import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./paths.js";

export async function readJsonFile<T = unknown>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

export function isJsonSerializable(value: unknown): boolean {
  try { JSON.stringify(value); return true; } catch { return false; }
}
