# Run artifacts

## Purpose

Run artifacts make graph executions inspectable after the active Pi session ends. They are not yet a durable execution checkpoint.

## Enabling persistence

```js
graph({ action: "run", name: "plan", input: {...}, saveRun: true })
```

## Directory layout

```txt
.pi/graph-runs/<run-id>/
  run.json
  history.json
  final-state.json
  graph.json
  graph.mmd
  graph.svg
  summary.md
```

## Files

- `run.json`: run metadata, status, current node, interrupt, artifact paths.
- `history.json`: status transitions and runtime events recorded by the runner.
- `final-state.json`: latest known LangGraph state/result.
- `graph.json`: graph snapshot used for the run.
- `graph.mmd`: Mermaid snapshot.
- `graph.svg`: copied from rendered graph artifacts when available.
- `summary.md`: human-readable overview.

## Lookup behavior

`status` and `history` are memory-first, disk-fallback:

```js
graph({ action: "status", id })
graph({ action: "history", id })
```

Saved-run actions:

```js
graph({ action: "list-runs" })
graph({ action: "get-run", id })
```

## Limitation

A disk-discovered waiting run cannot yet be resumed after process restart. That requires a durable LangGraph checkpointer.
