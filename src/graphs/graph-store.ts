import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { GraphError } from "../shared/errors.js";
import { readJsonFile, writeJsonAtomic } from "../shared/json.js";
import { ensureDir, graphDirs, graphPath } from "../shared/paths.js";
import type { GraphConfig, GraphRecord, GraphScope } from "../shared/types.js";
import { normalizeGraphConfig } from "./graph-normalizer.js";
import { validateGraphConfig } from "./graph-validator.js";
import { resolveGraph } from "./graph-loader.js";

const precedence: GraphScope[] = ["project", "user", "builtin"];

export async function listGraphs(): Promise<GraphRecord[]> {
	const dirs = graphDirs();
	await Promise.all([ensureDir(dirs.project), ensureDir(dirs.user)]);
	const records: GraphRecord[] = [];
	const first = new Map<string, GraphScope>();
	for (const scope of precedence) {
		for (const file of await jsonFiles(dirs[scope])) {
			const name = path.basename(file, ".json");
			const record: GraphRecord = {
				name,
				scope,
				path: path.join(dirs[scope], file),
			};
			if (first.has(name)) record.shadowedBy = first.get(name);
			else first.set(name, scope);
			records.push(record);
		}
	}
	return records.sort(
		(a, b) =>
			a.name.localeCompare(b.name) ||
			precedence.indexOf(a.scope) - precedence.indexOf(b.scope),
	);
}

export async function getGraph(name: string, scope?: GraphScope) {
	return resolveGraph(name, scope);
}

export async function createGraph(
	config: unknown,
	scope: GraphScope = "project",
) {
	if (scope === "builtin")
		throw new GraphError(
			"builtin_readonly",
			"Cannot create builtin graphs at runtime",
		);
	const graph = checked(config);
	const file = graphPath(scope, graph.name);
	try {
		await readJsonFile(file);
		throw new GraphError(
			"graph_exists",
			`Graph '${graph.name}' already exists`,
			{ path: file },
		);
	} catch (e) {
		if (e instanceof GraphError) throw e;
	}
	await writeJsonAtomic(file, graph);
	return { path: file, scope, config: graph };
}

export async function updateGraph(
	name: string,
	config: unknown,
	scope: GraphScope = "project",
) {
	if (scope === "builtin")
		throw new GraphError(
			"builtin_readonly",
			"Cannot update builtin graphs at runtime",
		);
	if (
		config &&
		typeof config === "object" &&
		"name" in config &&
		(config as { name?: unknown }).name !== name
	) {
		throw new GraphError(
			"name_mismatch",
			`Config name must match graph name '${name}'`,
			{ name, configName: (config as { name?: unknown }).name },
		);
	}
	const graph = checked({ ...(config as object), name });
	const file = graphPath(scope, name);
	await writeJsonAtomic(file, graph);
	return { path: file, scope, config: graph };
}

export async function deleteGraph(name: string, scope?: GraphScope) {
	const resolved = await resolveGraph(name, scope);
	if (resolved.scope === "builtin")
		throw new GraphError("builtin_readonly", "Cannot delete builtin graphs");
	if (resolved.scope === "path")
		throw new GraphError(
			"delete_path_unsupported",
			"Delete requires a stored graph name",
		);
	await rm(resolved.path);
	return { path: resolved.path, scope: resolved.scope, name };
}

function checked(config: unknown): GraphConfig {
	const graph = normalizeGraphConfig(config);
	const validation = validateGraphConfig(graph);
	if (!validation.valid)
		throw new GraphError("validation_failed", "Graph validation failed", {
			validation,
		});
	return graph;
}

async function jsonFiles(dir: string): Promise<string[]> {
	try {
		return (await readdir(dir)).filter((f) => f.endsWith(".json"));
	} catch {
		return [];
	}
}
