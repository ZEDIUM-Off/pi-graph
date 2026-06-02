import test from "node:test";
import assert from "node:assert/strict";
import { renderGraphDashboard } from "../src/tui/render.js";
import { graphStatusWidgetComponent } from "../src/tui/graph-status-widget.js";
import type { GraphConfig } from "../src/shared/types.js";

const graph: GraphConfig = {
	version: 1,
	name: "dash",
	start: "hub",
	nodes: [{ id: "hub", type: "human" }],
	edges: { hub: "end" },
};

test("dashboard respects width and shows core run data", () => {
	const lines = renderGraphDashboard(
		graph,
		{
			id: "graph-123",
			graphName: "dash",
			status: "waiting",
			currentNode: "hub",
			nextRoutes: ["business", "ux", "technical"],
			interrupt: { prompt: "Choose next" },
			artifacts: { svg: "/tmp/graph.svg", warnings: [] },
		},
		60,
	);
	assert.ok(lines.every((line) => line.length <= 60));
	assert.match(lines.join("\n"), /waitingRoute/);
	assert.match(lines.join("\n"), /1 business/);
	assert.match(lines.join("\n"), /file:\/\/\/tmp\/graph.svg/);
});

test("dashboard summarizes many routes and advertises picker", () => {
	const routes = Array.from({ length: 14 }, (_, i) => `route-${i + 1}`);
	const text = renderGraphDashboard(
		graph,
		{
			id: "graph-123",
			status: "waiting",
			currentNode: "hub",
			nextRoutes: routes,
		},
		70,
	).join("\n");
	assert.match(text, /routes 9\/14/);
	assert.match(text, /5 more/);
	assert.match(text, /ctrl\+g picker/);
});

test("waitingRoute dashboard stays compact enough to avoid widget truncation", () => {
	const text = renderGraphDashboard(
		graph,
		{
			id: "graph-123",
			status: "waiting",
			currentNode: "hub",
			nextRoutes: [
				"business",
				"ux",
				"technical",
				"constraints",
				"questions",
				"synthesize",
			],
			interrupt: {
				prompt: "A long prompt should not hide actions in route mode",
			},
			artifacts: { svg: "/tmp/graph.svg", warnings: [] },
		},
		80,
	);
	assert.ok(text.length <= 10);
	assert.match(text.join("\n"), /ctrl\+g picker/);
	assert.match(text.join("\n"), /svg {3}file:\/\/\/tmp\/graph\.svg/);
	assert.doesNotMatch(text.join("\n"), /prompt A long prompt/);
});

test("widget component applies theme colors", () => {
	const factory = graphStatusWidgetComponent(graph, {
		id: "graph-123",
		status: "waiting",
		currentNode: "hub",
		nextRoutes: ["business"],
	});
	const component = factory(undefined, {
		fg: (color: string, value: string) => `<${color}>${value}</${color}>`,
	});
	const text = component.render(80).join("\n");
	assert.match(text, /<accent>╭/);
	assert.match(text, /<warning>.*waiting for route/);
});

test("dashboard distinguishes waitingInput from route selection", () => {
	const text = renderGraphDashboard(
		graph,
		{
			id: "graph-123",
			status: "waiting",
			currentNode: "hub",
			nextRoutes: [],
			interrupt: { prompt: "Provide structured data" },
		},
		72,
	).join("\n");
	assert.match(text, /waitingInput/);
	assert.match(text, /structured input/);
	assert.doesNotMatch(text, /alt\+1\.\.9 choose visible/);
});
