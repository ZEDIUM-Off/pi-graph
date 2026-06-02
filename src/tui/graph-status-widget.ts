import type { GraphConfig } from "../shared/types.js";
import { renderNodeStatuses, renderRunSummary } from "./render.js";

export function graphStatusWidget(graph: GraphConfig, run?: any): string {
	return [
		renderRunSummary(run ?? { graphName: graph.name, status: "not-run" }),
		"",
		renderNodeStatuses(graph, run),
	].join("\n");
}
