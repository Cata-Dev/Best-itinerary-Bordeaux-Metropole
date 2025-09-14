import { Coords, euclideanDistance } from "@bibm/common/geographics";
import { dbSections as dbSectionsRaw } from "@bibm/data/models/TBM/sections.model";
import { Dijkstra } from "@catatomik/dijkstra";
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

/**
 * Makes graph from data, disconnected from data (no relation with shallow/deep copy)
 */
function makeGraph<N extends node = Section["s"]>(edges: ReturnType<makeComputeFpData>["edges"]) {
  const footGraph = new WeightedGraph<Section["s"] | N>();

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
 * Connect the largest component to all other disconnected components
 * @param footGraph The graph to connect
 * @param maxDist Maximal distance to connect two components (in meters), defaults to 1 km
 */
function connectFootGraph(
  edges: ReturnType<makeComputeFpData>["edges"],
  mappedSegments: MappedSegments,
  nodeCoords: Map<Section["s"], Coords>,
  footGraph: WeightedGraph<Section["s"]>,
  maxDist = 1e3,
) {
  type Component = Set<Section["s"]>;

  const components: Component[] = [];
  // Visited nodes
  const nodes = new Set(footGraph.nodesIterator);

  while (nodes.size > 0) {
    const node = nodes.values().next().value!;
    const component = Dijkstra(footGraph, [node])[0]
      .entries()
      .reduce<Component>((acc, [node, dist]) => (dist < Infinity ? acc.add(node) : acc), new Set());

    // Remove visited nodes
    for (const node of component) nodes.delete(node);

    // Add component
    components.push(component);
  }

  if (components.length <= 1) return [];

  const [largestComponent, otherComponents] = components
    .slice(1)
    .reduce<
      [Component, Component[]]
    >(([largestComponent, otherComponents], component) => (component.size > largestComponent.size ? [component, [...otherComponents, largestComponent]] : [largestComponent, [...otherComponents, component]]), [components[0], []]);

  const largestComponentMappedSegments: typeof mappedSegments = new Map(
    mappedSegments.entries().filter(([k]) => {
      const section = edges.get(k);
      if (!section) throw new Error(`Unable to retrieve section of ID ${k}`);

      if (largestComponent.has(section.s) || largestComponent.has(section.t)) return true;
      return false;
    }),
  );

  const connections: [
    start: Section["s"],
    end: Section["s"],
    target: Section["s"],
    approachedPoint: Exclude<ReturnType<typeof approachPoint>, null>,
    toTarget: number,
    fromTarget: number,
  ][] = [];

  for (const component of otherComponents) {
    // Get ends of minimal degree from the component
    // We will try to connect these ends to the largest component
    const ends = component.values().reduce<[number, Section["s"][]]>(
      ([minDeg, nodesOfMinDeg], node) => {
        const deg = footGraph.degree(node);

        return deg < minDeg
          ? [deg, [node]]
          : [minDeg, deg === minDeg ? [...nodesOfMinDeg, node] : nodesOfMinDeg];
      },
      [Infinity, []],
    )[1];

    for (const end of ends) {
      // Get end node coords
      const endCoords = nodeCoords.get(end);
      if (!endCoords) throw new Error(`Unable to retrieve coordinates for section end ${end}`);

      // Approach end
      const ap = approachPoint(largestComponentMappedSegments, endCoords, maxDist);
      if (!ap) continue;

      const { s, t } = edges.get(ap[2])!;

      const [toEnd, fromEnd] = distancesThroughAP(edges, ap);

      // Insert approached end
      footGraph.addEdge(s, end, toEnd);
      footGraph.addEdge(end, t, fromEnd);

      connections.push([s, t, end, ap, toEnd, fromEnd]);
    }
  }

  return connections;
}

type FootGraphNode = KeyOfMap<ReturnType<makeComputeFpData>["footGraphData"][0]>;

/**
 * Geometrically compute closest point to a set of segments
 * @param coords Coordinates to approach
 * @returns `[point, closest point, ID of edge containing this point, index of segment where point is projected]`
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
  connectFootGraph,
  importMappedSegments,
  makeGraph,
  refreshWithApproachedPoint,
  revertFromApproachedPoint,
  sectionsProjection,
};
export type { FootGraphNode, MappedSegments, Section };
