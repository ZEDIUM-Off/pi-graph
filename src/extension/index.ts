import { GraphToolParamsSchema, type GraphToolParams } from "./schemas.js";
import { graphToolDescription } from "./tool-description.js";
import { runDoctor } from "./doctor.js";
import {
	listGraphs,
	getGraph,
	createGraph,
	updateGraph,
	deleteGraph,
} from "../graphs/graph-store.js";
import { resolveGraph } from "../graphs/graph-loader.js";
import { normalizeGraphConfig } from "../graphs/graph-normalizer.js";
import { validateGraphConfig } from "../graphs/graph-validator.js";
import { previewGraph } from "../graphs/graph-preview.js";
import {
	runGraph,
	resumeGraph,
	getRunStatus,
	getRunHistory,
	interruptRun,
} from "../runtime/runner.js";
import { errorToResult, GraphError } from "../shared/errors.js";

export default function piGraphExtension(pi: any) {
	pi.registerTool({
		name: "graph",
		label: "Graph",
		description: graphToolDescription,
		parameters: GraphToolParamsSchema,
		async execute(_toolCallId: string, params: GraphToolParams) {
			const result = await handleGraphAction(params, pi);
			return {
				content: [{ type: "text", text: result.text }],
				details: result.details,
			};
		},
	});
}

export async function handleGraphAction(
	params: GraphToolParams,
	pi?: any,
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
					text: `Created graph ${r.config.name} at ${r.path}`,
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
					text: `Updated graph ${r.config.name} at ${r.path}`,
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
				const graph = params.config
					? normalizeGraphConfig(params.config)
					: normalizeGraphConfig(
							(await resolveGraph(required(params.name, "name"), params.scope))
								.config,
						);
				const preview = previewGraph(graph);
				return { text: preview.markdown, details: { graph, preview } };
			}
			case "render": {
				const graph = params.config
					? normalizeGraphConfig(params.config)
					: normalizeGraphConfig(
							(await resolveGraph(required(params.name, "name"), params.scope))
								.config,
						);
				const preview = previewGraph(graph);
				const text =
					params.format === "mermaid" ? preview.mermaid : preview.markdown;
				return { text, details: { graph, preview } };
			}
			case "run": {
				const graph = params.config
					? normalizeGraphConfig(params.config)
					: normalizeGraphConfig(
							(await resolveGraph(required(params.name, "name"), params.scope))
								.config,
						);
				const run = await runGraph(graph, params.input ?? {}, {
					pi,
					saveRun: params.saveRun,
				});
				return {
					text: formatRunText(run),
					details: { run },
				};
			}
			case "resume": {
				const run = await resumeGraph(
					required(params.id, "id"),
					params.message ?? params.input ?? {},
				);
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

function formatRunText(run: any): string {
	const head = `Run ${run.id} (${run.graphName}) is ${run.status}`;
	if (run.status === "waiting")
		return `${head}\nWaiting for human input:\n${JSON.stringify(run.interrupt, null, 2)}`;
	return head;
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
