---
name: pi-graph
description: Design, validate, preview, save, and run JSON workflow graphs in Pi using the graph tool. Use when creating or testing pi-graph workflows.
---

# pi-graph

Use `graph` to design, validate, preview, and run JSON workflow graphs. Always run `graph({"action":"list"})` before selecting a saved graph, then `validate` and `preview` before execution.

Runtime nodes currently supported: transform, condition, human interrupt/resume, static tool output, persistent store, subgraph, subagent agent, subagent-chain, and degraded thought-graph. Transform nodes support `config.command.goto` with declared `config.command.ends` for LangGraph Command routing. For subagents prefer `context.mode` of `fresh`, `fork`, or `none`; avoid `current`/`selected` in MVP graphs.


Saved runs: use `saveRun: true` to persist artifacts under `.pi/graph-runs/<run-id>/`; use `list-runs` and `get-run` to inspect them. Human interrupts expose system reporting routes (`report_issue`, `report_improvement`, `report_idea`); use the builtin `harness-report` graph to convert harness friction into a structured report.
