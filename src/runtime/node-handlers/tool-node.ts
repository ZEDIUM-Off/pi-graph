import type { GraphNode } from "../../shared/types.js";
import { GraphError } from "../../shared/errors.js";
import { event, type GraphState, type GraphStateUpdate } from "../state.js";
import { renderTemplate } from "./templates.js";

export function createToolNode(node: GraphNode, pi?: any) {
  return async (state: GraphState): Promise<GraphStateUpdate> => {
    const config = (node.config ?? {}) as Record<string, unknown>;
    if ("result" in config || "output" in config) {
      const output = renderTemplate(config.result ?? config.output, state);
      return { outputs: { [node.id]: output }, events: [event("node_completed", node.id, { type: "tool", mode: "static" })] };
    }
    // Pi tool dispatch APIs vary; do not guess and accidentally call external tools.
    throw new GraphError("tool_unsupported", `Tool node '${node.id}' requires a static config.result/output in the MVP`, { node: node.id, tool: config.name, piAvailable: Boolean(pi) });
  };
}
