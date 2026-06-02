import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(here, "../..");
export const cwd = () => process.cwd();
export const projectGraphDir = (base = cwd()) => path.join(base, ".pi", "graphs");
export const userGraphDir = () => path.join(homedir(), ".pi", "agent", "graphs");
export const builtinGraphDir = () => path.join(packageRoot, "graphs");
export const graphDirs = (base = cwd()) => ({ project: projectGraphDir(base), user: userGraphDir(), builtin: builtinGraphDir() });
export async function ensureDir(dir: string) { await mkdir(dir, { recursive: true }); return dir; }
export function graphFileName(name: string) { return `${name}.json`; }
export function graphPath(scope: "project" | "user" | "builtin", name: string, base = cwd()) { return path.join(graphDirs(base)[scope], graphFileName(name)); }
