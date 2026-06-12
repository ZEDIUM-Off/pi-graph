import { Type } from "typebox";

const ActionEnum = [
	"doctor",
	"list",
	"get",
	"create",
	"update",
	"delete",
	"validate",
	"preview",
	"render",
	"run",
	"resume",
	"status",
	"history",
	"list-runs",
	"get-run",
	"interrupt",
] as const;
const ScopeEnum = ["project", "user", "builtin"] as const;
const FormatEnum = ["text", "json", "markdown", "mermaid"] as const;

export const GraphToolParamsSchema = Type.Object(
	{
		action: Type.String({ enum: ActionEnum, description: "graph action" }),
		name: Type.Optional(Type.String({ minLength: 1 })),
		id: Type.Optional(Type.String({ minLength: 1 })),
		scope: Type.Optional(Type.String({ enum: ScopeEnum })),
		config: Type.Optional(Type.Any()),
		input: Type.Optional(Type.Any()),
		message: Type.Optional(Type.String()),
		dryRun: Type.Optional(Type.Boolean()),
		saveRun: Type.Optional(Type.Boolean()),
		ui: Type.Optional(Type.Boolean({ default: true })),
		shortcuts: Type.Optional(Type.Boolean({ default: true })),
		renderSvg: Type.Optional(Type.Boolean({ default: true })),
		format: Type.Optional(Type.String({ enum: FormatEnum })),
	},
	{ additionalProperties: false },
);

export type GraphToolParams = {
	action: (typeof ActionEnum)[number];
	name?: string;
	id?: string;
	scope?: (typeof ScopeEnum)[number];
	config?: unknown;
	input?: unknown;
	message?: string;
	dryRun?: boolean;
	saveRun?: boolean;
	ui?: boolean;
	shortcuts?: boolean;
	renderSvg?: boolean;
	format?: (typeof FormatEnum)[number];
};
