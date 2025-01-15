// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import sectionsModelInit, { dbSections } from "data/models/TBM/sections.model";
import { parentPort } from "node:worker_threads";
import { app } from "../../base";
import { FootGraphNode, makeGraph, Section, sectionsProjection } from "../../utils/foot/graph";
import Point from "../../utils/geometry/Point";
import Segment from "../../utils/geometry/Segment";
import { exportWGraph } from "../../utils/graph";
import { initDB } from "../../utils/mongoose";

if (parentPort) {
  (async () => {
    app.logger.info("Making pre-computed computeFp job data...");

    const sourceDataDB = await initDB(app, app.config.sourceDB);
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

    app.logger.info("Pre-computed computeFp job data made.");

    parentPort.postMessage({
      edges,
      mappedSegments:
        // Pre-generate mapped segments to fasten the process (and not redundant computing)
        // A segment describes a portion of an edge
        new Map<dbSections["_id"], Segment[]>(
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
        ),
      footGraphData: exportWGraph(makeGraph<FootGraphNode>(edges)),
    } satisfies ReturnType<makeComputeFpData>);
  })().catch((err) => app.logger.warn("During computeFp job data pre-computation", err));
}

export type makeComputeFpData = () => {
  edges: Map<Section["s"], Section>;
  mappedSegments: Map<Section["s"], Segment[]>;
  footGraphData: ReturnType<typeof exportWGraph<FootGraphNode>>;
};
