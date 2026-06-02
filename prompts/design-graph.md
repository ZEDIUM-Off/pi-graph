Design a pi-graph JSON workflow for the requested task.

Requirements:
- version must be 1 and every node id must be unique.
- choose a clear `start` node and explicit edges to `end` or an end node.
- use `agent` with `agentMode: "subagent"` for delegated Pi work.
- use `subagent-chain` for sequential scout/planner/worker/reviewer style flows.
- set subagent context to `fresh`, `fork`, or `none` only.
- use `human` for approval gates and `condition` for routing resume outputs.
- include a short description and keep configs JSON-serializable.

Return only the graph JSON unless asked for explanation.
