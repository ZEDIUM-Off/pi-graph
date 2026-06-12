# Store node

## Purpose

The `store` node provides a minimal cross-run state store for workspace-level orchestration.

Storage path:

```txt
.pi/graph-store/store.json
```

## Operations

### get

```json
{
  "id": "load_focus",
  "type": "store",
  "config": { "op": "get", "key": "workspace.focus" }
}
```

### set

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

### merge

```json
{
  "id": "merge_inventory",
  "type": "store",
  "config": {
    "op": "merge",
    "key": "workspace.inventory",
    "value": { "updatedAt": "{{input.updatedAt}}" }
  }
}
```

## Notes

- Keys are dot-separated paths.
- `merge` performs a shallow object merge at the target key.
- The store is a simple JSON file, not a concurrent database.
- Pass object payloads as actual objects, not JSON strings, when resuming human nodes that feed store nodes.
