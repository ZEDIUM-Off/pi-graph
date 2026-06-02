import type {
	GraphSessionController,
	ResetChoice,
} from "./graph-session-controller.js";

const dynamicImport = new Function("specifier", "return import(specifier)") as (
	specifier: string,
) => Promise<any>;
const editorInstalled = new WeakSet<object>();

export async function installGraphShortcutEditor(
	ctx: any,
	controller: GraphSessionController,
): Promise<boolean> {
	if (!ctx?.ui?.setEditorComponent || editorInstalled.has(ctx)) return false;
	try {
		const { CustomEditor } = await dynamicImport(
			"@earendil-works/pi-coding-agent",
		);
		const BaseEditor = CustomEditor as new (
			...args: any[]
		) => { handleInput(data: string): void };
		class PiGraphShortcutEditor extends BaseEditor {
			handleInput(data: string): void {
				void controller.handleInput(data).then((consumed) => {
					if (!consumed) super.handleInput(data);
				});
			}
		}
		ctx.ui.setEditorComponent(
			(tui: any, theme: any, keybindings: any) =>
				new PiGraphShortcutEditor(tui, theme, keybindings),
		);
		editorInstalled.add(ctx);
		return true;
	} catch {
		return false;
	}
}

export async function pickRoute(
	ctx: any,
	routes: string[],
): Promise<string | undefined> {
	if (!ctx?.ui?.custom || routes.length === 0) return undefined;
	const custom = ctx.ui.custom as <T>(
		factory: (...args: any[]) => unknown,
	) => Promise<T>;
	return custom<string | undefined>(
		(
			tui: any,
			theme: any,
			_kb: any,
			done: (value: string | undefined) => void,
		) => {
			let selected = 0;
			let query = "";
			let cached: string[] | undefined;
			const filtered = () =>
				routes.filter((route) =>
					route.toLowerCase().includes(query.toLowerCase()),
				);
			const refresh = () => {
				cached = undefined;
				tui.requestRender?.();
			};
			const choose = () => done(filtered()[selected]);
			return {
				handleInput(data: string) {
					if (data === "\x1b") return done(undefined);
					if (data === "\r" || data === "\n") return choose();
					if (data === "\x1b[A") {
						selected = Math.max(0, selected - 1);
						return refresh();
					}
					if (data === "\x1b[B") {
						selected = Math.min(
							Math.max(0, filtered().length - 1),
							selected + 1,
						);
						return refresh();
					}
					if (data === "\x7f" || data === "\b") {
						query = query.slice(0, -1);
						selected = 0;
						return refresh();
					}
					if (data.length === 1 && data >= " ") {
						query += data;
						selected = 0;
						return refresh();
					}
				},
				render(width: number) {
					if (cached) return cached;
					const matches = filtered();
					const lines = [
						accent(
							theme,
							`─ route picker ${matches.length}/${routes.length} `.padEnd(
								width,
								"─",
							),
						),
						text(theme, ` filter: ${query || "<type to filter>"}`),
						"",
					];
					for (let i = 0; i < Math.min(matches.length, 10); i++) {
						const prefix = i === selected ? "> " : "  ";
						lines.push(
							(i === selected ? accent : text)(
								theme,
								fit(`${prefix}${matches[i]}`, width),
							),
						);
					}
					if (!matches.length) lines.push(warn(theme, " no matching route"));
					lines.push(
						"",
						dim(
							theme,
							" ↑↓ navigate · type filter · enter select · esc cancel",
						),
					);
					cached = lines.map((line) => fit(line, width));
					return cached;
				},
				invalidate() {
					cached = undefined;
				},
			};
		},
	);
}

export async function confirmReset(ctx: any): Promise<ResetChoice | undefined> {
	if (!ctx?.ui?.custom) return undefined;
	const custom = ctx.ui.custom as <T>(
		factory: (...args: any[]) => unknown,
	) => Promise<T>;
	const options: Array<{ label: string; value: ResetChoice }> = [
		{ label: "restart from initial input", value: "restart" },
		{ label: "abandon run and clear widget", value: "clearWidget" },
		{ label: "keep run, clear selection state", value: "clearSelection" },
		{ label: "cancel", value: "cancel" },
	];
	return custom<ResetChoice | undefined>(
		(
			tui: any,
			theme: any,
			_kb: any,
			done: (value: ResetChoice | undefined) => void,
		) => {
			let selected = 0;
			let cached: string[] | undefined;
			const refresh = () => {
				cached = undefined;
				tui.requestRender?.();
			};
			return {
				handleInput(data: string) {
					if (data === "\x1b") return done("cancel");
					if (data === "\r" || data === "\n")
						return done(options[selected]?.value ?? "cancel");
					if (data >= "1" && data <= String(options.length))
						return done(options[Number(data) - 1]?.value ?? "cancel");
					if (data === "\x1b[A") {
						selected = Math.max(0, selected - 1);
						return refresh();
					}
					if (data === "\x1b[B") {
						selected = Math.min(options.length - 1, selected + 1);
						return refresh();
					}
				},
				render(width: number) {
					if (cached) return cached;
					const lines = [
						accent(theme, `─ reset pi-graph run `.padEnd(width, "─")),
						warn(theme, " destructive actions require confirmation"),
						"",
					];
					for (let i = 0; i < options.length; i++) {
						const prefix = i === selected ? "> " : "  ";
						lines.push(
							(i === selected ? accent : text)(
								theme,
								fit(`${prefix}${i + 1}. ${options[i]?.label}`, width),
							),
						);
					}
					lines.push(
						"",
						dim(
							theme,
							" ↑↓ navigate · 1-4 choose · enter confirm · esc cancel",
						),
					);
					cached = lines.map((line) => fit(line, width));
					return cached;
				},
				invalidate() {
					cached = undefined;
				},
			};
		},
	);
}

function fit(value: string, width: number): string {
	if (width <= 0) return "";
	return value.length > width
		? `${value.slice(0, Math.max(0, width - 1))}…`
		: value;
}

function accent(theme: any, value: string) {
	return theme?.fg ? theme.fg("accent", value) : value;
}
function text(theme: any, value: string) {
	return theme?.fg ? theme.fg("text", value) : value;
}
function dim(theme: any, value: string) {
	return theme?.fg ? theme.fg("dim", value) : value;
}
function warn(theme: any, value: string) {
	return theme?.fg ? theme.fg("warning", value) : value;
}
