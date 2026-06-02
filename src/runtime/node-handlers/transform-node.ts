import type { GraphNode } from "../../shared/types.js";
import { event, type GraphState, type GraphStateUpdate } from "../state.js";
import { renderTemplate } from "./templates.js";

export function createTransformNode(node: GraphNode) {
	return async (state: GraphState): Promise<GraphStateUpdate> => {
		const config = (node.config ?? {}) as Record<string, unknown>;
		const stateUpdate = renderTemplate(
			config.state ?? config.set ?? {},
			state,
		) as Record<string, unknown>;
		const nextState = { ...state, state: { ...state.state, ...stateUpdate } };
		const output = renderTemplate(config.output ?? stateUpdate, nextState);
		return {
			state: stateUpdate,
			outputs: { [node.id]: output },
			events: [event("node_completed", node.id, { type: "transform" })],
		};
	};
}
