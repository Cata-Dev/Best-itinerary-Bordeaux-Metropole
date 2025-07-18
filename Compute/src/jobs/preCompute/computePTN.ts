// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import { Logger } from "@bibm/common/logger";
import { approachedStopName } from "@bibm/data/models/TBM/NonScheduledRoutes.model";
import stopsModelInit, { dbTBM_Stops } from "@bibm/data/models/TBM/TBM_stops.model";
import { WeightedGraph } from "@catatomik/dijkstra/lib/utils/Graph";
import { sep } from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import { preComputeLogger } from ".";
import { app } from "../../base";
import {
  approachPoint,
  FootGraphNode,
  importMappedSegments,
  refreshWithApproachedPoint,
} from "../../utils/foot/graph";
import { exportWGraph, importWGraph } from "../../utils/graph";
import { initDB } from "../../utils/mongoose";
import { makeComputeFpData } from "./computeFp";

const stopProjection = { _id: 1, coords: 1 } satisfies Partial<Record<keyof dbTBM_Stops, 1>>;
type dbStops = Pick<dbTBM_Stops, keyof typeof stopProjection>;
interface StopOverwritten {
  // Remove it
  _id?: never;
}
// Equivalent to an Edge
type Stop = Omit<dbStops, keyof StopOverwritten> & StopOverwritten;

export type PTNGraphNode = FootGraphNode | ReturnType<typeof approachedStopName>;

if (parentPort) {
  const logger = new Logger(preComputeLogger, `[${(__filename.split(sep).pop() ?? "").split(".")[0]}]`);

  (async () => {
    logger.log("Making pre-computed computePTN job data...");

    const sourceDataDB = await initDB({ ...app, logger }, app.config.sourceDB);
    const stopsModel = stopsModelInit(sourceDataDB);

    // Retrieve already computed data
    const [{ edges, mappedSegmentsData, footGraphData }] = workerData as Parameters<makeComputePTNData>;
    const mappedSegments = importMappedSegments(mappedSegmentsData);

    // Make required data
    const stops = new Map<dbStops["_id"], Stop>(
      (
        await stopsModel
          .find(
            {
              $and: [{ coords: { $not: { $elemMatch: { $eq: Infinity } } } }],
            },
            stopProjection,
          )
          .lean()
      ).map((s) => [s._id, { coords: s.coords }]),
    );

    // Make graph
    const graph = importWGraph(footGraphData) as WeightedGraph<PTNGraphNode>;

    // Approach stops & insert
    for (const [stopId, { coords }] of stops) {
      const ap = approachPoint(mappedSegments, coords);
      if (ap) refreshWithApproachedPoint(edges, graph, approachedStopName(stopId), ap);
    }

    await sourceDataDB.close();

    logger.info("Pre-computed computePTN job data made.");

    parentPort.postMessage({
      stops,
      footPTNGraphData: exportWGraph(graph),
    } satisfies ReturnType<makeComputePTNData>);
  })().catch((err) => logger.warn("During computePTN job data pre-computation", err));
}

export type makeComputePTNData = (computeFpData: ReturnType<makeComputeFpData>) => {
  stops: Map<dbStops["_id"], Stop>;
  footPTNGraphData: ReturnType<typeof exportWGraph<PTNGraphNode>>;
};
