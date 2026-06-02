import { GraphError } from "../shared/errors.js";

export interface SubagentRequest {
	agent: string;
	task: string;
	context?: "fresh" | "fork";
	includeConversation?: boolean;
	input?: unknown;
}

export interface SubagentChainStep extends SubagentRequest {}

export interface PiSubagentsClient {
	runSubagent(request: SubagentRequest): Promise<unknown>;
	runChain(steps: SubagentChainStep[]): Promise<unknown[]>;
}

export function createPiSubagentsClient(pi?: any): PiSubagentsClient {
	return {
		async runSubagent(request) {
			return invokeSubagent(pi, request);
		},
		async runChain(steps) {
			const results: unknown[] = [];
			for (const step of steps) results.push(await invokeSubagent(pi, step));
			return results;
		},
	};
}

async function invokeSubagent(
	pi: any,
	request: SubagentRequest,
): Promise<unknown> {
	if (!pi) throw unsupported(request);
	if (typeof pi.runSubagent === "function") return pi.runSubagent(request);
	if (typeof pi.subagent === "function") return pi.subagent(request);
	if (pi.subagents && typeof pi.subagents.run === "function")
		return pi.subagents.run(request);
	if (pi.tools && typeof pi.tools.subagent === "function")
		return pi.tools.subagent(request);
	if (pi.tools && typeof pi.tools.subagents === "function")
		return pi.tools.subagents(request);
	if (typeof pi.callTool === "function")
		return pi.callTool("subagent", request);
	throw unsupported(request);
}

function unsupported(request: SubagentRequest) {
	return new GraphError(
		"subagents_unavailable",
		"pi-subagents integration is unavailable; install/enable pi-subagents or provide a compatible mock client",
		{ agent: request.agent },
	);
}
