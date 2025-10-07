import type { HistoryEntry, HistorySnapshot, ProviderSettings, RuntimeConfig } from "../types.js";
export interface HistoryExportContext {
    history: HistoryEntry[];
    brief: string | null;
    runtime: RuntimeConfig;
    provider: ProviderSettings;
}
export declare function createHistorySnapshot(context: HistoryExportContext): HistorySnapshot;
export declare function createPromptMarkdown(context: HistoryExportContext): string;
