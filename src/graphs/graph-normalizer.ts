import type { GraphConfig, GraphNode } from "../shared/types.js";

export function normalizeGraphConfig(input: unknown): GraphConfig {
  if (!input || typeof input !== "object") throw new Error("Graph config must be an object");
  const raw = input as Record<string, any>;
  const nodes = Array.isArray(raw.nodes) ? raw.nodes.map(normalizeNode) : [];
  const name = String(raw.name ?? "").trim();
  const start = String(raw.start ?? nodes[0]?.id ?? "").trim();
  return {
    version: 1,
    ...raw,
    name,
    start,
    nodes,
    edges: normalizeEdges(raw.edges),
    scope: raw.scope ?? "project",
    config: raw.config ?? {},
    context: { mode: raw.context?.mode ?? "fresh", ...(raw.context ?? {}) }
  } as GraphConfig;
}

function normalizeNode(node: any): GraphNode {
  return { ...node, id: String(node?.id ?? "").trim(), type: node?.type, config: node?.config ?? {} };
}

function normalizeEdges(edges: unknown) {
  if (!edges || typeof edges !== "object" || Array.isArray(edges)) return {};
  return edges as Record<string, string | string[] | Record<string, string>>;
}
