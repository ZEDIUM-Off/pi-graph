import type { GraphState } from "../state.js";

export function getPath(root: unknown, path: string): unknown {
  if (!path) return root;
  return path.split(".").reduce((value: any, key) => value?.[key], root as any);
}

export function resolvePath(state: GraphState, path: string): unknown {
  return getPath({ input: state.input, state: state.state, outputs: state.outputs, run: state.run }, path);
}

export function renderTemplate(value: unknown, state: GraphState): unknown {
  if (typeof value === "string") {
    const full = value.match(/^\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}$/);
    if (full) return resolvePath(state, full[1]);
    return value.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_m, path) => {
      const resolved = resolvePath(state, path);
      return resolved === undefined || resolved === null ? "" : String(resolved);
    });
  }
  if (Array.isArray(value)) return value.map((v) => renderTemplate(v, state));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, renderTemplate(v, state)]));
  }
  return value;
}
