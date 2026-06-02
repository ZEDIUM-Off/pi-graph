export type RoutePicker = (
	routes: string[],
) => Promise<string | undefined> | string | undefined;
export type ResetChoice =
	| "restart"
	| "clearWidget"
	| "clearSelection"
	| "cancel";
export type ResetConfirm = () =>
	| Promise<ResetChoice | undefined>
	| ResetChoice
	| undefined;

export interface GraphSessionControllerOptions {
	resume: (runId: string, input: unknown) => Promise<unknown> | unknown;
	openRoutePicker?: RoutePicker;
	confirmReset?: ResetConfirm;
	onClearWidget?: () => void;
	onClearSelection?: () => void;
	onRestart?: (runId: string) => Promise<unknown> | unknown;
	onError?: (error: unknown) => void;
}

export interface GraphSessionState {
	runId?: string;
	status?: string;
	currentNode?: string;
	routes: string[];
	shortcuts: boolean;
}

export class GraphSessionController {
	private state: GraphSessionState = { routes: [], shortcuts: true };

	constructor(private readonly options: GraphSessionControllerOptions) {}

	update(run: any, settings: { shortcuts?: boolean } = {}) {
		this.state = {
			runId: typeof run?.id === "string" ? run.id : undefined,
			status: typeof run?.status === "string" ? run.status : undefined,
			currentNode:
				typeof run?.currentNode === "string" ? run.currentNode : undefined,
			routes: Array.isArray(run?.nextRoutes) ? run.nextRoutes.map(String) : [],
			shortcuts: settings.shortcuts !== false,
		};
	}

	visibleRoutes(limit = 9): string[] {
		return this.state.routes.slice(0, Math.max(0, limit));
	}

	async chooseRoute(route: string): Promise<boolean> {
		if (!this.canChooseRoute() || !this.state.runId) return false;
		if (!this.state.routes.includes(route)) return false;
		await this.options.resume(this.state.runId, { next: route });
		return true;
	}

	async chooseVisibleRoute(index: number): Promise<boolean> {
		const route = this.visibleRoutes()[index - 1];
		return route ? this.chooseRoute(route) : false;
	}

	async openPicker(): Promise<boolean> {
		if (!this.state.shortcuts) return false;
		if (!this.canChooseRoute() || !this.options.openRoutePicker) return false;
		const route = await this.options.openRoutePicker([...this.state.routes]);
		return typeof route === "string" ? this.chooseRoute(route) : false;
	}

	async reset(): Promise<boolean> {
		if (!this.state.shortcuts) return false;
		if (!this.options.confirmReset) return false;
		const choice = (await this.options.confirmReset()) ?? "cancel";
		if (choice === "cancel") return true;
		if (choice === "clearWidget") {
			this.options.onClearWidget?.();
			return true;
		}
		if (choice === "clearSelection") {
			this.options.onClearSelection?.();
			return true;
		}
		if (choice === "restart" && this.state.runId) {
			await this.options.onRestart?.(this.state.runId);
			return true;
		}
		return false;
	}

	async handleInput(data: string): Promise<boolean> {
		if (!this.state.shortcuts) return false;
		try {
			const digit = altDigit(data);
			if (digit !== undefined) return this.chooseVisibleRoute(digit);
			if (isCtrlG(data)) return this.openPicker();
			if (isCtrlR(data)) return this.reset();
			return false;
		} catch (error) {
			this.options.onError?.(error);
			return true;
		}
	}

	shortcutsEnabled(): boolean {
		return this.state.shortcuts;
	}

	private canChooseRoute(): boolean {
		return this.state.status === "waiting" && this.state.routes.length > 0;
	}
}

export function altDigit(data: string): number | undefined {
	if (/^\x1b[1-9]$/.test(data)) return Number(data.slice(1));
	if (/^\x1b\[[1-9]$/.test(data)) return Number(data.slice(-1));
	return undefined;
}

function isCtrlG(data: string): boolean {
	return data === "\x07";
}

function isCtrlR(data: string): boolean {
	return data === "\x12";
}
