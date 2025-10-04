import type { ServerResponse } from "node:http";
export declare class SessionStore {
    private readonly ttlMs;
    private readonly capacity;
    private readonly sessions;
    constructor(ttlMs: number, capacity: number);
    getOrCreateSessionId(cookies: Record<string, string>, res: ServerResponse): string;
    getPrevHtml(sid: string): string;
    setPrevHtml(sid: string, html: string): void;
    private touchSession;
    private pruneSessions;
    private createSessionId;
}
