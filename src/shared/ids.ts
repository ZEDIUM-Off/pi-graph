import { randomUUID } from "node:crypto";
export function makeRunId(prefix = "run") { return `${prefix}-${new Date().toISOString().replace(/[:.]/g, "")}-${randomUUID().slice(0, 8)}`; }
