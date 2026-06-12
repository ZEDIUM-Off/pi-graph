# System reporting routes

## Purpose

Agents dogfooding pi-graph need a low-friction way to report issues, improvements, and ideas about the harness itself without losing the current graph state.

## Interrupt payload

Every human node interrupt includes:

```json
{
  "system": {
    "routes": ["report_issue", "report_improvement", "report_idea"],
    "hint": "..."
  }
}
```

`nextRoutes` merges graph routes and system routes.

## Recording feedback

Resume the run with:

```json
{
  "system": "report_improvement",
  "target": "pi-graph",
  "note": "Describe the friction or idea."
}
```

The runner records a `system_report_requested` history event and leaves the graph in `waiting` state. The original human interrupt is still active and can be resumed normally afterward.

## Builtin reporting flow

Use `harness-report` to turn raw feedback into a structured handoff:

```js
graph({ action: "run", name: "harness-report", input: { system, target, note, run } })
```

Future work: automatically create or update issues in the relevant harness project.
