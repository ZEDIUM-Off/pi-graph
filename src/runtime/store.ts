import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { graphStorePath } from "../shared/paths.js";

export type GraphStoreData = Record<string, unknown>;

export function readGraphStore(): GraphStoreData {
	const file = graphStorePath();
	if (!existsSync(file)) return {};
	return JSON.parse(readFileSync(file, "utf8")) as GraphStoreData;
}

export function writeGraphStore(data: GraphStoreData): GraphStoreData {
	const file = graphStorePath();
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
	return data;
}

export function getStorePath(key: string): unknown {
	return key.split(".").reduce((value: any, part) => value?.[part], readGraphStore() as any);
}

export function setStorePath(key: string, value: unknown): GraphStoreData {
	const data = readGraphStore();
	setNested(data, key, value, false);
	return writeGraphStore(data);
}

export function mergeStorePath(key: string, value: unknown): GraphStoreData {
	const data = readGraphStore();
	setNested(data, key, value, true);
	return writeGraphStore(data);
}

function setNested(root: GraphStoreData, key: string, value: unknown, merge: boolean) {
	const parts = key.split(".").filter(Boolean);
	if (!parts.length) return;
	let cursor: Record<string, unknown> = root;
	for (const part of parts.slice(0, -1)) {
		const next = cursor[part];
		if (!next || typeof next !== "object" || Array.isArray(next)) cursor[part] = {};
		cursor = cursor[part] as Record<string, unknown>;
	}
	const leaf = parts.at(-1)!;
	cursor[leaf] = merge && isRecord(cursor[leaf]) && isRecord(value)
		? { ...(cursor[leaf] as Record<string, unknown>), ...value }
		: value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
