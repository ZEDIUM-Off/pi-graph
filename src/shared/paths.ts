import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GraphScope } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(here, "../..");
export const cwd = () => process.cwd();
export const projectGraphDir = (base = cwd()) =>
	path.join(base, ".pi", "graphs");
export const userGraphDir = () =>
	path.join(homedir(), ".pi", "agent", "graphs");
export const builtinGraphDir = () => path.join(packageRoot, "graphs");
export const graphDirs = (base = cwd()) => ({
	project: projectGraphDir(base),
	user: userGraphDir(),
	builtin: builtinGraphDir(),
});
export async function ensureDir(dir: string) {
	await mkdir(dir, { recursive: true });
	return dir;
}
export function graphFileName(name: string) {
	return `${name}.json`;
}
export function graphPath(scope: GraphScope, name: string, base = cwd()) {
	return path.join(graphDirs(base)[scope], graphFileName(name));
}


export const projectGraphRunRoot = (base = cwd()) =>
	path.join(base, ".pi", "graph-runs");
export const graphStoreDir = (base = cwd()) =>
	path.join(base, ".pi", "graph-store");
export const graphStorePath = (base = cwd()) =>
	path.join(graphStoreDir(base), "store.json");
export function graphRunDir(runId: string, base = cwd()) {
	return path.join(projectGraphRunRoot(base), runId);
}
export function graphRunPath(runId: string, file: string, base = cwd()) {
	return path.join(graphRunDir(runId, base), file);
}

export function graphArtifactDir(
	scope: GraphScope | "path",
	name: string,
	base = cwd(),
) {
	if (scope === "builtin")
		return path.join(base, ".pi", "graph-artifacts", "builtin", name);
	if (scope === "user") return path.join(userGraphDir(), name);
	return path.join(projectGraphDir(base), name);
}

export function graphArtifactPath(
	scope: GraphScope | "path",
	name: string,
	file: string,
	base = cwd(),
) {
	return path.join(graphArtifactDir(scope, name, base), file);
}

export function graphArtifactJsonPath(
	scope: GraphScope | "path",
	name: string,
	base = cwd(),
) {
	return graphArtifactPath(scope, name, "graph.json", base);
}
export function graphArtifactMmdPath(
	scope: GraphScope | "path",
	name: string,
	base = cwd(),
) {
	return graphArtifactPath(scope, name, "graph.mmd", base);
}
export function graphArtifactSvgPath(
	scope: GraphScope | "path",
	name: string,
	base = cwd(),
) {
	return graphArtifactPath(scope, name, "graph.svg", base);
}
export function graphArtifactManifestPath(
	scope: GraphScope | "path",
	name: string,
	base = cwd(),
) {
	return graphArtifactPath(scope, name, "manifest.json", base);
}
