import type { GraphConfig } from "../shared/types.js";

const minWidth = 24;

export function renderGraphDashboard(
	graph: GraphConfig,
	run?: any,
	width = 80,
): string[] {
	const w = Math.max(minWidth, width);
	const status = classifyStatus(run);
	const title = ` pi-graph ─ ${graph.name} ─ ${status} `;
	const lines: string[] = [top(title, w)];
	lines.push(
		row(
			`run ${run?.id ?? "<not-run>"} · node ${run?.currentNode ?? graph.start}`,
			w,
		),
	);
	lines.push(row(`state ${stateLabel(status)}`, w));
	const routes = Array.isArray(run?.nextRoutes)
		? run.nextRoutes.map(String)
		: [];
	if (routes.length && status === "waitingRoute") {
		lines.push(
			separator(` routes ${Math.min(routes.length, 9)}/${routes.length} `, w),
		);
		for (const line of routeRows(routes, w)) lines.push(row(line, w));
	}
	const prompt = promptText(run);
	if (prompt && status !== "waitingRoute") {
		lines.push(separator(" input ", w));
		for (const line of wrap(`prompt ${prompt}`, w - 4).slice(0, 2))
			lines.push(row(line, w));
	}
	lines.push(separator(" actions ", w));
	lines.push(row(actionLine(status, routes.length), w));
	const svg = run?.artifacts?.svg;
	if (svg) lines.push(row(`svg   ${asFileUrl(svg)}`, w));
	const warnings = run?.artifacts?.warnings;
	if (Array.isArray(warnings) && warnings.length)
		lines.push(row(`warn  ${warnings[0]}`, w));
	lines.push(bottom(w));
	return lines;
}

export function renderRunSummary(run: any): string {
	return [
		`Run ${run.id ?? "<unknown>"} · ${run.graphName ?? "<graph>"} · ${run.status ?? "unknown"}`,
		run.currentNode ? `Current: ${run.currentNode}` : undefined,
		Array.isArray(run.nextRoutes) && run.nextRoutes.length
			? `Next: ${run.nextRoutes.join(" | ")}`
			: undefined,
		run.interrupt ? `Waiting: ${JSON.stringify(run.interrupt)}` : undefined,
		Array.isArray(run.history) ? `Events: ${run.history.length}` : undefined,
	]
		.filter(Boolean)
		.join("\n");
}

export function renderNodeStatuses(graph: GraphConfig, run?: any): string {
	const completed = new Set<string>(
		(run?.result?.events ?? [])
			.filter((e: any) => e?.node)
			.map((e: any) => e.node),
	);
	return graph.nodes
		.map((node) => {
			const marker =
				node.id === run?.currentNode ? "▶" : completed.has(node.id) ? "✓" : "○";
			return `${marker} ${node.id} [${node.type}]`;
		})
		.join("\n");
}

function classifyStatus(run: any): string {
	if (!run) return "idle";
	if (run.status === "waiting") {
		const routes = Array.isArray(run.nextRoutes) ? run.nextRoutes : [];
		return routes.length ? "waitingRoute" : "waitingInput";
	}
	if (run.status === "completed" && run.artifacts?.warnings?.length)
		return "stale";
	return run.status ?? "unknown";
}

function stateLabel(status: string): string {
	switch (status) {
		case "running":
			return "running graph";
		case "waitingRoute":
			return "waiting for route";
		case "waitingInput":
			return "waiting for structured input";
		case "completed":
			return "completed";
		case "failed":
			return "failed";
		case "interrupted":
			return "interrupted";
		case "stale":
			return "completed with artifact warnings";
		default:
			return status;
	}
}

function routeRows(routes: string[], width: number): string[] {
	const visible = routes.slice(0, 9);
	const inner = width - 4;
	const columns = inner >= 66 ? 3 : inner >= 44 ? 2 : 1;
	const cell = Math.max(12, Math.floor(inner / columns));
	const rows: string[] = [];
	for (let i = 0; i < visible.length; i += columns) {
		rows.push(
			visible
				.slice(i, i + columns)
				.map((route, offset) =>
					fit(`${i + offset + 1} ${route}`, cell - 1).padEnd(cell),
				)
				.join(""),
		);
	}
	if (routes.length > visible.length)
		rows.push(`… ${routes.length - visible.length} more · ctrl+g picker`);
	return rows;
}

function actionLine(status: string, routeCount: number): string {
	if (status === "waitingRoute" && routeCount > 0)
		return "ctrl+g picker · ctrl+r reset · alt+1..9 routes if available";
	if (status === "waitingInput") return "type resume input · ctrl+r reset";
	if (status === "running") return "watch progress · ctrl+r reset";
	return "ctrl+r reset/clear · graph resume/status available";
}

function promptText(run: any): string | undefined {
	const prompt = run?.interrupt?.prompt;
	return typeof prompt === "string" && prompt.trim() ? prompt : undefined;
}

function asFileUrl(file: string): string {
	return file.startsWith("file://") ? file : `file://${file}`;
}

function top(titleText: string, width: number): string {
	return `╭─${fit(titleText, width - 3, "─")}╮`;
}

function separator(label: string, width: number): string {
	return `├─${fit(label, width - 3, "─")}┤`;
}

function bottom(width: number): string {
	return `╰${"─".repeat(Math.max(0, width - 2))}╯`;
}

function row(text: string, width: number): string {
	return `│ ${fit(text, width - 4).padEnd(width - 4)} │`;
}

function fit(text: string, width: number, fill = " "): string {
	if (width <= 0) return "";
	const plain = String(text);
	if (plain.length > width)
		return width <= 1 ? "…" : `${plain.slice(0, width - 1)}…`;
	return fill === " "
		? plain
		: `${plain}${fill.repeat(Math.max(0, width - plain.length))}`;
}

function wrap(text: string, width: number): string[] {
	if (text.length <= width) return [text];
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		if (`${current} ${word}`.trim().length > width) {
			if (current) lines.push(current);
			current = word;
		} else current = `${current} ${word}`.trim();
	}
	if (current) lines.push(current);
	return lines;
}
