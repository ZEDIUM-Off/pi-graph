# pi-graph

Pi package for managing and running JSON workflow graphs with LangGraph.

## Tool actions

Use `graph({"action":"list"})` before selecting a saved graph. Supported actions: `doctor`, `list`, `get`, `create`, `update`, `delete`, `validate`, `preview`, `render`, `run`, `resume`, `status`, `history`, `interrupt`.

Scopes resolve in precedence order: project `.pi/graphs/`, user `~/.pi/agent/graphs/`, then builtin `graphs/`. Creates/updates default to project scope; builtin graphs are read-only.

## Runtime MVP

The runtime validates and normalizes graphs, compiles them to LangGraph, and runs with an in-memory checkpointer. Supported node types include `transform`, `condition`, `human` interrupt/resume, static-output `tool`, inline `subgraph`, `agent` with `agentMode: "subagent"`, `subagent-chain`, and a degraded `thought-graph` MVP.

Subagent nodes require `pi-subagents` (or a compatible mock exposing `pi.subagents.run`, `pi.runSubagent`, `pi.subagent`, `pi.tools.subagent`, `pi.tools.subagents`, or `pi.callTool("subagent", ...)`). Context policies for subagents support `fresh`, `fork`, and `none`; `selected`/`current` are rejected for safe MVP execution.

`run` accepts `saveRun: true` to snapshot status/history in the optional in-memory run store. Runs are not persisted to disk yet.

## Install locally

```bash
pi install /home/zedium/zedium-pi-extentions/pi-graph
# or test once
pi -e /home/zedium/zedium-pi-extentions/pi-graph
```
