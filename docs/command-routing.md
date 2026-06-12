# Command routing

Transform nodes can return LangGraph `Command` objects to apply state/output updates and route to another node in one step.

## Static route

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

## Templated route

```json
{
  "id": "decide",
  "type": "transform",
  "config": {
    "command": {
      "goto": "{{input.next}}",
      "ends": ["prepare", "review", "finish"]
    }
  }
}
```

## Rules

- `goto` may be a static string, `"end"`, an array, or a template that resolves at runtime.
- `ends` should list all possible concrete destinations.
- Static command targets are validated.
- Static command routes participate in reachability checks.
- Static command routes render as dashed Mermaid edges.

## Parent graph readiness

`command.graph: "parent"` maps to LangGraph `Command.PARENT`, but cross-subgraph parent routing should be used carefully and is not yet exercised by builtin graphs.
