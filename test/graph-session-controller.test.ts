import test from "node:test";
import assert from "node:assert/strict";
import {
	GraphSessionController,
	altDigit,
} from "../src/tui/graph-session-controller.js";

test("altDigit recognizes alt+1..9 escape sequences", () => {
	assert.equal(altDigit("\x1b1"), 1);
	assert.equal(altDigit("\x1b9"), 9);
	assert.equal(altDigit("1"), undefined);
});

test("alt+digit chooses a visible route", async () => {
	const calls: unknown[] = [];
	const controller = new GraphSessionController({
		resume: async (_runId, input) => calls.push(input),
	});
	controller.update({
		id: "run-1",
		status: "waiting",
		nextRoutes: ["business", "ux"],
	});
	assert.equal(await controller.handleInput("\x1b2"), true);
	assert.deepEqual(calls, [{ next: "ux" }]);
});

test("alt+digit does not choose hidden routes beyond visible limit", async () => {
	const calls: unknown[] = [];
	const routes = Array.from({ length: 12 }, (_, i) => `route-${i + 1}`);
	const controller = new GraphSessionController({
		resume: async (_runId, input) => calls.push(input),
	});
	controller.update({ id: "run-1", status: "waiting", nextRoutes: routes });
	assert.equal(await controller.handleInput("\x1b9"), true);
	assert.equal(await controller.chooseVisibleRoute(10), false);
	assert.deepEqual(calls, [{ next: "route-9" }]);
});

test("ctrl+g picker can choose routes hidden from shortcut view", async () => {
	const calls: unknown[] = [];
	const routes = Array.from({ length: 12 }, (_, i) => `route-${i + 1}`);
	const controller = new GraphSessionController({
		resume: async (_runId, input) => calls.push(input),
		openRoutePicker: async () => "route-12",
	});
	controller.update({ id: "run-1", status: "waiting", nextRoutes: routes });
	assert.equal(await controller.handleInput("\x07"), true);
	assert.deepEqual(calls, [{ next: "route-12" }]);
});

test("ctrl+r restart choice calls restart handler", async () => {
	const restarted: string[] = [];
	const controller = new GraphSessionController({
		resume: async () => undefined,
		confirmReset: () => "restart",
		onRestart: async (runId) => restarted.push(runId),
	});
	controller.update({ id: "run-1", status: "waiting", nextRoutes: ["next"] });
	assert.equal(await controller.handleInput("\x12"), true);
	assert.deepEqual(restarted, ["run-1"]);
});

test("ctrl+r asks for confirmation before reset actions", async () => {
	let cleared = false;
	const controller = new GraphSessionController({
		resume: async () => undefined,
		confirmReset: () => "clearWidget",
		onClearWidget: () => {
			cleared = true;
		},
	});
	controller.update({ id: "run-1", status: "waiting", nextRoutes: ["next"] });
	assert.equal(await controller.handleInput("\x12"), true);
	assert.equal(cleared, true);
});

test("shortcuts:false disables input interception", async () => {
	const calls: unknown[] = [];
	const controller = new GraphSessionController({
		resume: async (_runId, input) => calls.push(input),
	});
	controller.update(
		{ id: "run-1", status: "waiting", nextRoutes: ["next"] },
		{ shortcuts: false },
	);
	assert.equal(await controller.handleInput("\x1b1"), false);
	assert.deepEqual(calls, []);
});

test("non pi-graph keys are delegated", async () => {
	const controller = new GraphSessionController({
		resume: async () => undefined,
	});
	controller.update({ id: "run-1", status: "waiting", nextRoutes: ["next"] });
	assert.equal(await controller.handleInput("a"), false);
});
