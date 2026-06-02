import { Annotation } from "@langchain/langgraph";

export interface GraphRuntimeEvent {
  node?: string;
  type: string;
  message?: string;
  data?: unknown;
  at: string;
}

export interface GraphRuntimeState {
  input: Record<string, unknown>;
  state: Record<string, unknown>;
  outputs: Record<string, unknown>;
  events: GraphRuntimeEvent[];
  errors: unknown[];
  run: Record<string, unknown>;
}

const mergeRecord = (
  left: Record<string, unknown>,
  right?: Record<string, unknown>,
) => ({ ...(left ?? {}), ...(right ?? {}) });

export const GraphStateAnnotation = Annotation.Root({
  input: Annotation<Record<string, unknown>>({
    reducer: mergeRecord,
    default: () => ({}),
  }),
  state: Annotation<Record<string, unknown>>({
    reducer: mergeRecord,
    default: () => ({}),
  }),
  outputs: Annotation<Record<string, unknown>>({
    reducer: mergeRecord,
    default: () => ({}),
  }),
  events: Annotation<GraphRuntimeEvent[]>({
    reducer: (left, right) => left.concat(Array.isArray(right) ? right : [right]),
    default: () => [],
  }),
  errors: Annotation<unknown[]>({
    reducer: (left, right) => left.concat(Array.isArray(right) ? right : [right]),
    default: () => [],
  }),
  run: Annotation<Record<string, unknown>>({
    reducer: mergeRecord,
    default: () => ({}),
  }),
});

export type GraphState = typeof GraphStateAnnotation.State;
export type GraphStateUpdate = typeof GraphStateAnnotation.Update;

export function event(type: string, node?: string, data?: unknown, message?: string): GraphRuntimeEvent {
  return { type, node, data, message, at: new Date().toISOString() };
}
