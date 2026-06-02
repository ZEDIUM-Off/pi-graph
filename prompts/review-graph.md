Review this pi-graph JSON for correctness and runtime safety.

Check:
- schema shape, version, name, start, node ids, and edge targets.
- condition nodes have object route maps and a fallback where useful.
- human nodes interrupt before external effects.
- subagent nodes use `agentMode: "subagent"` and context `fresh`, `fork`, or `none`.
- no unsupported current-session assumptions.
- thought-graph operations are acceptable if model access is unavailable and degraded deterministic output is sufficient.

Report blockers first, then warnings, then suggested fixes.
