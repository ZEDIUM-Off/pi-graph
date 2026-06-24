# pi-graph

pi-graph is a graph runtime that controls one or more Pi sessions.

Core model:

- Pi executes turns.
- pi-graph controls the conditions of each turn: active node, visible context, tool policy, execution target, state frame, traces, auto-continue limits, and next route.
- Do not replace Pi with a custom mini agent loop. Build a control layer around the existing Pi runtime.
- Keep graph runtime concerns separate from Pi session runtime concerns.
- Prefer minimal, inspectable state frames over injecting full graph state into context.
- Store full traces/checkpoints outside the model context and expose targeted read tools/routes.
- Human input paths matter: graph runs should know nearest human/interrupt/wait nodes and enforce autonomy limits.

MVP bias:

- graph definitions without internal namespaces
- composition files using `graph.node` links
- current-session agent nodes before more exotic targets
- deterministic tool nodes
- human nodes via interrupt-like waiting
- sliding minimal state frames
- trace artifacts + trace readers
- TUI graph inspector
- shortest path to human/input
- max transitions before human input

Avoid:

- dumping all state into tool outputs or prompt context
- building a rigid pipeline instead of a graph runtime
- over-typing global state too early
- hiding traces where agents/users cannot inspect them
- speculative distributed/remote/vector-memory features before the MVP holds

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
