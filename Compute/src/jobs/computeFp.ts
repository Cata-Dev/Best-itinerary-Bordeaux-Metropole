import { Dijkstra, path, tracePath } from "@catatomik/dijkstra";
import { unpackGraphNode, WeightedGraph } from "@catatomik/dijkstra/lib/utils/Graph";
import { Duration } from "common/benchmark";
import { Coords } from "common/geographics";
import nonScheduledRoutesModelInit, {
  approachedStopName,
  dbFootPaths,
  dbFootPathsModel,
} from "data/models/TBM/NonScheduledRoutes.model";
import { dbSections } from "data/models/TBM/sections.model";
import { JobResult, Processor } from ".";
import { BaseApplication } from "../base";
import { limiter } from "../utils/asyncs";
import { Computer } from "../utils/Computer";
import {
  approachPoint,
  FootGraphNode,
  refreshWithApproachedPoint,
  revertFromApproachedPoint,
} from "../utils/foot/graph";
import { importWGraph } from "../utils/graph";
import { initDB } from "../utils/mongoose";
import type { makeComputeFpData } from "./preCompute/computeFp";
import { makeComputePTNData, PTNGraphNode } from "./preCompute/computePTN";

/**
 * Approached point details, to make the link without a graph
 */
export interface APDetails {
  sectionId: dbSections["_id"];
  idx: number;
}

declare module "." {
  interface Jobs {
    // Foot path One-To-One
    computeFp: (
      ps: Coords,
      pt: Coords,
    ) => {
      distance: number;
      path: path<FootGraphNode | "aps" | "apt">;
      apDetails: [aps: APDetails, apt: APDetails];
    };
    // Foot path One-To-All (all being stops)
    computeFpOTA: (
      ps: Coords,
      alias?: string,
      options?: Partial<{ maxDist: number; targetPTN: boolean }>,
    ) => { distances: Record<number, number>; alias?: string };
    // NonScheduledRoutes, all done by one processor - process could be parallelized,
    // but it would need a parallelized Dijkstra/graph
    // => long process, but it's expected
    computeNSR: (maxDist: number, getFullPaths?: boolean) => void;
  }
}

export default async function (
  app: BaseApplication,
  graphData: ReturnType<makeComputeFpData>,
  graphPTNData: ReturnType<makeComputePTNData>,
) {
  const sourceDataDB = await initDB(app, app.config.sourceDB);

  const fp = new Computer<"computeFp", typeof graphData, WeightedGraph<FootGraphNode | "aps" | "apt">>(
    ({ edges, mappedSegments }, footGraph, { data: [ps, pt] }) => {
      // Approach points into foot graph
      const aps = approachPoint(mappedSegments, ps);
      if (!aps) throw new Error("Couldn't approach starting point.");
      const apt = approachPoint(mappedSegments, pt);
      if (!apt) throw new Error("Couldn't approach target point.");

      refreshWithApproachedPoint(edges, footGraph, "aps", aps);
      refreshWithApproachedPoint(edges, footGraph, "apt", apt);

      const path = Dijkstra<unpackGraphNode<typeof footGraph>>(footGraph, ["aps", "apt"]);
      const distance = path.reduce<number>(
        (acc, node, i, arr) => (i === arr.length - 1 ? acc : acc + footGraph.weight(node, arr[i + 1])),
        0,
      );

      // In reverted order!
      revertFromApproachedPoint(edges, footGraph, "apt", apt[1]);
      revertFromApproachedPoint(edges, footGraph, "aps", aps[1]);

      return new Promise<JobResult<"computeFp">>((res) =>
        res({
          distance,
          path,
          apDetails: [
            {
              sectionId: aps[1],
              idx: aps[2],
            },

            {
              sectionId: apt[1],
              idx: apt[2],
            },
          ],
        }),
      );
    },
    graphData,
    ({ footGraphData }) => importWGraph(footGraphData),
  );

  const fpOTA = new Computer<
    "computeFpOTA",
    typeof graphData & typeof graphPTNData,
    WeightedGraph<PTNGraphNode | "aps">
  >(
    (
      { edges, mappedSegments },
      footPTNGraph,
      { data: [ps, alias, { maxDist = 1e3, targetPTN = false } = { maxDist: 1e3, targetPTN: false }] },
    ) => {
      const aps = approachPoint(mappedSegments, ps);
      if (!aps) throw new Error("Couldn't approach starting point.");

      refreshWithApproachedPoint(edges, footPTNGraph, "aps", aps);

      const [dist] = Dijkstra(footPTNGraph, ["aps" as unpackGraphNode<typeof footPTNGraph>], {
        maxCumulWeight: maxDist,
      });

      revertFromApproachedPoint(edges, footPTNGraph, "aps", aps[1]);

      // Keep only distances right target
      const nodeCond = targetPTN
        ? (node: (typeof footPTNGraph)["nodes"][number]): node is ReturnType<typeof approachedStopName> =>
            // Is approached stop
            typeof node === "string" && node.startsWith("as=")
        : (node: (typeof footPTNGraph)["nodes"][number]): node is FootGraphNode =>
            // Is intersection
            typeof node === "number";

      return new Promise<JobResult<"computeFpOTA">>((res) =>
        res({
          distances: Array.from(dist.entries()).reduce<JobResult<"computeFpOTA">["distances"]>(
            (acc, [node, dist]) =>
              dist < Infinity && nodeCond(node)
                ? { ...acc, [typeof node === "string" ? parseInt(node.substring(3)) : node]: dist }
                : acc,
            {},
          ),
          alias,
        }),
      );
    },
    {
      ...graphData,
      ...graphPTNData,
    },
    ({ footPTNGraphData }) => importWGraph(footPTNGraphData),
  );

  const NSR = new Computer<
    "computeNSR",
    typeof graphData &
      typeof graphPTNData & {
        nonScheduledRoutesModel: dbFootPathsModel;
      },
    WeightedGraph<PTNGraphNode>
  >(
    async ({ stops, nonScheduledRoutesModel }, footPTNGraph, job) => {
      const {
        data: [maxDist, getFullPaths = false],
      } = job;

      // Compute all paths

      // Update db
      await nonScheduledRoutesModel.deleteMany({});

      // Log every x percent
      const LOG_EVERY = 5;
      // Limit pending inserts to 10k
      const lim = limiter(10e3);
      let stopsTreatedCount = 0;
      let NSRInsertedCount = 0;
      let lastChunkInsertLogTime = Date.now();

      for (const stopId of stops.keys()) {
        const [dist, prev] = Dijkstra(
          footPTNGraph,
          [approachedStopName(stopId) as unpackGraphNode<typeof footPTNGraph>],
          {
            maxCumulWeight: maxDist,
          },
        );

        const toInsert = Array.from(stops.keys()).reduce<dbFootPaths[]>((acc, to) => {
          if (to === stopId) return acc;

          const stopNode = approachedStopName(to);
          const distance = dist.get(stopNode);
          if (distance === undefined || distance === Infinity) return acc;

          acc.push({
            from: stopId,
            to,
            distance,
            path: getFullPaths ? tracePath(prev, stopNode) : undefined,
          });

          return acc;
        }, []);

        const prom = nonScheduledRoutesModel.insertMany(toInsert, { ordered: false, rawResult: true });
        prom
          .then((inserted) => {
            stopsTreatedCount++;
            NSRInsertedCount += inserted.insertedCount;
            if (stopsTreatedCount % Math.round((stops.size / 100) * LOG_EVERY) === 0) {
              const newTime = Date.now();
              const progress = Math.round((stopsTreatedCount / stops.size) * 1000) / 10;
              job.updateProgress(progress).catch(app.logger.error);
              app.logger.debug(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `Inserting to NSR done at ${progress}%, inserted NSR : ${NSRInsertedCount}. Time since last ${LOG_EVERY}% compute & insert : ${new Duration(newTime - lastChunkInsertLogTime)}`,
              );
              lastChunkInsertLogTime = newTime;
            }
          })
          .catch((err) => app.logger.error("Cannot insert to NSR", err));

        await lim(prom, toInsert.length);
      }
    },
    {
      ...graphData,
      ...graphPTNData,
      nonScheduledRoutesModel: nonScheduledRoutesModelInit(sourceDataDB),
    },
    ({ footPTNGraphData }) => importWGraph(footPTNGraphData),
  );

  const updateFpData = (data: typeof graphData) => {
    fp.updateData(data);
    fpOTA.updateData(data);
    NSR.updateData(data);
  };

  const updatePTNData = (data: typeof graphPTNData) => {
    fpOTA.updateData(data);
    NSR.updateData(data);
  };

  return {
    fp: (...args: Parameters<Processor<"computeFp">>) => fp.compute(...args),
    fpOTA: (...args: Parameters<Processor<"computeFpOTA">>) => fpOTA.compute(...args),
    // Rarely used & can be slow : do not prepare a lot of things but init on-the-go
    computeNSR: (...args: Parameters<Processor<"computeNSR">>) => NSR.compute(...args),
    updateFpData,
    updatePTNData,
  };
}
