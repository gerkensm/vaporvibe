import type { ServerResponse } from "node:http";
import type { HistoryEntry, LlmReasoningTrace, LlmUsageMetrics, RestMutationRecord, RestQueryRecord } from "../types.js";
export declare class SessionStore {
    private readonly ttlMs;
    private readonly capacity;
    private readonly sessions;
    constructor(ttlMs: number, capacity: number);
    getOrCreateSessionId(cookies: Record<string, string>, res: ServerResponse): string;
    getPrevHtml(sid: string): string;
    setPrevHtml(sid: string, html: string): void;
    getHistory(sid: string, limit?: number): HistoryEntry[];
    appendHistoryEntry(sid: string, entry: HistoryEntry, options?: {
        preservePrevHtml?: boolean;
    }): void;
    appendMutationRecord(sid: string, record: RestMutationRecord): void;
    appendQueryRecord(sid: string, record: RestQueryRecord): void;
    getRestState(sid: string, limit?: number): {
        mutations: RestMutationRecord[];
        queries: RestQueryRecord[];
    };
    removeHistoryEntry(entryId: string): boolean;
    exportHistory(): HistoryEntry[];
    replaceHistory(entries: HistoryEntry[]): void;
    private touchSession;
    private pruneSessions;
    private createSessionId;
    private ensureRecord;
    private getActiveRecord;
    private persistRecord;
    appendRestHistoryEntry(sid: string, options: {
        type: "mutation" | "query";
        record: RestMutationRecord | RestQueryRecord;
        response?: unknown;
        rawResponse?: string;
        ok?: boolean;
        error?: string;
        durationMs?: number;
        usage?: LlmUsageMetrics;
        reasoning?: LlmReasoningTrace;
    }): void;
}
