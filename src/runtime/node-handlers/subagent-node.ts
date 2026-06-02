import type { GraphConfig, GraphNode } from "../../shared/types.js";
import { GraphError } from "../../shared/errors.js";
import { createPiSubagentsClient } from "../../integrations/pi-subagents.js";
import { event, type GraphState, type GraphStateUpdate } from "../state.js";
import { resolveContextPolicy } from "../context-policy.js";
import { renderTemplate } from "./templates.js";

export function createSubagentNode(
	node: GraphNode,
	options: { pi?: any; graph?: GraphConfig },
) {
	return async (state: GraphState): Promise<GraphStateUpdate> => {
		const config = { ...(node.config ?? {}), ...node } as Record<
			string,
			unknown
		>;
		const agentMode = config.agentMode ?? config.mode ?? "subagent";
		if (agentMode !== "subagent")
			throw new GraphError(
				"agent_mode_unsupported",
				`Agent node '${node.id}' only supports agentMode=subagent in the MVP`,
				{ node: node.id, agentMode },
			);
		const agent = stringValue(config.agent, "agent", node.id);
		const task = renderTemplate(config.task ?? config.prompt ?? "", state);
		if (typeof task !== "string" || !task.trim())
			throw new GraphError(
				"subagent_task_missing",
				`Subagent node '${node.id}' requires a task/prompt`,
				{ node: node.id },
			);
		const policy = resolveContextPolicy(node, options.graph);
		const output = await createPiSubagentsClient(options.pi).runSubagent({
			agent,
			task,
			context: policy.subagentContext,
			includeConversation: policy.includeConversation,
			input: state.input,
		});
		return {
			outputs: { [node.id]: output },
			events: [
				event("node_completed", node.id, {
					type: "agent",
					agent,
					context: policy.mode,
				}),
			],
		};
	};
}

function stringValue(value: unknown, name: string, nodeId: string): string {
	if (typeof value === "string" && value.trim()) return value;
	throw new GraphError(
		"subagent_config_missing",
		`Subagent node '${nodeId}' requires '${name}'`,
		{ node: nodeId, field: name },
	);
}
