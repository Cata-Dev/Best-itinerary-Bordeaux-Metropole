import { node } from "@catatomik/dijkstra/lib/utils/Graph";
import { Cache, CacheData } from "common/cache";
import { approachedStopName } from "data/models/TBM/NonScheduledRoutes.model";
import { dbTBM_Stops, dbTBM_StopsModel } from "data/models/TBM/TBM_stops.model";
import { approachPoint, makeGraph, makeInitData, refreshWithApproachedPoint } from "../foot/graph";

const stopProjection = { _id: 1, coords: 1 };
type dbStops = Pick<dbTBM_Stops, keyof typeof stopProjection>;
interface StopOverwritten {
  // Remove it
  _id?: never;
}
// Equivalent to an Edge
type Stop = Omit<dbStops, keyof StopOverwritten> & StopOverwritten;

function makePTNInitData(stopsModel: dbTBM_StopsModel) {
  const query = {
    $and: [{ coords: { $not: { $elemMatch: { $eq: Infinity } } } }],
  };

  return new Cache(
    new Map<dbStops["_id"], Stop>(),
    stopsModel,
    async (stopsModel) =>
      (
        await stopsModel.find(query, { updatedAt: 1 }).sort({ updatedAt: -1 }).limit(1)
      )[0]?.updatedAt?.getTime() ?? -1,
    async (stopsModel) =>
      new Map<dbStops["_id"], Stop>(
        (await stopsModel.find(query, stopProjection).lean()).map((s) => [s._id, { coords: s.coords }]),
      ),
  );
}

/**
 * Only reads all parameters
 */
function makeFootPTNGraph<N extends node = ReturnType<typeof approachedStopName>>(
  edges: CacheData<ReturnType<typeof makeInitData>>["edges"],
  mappedSegments: CacheData<ReturnType<typeof makeInitData>>["mappedSegments"],
  stops: Map<dbStops["_id"], Stop>,
) {
  // Make graph
  const graph = makeGraph<ReturnType<typeof approachedStopName> | N>(edges);

  // Approach stops & insert
  const approachedStops = new Map<dbStops["_id"], NonNullable<ReturnType<typeof approachPoint>>>();

  for (const [stopId, { coords }] of stops) {
    const ap = approachPoint(mappedSegments, coords);
    if (ap) {
      approachedStops.set(stopId, ap);
      refreshWithApproachedPoint(edges, graph, approachedStopName(stopId), ap);
    }
  }

  return graph;
}

export { makeFootPTNGraph, makePTNInitData };
