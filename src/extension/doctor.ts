import { readJsonFile } from "../shared/json.js";
import { builtinGraphDir, graphDirs, packageRoot } from "../shared/paths.js";

export async function runDoctor(pi?: any) {
  const pkg = await readJsonFile<any>(`${packageRoot}/package.json`);
  let langgraph = false, langgraphError: string | undefined;
  try { await import("@langchain/langgraph"); langgraph = true; } catch (e: any) { langgraphError = e?.message ?? String(e); }
  const tools = discoverToolNames(pi);
  const details = { package: { name: pkg.name, version: pkg.version, root: packageRoot }, cwd: process.cwd(), graphDirs: graphDirs(), builtinGraphDir: builtinGraphDir(), langgraph: { available: langgraph, error: langgraphError }, subagentToolAvailable: tools.includes("subagent"), knownTools: tools };
  const text = [`pi-graph doctor ${pkg.version}`, `cwd: ${process.cwd()}`, `LangGraph import: ${langgraph ? "ok" : "missing"}`, `subagent tool: ${details.subagentToolAvailable ? "available" : "not detected"}`].join("\n");
  return { text, details };
}

function discoverToolNames(pi?: any): string[] {
  try {
    if (typeof pi?.getAllTools === "function") return pi.getAllTools().map((t: any) => t.name).filter(Boolean);
    if (Array.isArray(pi?.tools)) return pi.tools.map((t: any) => t.name).filter(Boolean);
  } catch {}
  return [];
}
