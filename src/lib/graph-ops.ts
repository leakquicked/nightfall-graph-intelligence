import type { EntityType, GraphEdge, GraphNode, IntelligenceGraph } from "./graph";

export function graphNeighbors(graph: IntelligenceGraph, nodeId: string): string[] {
  const result = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source === nodeId) result.add(edge.target);
    if (edge.target === nodeId) result.add(edge.source);
  }
  return [...result];
}

export function searchGraph(graph: IntelligenceGraph, query: string): GraphNode[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return graph.nodes;
  return graph.nodes.filter((node) =>
    node.label.toLocaleLowerCase("ru").includes(needle)
    || node.type.toLocaleLowerCase("ru").includes(needle)
    || Object.entries(node.attributes).some(([key, value]) =>
      key.toLocaleLowerCase("ru").includes(needle) || value.toLocaleLowerCase("ru").includes(needle)),
  );
}

export function filterGraph(
  graph: IntelligenceGraph,
  types: Set<EntityType>,
  query = "",
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const matching = new Set(searchGraph(graph, query).map((node) => node.id));
  const nodes = graph.nodes.filter((node) => types.has(node.type) && matching.has(node.id));
  const visible = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: graph.edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target)),
  };
}

export function connectedEdges(graph: IntelligenceGraph, ids: Set<string>): GraphEdge[] {
  return graph.edges.filter((edge) => ids.has(edge.source) || ids.has(edge.target));
}

export function updateSelection(current: string[], id: string, additive: boolean): string[] {
  if (!id) return [];
  if (!additive) return [id];
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

