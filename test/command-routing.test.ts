import test from "node:test";
import assert from "node:assert/strict";
import { runGraph } from "../src/runtime/runner.js";
import type { GraphConfig } from "../src/shared/types.js";

test("transform command goto routes to a declared target while applying state updates", async () => {
	const graph: GraphConfig = {
		version: 1,
		name: "command-goto-runtime",
		start: "decide",
		nodes: [
			{
				id: "decide",
				type: "transform",
				config: {
					set: { selected: "right" },
					output: "selected {{state.selected}}",
					command: { goto: "right", ends: ["right", "left"] },
				},
			},
			{ id: "left", type: "transform", config: { output: "left" } },
			{ id: "right", type: "transform", config: { output: "right {{state.selected}}" } },
		],
		edges: { left: "end", right: "end" },
	};
	const run = await runGraph(graph, {});
	assert.equal(run.status, "completed");
	assert.equal((run.result as any).state.selected, "right");
	assert.equal((run.result as any).outputs.decide, "selected right");
	assert.equal((run.result as any).outputs.right, "right right");
	assert.equal((run.result as any).outputs.left, undefined);
});

test("transform command goto supports templated routes", async () => {
	const graph: GraphConfig = {
		version: 1,
		name: "command-template-runtime",
		start: "decide",
		nodes: [
			{
				id: "decide",
				type: "transform",
				config: {
					output: "{{input.route}}",
					command: { goto: "{{input.route}}", ends: ["a", "b"] },
				},
			},
			{ id: "a", type: "transform", config: { output: "A" } },
			{ id: "b", type: "transform", config: { output: "B" } },
		],
		edges: { a: "end", b: "end" },
	};
	const run = await runGraph(graph, { route: "b" });
	assert.equal(run.status, "completed");
	assert.equal((run.result as any).outputs.b, "B");
	assert.equal((run.result as any).outputs.a, undefined);
});
