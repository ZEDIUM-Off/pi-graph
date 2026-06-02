import type { GraphConfig } from "../shared/types.js";
import { previewGraph } from "../graphs/graph-preview.js";

export function renderPreviewDialog(graph: GraphConfig): string {
	const preview = previewGraph(graph);
	return [
		`# Preview: ${graph.name}`,
		preview.markdown,
		"```mermaid",
		preview.mermaid,
		"```",
	].join("\n\n");
}
