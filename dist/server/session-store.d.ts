import type { ServerResponse } from "node:http";
import type { HistoryEntry } from "../types.js";
export declare class SessionStore {
    private readonly ttlMs;
    private readonly capacity;
    private readonly sessions;
    constructor(ttlMs: number, capacity: number);
    getOrCreateSessionId(cookies: Record<string, string>, res: ServerResponse): string;
    getPrevHtml(sid: string): string;
    setPrevHtml(sid: string, html: string): void;
    getHistory(sid: string, limit?: number): HistoryEntry[];
    appendHistoryEntry(sid: string, entry: HistoryEntry): void;
    exportHistory(): HistoryEntry[];
    replaceHistory(entries: HistoryEntry[]): void;
    private touchSession;
    private pruneSessions;
    private createSessionId;
    private ensureRecord;
    private getActiveRecord;
    private persistRecord;
}
