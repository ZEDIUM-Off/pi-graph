import {
	END,
	START,
	StateGraph,
	type BaseCheckpointSaver,
} from "@langchain/langgraph";
import type { GraphConfig, GraphNode } from "../shared/types.js";
import { GraphError } from "../shared/errors.js";
import { normalizeGraphConfig } from "../graphs/graph-normalizer.js";
import { validateGraphConfig } from "../graphs/graph-validator.js";
import { GraphStateAnnotation } from "./state.js";
import { createMemorySaver } from "./checkpoints.js";
import { createTransformNode } from "./node-handlers/transform-node.js";
import { createConditionRouter } from "./node-handlers/condition-node.js";
import { createHumanNode } from "./node-handlers/human-node.js";
import { createToolNode } from "./node-handlers/tool-node.js";
import { createStoreNode } from "./node-handlers/store-node.js";
import { createSubgraphNode } from "./node-handlers/subgraph-node.js";
import { createSubagentNode } from "./node-handlers/subagent-node.js";
import { createSubagentChainNode } from "./node-handlers/subagent-chain-node.js";
import { createThoughtGraphNode } from "./node-handlers/thought-graph-node.js";
import { createUnsupportedNode } from "./node-handlers/unsupported-node.js";

export interface CompileGraphOptions {
	checkpointer?: BaseCheckpointSaver | false;
	pi?: any;
	depth?: number;
}

export async function compileGraph(
	config: GraphConfig,
	options: CompileGraphOptions = {},
) {
	const graph = normalizeGraphConfig(config);
	const validation = validateGraphConfig(graph);
	if (!validation.valid) {
		throw new GraphError("validation_failed", "Graph validation failed", {
			validation,
		});
	}
	const depth = options.depth ?? 0;
	if (depth > 5)
		throw new GraphError("subgraph_depth", "Maximum subgraph depth exceeded", {
			graph: graph.name,
			depth,
		});

	const builder = new StateGraph(GraphStateAnnotation);
	const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

	for (const node of graph.nodes) {
		if (node.type === "end") continue;
		builder.addNode(
			node.id,
			createNodeHandler(node, { pi: options.pi, depth, graph }),
			commandNodeOptions(node),
		);
	}

	builder.addEdge(
		START,
		isEndTarget(graph.start, nodeById) ? END : (graph.start as any),
	);
	for (const node of graph.nodes) {
		if (node.type === "end") continue;
		const edge = graph.edges?.[node.id];
		if (node.type === "condition") {
			const routes = asRouteMap(edge, node.id);
			builder.addConditionalEdges(node.id as any, async (state) => {
				const target = await createConditionRouter(node, routes)(state);
				return isEndTarget(target, nodeById) ? END : target;
			});
			continue;
		}
		for (const target of edgeTargets(edge)) {
			builder.addEdge(
				node.id as any,
				isEndTarget(target, nodeById) ? END : (target as any),
			);
		}
		if (!edge && nodeById.get(node.id)?.type !== "condition")
			builder.addEdge(node.id as any, END);
	}

	return builder.compile({
		checkpointer:
			options.checkpointer === undefined
				? createMemorySaver()
				: options.checkpointer,
	});
}

function createNodeHandler(
	node: GraphNode,
	options: { pi?: any; depth: number; graph: GraphConfig },
) {
	switch (node.type) {
		case "transform":
			return createTransformNode(node);
		case "human":
			return createHumanNode(node);
		case "tool":
			return createToolNode(node, options.pi);
		case "store":
			return createStoreNode(node);
		case "subgraph":
			return createSubgraphNode(node, options);
		case "agent":
			return createSubagentNode(node, options);
		case "subagent-chain":
			return createSubagentChainNode(node, options);
		case "thought-graph":
			return createThoughtGraphNode(node, options.pi);
		case "condition":
			return async () => ({});
		default:
			return createUnsupportedNode(node);
	}
}

function edgeTargets(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (Array.isArray(value))
		return value.filter((v): v is string => typeof v === "string");
	if (value && typeof value === "object")
		return Object.values(value as Record<string, unknown>).filter(
			(v): v is string => typeof v === "string",
		);
	return [];
}

function isEndTarget(
	target: string,
	nodeById: Map<string, GraphNode>,
): boolean {
	return target === "end" || nodeById.get(target)?.type === "end";
}

function asRouteMap(value: unknown, nodeId: string): Record<string, string> {
	if (value && typeof value === "object" && !Array.isArray(value))
		return value as Record<string, string>;
	throw new GraphError(
		"condition_routes",
		`Condition node '${nodeId}' requires object routes`,
		{ node: nodeId },
	);
}


function commandNodeOptions(node: GraphNode): { ends?: string[] } | undefined {
	const command = (node.config as Record<string, unknown> | undefined)?.command as
		| Record<string, unknown>
		| undefined;
	if (!command || typeof command !== "object") return undefined;
	const ends = commandEnds(command);
	return ends.length ? ({ ends } as any) : undefined;
}

function commandEnds(command: Record<string, unknown>): string[] {
	const values = [command.ends, command.goto].flatMap((value) =>
		Array.isArray(value) ? value : [value],
	);
	return [...new Set(
		values
			.filter((value): value is string => typeof value === "string" && !value.includes("{{"))
			.map((value) => (value === "end" ? END : value)),
	)];
}
