import { ensureGraphArtifacts } from "../graphs/graph-artifacts.js";
import { resolveGraph } from "../graphs/graph-loader.js";
import { normalizeGraphConfig } from "../graphs/graph-normalizer.js";
import { previewGraph } from "../graphs/graph-preview.js";
import {
	createGraph,
	deleteGraph,
	getGraph,
	listGraphs,
	updateGraph,
} from "../graphs/graph-store.js";
import { validateGraphConfig } from "../graphs/graph-validator.js";
import {
	getRunHistory,
	getRunStatus,
	interruptRun,
	resumeGraph,
	runGraph,
} from "../runtime/runner.js";
import { errorToResult, GraphError } from "../shared/errors.js";
import type { GraphConfig, GraphScope } from "../shared/types.js";
import { GraphSessionController } from "../tui/graph-session-controller.js";
import {
	confirmReset,
	installGraphShortcutEditor,
	pickRoute,
} from "../tui/graph-session-ui.js";
import { graphStatusWidgetComponent } from "../tui/graph-status-widget.js";
import { runDoctor } from "./doctor.js";
import { GraphToolParamsSchema, type GraphToolParams } from "./schemas.js";
import { graphToolDescription } from "./tool-description.js";

let activeGraphController: GraphSessionController | undefined;

export default function piGraphExtension(pi: any) {
	registerGraphShortcuts(pi);
	pi.registerTool({
		name: "graph",
		label: "Graph",
		description: graphToolDescription,
		parameters: GraphToolParamsSchema,
		async execute(
			_toolCallId: string,
			params: GraphToolParams,
			_signal?: AbortSignal,
			onUpdate?: any,
			ctx?: any,
		) {
			const result = await handleGraphAction(params, pi, ctx, onUpdate);
			return {
				content: [{ type: "text", text: result.text }],
				details: result.details,
			};
		},
	});
}

function registerGraphShortcuts(pi: any) {
	if (!pi?.registerShortcut) return;
	for (const shortcut of ["ctrl+g", "ctrl+shift+g"]) {
		pi.registerShortcut(shortcut, {
			description: "pi-graph: open route picker for the active graph run",
			handler: async () => {
				await activeGraphController?.openPicker();
			},
		});
	}
	pi.registerShortcut("ctrl+r", {
		description: "pi-graph: reset/clear the active graph run",
		handler: async () => {
			await activeGraphController?.reset();
		},
	});
}

export async function handleGraphAction(
	params: GraphToolParams,
	pi?: any,
	ctx?: any,
	onUpdate?: any,
): Promise<{ text: string; details: any }> {
	try {
		switch (params.action) {
			case "doctor": {
				const r = await runDoctor(pi);
				return { text: r.text, details: r.details };
			}
			case "list": {
				const graphs = await listGraphs();
				return {
					text: graphs.length
						? graphs
								.map(
									(g) =>
										`${g.name}\t${g.scope}${g.shadowedBy ? ` (shadowed by ${g.shadowedBy})` : ""}`,
								)
								.join("\n")
						: "No graphs found.",
					details: { graphs },
				};
			}
			case "get": {
				const name = required(params.name, "name");
				const r = await getGraph(name, params.scope);
				return {
					text: `Graph ${name} (${r.scope})\n${JSON.stringify(r.config, null, 2)}`,
					details: r,
				};
			}
			case "create": {
				const r = await createGraph(
					requiredConfig(params.config),
					params.scope ?? "project",
				);
				return {
					text: `Created graph ${r.config.name} at ${r.path}${artifactWarnings(r.artifacts)}`,
					details: r,
				};
			}
			case "update": {
				const r = await updateGraph(
					required(params.name, "name"),
					requiredConfig(params.config),
					params.scope ?? "project",
				);
				return {
					text: `Updated graph ${r.config.name} at ${r.path}${artifactWarnings(r.artifacts)}`,
					details: r,
				};
			}
			case "delete": {
				const r = await deleteGraph(
					required(params.name, "name"),
					params.scope,
				);
				return { text: `Deleted graph ${r.name} from ${r.scope}`, details: r };
			}
			case "validate": {
				const graph = params.config
					? normalizeGraphConfig(params.config)
					: (await resolveGraph(required(params.name, "name"), params.scope))
							.config;
				const validation = validateGraphConfig(normalizeGraphConfig(graph));
				return {
					text: validation.valid
						? `Graph ${graph.name} is valid (${validation.warnings.length} warnings)`
						: `Graph ${graph.name ?? "<inline>"} is invalid (${validation.errors.length} errors)`,
					details: { graph, validation },
				};
			}
			case "preview": {
				const resolved = await resolveActionGraph(params);
				const preview = previewGraph(resolved.graph);
				const artifacts = await ensureGraphArtifacts(resolved.graph, {
					scope: resolved.scope,
					renderSvg: params.renderSvg,
				});
				return {
					text: `${preview.markdown}${artifactWarnings(artifacts)}`,
					details: { graph: resolved.graph, preview, artifacts },
				};
			}
			case "render": {
				const resolved = await resolveActionGraph(params);
				const preview = previewGraph(resolved.graph);
				const artifacts = await ensureGraphArtifacts(resolved.graph, {
					scope: resolved.scope,
					renderSvg: params.renderSvg,
				});
				const text =
					params.format === "mermaid" ? preview.mermaid : preview.markdown;
				return {
					text: `${text}${artifactWarnings(artifacts)}`,
					details: { graph: resolved.graph, preview, artifacts },
				};
			}
			case "run": {
				const resolved = await resolveActionGraph(params);
				const artifacts = await ensureGraphArtifacts(resolved.graph, {
					scope: resolved.scope,
					renderSvg: params.renderSvg,
				});
				const updateWidget = makeWidgetUpdater(ctx, params, resolved.graph);
				let controller: GraphSessionController | undefined;
				controller = await maybeInstallController(
					ctx,
					params,
					updateWidget,
					(r: any) => {
						controller?.update(r, { shortcuts: params.shortcuts });
					},
					async () => {
						const restarted = await runGraph(
							resolved.graph,
							params.input ?? {},
							{
								pi,
								saveRun: params.saveRun,
								artifacts,
								onUpdate: (r) => {
									updateWidget(r);
									controller?.update(r, { shortcuts: params.shortcuts });
									emitToolUpdate(onUpdate, r);
								},
							},
						);
						updateWidget(restarted);
						controller?.update(restarted, { shortcuts: params.shortcuts });
						return restarted;
					},
				);
				const run = await runGraph(resolved.graph, params.input ?? {}, {
					pi,
					saveRun: params.saveRun,
					artifacts,
					onUpdate: (r) => {
						updateWidget(r);
						controller?.update(r, { shortcuts: params.shortcuts });
						emitToolUpdate(onUpdate, r);
					},
				});
				updateWidget(run);
				controller?.update(run, { shortcuts: params.shortcuts });
				return {
					text: `${formatRunText(run)}${artifactWarnings(artifacts)}`,
					details: { run, artifacts },
				};
			}
			case "resume": {
				const run = await resumeGraph(
					required(params.id, "id"),
					params.message ?? params.input ?? {},
					{ onUpdate: (r) => emitToolUpdate(onUpdate, r) },
				);
				updateResumeWidget(ctx, params, run);
				return { text: formatRunText(run), details: { run } };
			}
			case "status": {
				const run = getRunStatus(required(params.id, "id"));
				return { text: formatRunText(run), details: { run } };
			}
			case "history": {
				const history = getRunHistory(required(params.id, "id"));
				return {
					text: history.history.map((e) => `${e.at}\t${e.type}`).join("\n"),
					details: history,
				};
			}
			case "interrupt": {
				const run = interruptRun(required(params.id, "id"));
				return { text: formatRunText(run), details: { run } };
			}
			default:
				throw new GraphError(
					"unknown_action",
					`Unknown graph action '${(params as any).action}'`,
					{ action: (params as any).action },
				);
		}
	} catch (e) {
		const r = errorToResult(e);
		return { text: `graph error [${r.code}]: ${r.error}`, details: r };
	}
}

async function resolveActionGraph(
	params: GraphToolParams,
): Promise<{ graph: GraphConfig; scope: GraphScope | "path" }> {
	if (params.config) {
		const graph = normalizeGraphConfig(params.config);
		return { graph, scope: params.scope ?? "project" };
	}
	const resolved = await resolveGraph(
		required(params.name, "name"),
		params.scope,
	);
	return {
		graph: normalizeGraphConfig(resolved.config),
		scope: resolved.scope,
	};
}

function makeWidgetUpdater(
	ctx: any,
	params: GraphToolParams,
	graph: GraphConfig,
) {
	const enabled = params.ui !== false && ctx?.hasUI && ctx?.ui?.setWidget;
	return (run: any) => {
		if (!enabled) return;
		ctx.ui.setWidget("pi-graph", graphStatusWidgetComponent(graph, run), {
			placement: "belowEditor",
		});
	};
}

async function maybeInstallController(
	ctx: any,
	params: GraphToolParams,
	updateWidget: (run: any) => void,
	onControllerUpdate: (run: any) => void,
	onRestart: (runId: string) => Promise<unknown> | unknown,
): Promise<GraphSessionController | undefined> {
	if (params.ui === false || !ctx?.hasUI) return undefined;
	let controller: GraphSessionController;
	controller = new GraphSessionController({
		resume: async (runId, input) => {
			const run = await resumeGraph(runId, input, {
				onUpdate: (r) => {
					updateWidget(r);
					onControllerUpdate(r);
				},
			});
			updateWidget(run);
			onControllerUpdate(run);
			return run;
		},
		openRoutePicker: (routes) => pickRoute(ctx, routes),
		confirmReset: () => confirmReset(ctx),
		onClearWidget: () =>
			ctx.ui?.setWidget?.("pi-graph", [], { placement: "belowEditor" }),
		onClearSelection: () => undefined,
		onRestart,
		onError: (error) => console.warn("pi-graph shortcut error", error),
	});
	activeGraphController = controller;
	if (params.shortcuts !== false)
		await installGraphShortcutEditor(ctx, controller);
	return controller;
}

function updateResumeWidget(ctx: any, params: GraphToolParams, run: any) {
	if (params.ui === false || !ctx?.hasUI || !ctx?.ui?.setWidget) return;
	const graph: GraphConfig = {
		version: 1,
		name: run.graphName ?? "graph",
		start: run.currentNode ?? "unknown",
		nodes: [{ id: run.currentNode ?? "unknown", type: "human" }],
		edges: {},
	};
	ctx.ui.setWidget("pi-graph", graphStatusWidgetComponent(graph, run), {
		placement: "belowEditor",
	});
}

function emitToolUpdate(onUpdate: any, run: any) {
	onUpdate?.({
		content: [{ type: "text", text: formatRunText(run) }],
		details: { run },
	});
}

function formatRunText(run: any): string {
	const head = `Run ${run.id} (${run.graphName}) is ${run.status}`;
	if (run.status === "waiting")
		return `${head}\nWaiting for human input:\n${JSON.stringify(run.interrupt, null, 2)}`;
	return head;
}

function artifactWarnings(artifacts?: { warnings?: string[] }) {
	return artifacts?.warnings?.length
		? `\nWarnings:\n${artifacts.warnings.map((warning) => `- ${warning}`).join("\n")}`
		: "";
}

function required<T>(value: T | undefined, name: string): T {
	if (value === undefined || value === null || value === "")
		throw new GraphError(
			"missing_param",
			`Missing required parameter '${name}'`,
		);
	return value;
}
function requiredConfig(config: unknown) {
	if (config === undefined)
		throw new GraphError(
			"missing_param",
			"Missing required parameter 'config'",
		);
	return config;
}
