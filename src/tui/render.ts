import type { GraphConfig } from "../shared/types.js";

export function renderRunSummary(run: any): string {
	const lines = [
		`Run ${run.id ?? "<unknown>"} · ${run.graphName ?? "<graph>"} · ${run.status ?? "unknown"}`,
	];
	if (run.interrupt) lines.push(`Waiting: ${JSON.stringify(run.interrupt)}`);
	if (Array.isArray(run.history)) lines.push(`Events: ${run.history.length}`);
	return lines.join("\n");
}

export function renderNodeStatuses(graph: GraphConfig, run?: any): string {
	const completed = new Set<string>(
		(run?.result?.events ?? [])
			.filter((e: any) => e?.node)
			.map((e: any) => e.node),
	);
	return graph.nodes
		.map(
			(node) =>
				`${completed.has(node.id) ? "✓" : "○"} ${node.id} [${node.type}]`,
		)
		.join("\n");
}
