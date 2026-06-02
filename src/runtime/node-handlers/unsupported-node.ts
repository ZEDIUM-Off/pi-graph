import type { GraphNode } from "../../shared/types.js";
import { GraphError } from "../../shared/errors.js";

export function createUnsupportedNode(node: GraphNode) {
  return async () => {
    throw new GraphError("node_unsupported", `Node type '${node.type}' is not executable in the runtime MVP`, { node: node.id, type: node.type });
  };
}
