import { WeightedGraph } from "@catatomik/dijkstra/lib/utils/Graph";
import { Dijkstra, path } from "@catatomik/dijkstra";
import footGraphModelInit, { dbFootGraphEdges } from "data/lib/models/TBM/FootGraph.model";
import { euclideanDistance } from "common/geographics";
import { JobFn, JobResult } from ".";
import { BaseApplication } from "../base";
import { initDB } from "../utils/mongoose";
import { unpackRefType } from "../utils";
import Segment from "../utils/geometry/Segment";
import Point from "../utils/geometry/Point";

/**
 * Geographical point, WGS coordinates
 */
export type GeoPoint = [lat: number, long: number];

declare module "." {
  interface Jobs {
    // Foot path One-To-One
    computeFp: (ps: GeoPoint, pt: GeoPoint) => { distance: number; path: path<FootGraphNode> };
    // Foot path One-To-All (all being stops)
    computeFpOTA: (
      ps: GeoPoint,
      alias?: string,
      // TODO : use it
      options?: { maxDist: number },
    ) => { distances: Record<number, number>; alias?: string };
  }
}

export function approachedPointName(name: string) {
  return `ap-${name}` as const;
}

interface EdgeOverwritten {
  // Will never be populated
  ends: [unpackRefType<dbFootGraphEdges["ends"][0]>, unpackRefType<dbFootGraphEdges["ends"][1]>];
}
type Edge = Omit<dbFootGraphEdges, keyof EdgeOverwritten> & EdgeOverwritten;

type FootGraphNode = Edge["ends"][0] | ReturnType<typeof approachedPointName>;

export default async function (app: BaseApplication) {
  const sourceDataDB = await initDB(app, app.config.sourceDataDB);

  const FootGraphEdgesModel = footGraphModelInit(sourceDataDB)[2];

  // Query graph data
  const edges = new Map<dbFootGraphEdges["_id"], Edge>(
    (await FootGraphEdgesModel.find({}).lean().exec()).map((s) => [s._id, s as Edge]),
  );

  // Pre-generate mapped segments to fasten the process (and not redundant computing)
  // A segment describes a portion of an edge
  const mappedSegments = new Map<dbFootGraphEdges["_id"], Segment[]>();
  for (const [id, edge] of edges) {
    mappedSegments.set(
      id,
      edge.coords.reduce<Segment[]>(
        (acc, v, i) =>
          i >= edge.coords.length - 1
            ? acc
            : [...acc, new Segment(new Point(...v), new Point(...edge.coords[i + 1]))],
        [],
      ),
    );
  }

  // Build graph
  const makeGraph = () => {
    const footGraph = new WeightedGraph<FootGraphNode>();

    for (const {
      ends: [s, t],
      distance,
    } of edges.values()) {
      footGraph.addEdge(s, t, distance);
    }

    return footGraph;
  };

  /**
   *
   * @param coords
   * @returns `[closest point, edge containing this point, indice of segment composing the edge]`
   */
  const approachPoint = (coords: [number, number]): [Point, dbFootGraphEdges["_id"], number] | null => {
    const point = new Point(...coords);

    /**@description [distance to closest point, closest point, edge containing this point, indice of segment composing the edge (i;i+1 in Section coords)] */
    const closestPoint: [number, Point | null, dbFootGraphEdges["_id"] | null, number | null] = [
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

    return closestPoint[0] < 10e3 &&
      closestPoint[1] !== null &&
      closestPoint[2] !== null &&
      closestPoint[3] !== null
      ? [closestPoint[1], closestPoint[2], closestPoint[3]]
      : null;
  };

  /**
   * Pushes approached point into graph, just like a proxy on a edge
   * @returns Name of point added to graph
   */
  const refreshWithApproachedPoint = (
    footGraph: WeightedGraph<FootGraphNode>,
    name: string,
    [closestPoint, edgeId, n]: Exclude<ReturnType<typeof approachPoint>, null>,
  ) => {
    const {
      coords,
      ends: [s, t],
    } = edges.get(edgeId)!;

    // Compute distance from start edge to approachedStop
    const toApproachedStop: number =
      coords.reduce((acc, v, i, arr) => {
        if (i < n && i < arr.length - 1) return acc + euclideanDistance(...v, ...arr[i + 1]);
        return acc;
      }, 0) + Point.distance(closestPoint, new Point(...coords[n]));

    // Compute distance form approachedStop to end edge
    const fromApproachedStop: number =
      coords.reduce((acc, v, i, arr) => {
        if (i > n && i < arr.length - 1) return acc + euclideanDistance(...v, ...arr[i + 1]);
        return acc;
      }, 0) + Point.distance(closestPoint, new Point(...coords[n]));

    // Remove edge from p1 to p2
    footGraph.removeEdge(s, t);

    const insertedNode = approachedPointName(name);

    footGraph.addEdge(s, insertedNode, toApproachedStop);
    footGraph.addEdge(insertedNode, t, fromApproachedStop);

    return insertedNode;
  };

  const revertFromApproachedPoint = (
    footGraph: WeightedGraph<FootGraphNode>,
    insertedNode: ReturnType<typeof approachedPointName>,
    edgeId: dbFootGraphEdges["_id"],
  ) => {
    const {
      distance,
      ends: [s, t],
    } = edges.get(edgeId)!;

    footGraph.removeEdge(insertedNode, t);
    footGraph.removeEdge(s, insertedNode);
    footGraph.addEdge(s, t, distance);
  };

  return {
    fp: function fpInit() {
      // Graph private to One-To-One computations
      const footGraph = makeGraph();

      return ({ data: [ps, pt] }) => {
        // Approach points into foot graph
        const aps = approachPoint(ps);
        if (!aps) throw new Error("Couldn't approach starting point.");
        const apt = approachPoint(pt);
        if (!apt) throw new Error("Couldn't approach target point.");

        const apsName = refreshWithApproachedPoint(footGraph, "aps", aps);
        const aptName = refreshWithApproachedPoint(footGraph, "apt", apt);

        const path = Dijkstra(footGraph, [apsName as FootGraphNode, aptName as FootGraphNode]);

        revertFromApproachedPoint(footGraph, apsName, aps[1]);
        revertFromApproachedPoint(footGraph, aptName, apt[1]);

        return new Promise<JobResult<"computeFp">>((res) =>
          res({
            distance: path.reduce(
              (acc, node, i, arr) => (i === arr.length - 1 ? acc : acc + footGraph.weight(node, arr[i + 1])),
              0,
            ),
            path,
          }),
        );
      };
    } satisfies JobFn<"computeFp">,

    fpOTA: function fpOTAInit() {
      // Graph private to One-To-All computations
      const footGraph = makeGraph();

      return ({ data: [ps, alias, options = { maxDist: 1e3 }] }) => {
        // Approach points into foot graph
        const aps = approachPoint(ps);
        if (!aps) throw new Error("Couldn't approach starting point.");

        const apsName = refreshWithApproachedPoint(footGraph, "aps", aps);

        const [dist] = Dijkstra(footGraph, [apsName as FootGraphNode], { maxCumulWeight: options.maxDist });

        revertFromApproachedPoint(footGraph, apsName, aps[1]);

        return new Promise<JobResult<"computeFpOTA">>((res) =>
          res({
            distances:
              // Keep only distances to approached stops
              Array.from(dist.entries()).reduce(
                (acc, [node, dist]) =>
                  !isNaN(parseInt(`${dist}`)) && node.startsWith("as")
                    ? { ...acc, [node.replace("as=", "")]: dist }
                    : acc,
                {},
              ),
            alias,
          }),
        );
      };
    } satisfies JobFn<"computeFpOTA">,
  };
}
