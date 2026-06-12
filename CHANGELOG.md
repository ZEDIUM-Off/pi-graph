# Changelog

## 0.2.0 — 2026-06-12

### Added

- Persisted run artifacts for `graph({ action: "run", saveRun: true })` under `.pi/graph-runs/<run-id>/`:
  - `run.json`
  - `history.json`
  - `final-state.json`
  - `graph.json`
  - `graph.mmd`
  - optional `graph.svg`
  - `summary.md`
- New run inspection actions:
  - `graph({ action: "list-runs" })`
  - `graph({ action: "get-run", id })`
- Memory-first, disk-fallback status/history lookup for saved runs.
- Transform node Command routing:
  - `config.command.goto`
  - `config.command.ends`
  - templated `goto` values such as `"{{input.next}}"`
- Mermaid preview support for static Command routes.
- Validator support for static Command targets and Command reachability.
- System reporting routes on all human interrupts:
  - `report_issue`
  - `report_improvement`
  - `report_idea`
- System-report resume handling: `resume` with `{ system: "report_*", target, note }` records harness feedback without consuming the current human interrupt.
- Minimal persistent `store` node backed by `.pi/graph-store/store.json` with `get`, `set`, and `merge` operations.
- Builtin `harness-report` graph for turning harness friction into a structured report payload.

### Changed

- README and skill docs now describe run persistence, Command routing, system reporting, and store nodes.
- Human-node route listings now include normal graph routes plus system reporting routes.
- Existing human interrupt behavior remains compatible: regular resume payloads still complete the interrupt normally.

### Known limitations

- Saved run artifacts are durable, but full resume-after-process-restart is not yet implemented. A durable LangGraph checkpointer, likely SQLite-backed, is still required.
- `store` is a minimal JSON-file store, not a concurrent database.
- `harness-report` produces a structured handoff payload; it does not yet automatically create GitHub issues.

### Verification

- `npm run typecheck`
- `npm test` — 49 passing tests

## 0.1.0

Initial public MVP with graph CRUD, validation, preview/render, LangGraph runtime, human interrupts, subgraphs, subagents, graph artifacts, and TUI dashboard.
