import { Command, END } from "@langchain/langgraph";
import type { GraphNode } from "../../shared/types.js";
import { event, type GraphState, type GraphStateUpdate } from "../state.js";
import { renderTemplate } from "./templates.js";

export function createTransformNode(node: GraphNode) {
	return async (state: GraphState): Promise<GraphStateUpdate | Command> => {
		const config = (node.config ?? {}) as Record<string, unknown>;
		const stateUpdate = renderTemplate(
			config.state ?? config.set ?? {},
			state,
		) as Record<string, unknown>;
		const nextState = { ...state, state: { ...state.state, ...stateUpdate } };
		const output = renderTemplate(config.output ?? stateUpdate, nextState);
		const update: GraphStateUpdate = {
			state: stateUpdate,
			outputs: { [node.id]: output },
			events: [event("node_completed", node.id, { type: "transform" })],
		};
		const command = commandConfig(config.command, nextState);
		return command
			? new Command({ ...command, update } as any)
			: update;
	};
}


function commandConfig(value: unknown, state: GraphState): { goto?: unknown; graph?: string } | undefined {
	if (!value || typeof value !== "object") return undefined;
	const config = value as Record<string, unknown>;
	const renderedGoto = renderTemplate(config.goto, state);
	const goto = normalizeGoto(renderedGoto);
	const graph = normalizeGraph(config.graph);
	if (goto === undefined && graph === undefined) return undefined;
	return { goto, graph };
}

function normalizeGoto(value: unknown): unknown {
	if (typeof value === "string") return value === "end" ? END : value;
	if (Array.isArray(value)) return value.map((item) => normalizeGoto(item));
	return undefined;
}

function normalizeGraph(value: unknown): string | undefined {
	if (value === "parent" || value === "PARENT") return Command.PARENT;
	return typeof value === "string" ? value : undefined;
}
