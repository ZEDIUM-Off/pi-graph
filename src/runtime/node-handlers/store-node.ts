import type { GraphNode } from "../../shared/types.js";
import { GraphError } from "../../shared/errors.js";
import { event, type GraphState, type GraphStateUpdate } from "../state.js";
import { getStorePath, mergeStorePath, setStorePath } from "../store.js";
import { renderTemplate } from "./templates.js";

export function createStoreNode(node: GraphNode) {
	return async (state: GraphState): Promise<GraphStateUpdate> => {
		const config = (node.config ?? {}) as Record<string, unknown>;
		const op = String(config.op ?? "get");
		const key = renderTemplate(config.key, state);
		if (typeof key !== "string" || !key.trim())
			throw new GraphError("store_key_missing", `Store node '${node.id}' requires config.key`, { node: node.id });
		let output: unknown;
		if (op === "get") output = getStorePath(key);
		else if (op === "set") output = setStorePath(key, renderTemplate(config.value, state));
		else if (op === "merge") output = mergeStorePath(key, renderTemplate(config.value, state));
		else throw new GraphError("store_op_unsupported", `Unsupported store op '${op}'`, { node: node.id, op });
		return { outputs: { [node.id]: output }, events: [event("node_completed", node.id, { type: "store", op, key })] };
	};
}
