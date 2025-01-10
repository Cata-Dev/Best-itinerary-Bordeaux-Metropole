import { Dijkstra, path, tracePath } from "@catatomik/dijkstra";
import { unpackGraphNode } from "@catatomik/dijkstra/lib/utils/Graph";
import { Duration } from "common/benchmark";
import nonScheduledRoutesModelInit, {
  approachedStopName,
  dbFootPaths,
} from "data/models/TBM/NonScheduledRoutes.model";
import sectionsModelInit from "data/models/TBM/sections.model";
import stopsModelInit from "data/models/TBM/TBM_stops.model";
import { JobFn, JobResult } from ".";
import { BaseApplication } from "../base";
import { limiter } from "../utils/asyncs";
import {
  approachPoint,
  FootGraphNode,
  makeFootStopsGraph,
  makeGraph,
  makeInitData,
  makePTNInitData,
  refreshWithApproachedPoint,
  revertFromApproachedPoint,
} from "../utils/foot/graph";
import { initDB } from "../utils/mongoose";

/**
 * Geographical point, WGS coordinates
 */
export type GeoPoint = [lat: number, long: number];

declare module "." {
  interface Jobs {
    // Foot path One-To-One
    computeFp: (ps: GeoPoint, pt: GeoPoint) => { distance: number; path: path<FootGraphNode<"aps" | "apt">> };
    // Foot path One-To-All (all being stops)
    computeFpOTA: (
      ps: GeoPoint,
      alias?: string,
      options?: Partial<{ maxDist: number; targetPTN: boolean }>,
    ) => { distances: Record<number, number>; alias?: string };
    // NonScheduledRoutes, all done by one processor - process could be parallelized,
    // but it would need a parallelized Dijkstra/graph
    // => long process, but it's expected
    computeNSR: (maxDist: number, getFullPaths?: boolean) => void;
  }
}

export default async function (app: BaseApplication) {
  const sourceDataDB = await initDB(app, app.config.sourceDB);

  const sectionsModel = sectionsModelInit(sourceDataDB);
  const stopsModel = stopsModelInit(sourceDataDB);

  // Queried cached data will be read-only : can be shared safely

  const graphData = makeInitData(sectionsModel);
  const graphPTNData = makePTNInitData(stopsModel);

  const graphCaches = [graphData, graphPTNData] as const;

  let edges: Awaited<ReturnType<(typeof graphData)["get"]>>[2]["edges"];
  let mappedSegments: Awaited<ReturnType<(typeof graphData)["get"]>>[2]["mappedSegments"];
  let stops: Awaited<ReturnType<(typeof graphPTNData)["get"]>>[2];

  // Query every cache and init
  for (const graphCache of graphCaches) {
    const data = (await graphCache.get())[2];
    if ("edges" in data) ({ edges, mappedSegments } = data);
    else if (data instanceof Map) stops = data;
  }

  const refreshData = async <C extends (typeof graphCaches)[number]>(
    cache: C,
    localLastUpdate: number,
  ): Promise<{ updated: boolean; localLastUpdate: number; data: Awaited<ReturnType<C["get"]>>[2] }> => {
    let updated = false;
    const [_, lastUpdate, data] = await cache.get();

    if (lastUpdate > localLastUpdate) {
      // Data is fresher than local (the one from the caller) one
      localLastUpdate = lastUpdate;
      updated = true;
    }

    return { updated, localLastUpdate, data };
  };

  return {
    fp: function fpInit() {
      let localLastUpdate = graphData.lastUpdate;
      // Graph private to One-To-One computations
      let footGraph = makeGraph<"aps" | "apt">(edges);

      return async ({ data: [ps, pt] }) => {
        const refreshed = await refreshData(graphData, localLastUpdate);
        if (refreshed.updated) {
          ({
            localLastUpdate,
            data: { edges, mappedSegments },
          } = refreshed);
          footGraph = makeGraph<"aps" | "apt">(edges);
        }

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
          }),
        );
      };
    } satisfies JobFn<"computeFp">,

    fpOTA: function fpOTAInit() {
      const localLastUpdate = new Map<(typeof graphCaches)[number], number>(
        graphCaches.map((cache) => [cache, cache.lastUpdate]),
      );
      // Graph private to One-To-All computations
      let footPTNGraph = makeFootStopsGraph<"aps">(edges, mappedSegments, stops);

      return async ({
        data: [ps, alias, { maxDist = 1e3, targetPTN = false } = { maxDist: 1e3, targetPTN: false }],
      }) => {
        // Data refresh
        const refreshed = await refreshData(graphData, localLastUpdate.get(graphData)!);
        if (refreshed.updated) {
          localLastUpdate.set(graphData, refreshed.localLastUpdate);
          ({
            data: { edges, mappedSegments },
          } = refreshed);
        }

        let refreshedPTN: Awaited<ReturnType<typeof refreshData<typeof graphPTNData>>> | null = null;
        if (targetPTN) {
          refreshedPTN = await refreshData(graphPTNData, localLastUpdate.get(graphPTNData)!);
          if (refreshedPTN.updated) {
            localLastUpdate.set(graphPTNData, refreshedPTN.localLastUpdate);
            ({ data: stops } = refreshedPTN);
          }
        }

        if (refreshed.updated || refreshedPTN?.updated)
          // Need to re-make (foot +/ PTN) graph
          footPTNGraph = makeFootStopsGraph(edges, mappedSegments, stops);

        // Approach points into foot graph
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
      };
    } satisfies JobFn<"computeFpOTA">,
    // Rarely used & can be slow : do not prepare a lot of things but init on-the-go
    computeNSR: function fpNSRInit() {
      const nonScheduledRoutesModel = nonScheduledRoutesModelInit(sourceDataDB);

      return async (job) => {
        // Refresh all data
        const {
          data: [maxDist, getFullPaths = false],
        } = job;
        ({
          data: { edges, mappedSegments },
        } = await refreshData(graphData, 0));
        ({ data: stops } = await refreshData(graphPTNData, 0));

        // Need to (re)make (foot +/ PTN) graph
        const footPTNGraph = makeFootStopsGraph(edges, mappedSegments, stops);

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
      };
    } satisfies JobFn<"computeNSR">,
  };
}
