import type { HistoryEntry } from "../types.js";
export declare function selectHistoryForPrompt(history: HistoryEntry[], maxBytes: number): {
    entries: HistoryEntry[];
    bytes: number;
};
export declare function estimateHistoryEntrySize(entry: HistoryEntry): number;
