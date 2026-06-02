import path from "node:path";
import { access } from "node:fs/promises";
import { readJsonFile } from "../shared/json.js";
import { graphDirs, graphPath } from "../shared/paths.js";
import type { GraphConfig, GraphScope } from "../shared/types.js";
import { GraphError } from "../shared/errors.js";

export async function resolveGraph(nameOrPath: string, scope?: GraphScope): Promise<{ path: string; scope: GraphScope | "path"; config: GraphConfig }> {
  if (nameOrPath.endsWith(".json") || nameOrPath.includes("/") || path.isAbsolute(nameOrPath)) {
    const file = path.resolve(nameOrPath);
    return { path: file, scope: "path", config: await readJsonFile<GraphConfig>(file) };
  }
  const scopes: GraphScope[] = scope ? [scope] : ["project", "user", "builtin"];
  for (const s of scopes) {
    const file = graphPath(s, nameOrPath);
    try { await access(file); return { path: file, scope: s, config: await readJsonFile<GraphConfig>(file) }; } catch {}
  }
  throw new GraphError("graph_not_found", `Graph '${nameOrPath}' not found`, { searched: graphDirs() });
}
