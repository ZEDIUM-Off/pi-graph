# pi-graph 0.2.0 release notes

## Release intent

`0.2.0` turns pi-graph from an in-memory workflow runner into a more useful dogfooding harness for Pi agents.

The release focuses on four capabilities:

1. persisted run artifacts;
2. graph-level Command routing;
3. always-available harness feedback routes;
4. cross-run workspace state through a minimal store node.

This is the first release where `pi-graph` can carry workspace-level orchestration state for `/home/zedium/workspaces` while also capturing its own friction as structured feedback.

## User-facing changes

### Saved run artifacts

Use:

```js
graph({ action: "run", name: "understand", input: { goal: "..." }, saveRun: true })
```

This writes:

```txt
.pi/graph-runs/<run-id>/
  run.json
  history.json
  final-state.json
  graph.json
  graph.mmd
  graph.svg        # when available
  summary.md
```

Inspect saved runs:

```js
graph({ action: "list-runs" })
graph({ action: "get-run", id: "<run-id>" })
graph({ action: "status", id: "<run-id>" })
graph({ action: "history", id: "<run-id>" })
```

`status` and `history` read in-memory runs first, then fall back to disk.

### Command routing

Transform nodes can now return a LangGraph `Command` update and route to another node:

```json
{
  "id": "decide",
  "type": "transform",
  "config": {
    "set": { "selected": "right" },
    "output": "selected {{state.selected}}",
    "command": {
      "goto": "right",
      "ends": ["right", "left"]
    }
  }
}
```

Use `ends` to declare static destinations for LangGraph compilation, validation, preview, and Mermaid rendering. Templated `goto` values are supported when their possible destinations are declared in `ends`.

### Harness reporting routes

Every human interrupt now exposes:

```txt
report_issue
report_improvement
report_idea
```

A user or agent may resume with:

```json
{
  "system": "report_improvement",
  "target": "pi-graph",
  "note": "The route picker should surface system reporting separately."
}
```

This records a `system_report_requested` history event and leaves the original human interrupt waiting.

### Persistent store node

Use the `store` node to persist cross-run state in `.pi/graph-store/store.json`:

```json
{
  "id": "save_focus",
  "type": "store",
  "config": {
    "op": "set",
    "key": "workspace.focus",
    "value": "{{outputs.capture}}"
  }
}
```

Supported operations:

- `get`
- `set`
- `merge`

## Builtin graph: `harness-report`

`harness-report` is a human-in-the-loop reporting graph. It captures:

- target project (`pi-graph`, `pi-context-tree`, `skills`, `context-files`, `other`);
- kind (`bug`, `improvement`, `idea`);
- severity;
- title/summary;
- observed/expected behavior;
- reproduction notes and relevant files.

It currently produces a structured `harness_report` handoff. Automatic issue creation is intentionally left for a later release.

## Compatibility

Existing graph files continue to work.

Breaking changes: none intended.

Behavioral change: human interrupt route lists now include system reporting routes in addition to graph routes.

## Known limitation: durable resume

`saveRun: true` persists inspection artifacts, but a waiting run cannot yet be resumed after the Pi process exits because LangGraph still uses an in-memory checkpointer.

Next release target:

- add durable SQLite checkpointer support;
- recompile archived `graph.json`;
- resume with the same `thread_id = runId`.

Tracked in workspace dogfooding idea:

```txt
/home/zedium/workspaces/.agents/ideas/pi-graph-durable-resume.md
```

## Verification

Before tagging:

```bash
npm run typecheck
npm test
```

Expected at release time:

```txt
49 passing tests
```
