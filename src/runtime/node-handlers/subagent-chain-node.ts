import type { GraphConfig, GraphNode } from "../../shared/types.js";
import { GraphError } from "../../shared/errors.js";
import {
	createPiSubagentsClient,
	type SubagentChainStep,
} from "../../integrations/pi-subagents.js";
import { event, type GraphState, type GraphStateUpdate } from "../state.js";
import { resolveContextPolicy } from "../context-policy.js";
import { renderTemplate } from "./templates.js";

export function createSubagentChainNode(
	node: GraphNode,
	options: { pi?: any; graph?: GraphConfig },
) {
	return async (state: GraphState): Promise<GraphStateUpdate> => {
		const config = { ...(node.config ?? {}), ...node } as Record<
			string,
			unknown
		>;
		const chain = Array.isArray(config.chain) ? config.chain : [];
		if (!chain.length)
			throw new GraphError(
				"subagent_chain_empty",
				`Subagent-chain node '${node.id}' requires a non-empty chain`,
				{ node: node.id },
			);
		const policy = resolveContextPolicy(node, options.graph);
		const client = createPiSubagentsClient(options.pi);
		const outputs: unknown[] = [];
		for (const [index, rawStep] of chain.entries()) {
			const step =
				rawStep && typeof rawStep === "object"
					? (rawStep as Record<string, unknown>)
					: {};
			const chainState = {
				...state,
				outputs: {
					...state.outputs,
					[node.id]: outputs,
					previous: outputs.at(-1),
				},
			};
			const request: SubagentChainStep = {
				agent: stringValue(step.agent, "agent", node.id, index),
				task: stringValue(
					renderTemplate(step.task ?? step.prompt ?? "", chainState),
					"task",
					node.id,
					index,
				),
				context: policy.subagentContext,
				includeConversation: policy.includeConversation,
				input: state.input,
			};
			outputs.push(await client.runSubagent(request));
		}
		return {
			outputs: { [node.id]: outputs },
			events: [
				event("node_completed", node.id, {
					type: "subagent-chain",
					steps: outputs.length,
					context: policy.mode,
				}),
			],
		};
	};
}

function stringValue(
	value: unknown,
	name: string,
	nodeId: string,
	index: number,
): string {
	if (typeof value === "string" && value.trim()) return value;
	throw new GraphError(
		"subagent_chain_config_missing",
		`Subagent-chain node '${nodeId}' step ${index} requires '${name}'`,
		{ node: nodeId, step: index, field: name },
	);
}
