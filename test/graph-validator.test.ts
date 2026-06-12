import test from "node:test";
import assert from "node:assert/strict";
import { readJsonFile } from "../src/shared/json.js";
import { normalizeGraphConfig } from "../src/graphs/graph-normalizer.js";
import { validateGraphConfig } from "../src/graphs/graph-validator.js";

test("valid-simple fixture validates", async () => {
	const graph = normalizeGraphConfig(
		await readJsonFile("test/fixtures/graphs/valid-simple.json"),
	);
	const result = validateGraphConfig(graph);
	assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("missing start is invalid", async () => {
	const graph = normalizeGraphConfig(
		await readJsonFile("test/fixtures/graphs/invalid-missing-start.json"),
	);
	const result = validateGraphConfig(graph);
	assert.equal(result.valid, false);
	assert.match(result.errors.map((e) => e.code).join(","), /missing_start/);
});

test("condition routes must target existing nodes or end", async () => {
	const graph = normalizeGraphConfig(
		await readJsonFile("test/fixtures/graphs/invalid-route.json"),
	);
	const result = validateGraphConfig(graph);
	assert.equal(result.valid, false);
	assert.ok(result.errors.some((e) => e.code === "edge_target"));
	assert.ok(result.errors.some((e) => e.code === "condition_routes"));
});

test("graph names must be safe stored identifiers", () => {
	const graph = normalizeGraphConfig({
		version: 1,
		name: "../escape",
		start: "a",
		nodes: [{ id: "a", type: "transform" }],
		edges: { a: "end" },
	});
	const result = validateGraphConfig(graph);
	assert.equal(result.valid, false);
	assert.ok(result.errors.some((e) => e.path === "name" && e.code === "id"));
});

test("command targets must exist when statically declared", () => {
	const graph = normalizeGraphConfig({
		version: 1,
		name: "bad-command-target",
		start: "a",
		nodes: [{ id: "a", type: "transform", config: { command: { goto: "missing" } } }],
		edges: {},
	});
	const result = validateGraphConfig(graph);
	assert.equal(result.valid, false);
	assert.ok(result.errors.some((e) => e.code === "command_target"));
});

test("command targets participate in reachability", () => {
	const graph = normalizeGraphConfig({
		version: 1,
		name: "command-reachable",
		start: "a",
		nodes: [
			{ id: "a", type: "transform", config: { command: { goto: "b", ends: ["b"] } } },
			{ id: "b", type: "transform" },
		],
		edges: { b: "end" },
	});
	const result = validateGraphConfig(graph);
	assert.equal(result.valid, true, JSON.stringify(result.errors));
	assert.equal(result.warnings.some((w) => w.path === "nodes.b" && w.code === "unreachable"), false);
});
