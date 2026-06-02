import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ensureGraphArtifacts } from "../src/graphs/graph-artifacts.js";
import type { GraphConfig } from "../src/shared/types.js";

const graph: GraphConfig = {
	version: 1,
	name: "artifact-simple",
	start: "a",
	nodes: [{ id: "a", type: "transform" }],
	edges: { a: "end" },
};

test("ensureGraphArtifacts writes json, mmd, svg and manifest", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "pi-graph-artifacts-"));
	try {
		const result = await ensureGraphArtifacts(graph, {
			base: dir,
			renderer: async (_input, output) =>
				writeFile(output, "<svg></svg>", "utf8"),
		});
		assert.equal(result.warnings.length, 0);
		assert.equal(result.renderedSvg, true);
		assert.match(await readFile(result.json, "utf8"), /artifact-simple/);
		assert.match(await readFile(result.mmd, "utf8"), /flowchart TD/);
		assert.match(await readFile(result.svg, "utf8"), /<svg/);
		assert.match(await readFile(result.manifest, "utf8"), /"hash"/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("ensureGraphArtifacts warns instead of failing when svg renderer fails", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "pi-graph-artifacts-"));
	try {
		const result = await ensureGraphArtifacts(graph, {
			base: dir,
			renderer: async () => {
				throw new Error("renderer unavailable");
			},
		});
		assert.equal(result.renderedSvg, false);
		assert.match(result.warnings[0] ?? "", /renderer unavailable/);
		assert.match(await readFile(result.mmd, "utf8"), /flowchart TD/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("ensureGraphArtifacts uses manifest cache when graph is unchanged", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "pi-graph-artifacts-"));
	let calls = 0;
	try {
		const renderer = async (_input: string, output: string) => {
			calls += 1;
			await writeFile(output, "<svg></svg>", "utf8");
		};
		await ensureGraphArtifacts(graph, { base: dir, renderer });
		const second = await ensureGraphArtifacts(graph, { base: dir, renderer });
		assert.equal(calls, 1);
		assert.equal(second.cached, true);
		assert.equal(second.renderedSvg, false);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
