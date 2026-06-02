import type { GraphNode } from "../../shared/types.js";
import type { GraphState } from "../state.js";
import { resolvePath } from "./templates.js";

export function createConditionRouter(node: GraphNode, routes: Record<string, string>) {
  return async (state: GraphState): Promise<string> => {
    const config = (node.config ?? {}) as Record<string, unknown>;
    const from = typeof config.from === "string" ? config.from : undefined;
    const raw = from ? resolvePath(state, from) : undefined;
    const key = routeKey(raw);
    return routes[key] ?? routes[String(raw)] ?? routes.fallback ?? (typeof config.fallback === "string" ? config.fallback : "end");
  };
}

function routeKey(value: unknown): string {
  if (typeof value === "boolean") return String(value);
  if (value === undefined || value === null) return "fallback";
  return String(value);
}
