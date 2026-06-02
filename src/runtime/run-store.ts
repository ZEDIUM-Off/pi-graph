import type { RunStatus } from "../shared/types.js";
import { GraphError } from "../shared/errors.js";

export interface StoredRunSnapshot {
	id: string;
	graphName: string;
	status: RunStatus;
	interrupt?: unknown;
	result?: unknown;
	history: Array<{ at: string; type: string; data?: unknown }>;
}

const savedRuns = new Map<string, StoredRunSnapshot>();

export function saveRunSnapshot(
	snapshot: StoredRunSnapshot,
): StoredRunSnapshot {
	const copy = cloneSnapshot(snapshot);
	savedRuns.set(copy.id, copy);
	return copy;
}

export function getSavedRunStatus(id: string): StoredRunSnapshot {
	const snapshot = savedRuns.get(id);
	if (!snapshot)
		throw new GraphError(
			"saved_run_not_found",
			`Saved run '${id}' was not found`,
			{ id },
		);
	return cloneSnapshot(snapshot);
}

export function getSavedRunHistory(id: string) {
	const snapshot = getSavedRunStatus(id);
	return { id, status: snapshot.status, history: snapshot.history };
}

export function listSavedRuns(): StoredRunSnapshot[] {
	return [...savedRuns.values()].map(cloneSnapshot);
}

export function clearSavedRunsForTest() {
	savedRuns.clear();
}

function cloneSnapshot(snapshot: StoredRunSnapshot): StoredRunSnapshot {
	return JSON.parse(JSON.stringify(snapshot)) as StoredRunSnapshot;
}
