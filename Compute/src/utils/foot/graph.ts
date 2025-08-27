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
  maxDist = 1e3,
): [stopPoint: Point, approachedPoint: Point, edgeId: dbSectionsRaw["_id"], segIdx: number] | null {
  const point = new Point(...coords);

  /**@description [distance to closest point, closest point, edge containing this point, indice of segment composing the edge (i;i+1 in Section coords)] */
  const closestPoint = [Infinity, null, null, null] as
    | [distance: number, closesPoint: null, edgeId: null, segIdx: null]
    | [distance: number, closesPoint: Point, edgeId: dbSectionsRaw["_id"], segIdx: number];

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

  return closestPoint[1] !== null && closestPoint[0] < maxDist
    ? [point, closestPoint[1], closestPoint[2], closestPoint[3]]
    : null;
}

function distancesThroughAP(
  edges: ReturnType<makeComputeFpData>["edges"],
  [point, approachedPoint, edgeId, n]: Exclude<ReturnType<typeof approachPoint>, null>,
) {
  const { coords } = edges.get(edgeId)!;

  return [
    // Compute distance from start edge to approached stop
    coords
      .slice(0, n + 1)
      .reduce(
        (acc, v, i, arr) => (i < arr.length - 1 ? acc + euclideanDistance(...v, ...arr[i + 1]) : acc),
        0,
      ) +
      // From last segment end to approached stop
      Point.distance(new Point(...coords[n]), approachedPoint) +
      // From approached stop to real stop
      Point.distance(approachedPoint, point),
    // Compute distance from approached stop to end edge
    // From real stop to approached stop
    Point.distance(point, approachedPoint) +
      // From approached stop to next segment start
      Point.distance(approachedPoint, new Point(...coords[n + 1])) +
      coords
        .slice(n + 1)
        .reduce(
          (acc, v, i, arr) => (i < arr.length - 1 ? acc + euclideanDistance(...v, ...arr[i + 1]) : acc),
          0,
        ),
  ];
}

/**
 * Pushes approached point into graph, just like a proxy on an edge.
 * Only reads all parameters.
 *
 * ```
 *      n, point
 * .-----^---. edgeId
 *  ~    |  ~
 *   ~   |  ~
 *    ~  | ~  inserted virtual edges
 *     ~ | ~
 *       X real stop, coords, inserted node
 * ```
 */
function refreshWithApproachedPoint<N extends node>(
  edges: ReturnType<makeComputeFpData>["edges"],
  footGraph: WeightedGraph<FootGraphNode | N>,
  name: N,
  ap: Exclude<ReturnType<typeof approachPoint>, null>,
) {
  // Compute distance from start edge to approached stop
  const [toStop, fromStop] = distancesThroughAP(edges, ap);

  const { s, t } = edges.get(ap[2])!;

  footGraph.addEdge(s, name, toStop);
  footGraph.addEdge(name, t, fromStop);

  return [toStop, fromStop];
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
