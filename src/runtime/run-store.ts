import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderMermaid } from "../graphs/graph-mermaid.js";
import { GraphError } from "../shared/errors.js";
import { graphRunDir, graphRunPath, projectGraphRunRoot } from "../shared/paths.js";
import type { GraphConfig, RunStatus } from "../shared/types.js";

export interface StoredRunSnapshot {
	id: string;
	graphName: string;
	status: RunStatus;
	currentNode?: string;
	nextRoutes?: string[];
	interrupt?: unknown;
	result?: unknown;
	history: Array<{ at: string; type: string; data?: unknown }>;
	artifacts?: { json?: string; mmd?: string; svg?: string; warnings?: string[] };
}

export interface SavedRunRecord extends StoredRunSnapshot {
	dir?: string;
	files?: Record<string, string>;
}

const savedRuns = new Map<string, StoredRunSnapshot>();

export function saveRunSnapshot(
	snapshot: StoredRunSnapshot,
	options: { graph?: GraphConfig } = {},
): StoredRunSnapshot {
	const copy = cloneSnapshot(snapshot);
	savedRuns.set(copy.id, copy);
	writeRunArtifacts(copy, options.graph);
	return copy;
}

export function getSavedRunStatus(id: string): SavedRunRecord {
	const snapshot = savedRuns.get(id) ?? readRunSnapshot(id);
	if (!snapshot)
		throw new GraphError(
			"saved_run_not_found",
			`Saved run '${id}' was not found`,
			{ id },
		);
	return withFiles(cloneSnapshot(snapshot));
}

export function getSavedRunHistory(id: string) {
	const snapshot = getSavedRunStatus(id);
	return { id, status: snapshot.status, history: snapshot.history };
}

export function listSavedRuns(): SavedRunRecord[] {
	const byId = new Map<string, StoredRunSnapshot>();
	for (const snapshot of savedRuns.values()) byId.set(snapshot.id, snapshot);
	for (const snapshot of readDiskSnapshots()) byId.set(snapshot.id, snapshot);
	return [...byId.values()]
		.map((snapshot) => withFiles(cloneSnapshot(snapshot)))
		.sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
}

export function clearSavedRunsForTest() {
	savedRuns.clear();
}

function writeRunArtifacts(snapshot: StoredRunSnapshot, graph?: GraphConfig) {
	const dir = graphRunDir(snapshot.id);
	mkdirSync(dir, { recursive: true });
	writeJson(path.join(dir, "run.json"), runMetadata(snapshot));
	writeJson(path.join(dir, "history.json"), snapshot.history);
	writeJson(path.join(dir, "final-state.json"), snapshot.result ?? null);
	if (graph) {
		writeJson(path.join(dir, "graph.json"), graph);
		writeFileSync(path.join(dir, "graph.mmd"), `${renderMermaid(graph)}\n`, "utf8");
	}
	copyGraphSvg(snapshot, dir);
	writeFileSync(path.join(dir, "summary.md"), summary(snapshot), "utf8");
}

function runMetadata(snapshot: StoredRunSnapshot) {
	return {
		id: snapshot.id,
		graphName: snapshot.graphName,
		status: snapshot.status,
		currentNode: snapshot.currentNode,
		nextRoutes: snapshot.nextRoutes ?? [],
		interrupt: snapshot.interrupt,
		updatedAt: lastAt(snapshot),
		artifacts: snapshot.artifacts,
		files: runFiles(snapshot.id),
	};
}

function readRunSnapshot(id: string): StoredRunSnapshot | undefined {
	const run = readJson<Partial<StoredRunSnapshot>>(graphRunPath(id, "run.json"));
	const history = readJson<StoredRunSnapshot["history"]>(graphRunPath(id, "history.json"));
	if (!run || !history) return undefined;
	return {
		id,
		graphName: String(run.graphName ?? "unknown"),
		status: (run.status ?? "completed") as RunStatus,
		currentNode: run.currentNode,
		nextRoutes: run.nextRoutes,
		interrupt: run.interrupt,
		result: readJson(graphRunPath(id, "final-state.json")),
		history,
		artifacts: run.artifacts,
	};
}

function readDiskSnapshots(): StoredRunSnapshot[] {
	const root = projectGraphRunRoot();
	if (!existsSync(root)) return [];
	return readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => readRunSnapshot(entry.name))
		.filter((snapshot): snapshot is StoredRunSnapshot => Boolean(snapshot));
}

function withFiles<T extends StoredRunSnapshot>(snapshot: T): T & { dir: string; files: Record<string, string> } {
	return { ...snapshot, dir: graphRunDir(snapshot.id), files: runFiles(snapshot.id) };
}

function runFiles(id: string) {
	return Object.fromEntries(
		["run.json", "history.json", "final-state.json", "graph.json", "graph.mmd", "graph.svg", "summary.md"].map((file) => [file, graphRunPath(id, file)]),
	);
}

function copyGraphSvg(snapshot: StoredRunSnapshot, dir: string) {
	const svg = snapshot.artifacts?.svg;
	if (svg && existsSync(svg)) copyFileSync(svg, path.join(dir, "graph.svg"));
}

function summary(snapshot: StoredRunSnapshot) {
	const lines = [
		`# pi-graph run ${snapshot.id}`,
		"",
		`- Graph: ${snapshot.graphName}`,
		`- Status: ${snapshot.status}`,
		`- Current node: ${snapshot.currentNode ?? "unknown"}`,
		`- Updated: ${lastAt(snapshot)}`,
		"",
		"## History",
		"",
		...snapshot.history.map((entry) => `- ${entry.at} — ${entry.type}`),
		"",
	];
	return `${lines.join("\n")}\n`;
}

function writeJson(file: string, value: unknown) {
	writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson<T = unknown>(file: string): T | undefined {
	try {
		return JSON.parse(readFileSync(file, "utf8")) as T;
	} catch {
		return undefined;
	}
}

function lastAt(snapshot: StoredRunSnapshot) {
	return snapshot.history.at(-1)?.at ?? "";
}

function cloneSnapshot(snapshot: StoredRunSnapshot): StoredRunSnapshot {
	return JSON.parse(JSON.stringify(snapshot)) as StoredRunSnapshot;
}
