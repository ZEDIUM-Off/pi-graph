# pi-graph

Pi package for managing and running JSON workflow graphs with LangGraph.

## Tool actions

Use `graph({"action":"list"})` before selecting a saved graph.

Supported actions:

```txt
doctor, list, get, create, update, delete, validate, preview, render,
run, resume, status, history, list-runs, get-run, interrupt
```

Scopes resolve in precedence order:

1. project `.pi/graphs/`
2. user `~/.pi/agent/graphs/`
3. builtin `graphs/`

Creates/updates default to project scope; builtin graphs are read-only.

## Runtime

The runtime validates and normalizes graphs, compiles them to LangGraph, and currently runs with an in-memory LangGraph checkpointer.

Supported node types:

- `transform`
- `condition`
- `human`
- static-output `tool`
- persistent `store`
- inline/reference `subgraph`
- `agent` with `agentMode: "subagent"`
- `subagent-chain`
- degraded `thought-graph` MVP
- `end`

Subagent nodes require `pi-subagents` or a compatible mock exposing `pi.subagents.run`, `pi.runSubagent`, `pi.subagent`, `pi.tools.subagent`, `pi.tools.subagents`, or `pi.callTool("subagent", ...)`.

Context policies for subagents support `fresh`, `fork`, and `none`; `selected`/`current` are rejected for safe MVP execution.

## v0.2.0 capabilities

### Saved run artifacts

`run` accepts `saveRun: true` to persist run artifacts under `.pi/graph-runs/<run-id>/`:

```txt
run.json
history.json
final-state.json
graph.json
graph.mmd
graph.svg        # when available
summary.md
```

`status` and `history` read memory first and fall back to disk. `list-runs` and `get-run` expose saved run records.

See [`docs/run-artifacts.md`](docs/run-artifacts.md).

### Command routing

`transform` nodes may return LangGraph `Command` routing through:

```json
{
  "command": {
    "goto": "targetNode",
    "ends": ["targetNode", "otherNode"]
  }
}
```

Templated `goto` values are supported when concrete destinations are declared in `ends`.

See [`docs/command-routing.md`](docs/command-routing.md).

### System reporting routes

All `human` interrupts advertise system reporting routes:

```txt
report_issue, report_improvement, report_idea
```

Resuming with `{ "system": "report_improvement", "target": "pi-graph", "note": "..." }` records harness feedback without consuming the active human interrupt.

See [`docs/system-reporting.md`](docs/system-reporting.md) and the builtin `harness-report` graph.

### Store node

`store` nodes persist cross-run state in `.pi/graph-store/store.json` with:

```txt
get, set, merge
```

See [`docs/store-node.md`](docs/store-node.md).

## Builtin graphs

Current builtin graphs include:

- `understand`
- `plan`
- `implementation`
- `review-loop`
- `graph-of-thoughts-basic`
- `harness-report`

## Known limitations

- Full resume-after-process-restart is not implemented yet. Saved artifacts are durable, but execution resume still requires a durable LangGraph checkpointer.
- `store` is a simple JSON-file store, not a concurrent database.
- `harness-report` produces a structured handoff payload; it does not yet create GitHub issues automatically.

## Release docs

- [`CHANGELOG.md`](CHANGELOG.md)
- [`docs/release-v0.2.0.md`](docs/release-v0.2.0.md)
- [`docs/run-artifacts.md`](docs/run-artifacts.md)
- [`docs/command-routing.md`](docs/command-routing.md)
- [`docs/system-reporting.md`](docs/system-reporting.md)
- [`docs/store-node.md`](docs/store-node.md)

## Verification

```bash
npm run typecheck
npm test
```

## Install locally

```bash
pi install /home/zedium/workspaces/zedium-pi-extensions/pi-graph
# or test once
pi -e /home/zedium/workspaces/zedium-pi-extensions/pi-graph
```
