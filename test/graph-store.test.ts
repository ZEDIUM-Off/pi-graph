import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	createGraph,
	deleteGraph,
	getGraph,
	listGraphs,
	updateGraph,
} from "../src/graphs/graph-store.js";

test("create/get/delete project graph", async () => {
	const old = process.cwd();
	const dir = await mkdtemp(path.join(tmpdir(), "pi-graph-test-"));
	process.chdir(dir);
	try {
		const config = {
			version: 1,
			name: "store-simple",
			start: "a",
			nodes: [{ id: "a", type: "transform" }],
			edges: { a: "end" },
		};
		const created = await createGraph(config);
		assert.match(created.path, /\.pi\/graphs\/store-simple\.json$/);
		const got = await getGraph("store-simple");
		assert.equal(got.scope, "project");
		const listed = await listGraphs();
		assert.ok(
			listed.some((g) => g.name === "store-simple" && g.scope === "project"),
		);
		await deleteGraph("store-simple");
	} finally {
		process.chdir(old);
		await rm(dir, { recursive: true, force: true });
	}
});

test("builtin delete is refused", async () => {
	await assert.rejects(
		() => deleteGraph("review-loop", "builtin"),
		/Cannot delete builtin/,
	);
});

test("update refuses mismatched config names", async () => {
	await assert.rejects(
		() =>
			updateGraph("stored-name", {
				version: 1,
				name: "other-name",
				start: "a",
				nodes: [{ id: "a", type: "transform" }],
				edges: { a: "end" },
			}),
		/Config name must match graph name/,
	);
});
