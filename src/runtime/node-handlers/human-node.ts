import { interrupt } from "@langchain/langgraph";
import type { GraphNode } from "../../shared/types.js";
import { event, type GraphState, type GraphStateUpdate } from "../state.js";
import { renderTemplate } from "./templates.js";

export function createHumanNode(node: GraphNode) {
  return async (state: GraphState): Promise<GraphStateUpdate> => {
    const config = (node.config ?? {}) as Record<string, unknown>;
    // Keep the node idempotent: no external side effects before interrupt().
    const payload = renderTemplate({
      nodeId: node.id,
      prompt: config.prompt ?? node.label ?? `Input required for ${node.id}`,
      payload: config.payload ?? {},
    }, state);
    const resume = interrupt(payload as any);
    return {
      outputs: { [node.id]: resume },
      events: [event("human_resumed", node.id, { resume })],
    };
  };
}
