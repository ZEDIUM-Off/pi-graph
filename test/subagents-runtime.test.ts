import test from "node:test";
import assert from "node:assert/strict";
import { runGraph } from "../src/runtime/runner.js";
import {
	clearSavedRunsForTest,
	getSavedRunHistory,
	getSavedRunStatus,
} from "../src/runtime/run-store.js";
import type { GraphConfig } from "../src/shared/types.js";

function mockPi() {
	const calls: any[] = [];
	return {
		calls,
		subagents: {
			async run(request: any) {
				calls.push(request);
				return {
					agent: request.agent,
					task: request.task,
					context: request.context,
					includeConversation: request.includeConversation,
				};
			},
		},
	};
}

test("runs agentMode subagent nodes through pi-subagents with context policy", async () => {
	const pi = mockPi();
	const graph: GraphConfig = {
		version: 1,
		name: "subagent-node-runtime",
		start: "worker",
		nodes: [
			{
				id: "worker",
				type: "agent",
				agentMode: "subagent",
				agent: "worker",
				task: "Build {{input.feature}}",
				context: { mode: "none" },
			},
		],
		edges: { worker: "end" },
	};
	const run = await runGraph(graph, { feature: "tests" }, { pi });
	assert.equal(run.status, "completed");
	assert.equal(pi.calls[0].context, "fresh");
	assert.equal(pi.calls[0].includeConversation, false);
	assert.deepEqual((run.result as any).outputs.worker, {
		agent: "worker",
		task: "Build tests",
		context: "fresh",
		includeConversation: false,
	});
});

test("runs subagent-chain sequentially and exposes previous output", async () => {
	const pi = mockPi();
	const graph: GraphConfig = {
		version: 1,
		name: "subagent-chain-runtime",
		start: "chain",
		nodes: [
			{
				id: "chain",
				type: "subagent-chain",
				context: { mode: "fork" },
				chain: [
					{ agent: "scout", task: "Scout {{input.topic}}" },
					{ agent: "reviewer", task: "Review {{outputs.previous.agent}}" },
				],
			},
		],
		edges: { chain: "end" },
	};
	const run = await runGraph(graph, { topic: "pi-graph" }, { pi });
	assert.equal(run.status, "completed");
	assert.equal(pi.calls.length, 2);
	assert.equal(pi.calls[0].context, "fork");
	assert.equal(pi.calls[1].task, "Review scout");
	assert.equal((run.result as any).outputs.chain.length, 2);
});

test("uses the real pi-subagents tool name when dispatching through callTool", async () => {
	const calls: any[] = [];
	const pi = {
		async callTool(name: string, request: any) {
			calls.push({ name, request });
			return { ok: true, name, agent: request.agent };
		},
	};
	const graph: GraphConfig = {
		version: 1,
		name: "subagent-calltool-runtime",
		start: "worker",
		nodes: [
			{
				id: "worker",
				type: "agent",
				agentMode: "subagent",
				agent: "worker",
				task: "Build {{input.feature}}",
			},
		],
		edges: { worker: "end" },
	};
	const run = await runGraph(graph, { feature: "integration" }, { pi });
	assert.equal(run.status, "completed");
	assert.equal(calls[0].name, "subagent");
	assert.equal(calls[0].request.task, "Build integration");
});

test("saveRun stores status and history snapshots", async () => {
	clearSavedRunsForTest();
	const graph: GraphConfig = {
		version: 1,
		name: "save-run-runtime",
		start: "done",
		nodes: [{ id: "done", type: "transform", config: { output: "ok" } }],
		edges: { done: "end" },
	};
	const run = await runGraph(
		graph,
		{},
		{ saveRun: true, runId: "graph-test-save" },
	);
	const saved = getSavedRunStatus(run.id);
	assert.equal(saved.status, "completed");
	assert.equal(
		getSavedRunHistory(run.id).history.at(-1)?.type,
		"run_completed",
	);
});
