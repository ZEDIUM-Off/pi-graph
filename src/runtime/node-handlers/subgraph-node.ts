import type { GraphNode } from "../../shared/types.js";
import { resolveGraph } from "../../graphs/graph-loader.js";
import { normalizeGraphConfig } from "../../graphs/graph-normalizer.js";
import { event, type GraphState, type GraphStateUpdate } from "../state.js";
import { compileGraph } from "../compile.js";
import { renderTemplate } from "./templates.js";

export function createSubgraphNode(node: GraphNode, options: { pi?: any; depth: number }) {
  return async (state: GraphState): Promise<GraphStateUpdate> => {
    const config = (node.config ?? {}) as Record<string, unknown>;
    const graph = config.graph
      ? normalizeGraphConfig(config.graph)
      : normalizeGraphConfig((await resolveGraph(String(config.ref ?? config.name))).config);
    const compiled = await compileGraph(graph, { pi: options.pi, depth: options.depth + 1 });
    const input = renderTemplate(config.input ?? state.input, state) as Record<string, unknown>;
    const result = await compiled.invoke({ input, run: { parentNode: node.id } }, { configurable: { thread_id: `${state.run.runId ?? "subgraph"}:${node.id}` } });
    return {
      outputs: { [node.id]: result },
      events: [event("node_completed", node.id, { type: "subgraph", graph: graph.name })],
    };
  };
}
