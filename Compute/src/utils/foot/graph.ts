import { Coords, euclideanDistance } from "@bibm/common/geographics";
import { dbSections as dbSectionsRaw } from "@bibm/data/models/TBM/sections.model";
import { KeyOfMap, node, WeightedGraph } from "@catatomik/dijkstra/lib/utils/Graph";
import { ProjectionType } from "mongoose";
import type { makeComputeFpData } from "../../jobs/preCompute/computeFp";
import Point from "../geometry/Point";
import Segment from "../geometry/Segment";

const sectionsProjection = {
  _id: 1,
  coords: 1,
  distance: 1,
  rg_fv_graph_nd: 1,
  rg_fv_graph_na: 1,
} satisfies ProjectionType<dbSectionsRaw>;
type dbSections = Pick<dbSectionsRaw, keyof typeof sectionsProjection>;
interface SectionOverwritten {
  // Remove it
  _id?: never;
  // Rename them
  rg_fv_graph_nd?: never;
  rg_fv_graph_na?: never;
  // Will never be populated
  s: dbSectionsRaw["rg_fv_graph_nd"];
  t: dbSectionsRaw["rg_fv_graph_na"];
}
// Equivalent to an Edge
type Section = Omit<dbSections, keyof SectionOverwritten> & SectionOverwritten;

type FootGraphNode = Section["s"];

/**
 * Makes graph from data, disconnected from data (no relation with shallow/deep copy)
 */
function makeGraph<N extends node = FootGraphNode>(edges: ReturnType<makeComputeFpData>["edges"]) {
  const footGraph = new WeightedGraph<FootGraphNode | N>();

  for (const { s, t, distance } of edges.values()) {
    footGraph.addEdge(s, t, distance);
  }

  return footGraph;
}

type MappedSegments = Map<KeyOfMap<ReturnType<makeComputeFpData>["mappedSegmentsData"]>, Segment[]>;

function importMappedSegments(mappedSegmentsData: ReturnType<makeComputeFpData>["mappedSegmentsData"]) {
  return new Map(
    Array.from(mappedSegmentsData.entries()).map(([key, value]) => [
      key,
      value.map((val) => Segment.import(val)),
    ]),
  );
}

/**
 *
 * @param coords
 * @returns `[closest point, edge containing this point, indice of segment composing the edge]`
 */
function approachPoint(
  mappedSegments: MappedSegments,
  coords: Coords,
): [stopPoint: Point, edge: Section["s"], segIdx: number] | null {
  const point = new Point(...coords);

  /**@description [distance to closest point, closest point, edge containing this point, indice of segment composing the edge (i;i+1 in Section coords)] */
  const closestPoint: [number, Point | null, Section["s"] | null, number | null] = [
    Infinity,
    null,
    null,
    null,
  ];

  for (const [edge, segs] of mappedSegments) {
    for (const [n, seg] of segs.entries()) {
      const localClosestPoint = seg.closestPointFromPoint(point);
      const distance = Point.distance(point, localClosestPoint);
      if (distance < closestPoint[0]) {
        closestPoint[0] = distance;
        closestPoint[1] = localClosestPoint;
        closestPoint[2] = edge;
        closestPoint[3] = n;
      }
    }
  }

  // Max distance to closest segment (section)
  return closestPoint[0] < 1e3 && closestPoint[2] !== null && closestPoint[3] !== null
    ? [point, closestPoint[2], closestPoint[3]]
    : null;
}

/**
 * Pushes approached point into graph, just like a proxy on a edge
 * Only reads all parameters
 * @returns Name of point added to graph
 */
function refreshWithApproachedPoint<N extends node>(
  edges: ReturnType<makeComputeFpData>["edges"],
  footGraph: WeightedGraph<FootGraphNode | N>,
  name: N,
  [point, edgeId, n]: Exclude<ReturnType<typeof approachPoint>, null>,
) {
  const { coords, s, t } = edges.get(edgeId)!;

  // Compute distance from start edge to approachedStop
  const toStop: number =
    coords.reduce((acc, v, i, arr) => {
      if (i < n && i < arr.length - 1) return acc + euclideanDistance(...v, ...arr[i + 1]);
      return acc;
    }, 0) +
    // From last segment end to real stop
    Point.distance(new Point(...coords[n]), point);

  // Compute distance from approachedStop to end edge
  const fromStop: number =
    // From real stop to next segment start
    Point.distance(point, new Point(...coords[n + 1])) +
    coords.reduce((acc, v, i, arr) => {
      if (i > n && i < arr.length - 1) return acc + euclideanDistance(...v, ...arr[i + 1]);
      return acc;
    }, 0);

  footGraph.addEdge(s, name, toStop);
  footGraph.addEdge(name, t, fromStop);

  return;
}

function revertFromApproachedPoint<N extends node>(
  edges: ReturnType<makeComputeFpData>["edges"],
  footGraph: WeightedGraph<FootGraphNode | N>,
  insertedNode: N,
  edgeId: dbSections["_id"],
) {
  const { s, t } = edges.get(edgeId)!;

  footGraph.removeEdge(insertedNode, t);
  footGraph.removeEdge(s, insertedNode);
}

export {
  approachPoint,
  importMappedSegments,
  makeGraph,
  refreshWithApproachedPoint,
  revertFromApproachedPoint,
  sectionsProjection,
};
export type { FootGraphNode, MappedSegments, Section };
