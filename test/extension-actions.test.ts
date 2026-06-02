import test from "node:test";
import assert from "node:assert/strict";
import { handleGraphAction } from "../src/extension/index.js";

test("doctor returns reconstructible details", async () => {
	const result = await handleGraphAction({ action: "doctor" });
	assert.match(result.text, /pi-graph doctor/);
	assert.equal(result.details.package.name, "pi-graph");
});

test("run returns controlled subagents-unavailable error for subagent example without integration", async () => {
	const result = await handleGraphAction({
		action: "run",
		name: "review-loop",
	});
	assert.match(result.text, /subagents_unavailable/);
	assert.equal(result.details.code, "subagents_unavailable");
});

test("create in builtin scope returns readonly error", async () => {
	const result = await handleGraphAction({
		action: "create",
		scope: "builtin",
		config: {
			version: 1,
			name: "cannot-create",
			start: "a",
			nodes: [{ id: "a", type: "transform" }],
			edges: { a: "end" },
		},
	});
	assert.match(result.text, /builtin_readonly/);
	assert.equal(result.details.code, "builtin_readonly");
});
