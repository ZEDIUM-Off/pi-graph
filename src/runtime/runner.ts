import { Command } from "@langchain/langgraph";
import type { GraphArtifactsResult } from "../graphs/graph-artifacts.js";
import { normalizeGraphConfig } from "../graphs/graph-normalizer.js";
import { validateGraphConfig } from "../graphs/graph-validator.js";
import { GraphError } from "../shared/errors.js";
import { makeRunId } from "../shared/ids.js";
import type { GraphConfig, RunStatus } from "../shared/types.js";
import { createMemorySaver } from "./checkpoints.js";
import { compileGraph } from "./compile.js";
import { extractInterrupts, interruptPayload } from "./interrupts.js";
import { saveRunSnapshot } from "./run-store.js";

interface RunRecord {
	id: string;
	graphName: string;
	graph: GraphConfig;
	status: RunStatus;
	compiled: any;
	config: { configurable: { thread_id: string } };
	result?: unknown;
	interrupt?: unknown;
	history: Array<{ at: string; type: string; data?: unknown }>;
	saveRun?: boolean;
	artifacts?: GraphArtifactsResult;
	onUpdate?: (run: ReturnType<typeof publicRecord>) => void;
}

interface RunOptions {
	pi?: any;
	runId?: string;
	saveRun?: boolean;
	artifacts?: GraphArtifactsResult;
	onUpdate?: (run: ReturnType<typeof publicRecord>) => void;
}

const runs = new Map<string, RunRecord>();

export async function runGraph(
	config: GraphConfig,
	input: unknown = {},
	options: RunOptions = {},
) {
	const graph = normalizeGraphConfig(config);
	const validation = validateGraphConfig(graph);
	if (!validation.valid)
		throw new GraphError("validation_failed", "Graph validation failed", {
			validation,
		});
	const runId = options.runId ?? makeRunId("graph");
	const checkpointer = createMemorySaver();
	const compiled = await compileGraph(graph, { checkpointer, pi: options.pi });
	const record: RunRecord = {
		id: runId,
		graphName: graph.name,
		graph,
		status: "running",
		compiled,
		config: { configurable: { thread_id: runId } },
		history: [
			{
				at: new Date().toISOString(),
				type: "run_started",
				data: { graph: graph.name, saveRun: Boolean(options.saveRun) },
			},
		],
		saveRun: Boolean(options.saveRun),
		artifacts: options.artifacts,
		onUpdate: options.onUpdate,
	};
	runs.set(runId, record);
	notify(record);
	try {
		const result = await compiled.invoke(
			{ input: asRecord(input), run: { runId, graph: graph.name } },
			record.config,
		);
		return finishRecord(record, result);
	} catch (e) {
		record.status = "failed";
		record.history.push({
			at: new Date().toISOString(),
			type: "run_failed",
			data: errorData(e),
		});
		notify(record);
		throw e;
	}
}

export async function resumeGraph(
	id: string,
	message: unknown,
	options: Pick<RunOptions, "onUpdate"> = {},
) {
	const record = getRun(id);
	if (record.status !== "waiting")
		throw new GraphError("run_not_waiting", `Run '${id}' is not waiting`, {
			id,
			status: record.status,
		});
	record.status = "running";
	if (options.onUpdate) record.onUpdate = options.onUpdate;
	record.history.push({
		at: new Date().toISOString(),
		type: "run_resumed",
		data: { message },
	});
	notify(record);
	try {
		const result = await record.compiled.invoke(
			new Command({ resume: message }),
			record.config,
		);
		return finishRecord(record, result);
	} catch (e) {
		record.status = "failed";
		record.history.push({
			at: new Date().toISOString(),
			type: "run_failed",
			data: errorData(e),
		});
		notify(record);
		throw e;
	}
}

export function getRunStatus(id: string) {
	const record = getRun(id);
	return publicRecord(record);
}

export function getRunHistory(id: string) {
	const record = getRun(id);
	return { id, history: record.history, status: record.status };
}

export function interruptRun(id: string) {
	const record = getRun(id);
	if (record.status === "completed" || record.status === "failed") {
		throw new GraphError(
			"run_finished",
			`Run '${id}' is already ${record.status}`,
			{ id, status: record.status },
		);
	}
	record.status = "interrupted";
	record.history.push({
		at: new Date().toISOString(),
		type: "run_interrupted",
	});
	return notify(record);
}

function finishRecord(record: RunRecord, result: unknown) {
	record.result = result;
	const interrupts = extractInterrupts(result);
	if (interrupts.length) {
		record.status = "waiting";
		record.interrupt = interruptPayload(interrupts[0]);
		record.history.push({
			at: new Date().toISOString(),
			type: "run_waiting",
			data: { interrupt: record.interrupt },
		});
	} else {
		record.status = "completed";
		record.interrupt = undefined;
		record.history.push({
			at: new Date().toISOString(),
			type: "run_completed",
		});
	}
	return notify(record);
}

function notify(record: RunRecord) {
	const run = publicRecord(record);
	record.onUpdate?.(run);
	return run;
}

function publicRecord(record: RunRecord) {
	const currentNode = currentNodeId(record);
	const snapshot = {
		id: record.id,
		graphName: record.graphName,
		status: record.status,
		currentNode,
		nextRoutes: currentNode
			? nextRoutes(record.graph, currentNode, record.interrupt)
			: [],
		interrupt: record.interrupt,
		result: record.result,
		history: record.history,
		artifacts: record.artifacts,
	};
	if (record.saveRun) saveRunSnapshot(snapshot);
	return snapshot;
}

function currentNodeId(record: RunRecord): string | undefined {
	const interruptNode = (record.interrupt as any)?.nodeId;
	if (typeof interruptNode === "string") return interruptNode;
	const events = (record.result as any)?.events;
	if (Array.isArray(events)) {
		for (let i = events.length - 1; i >= 0; i--) {
			const node = events[i]?.node;
			if (typeof node === "string") return node;
		}
	}
	return record.graph.start;
}

function nextRoutes(
	graph: GraphConfig,
	nodeId: string,
	interrupt?: unknown,
): string[] {
	const payloadRoutes =
		(interrupt as any)?.payload?.routes ?? (interrupt as any)?.routes;
	if (Array.isArray(payloadRoutes)) return payloadRoutes.map(String);
	const edge = graph.edges?.[nodeId];
	if (!edge) return [];
	if (typeof edge === "string") return edge === "end" ? [] : [edge];
	if (Array.isArray(edge)) return edge.filter((item) => item !== "end");
	return Object.keys(edge);
}

function getRun(id: string): RunRecord {
	const record = runs.get(id);
	if (!record)
		throw new GraphError(
			"run_not_found",
			`Run '${id}' was not found in memory`,
			{ id },
		);
	return record;
}

function asRecord(input: unknown): Record<string, unknown> {
	return input && typeof input === "object" && !Array.isArray(input)
		? (input as Record<string, unknown>)
		: { value: input };
}

function errorData(e: unknown) {
	return e instanceof Error ? { name: e.name, message: e.message } : e;
}
