import type { GraphConfig } from "../shared/types.js";

export function renderMermaid(graph: GraphConfig): string {
	const lines = ["flowchart TD", `  START([START]) --> ${nodeId(graph.start)}`];
	for (const node of graph.nodes) {
		if (node.type === "end") continue;
		lines.push(
			`  ${nodeId(node.id)}["${esc(node.label ?? node.id)}\\n${esc(node.type)}"]`,
		);
	}
	for (const node of graph.nodes) {
		if (node.type === "end") continue;
		for (const t of commandTargets(node))
			lines.push(`  ${nodeId(node.id)} -. command .-> ${target(t)}`);
	}
	for (const [from, edge] of Object.entries(graph.edges ?? {})) {
		if (isEndNode(graph, from)) continue;
		if (typeof edge === "string")
			lines.push(`  ${nodeId(from)} --> ${target(edge)}`);
		else if (Array.isArray(edge))
			for (const t of edge) lines.push(`  ${nodeId(from)} --> ${target(t)}`);
		else
			for (const [label, t] of Object.entries(edge))
				lines.push(`  ${nodeId(from)} -- "${esc(label)}" --> ${target(t)}`);
	}
	lines.push("  END([END])");
	return lines.join("\n");
}
function nodeId(id: string) {
	return `n_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}
function target(id: string) {
	return id === "end" ? "END" : nodeId(id);
}
function commandTargets(node: { config?: Record<string, unknown> }) {
	const command = node.config?.command as Record<string, unknown> | undefined;
	if (!command || typeof command !== "object") return [];
	return [command.ends, command.goto]
		.flatMap((value) => (Array.isArray(value) ? value : [value]))
		.filter((value): value is string =>
			typeof value === "string" && !value.includes("{{") && value !== "parent" && value !== "PARENT",
		);
}
function isEndNode(graph: GraphConfig, id: string) {
	return graph.nodes.some((node) => node.id === id && node.type === "end");
}
function esc(s: string) {
	return String(s).replace(/["<>]/g, "").replace(/\|/g, "/");
}
