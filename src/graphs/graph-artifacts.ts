import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GraphConfig, GraphScope } from "../shared/types.js";
import {
	ensureDir,
	packageRoot,
	graphArtifactDir,
	graphArtifactJsonPath,
	graphArtifactManifestPath,
	graphArtifactMmdPath,
	graphArtifactSvgPath,
} from "../shared/paths.js";
import { writeJsonAtomic } from "../shared/json.js";
import { renderMermaid } from "./graph-mermaid.js";

const execFileAsync = promisify(execFile);
const rendererVersion = "mmdc-v1";

export interface GraphArtifactsResult {
	dir: string;
	json: string;
	mmd: string;
	svg: string;
	manifest: string;
	warnings: string[];
	renderedSvg: boolean;
	cached: boolean;
}

export type GraphSvgRenderer = (
	inputMmd: string,
	outputSvg: string,
) => Promise<void>;

export interface EnsureGraphArtifactsOptions {
	scope?: GraphScope | "path";
	base?: string;
	force?: boolean;
	renderSvg?: boolean;
	renderer?: GraphSvgRenderer;
}

interface ArtifactManifest {
	name: string;
	hash: string;
	renderer: string;
	updatedAt: string;
	files: { json: string; mmd: string; svg: string };
}

export async function ensureGraphArtifacts(
	graph: GraphConfig,
	options: EnsureGraphArtifactsOptions = {},
): Promise<GraphArtifactsResult> {
	const scope = options.scope ?? graph.scope ?? "project";
	const dir = graphArtifactDir(scope, graph.name, options.base);
	const json = graphArtifactJsonPath(scope, graph.name, options.base);
	const mmd = graphArtifactMmdPath(scope, graph.name, options.base);
	const svg = graphArtifactSvgPath(scope, graph.name, options.base);
	const manifest = graphArtifactManifestPath(scope, graph.name, options.base);
	const warnings: string[] = [];
	const mermaid = renderMermaid(graph);
	const normalizedJson = stableJson(graph);
	const hash = sha256(`${normalizedJson}\n---mmd---\n${mermaid}`);

	await ensureDir(dir);
	await writeJsonAtomic(json, graph);
	await writeFile(mmd, `${mermaid}\n`, "utf8");

	const previous = await readManifest(manifest);
	const svgExists = await exists(svg);
	let cached = Boolean(
		!options.force &&
			previous?.hash === hash &&
			previous?.renderer === rendererVersion &&
			svgExists,
	);
	let renderedSvg = false;

	if (options.renderSvg !== false && !cached) {
		try {
			await (options.renderer ?? defaultMermaidCliRenderer)(mmd, svg);
			renderedSvg = true;
		} catch (e) {
			warnings.push(`Mermaid SVG generation failed: ${formatError(e)}`);
		}
	} else if (options.renderSvg === false) {
		cached = false;
	}

	const nextManifest: ArtifactManifest = {
		name: graph.name,
		hash,
		renderer: rendererVersion,
		updatedAt: new Date().toISOString(),
		files: { json, mmd, svg },
	};
	await writeJsonAtomic(manifest, nextManifest);

	return { dir, json, mmd, svg, manifest, warnings, renderedSvg, cached };
}

export async function defaultMermaidCliRenderer(
	inputMmd: string,
	outputSvg: string,
): Promise<void> {
	const bin = process.platform === "win32" ? "mmdc.cmd" : "mmdc";
	const candidates = [
		path.join(process.cwd(), "node_modules", ".bin", bin),
		path.join(packageRoot, "node_modules", ".bin", bin),
		bin,
	];
	let lastError: unknown;
	for (const command of candidates) {
		if (command !== bin && !(await exists(command))) continue;
		try {
			await execFileAsync(command, ["-i", inputMmd, "-o", outputSvg], {
				timeout: 20_000,
			});
			return;
		} catch (error) {
			lastError = error;
			if ((error as NodeJS.ErrnoException)?.code === "ENOENT") continue;
			throw error;
		}
	}
	throw lastError ?? new Error("mmdc was not found");
}

function stableJson(value: unknown): string {
	return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, item]) => [key, sortKeys(item)]),
	);
}

function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

async function exists(file: string): Promise<boolean> {
	try {
		await access(file);
		return true;
	} catch {
		return false;
	}
}

async function readManifest(
	file: string,
): Promise<ArtifactManifest | undefined> {
	try {
		return JSON.parse(await readFile(file, "utf8")) as ArtifactManifest;
	} catch {
		return undefined;
	}
}

function formatError(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
