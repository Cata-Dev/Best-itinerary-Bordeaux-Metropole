// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import { Logger } from "@bibm/common/logger";
import { ReadonlyDeep } from "@bibm/common/types";
import graphApproachedPointsModelInit, {
  GraphApproachedPoints,
} from "@bibm/data/models/Compute/GraphApproachedPoints.model";
import { approachedStopName, PathStep } from "@bibm/data/models/TBM/NonScheduledRoutes.model";
import stopsModelInit, { dbTBM_Stops } from "@bibm/data/models/TBM/TBM_stops.model";
import { WeightedGraph } from "@catatomik/dijkstra/lib/utils/Graph";
import { sep } from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import { preComputeLogger } from ".";
import { app } from "../../base";
import { approachPoint, importMappedSegments, refreshWithApproachedPoint } from "../../utils/foot/graph";
import Point from "../../utils/geometry/Point";
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

if (parentPort) {
  const logger = new Logger(preComputeLogger, `[${(__filename.split(sep).pop() ?? "").split(".")[0]}]`);

  (async () => {
    logger.log("Making pre-computed computePTN job data...");

    const sourceDataDB = await initDB({ ...app, logger }, app.config.sourceDB);
    const stopsModel = stopsModelInit(sourceDataDB);
    const graphApproachedPointsModel = graphApproachedPointsModelInit(sourceDataDB);

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
    const graph = importWGraph(footGraphData) as WeightedGraph<PathStep>;

    // Approach stops & insert
    logger.debug("Approaching stops in foot graph...");
    const stopsUpdated =
      (await stopsModel.find({}).sort({ updatedAt: -1 }).limit(1))[0]?.updatedAt?.getTime() ?? -Infinity;
    const graphApproachedPointsUpdated =
      (
        await graphApproachedPointsModel.find({ type: "as" }).sort({ updatedAt: -1 }).limit(1)
      )[0]?.updatedAt?.getTime() ?? 0;
    if (stopsUpdated > graphApproachedPointsUpdated) {
      const approachedPoints: [
        target: ReturnType<typeof approachedStopName>,
        ap: Exclude<ReturnType<typeof approachPoint>, null>,
        toTarget: number,
        fromTarget: number,
      ][] = [];
      for (const [stopId, { coords }] of stops) {
        const ap = approachPoint(mappedSegments, coords);
        if (!ap) continue;

        const newNodeName = approachedStopName(stopId);
        const [distanceToTarget, distanceFromTarget] = refreshWithApproachedPoint(
          edges,
          graph,
          newNodeName,
          ap,
        );
        approachedPoints.push([newNodeName, ap, distanceToTarget, distanceFromTarget]);
      }

      await graphApproachedPointsModel.deleteMany({ type: "as" });
      if (approachedPoints.length)
        await graphApproachedPointsModel.bulkSave(
          approachedPoints.map(
            ([target, [_, approachedPoint, edge, cutIdx], distanceToTarget, distanceFromTarget]) => {
              const { s, t } = edges.get(edge)!;

              return new graphApproachedPointsModel({
                s,
                t,
                target,
                distanceToTarget,
                distanceFromTarget,
                approachedCoords: approachedPoint.export(),
                edge,
                cutIdx,
                type: "as",
              } satisfies ReadonlyDeep<GraphApproachedPoints>);
            },
          ),
        );
    } else {
      logger.debug("Using precomputed approached points...");
      for await (const connection of graphApproachedPointsModel.find({ type: "as" }).cursor())
        refreshWithApproachedPoint(edges, graph, connection.target, [
          Point.import(
            stops.get(parseInt((connection.target as ReturnType<typeof approachedStopName>).substring(3)))!
              .coords,
          ),
          Point.import(connection.approachedCoords),
          connection.edge as Exclude<ReturnType<typeof approachPoint>, null>[2],
          connection.cutIdx,
        ]);
    }
    logger.debug("Approached stops inserted.");

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
  footPTNGraphData: ReturnType<typeof exportWGraph<PathStep>>;
};
