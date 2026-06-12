import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runGraph } from "../src/runtime/runner.js";
import type { GraphConfig } from "../src/shared/types.js";

test("store nodes persist and read cross-run state", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "pi-graph-store-"));
	const previous = process.cwd();
	process.chdir(dir);
	try {
		const writeGraph: GraphConfig = {
			version: 1,
			name: "store-write",
			start: "save",
			nodes: [
				{ id: "save", type: "store", config: { op: "merge", key: "workspace.focus", value: { project: "pi-graph", phase: "C4" } } },
			],
			edges: { save: "end" },
		};
		await runGraph(writeGraph, {});
		const readGraph: GraphConfig = {
			version: 1,
			name: "store-read",
			start: "load",
			nodes: [{ id: "load", type: "store", config: { op: "get", key: "workspace.focus" } }],
			edges: { load: "end" },
		};
		const run = await runGraph(readGraph, {});
		assert.deepEqual((run.result as any).outputs.load, { project: "pi-graph", phase: "C4" });
		assert.match(await readFile(path.join(dir, ".pi", "graph-store", "store.json"), "utf8"), /pi-graph/);
	} finally {
		process.chdir(previous);
		await rm(dir, { recursive: true, force: true });
	}
});
