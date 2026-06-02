export type NodeType =
  | "transform"
  | "condition"
  | "agent"
  | "subagent-chain"
  | "human"
  | "tool"
  | "subgraph"
  | "thought-graph"
  | "end";

export type ContextPolicy = "fresh" | "fork" | "none" | "selected" | "current";
export type GraphScope = "project" | "user" | "builtin";
export type RunStatus = "running" | "waiting" | "completed" | "failed" | "interrupted";

export interface GraphNode {
  id: string;
  type: NodeType;
  label?: string;
  description?: string;
  config?: Record<string, unknown>;
  context?: { mode?: ContextPolicy; include?: string[] };
  [key: string]: unknown;
}

export type GraphEdgeMap = Record<string, string | string[] | Record<string, string>>;

export interface GraphConfig {
  version: 1;
  name: string;
  description?: string;
  start: string;
  nodes: GraphNode[];
  edges?: GraphEdgeMap;
  scope?: GraphScope;
  config?: Record<string, unknown>;
  context?: { mode?: ContextPolicy; include?: string[] };
}

export interface ValidationIssue {
  path: string;
  message: string;
  code?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface PreviewResult {
  markdown: string;
  mermaid: string;
  validation: ValidationResult;
}

export interface GraphRecord {
  name: string;
  scope: GraphScope;
  path: string;
  shadowedBy?: GraphScope;
  config?: GraphConfig;
}
