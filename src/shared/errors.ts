export class GraphError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message);
    this.name = "GraphError";
  }
}

export function errorToResult(error: unknown) {
  if (error instanceof GraphError) return { ok: false, error: error.message, code: error.code, details: error.details };
  if (error instanceof Error) return { ok: false, error: error.message, code: "error", details: {} };
  return { ok: false, error: String(error), code: "error", details: {} };
}
