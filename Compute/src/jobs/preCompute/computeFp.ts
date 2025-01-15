// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import { Logger } from "common/logger";
import sectionsModelInit, { dbSections } from "data/models/TBM/sections.model";
import { sep } from "node:path";
import { parentPort } from "node:worker_threads";
import { preComputeLogger } from ".";
import { app } from "../../base";
import { FootGraphNode, makeGraph, Section, sectionsProjection } from "../../utils/foot/graph";
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

    // Query graph data
    const edges = new Map<dbSections["_id"], Section>(
      (await sectionsModel.find({}, sectionsProjection).lean()).map<[number, Section]>(
        ({ _id, coords, distance, rg_fv_graph_nd: s, rg_fv_graph_na: t }) => [
          _id,
          { coords, distance, s, t } satisfies Section,
        ],
      ),
    );

    await sourceDataDB.close();

    logger.info("Pre-computed computeFp job data made.");

    parentPort.postMessage({
      edges,
      mappedSegmentsData:
        // Pre-generate mapped segments to fasten the process (and not redundant computing)
        // A segment describes a portion of an edge
        new Map(
          Array.from(edges.entries()).map(([id, edge]) => [
            id,
            edge.coords.reduce<ReturnType<InstanceType<typeof Segment>["export"]>[]>(
              (acc, v, i) =>
                i >= edge.coords.length - 1
                  ? acc
                  : [...acc, new Segment(new Point(...v), new Point(...edge.coords[i + 1])).export()],
              [],
            ),
          ]),
        ),
      footGraphData: exportWGraph(makeGraph<FootGraphNode>(edges)),
    } satisfies ReturnType<makeComputeFpData>);
  })().catch((err) => logger.warn("During computeFp job data pre-computation", err));
}

export type makeComputeFpData = () => {
  edges: Map<Section["s"], Section>;
  mappedSegmentsData: Map<Section["s"], ReturnType<InstanceType<typeof Segment>["export"]>[]>;
  footGraphData: ReturnType<typeof exportWGraph<FootGraphNode>>;
};
