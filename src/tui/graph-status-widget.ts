import type { GraphConfig } from "../shared/types.js";
import { renderGraphDashboard } from "./render.js";

export function graphStatusWidget(
	graph: GraphConfig,
	run?: any,
	width = 80,
): string {
	return renderGraphDashboard(graph, run, width).join("\n");
}

export function graphStatusWidgetComponent(graph: GraphConfig, run?: any) {
	return (_tui: any, theme: any) => ({
		invalidate() {},
		render(width: number) {
			return colorizeDashboard(renderGraphDashboard(graph, run, width), theme);
		},
	});
}

function colorizeDashboard(lines: string[], theme: any): string[] {
	return lines.map((line) => {
		if (line.startsWith("╭") || line.startsWith("├") || line.startsWith("╰"))
			return fg(theme, "accent", line);
		if (line.includes("waiting for route")) return fg(theme, "warning", line);
		if (line.includes("completed")) return fg(theme, "success", line);
		if (line.includes("failed")) return fg(theme, "error", line);
		if (line.includes("alt+") || line.includes("ctrl+"))
			return fg(theme, "accent", line);
		if (line.includes("svg   file://")) return fg(theme, "dim", line);
		if (line.includes("warn  ")) return fg(theme, "warning", line);
		if (/│\s+\d+\s/.test(line)) return fg(theme, "text", line);
		return fg(theme, "muted", line);
	});
}

function fg(theme: any, color: string, value: string) {
	return theme?.fg ? theme.fg(color, value) : value;
}
