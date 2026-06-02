import type {
	GraphConfig,
	GraphNode,
	ValidationIssue,
	ValidationResult,
} from "../shared/types.js";
import { isJsonSerializable } from "../shared/json.js";

const nodeTypes = new Set([
	"transform",
	"condition",
	"agent",
	"subagent-chain",
	"human",
	"tool",
	"subgraph",
	"thought-graph",
	"end",
]);
const contextModes = new Set(["fresh", "fork", "none", "selected", "current"]);
const idRe = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function validateGraphConfig(graph: GraphConfig): ValidationResult {
	const errors: ValidationIssue[] = [];
	const warnings: ValidationIssue[] = [];
	const err = (path: string, message: string, code?: string) =>
		errors.push({ path, message, code });
	const warn = (path: string, message: string, code?: string) =>
		warnings.push({ path, message, code });

	if ((graph as any).version !== 1)
		err("version", "version must be 1", "version");
	if (!graph.name || typeof graph.name !== "string")
		err("name", "name is required", "required");
	else if (!idRe.test(graph.name))
		err("name", "graph name must match /^[A-Za-z][A-Za-z0-9_-]*$/", "id");
	if (!Array.isArray(graph.nodes) || graph.nodes.length === 0)
		err("nodes", "nodes must be a non-empty array", "required");
	if (!graph.start || typeof graph.start !== "string")
		err("start", "start is required", "required");
	if (graph.context?.mode && !contextModes.has(graph.context.mode))
		err(
			"context.mode",
			`unsupported context mode ${graph.context.mode}`,
			"context",
		);

	const ids = new Set<string>();
	for (const [i, node] of (graph.nodes ?? []).entries()) {
		const p = `nodes[${i}]`;
		if (!node.id || !idRe.test(node.id))
			err(`${p}.id`, "node id must match /^[A-Za-z][A-Za-z0-9_-]*$/", "id");
		if (ids.has(node.id))
			err(`${p}.id`, `duplicate node id ${node.id}`, "duplicate");
		ids.add(node.id);
		if (!nodeTypes.has(node.type))
			err(`${p}.type`, `unsupported node type ${node.type}`, "type");
		if (node.context?.mode && !contextModes.has(node.context.mode))
			err(
				`${p}.context.mode`,
				`unsupported context mode ${node.context.mode}`,
				"context",
			);
		if (
			node.type === "human" &&
			!isJsonSerializable(node.config?.payload ?? node.config ?? {})
		)
			err(
				`${p}.config`,
				"human payload must be JSON serializable",
				"serializable",
			);
	}
	if (graph.start && !ids.has(graph.start))
		err("start", `start node ${graph.start} does not exist`, "missing_start");

	const edges = graph.edges ?? {};
	for (const [from, to] of Object.entries(edges)) {
		if (!ids.has(from))
			err(`edges.${from}`, `edge source ${from} does not exist`, "edge_source");
		for (const target of edgeTargets(to)) {
			if (target !== "end" && !ids.has(target))
				err(
					`edges.${from}`,
					`edge target ${target} does not exist`,
					"edge_target",
				);
		}
		const node = graph.nodes.find((n) => n.id === from);
		if (
			node?.type === "condition" &&
			!(to && typeof to === "object" && !Array.isArray(to))
		) {
			err(
				`edges.${from}`,
				"condition nodes must route with an object map",
				"condition_routes",
			);
		}
	}

	if (!errors.length) {
		const reachable = reachableNodes(graph);
		for (const node of graph.nodes)
			if (!reachable.has(node.id))
				warn(`nodes.${node.id}`, "node is unreachable", "unreachable");
		if (hasCycle(graph))
			warn(
				"edges",
				"graph contains a cycle; ensure runtime has a termination condition",
				"cycle",
			);
		for (const node of graph.nodes) addRiskWarnings(node, warn);
	}

	return { valid: errors.length === 0, errors, warnings };
}

function edgeTargets(
	value: string | string[] | Record<string, string>,
): string[] {
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) return value;
	if (value && typeof value === "object") return Object.values(value);
	return [];
}

function reachableNodes(graph: GraphConfig): Set<string> {
	const seen = new Set<string>();
	const stack = [graph.start];
	while (stack.length) {
		const id = stack.pop()!;
		if (id === "end" || seen.has(id)) continue;
		seen.add(id);
		for (const t of edgeTargets((graph.edges?.[id] as any) ?? []))
			if (t !== "end") stack.push(t);
	}
	return seen;
}

function hasCycle(graph: GraphConfig): boolean {
	const visiting = new Set<string>(),
		visited = new Set<string>();
	const visit = (id: string): boolean => {
		if (id === "end") return false;
		if (visiting.has(id)) return true;
		if (visited.has(id)) return false;
		visiting.add(id);
		for (const t of edgeTargets((graph.edges?.[id] as any) ?? []))
			if (visit(t)) return true;
		visiting.delete(id);
		visited.add(id);
		return false;
	};
	return visit(graph.start);
}

function addRiskWarnings(
	node: GraphNode,
	warn: (path: string, message: string, code?: string) => void,
) {
	if (node.type === "agent" || node.type === "subagent-chain")
		warn(
			`nodes.${node.id}`,
			"subagent execution requires pi-subagents and may have external effects",
			"subagent_risk",
		);
	if (node.type === "human")
		warn(
			`nodes.${node.id}`,
			"human interrupt requires resume support at runtime",
			"hitl_risk",
		);
	if (node.type === "tool")
		warn(
			`nodes.${node.id}`,
			"tool node execution is limited to static config.result/output unless Pi dispatch is explicitly integrated",
			"tool_risk",
		);
	if (node.type === "thought-graph")
		warn(
			`nodes.${node.id}`,
			"thought graph can branch and increase model cost",
			"got_risk",
		);
	if (node.context?.mode === "current")
		warn(
			`nodes.${node.id}.context.mode`,
			"current-session mode is intentionally unsupported for safe MVP execution",
			"current_session",
		);
}
