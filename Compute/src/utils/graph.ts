import { node, WeightedGraph } from "@catatomik/dijkstra/lib/utils/Graph";

/**
 * Export a graph internal data, to be used later through {@link importWGraph}
 * @returns Shallow copy of the graph internal data
 */
function exportWGraph<N extends node>(wGraph: WeightedGraph<N>) {
  return [wGraph.adj, wGraph.weights] satisfies [unknown, unknown];
}

/**
 * Import a graph from its exported internal data, from {@link exportWGraph}.
 * @returns A new deep-copied graph from given internal data
 */
function importWGraph<N extends node>([adj, weights]: ReturnType<typeof exportWGraph<N>>) {
  return new WeightedGraph(structuredClone(adj), structuredClone(weights));
}

export { exportWGraph, importWGraph };
