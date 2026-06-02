---
name: pi-graph
description: Design, validate, preview, save, and run JSON workflow graphs in Pi using the graph tool. Use when creating or testing pi-graph workflows.
---

# pi-graph

Use `graph` to design, validate, preview, and run JSON workflow graphs. Always run `graph({"action":"list"})` before selecting a saved graph, then `validate` and `preview` before execution.

Runtime nodes currently supported: transform, condition, human interrupt/resume, static tool output, subgraph, subagent agent, subagent-chain, and degraded thought-graph. For subagents prefer `context.mode` of `fresh`, `fork`, or `none`; avoid `current`/`selected` in MVP graphs.
