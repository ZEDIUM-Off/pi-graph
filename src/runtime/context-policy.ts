import type { ContextPolicy, GraphConfig, GraphNode } from "../shared/types.js";
import { GraphError } from "../shared/errors.js";

export interface ResolvedContextPolicy {
	mode: ContextPolicy;
	subagentContext: "fresh" | "fork";
	includeConversation: boolean;
}

export function resolveContextPolicy(
	node: GraphNode,
	graph?: GraphConfig,
): ResolvedContextPolicy {
	const mode = node.context?.mode ?? graph?.context?.mode ?? "fresh";
	switch (mode) {
		case "fresh":
			return { mode, subagentContext: "fresh", includeConversation: true };
		case "fork":
			return { mode, subagentContext: "fork", includeConversation: true };
		case "none":
			return { mode, subagentContext: "fresh", includeConversation: false };
		case "current":
		case "selected":
			throw new GraphError(
				"context_unsupported",
				`Context mode '${mode}' is not supported for safe subagent MVP execution`,
				{ mode, node: node.id },
			);
		default:
			throw new GraphError(
				"context_unsupported",
				`Unsupported context mode '${mode}'`,
				{ mode, node: node.id },
			);
	}
}
