import type { GraphConfig, PreviewResult } from "../shared/types.js";
import { markdownCode } from "../shared/formatters.js";
import { renderMermaid } from "./graph-mermaid.js";
import { validateGraphConfig } from "./graph-validator.js";

export function previewGraph(graph: GraphConfig): PreviewResult {
  const validation = validateGraphConfig(graph);
  const mermaid = renderMermaid(graph);
  const byType = new Map<string, number>();
  for (const n of graph.nodes) byType.set(n.type, (byType.get(n.type) ?? 0) + 1);
  const riskLines = validation.warnings.filter((w) => /risk|current_session|cycle/.test(w.code ?? "")).map((w) => `- ${w.path}: ${w.message}`);
  const edgeLines = Object.entries(graph.edges ?? {}).map(([from, to]) => `- ${from} → ${typeof to === "string" ? to : Array.isArray(to) ? to.join(", ") : Object.entries(to).map(([k,v]) => `${k}:${v}`).join(", ")}`);
  const markdown = [
    `# Graph preview: ${graph.name}`,
    graph.description ? `\n${graph.description}` : "",
    `\n- Version: ${graph.version}`,
    `- Start: ${graph.start}`,
    `- Nodes: ${graph.nodes.length} (${[...byType.entries()].map(([t,c]) => `${t}=${c}`).join(", ")})`,
    `- Validation: ${validation.valid ? "valid" : "invalid"}`,
    "\n## Nodes",
    ...graph.nodes.map((n) => `- ${n.id}: ${n.type}${n.label ? ` — ${n.label}` : ""}`),
    "\n## Edges",
    ...(edgeLines.length ? edgeLines : ["- No explicit edges"]),
    "\n## Risks and warnings",
    ...(riskLines.length ? riskLines : validation.warnings.map((w) => `- ${w.path}: ${w.message}`)),
    ...(validation.errors.length ? ["\n## Errors", ...validation.errors.map((e) => `- ${e.path}: ${e.message}`)] : []),
    "\n## Mermaid",
    markdownCode("mermaid", mermaid)
  ].filter(Boolean).join("\n");
  return { markdown, mermaid, validation };
}
