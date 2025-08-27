// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import { Coords } from "@bibm/common/geographics";
import { Logger } from "@bibm/common/logger";
import { ReadonlyDeep } from "@bibm/common/types";
import graphApproachedPointsModelInit, {
  GraphApproachedPoints,
} from "@bibm/data/models/Compute/GraphApproachedPoints";
import sectionsModelInit, { dbSections } from "@bibm/data/models/TBM/sections.model";
import { sep } from "node:path";
import { parentPort } from "node:worker_threads";
import { preComputeLogger } from ".";
import { app } from "../../base";
import {
  connectFootGraph,
  makeGraph,
  refreshWithApproachedPoint,
  Section,
  sectionsProjection,
} from "../../utils/foot/graph";
import Point from "../../utils/geometry/Point";
import Segment from "../../utils/geometry/Segment";
import { exportWGraph } from "../../utils/graph";
import { initDB } from "../../utils/mongoose";

if (parentPort) {
  const logger = new Logger(preComputeLogger, `[${(__filename.split(sep).pop() ?? "").split(".")[0]}]`);

  (async () => {
    logger.log("Making pre-computed computeFp job data...");

    const sourceDataDB = await initDB({ ...app, logger }, app.config.sourceDB);
    const sectionsModel = sectionsModelInit(sourceDataDB);
    const graphApproachedPointsModel = graphApproachedPointsModelInit(sourceDataDB);

    // Query graph data
    const edges = new Map<dbSections["_id"], Section>(
      (await sectionsModel.find({}, sectionsProjection).lean()).map<[number, Section]>(
        ({ _id, coords, distance, rg_fv_graph_nd: s, rg_fv_graph_na: t }) => [
          _id,
          { coords, distance, s, t } satisfies Section,
        ],
      ),
    );

    const mappedSegments = new Map(
      Array.from(edges.entries()).map(([id, edge]) => [
        id,
        edge.coords.reduce<Segment[]>(
          (acc, v, i) =>
            i >= edge.coords.length - 1
              ? acc
              : [...acc, new Segment(new Point(...v), new Point(...edge.coords[i + 1]))],
          [],
        ),
      ]),
    );

    // Compute coordinates for each node
    const nodeCoords = new Map<Section["s"], Coords>();
    for (const section of edges.values()) {
      if (!nodeCoords.has(section.s)) nodeCoords.set(section.s, section.coords[0]);
      if (!nodeCoords.has(section.t)) nodeCoords.set(section.t, section.coords[section.coords.length - 1]);
    }

    const footGraph = makeGraph<Section["s"]>(edges);

    logger.debug("Connecting foot graph...");
    const sectionsUpdated =
      (await sectionsModel.find({}).sort({ updatedAt: -1 }).limit(1))[0]?.updatedAt?.getTime() ?? -Infinity;
    const graphApproachedPointsUpdated =
      (
        await graphApproachedPointsModel.find({ type: "conn" }).sort({ updatedAt: -1 }).limit(1)
      )[0]?.updatedAt?.getTime() ?? 0;
    if (sectionsUpdated > graphApproachedPointsUpdated) {
      const connections = connectFootGraph(edges, mappedSegments, nodeCoords, footGraph);
      logger.debug(`Foot graph connected (+ ${connections.length * 2} edges). Saving...`);

      await graphApproachedPointsModel.deleteMany({ type: "conn" });
      if (connections.length)
        await graphApproachedPointsModel.bulkSave(
          connections.map(
            ([s, t, target, [_, approachedPoint, edge, cutIdx], distanceToTarget, distanceFromTarget]) =>
              new graphApproachedPointsModel({
                s,
                t,
                target,
                distanceToTarget,
                distanceFromTarget,
                approachedCoords: approachedPoint.export(),
                edge,
                cutIdx,
                type: "conn",
              } satisfies ReadonlyDeep<GraphApproachedPoints>),
          ),
        );
    } else {
      logger.debug("Using precomputed connections...");
      for await (const connection of graphApproachedPointsModel.find({ type: "conn" }).cursor())
        refreshWithApproachedPoint(edges, footGraph, connection.target, [
          Point.import(nodeCoords.get(connection.target as number)!),
          Point.import(connection.approachedCoords),
          connection.edge as dbSections["_id"],
          connection.cutIdx,
        ]);
      logger.debug(`Foot graph connected.`);
    }

    await sourceDataDB.close();

    logger.info("Pre-computed computeFp job data made.");

    parentPort.postMessage({
      edges,
      mappedSegmentsData:
        // Pre-generate mapped segments to fasten the process (and not redundant computing)
        // A segment describes a portion of an edge
        new Map(mappedSegments.entries().map(([k, v]) => [k, v.map((seg) => seg.export())])),
      footGraphData: exportWGraph(footGraph),
    } satisfies ReturnType<makeComputeFpData>);
  })().catch((err) => logger.warn("During computeFp job data pre-computation", err));
}

export type makeComputeFpData = () => {
  edges: Map<dbSections["_id"], Section>;
  mappedSegmentsData: Map<dbSections["_id"], ReturnType<InstanceType<typeof Segment>["export"]>[]>;
  footGraphData: ReturnType<typeof exportWGraph<dbSections["_id"]>>;
};
