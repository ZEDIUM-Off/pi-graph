import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { handleGraphAction } from "../src/extension/index.js";
import { getRunHistory, getRunStatus, runGraph } from "../src/runtime/runner.js";
import { clearSavedRunsForTest } from "../src/runtime/run-store.js";
import type { GraphConfig } from "../src/shared/types.js";

const graph: GraphConfig = {
	version: 1,
	name: "saved-runtime",
	start: "a",
	nodes: [{ id: "a", type: "transform", config: { output: "hello {{input.name}}" } }],
	edges: { a: "end" },
};

test("saveRun writes durable run artifacts and status/history can be read from disk", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "pi-graph-runs-"));
	const previous = process.cwd();
	process.chdir(dir);
	clearSavedRunsForTest();
	try {
		const run = await runGraph(graph, { name: "Pi" }, { saveRun: true });
		const runDir = path.join(dir, ".pi", "graph-runs", run.id);
		for (const file of ["run.json", "history.json", "final-state.json", "graph.json", "graph.mmd", "summary.md"]) {
			assert.equal(existsSync(path.join(runDir, file)), true, `${file} should exist`);
		}
		assert.match(await readFile(path.join(runDir, "summary.md"), "utf8"), /saved-runtime/);
		clearSavedRunsForTest();
		assert.equal(getRunStatus(run.id).status, "completed");
		assert.equal(getRunHistory(run.id).history.at(-1)?.type, "run_completed");
	} finally {
		process.chdir(previous);
		await rm(dir, { recursive: true, force: true });
	}
});

test("graph list-runs and get-run expose saved run records", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "pi-graph-runs-actions-"));
	const previous = process.cwd();
	process.chdir(dir);
	clearSavedRunsForTest();
	try {
		const runResult = await handleGraphAction({ action: "run", config: graph, input: { name: "Pi" }, saveRun: true, renderSvg: false, ui: false });
		const id = runResult.details.run.id;
		clearSavedRunsForTest();
		const listed = await handleGraphAction({ action: "list-runs" });
		assert.match(listed.text, new RegExp(id));
		const got = await handleGraphAction({ action: "get-run", id });
		assert.match(got.text, /completed/);
		assert.equal(got.details.run.id, id);
	} finally {
		process.chdir(previous);
		await rm(dir, { recursive: true, force: true });
	}
});
