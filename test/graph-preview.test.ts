import test from "node:test";
import assert from "node:assert/strict";
import { readJsonFile } from "../src/shared/json.js";
import { normalizeGraphConfig } from "../src/graphs/graph-normalizer.js";
import { previewGraph } from "../src/graphs/graph-preview.js";
import { renderMermaid } from "../src/graphs/graph-mermaid.js";

test("preview includes markdown risks and mermaid", async () => {
	const graph = normalizeGraphConfig(
		await readJsonFile("graphs/review-loop.json"),
	);
	const preview = previewGraph(graph);
	assert.match(preview.markdown, /Graph preview: review-loop/);
	assert.match(preview.markdown, /subagent execution/);
	assert.match(preview.markdown, /human interrupt/);
	assert.match(preview.mermaid, /flowchart TD/);
});

test("mermaid renders START and END", async () => {
	const graph = normalizeGraphConfig(
		await readJsonFile("test/fixtures/graphs/valid-simple.json"),
	);
	const mermaid = renderMermaid(graph);
	assert.match(mermaid, /START/);
	assert.match(mermaid, /END/);
});

test("mermaid avoids reserved end node identifiers", async () => {
	const graph = normalizeGraphConfig(
		await readJsonFile("graphs/understand.json"),
	);
	const mermaid = renderMermaid(graph);
	assert.doesNotMatch(mermaid, /^\s*end\[/m);
	assert.doesNotMatch(mermaid, /^\s*n_end\[/m);
	assert.doesNotMatch(mermaid, /^\s*n_end\s+-->/m);
	assert.match(mermaid, /synthesize.*--> END/);
});
