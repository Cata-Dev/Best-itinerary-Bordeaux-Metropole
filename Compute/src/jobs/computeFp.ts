import { Dijkstra, path, tracePath } from "@catatomik/dijkstra";
import { unpackGraphNode } from "@catatomik/dijkstra/lib/utils/Graph";
import { Duration } from "common/benchmark";
import nonScheduledRoutesModelInit, {
  approachedStopName,
  dbFootPaths,
} from "data/lib/models/TBM/NonScheduledRoutes.model";
import sectionsModelInit from "data/lib/models/TBM/sections.model";
import stopsModelInit from "data/lib/models/TBM/TBM_stops.model";
import { JobFn, JobResult } from ".";
import { BaseApplication } from "../base";
import { limiter } from "../utils/asyncs";
import {
  approachPoint,
  FootGraphNode,
  initData,
  makeFootStopsGraph,
  makeGraph,
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
      options?: { maxDist: number },
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

  const queryData = initData(sectionsModel);

  return {
    fp: async function fpInit() {
      let { edges, mappedSegments, updated } = await queryData();
      // Graph private to One-To-One computations
      let footGraph = makeGraph<"aps" | "apt">(edges);

      return async ({ data: [ps, pt] }) => {
        ({ edges, mappedSegments, updated } = await queryData());
        if (updated)
          // Need to re-make foot graph
          footGraph = makeGraph<"aps" | "apt">(edges);

        // Approach points into foot graph
        const aps = approachPoint(mappedSegments, ps);
        if (!aps) throw new Error("Couldn't approach starting point.");
        const apt = approachPoint(mappedSegments, pt);
        if (!apt) throw new Error("Couldn't approach target point.");

        refreshWithApproachedPoint(edges, footGraph, "aps", aps);
        refreshWithApproachedPoint(edges, footGraph, "apt", apt);

        const path = Dijkstra(footGraph, [
          "aps" as unpackGraphNode<typeof footGraph>,
          "apt" as unpackGraphNode<typeof footGraph>,
        ]);

        // In reverted order!
        revertFromApproachedPoint(edges, footGraph, "apt", apt[1]);
        revertFromApproachedPoint(edges, footGraph, "aps", aps[1]);

        return new Promise<JobResult<"computeFp">>((res) =>
          res({
            distance: path.reduce<number>(
              (acc, node, i, arr) => (i === arr.length - 1 ? acc : acc + footGraph.weight(node, arr[i + 1])),
              0,
            ),
            path,
          }),
        );
      };
    } satisfies JobFn<"computeFp">,

    fpOTA: async function fpOTAInit() {
      let { edges, mappedSegments, updated } = await queryData();
      // Graph private to One-To-All computations
      let footGraph = makeGraph<"aps" | "apt">(edges);

      return async ({ data: [ps, alias, { maxDist } = { maxDist: 1e3 }] }) => {
        ({ edges, mappedSegments, updated } = await queryData());
        if (updated)
          // Need to re-make foot graph
          footGraph = makeGraph<"aps">(edges);

        // Approach points into foot graph
        const aps = approachPoint(mappedSegments, ps);
        if (!aps) throw new Error("Couldn't approach starting point.");

        refreshWithApproachedPoint(edges, footGraph, "aps", aps);

        const [dist] = Dijkstra(footGraph, ["aps" as unpackGraphNode<typeof footGraph>], {
          maxCumulWeight: maxDist,
        });

        revertFromApproachedPoint(edges, footGraph, "aps", aps[1]);

        return new Promise<JobResult<"computeFpOTA">>((res) =>
          res({
            distances:
              // Keep only distances to approached stops
              Array.from(dist.entries()).reduce(
                (acc, [node, dist]) =>
                  !isNaN(parseInt(`${dist}`)) && typeof node === "number" ? { ...acc, [node]: dist } : acc,
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
      const stopsModel = stopsModelInit(sourceDataDB);

      return async (job) => {
        const {
          data: [maxDist, getFullPaths = false],
        } = job;
        const { stops, graph } = await makeFootStopsGraph(sectionsModel, stopsModel);

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
            graph,
            [approachedStopName(stopId) as unpackGraphNode<typeof graph>],
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
