import type { GraphNode } from "../../shared/types.js";
import { event, type GraphState, type GraphStateUpdate } from "../state.js";
import { renderTemplate } from "./templates.js";

interface Thought {
	text: string;
	score?: number;
	data?: unknown;
}

export function createThoughtGraphNode(node: GraphNode, pi?: any) {
	return async (state: GraphState): Promise<GraphStateUpdate> => {
		const config = (node.config ?? {}) as Record<string, unknown>;
		const operations = Array.isArray(config.operations)
			? (config.operations as Record<string, unknown>[])
			: [];
		let thoughts: Thought[] = normalizeThoughts(
			renderTemplate(config.input ?? config.prompt ?? state.input, state),
		);
		for (const operation of operations) {
			const op = operation.op;
			if (op === "generate")
				thoughts = await generate(thoughts, operation, state, pi);
			else if (op === "score") thoughts = score(thoughts, operation);
			else if (op === "keepBest") thoughts = keepBest(thoughts, operation);
			else if (op === "aggregate") thoughts = aggregate(thoughts);
		}
		const output = thoughts.length === 1 ? thoughts[0] : thoughts;
		return {
			outputs: { [node.id]: output },
			events: [
				event("node_completed", node.id, {
					type: "thought-graph",
					operations: operations.length,
					degraded: !pi?.model,
				}),
			],
		};
	};
}

async function generate(
	thoughts: Thought[],
	operation: Record<string, unknown>,
	state: GraphState,
	pi: any,
): Promise<Thought[]> {
	const n =
		typeof operation.n === "number" && operation.n > 0
			? Math.floor(operation.n)
			: 1;
	const prompt = renderTemplate(operation.prompt ?? "{{input.prompt}}", state);
	if (pi?.model && typeof pi.model.generate === "function") {
		const generated = await Promise.all(
			Array.from({ length: n }, () => pi.model.generate({ prompt })),
		);
		return generated.map((text) => ({ text: String(text) }));
	}
	const seed = thoughts.length
		? thoughts.map((t) => t.text).join("\n")
		: String(prompt ?? "thought");
	return Array.from({ length: n }, (_, i) => ({
		text: n === 1 ? seed : `${seed} [candidate ${i + 1}]`,
	}));
}

function score(
	thoughts: Thought[],
	operation: Record<string, unknown>,
): Thought[] {
	const scores = Array.isArray(operation.scores) ? operation.scores : [];
	return thoughts.map((thought, index) => ({
		...thought,
		score:
			typeof scores[index] === "number"
				? (scores[index] as number)
				: (thought.score ?? 1 / (index + 1)),
	}));
}

function keepBest(
	thoughts: Thought[],
	operation: Record<string, unknown>,
): Thought[] {
	const n =
		typeof operation.n === "number" && operation.n > 0
			? Math.floor(operation.n)
			: 1;
	return [...thoughts]
		.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
		.slice(0, n);
}

function aggregate(thoughts: Thought[]): Thought[] {
	return [{ text: thoughts.map((t) => t.text).join("\n"), data: { thoughts } }];
}

function normalizeThoughts(value: unknown): Thought[] {
	if (Array.isArray(value))
		return value.map((entry) =>
			typeof entry === "object" && entry && "text" in entry
				? (entry as Thought)
				: { text: String(entry) },
		);
	return [{ text: String(value ?? "") }];
}
