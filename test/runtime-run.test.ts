import test from "node:test";
import assert from "node:assert/strict";
import { runGraph, resumeGraph } from "../src/runtime/runner.js";
import type { GraphConfig } from "../src/shared/types.js";

const simpleGraph: GraphConfig = {
	version: 1,
	name: "simple-runtime",
	start: "setGreeting",
	nodes: [
		{
			id: "setGreeting",
			type: "transform",
			config: {
				state: { greeting: "hello {{input.name}}" },
				output: "{{state.greeting}}",
			},
		},
	],
	edges: { setGreeting: "end" },
};

test("runs a simple transform graph", async () => {
	const run = await runGraph(simpleGraph, { name: "Pi" });
	assert.equal(run.status, "completed");
	assert.equal((run.result as any).state.greeting, "hello Pi");
	assert.equal((run.result as any).outputs.setGreeting, "hello Pi");
});

test("routes condition nodes", async () => {
	const graph: GraphConfig = {
		version: 1,
		name: "condition-runtime",
		start: "route",
		nodes: [
			{ id: "route", type: "condition", config: { from: "input.approved" } },
			{ id: "yes", type: "transform", config: { output: "approved" } },
			{ id: "no", type: "transform", config: { output: "rejected" } },
		],
		edges: {
			route: { true: "yes", false: "no", fallback: "no" },
			yes: "end",
			no: "end",
		},
	};
	const run = await runGraph(graph, { approved: true });
	assert.equal(run.status, "completed");
	assert.equal((run.result as any).outputs.yes, "approved");
});

test("treats explicit end nodes as LangGraph END", async () => {
	const graph: GraphConfig = {
		version: 1,
		name: "explicit-end-runtime",
		start: "work",
		nodes: [
			{ id: "work", type: "transform", config: { output: "done" } },
			{ id: "finish", type: "end" },
		],
		edges: { work: "finish", finish: "end" },
	};
	const run = await runGraph(graph, {});
	assert.equal(run.status, "completed");
	assert.equal((run.result as any).outputs.work, "done");
});

test("interrupts and resumes human nodes", async () => {
	const graph: GraphConfig = {
		version: 1,
		name: "human-runtime",
		start: "approval",
		nodes: [
			{
				id: "approval",
				type: "human",
				config: { prompt: "Approve?", payload: { kind: "approval" } },
			},
			{
				id: "done",
				type: "transform",
				config: { output: "{{outputs.approval.approved}}" },
			},
		],
		edges: { approval: "done", done: "end" },
	};
	const waiting = await runGraph(graph, {});
	assert.equal(waiting.status, "waiting");
	assert.deepEqual((waiting.interrupt as any).payload, { kind: "approval" });

	const resumed = await resumeGraph(waiting.id, { approved: true });
	assert.equal(resumed.status, "completed");
	assert.deepEqual((resumed.result as any).outputs.approval, {
		approved: true,
	});
	assert.equal((resumed.result as any).outputs.done, true);
});

test("runs an inline subgraph", async () => {
	const graph: GraphConfig = {
		version: 1,
		name: "parent-subgraph-runtime",
		start: "child",
		nodes: [
			{
				id: "child",
				type: "subgraph",
				config: {
					graph: {
						version: 1,
						name: "inline-child",
						start: "setChild",
						nodes: [
							{
								id: "setChild",
								type: "transform",
								config: { output: "child {{input.value}}" },
							},
						],
						edges: { setChild: "end" },
					},
					input: { value: "{{input.value}}" },
				},
			},
		],
		edges: { child: "end" },
	};
	const run = await runGraph(graph, { value: "ok" });
	assert.equal(run.status, "completed");
	assert.equal((run.result as any).outputs.child.outputs.setChild, "child ok");
});
