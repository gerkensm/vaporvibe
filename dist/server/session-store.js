import crypto from "node:crypto";
import { setCookie } from "../utils/cookies.js";
export class SessionStore {
    ttlMs;
    capacity;
    sessions = new Map();
    constructor(ttlMs, capacity) {
        this.ttlMs = ttlMs;
        this.capacity = capacity;
    }
    getOrCreateSessionId(cookies, res) {
        let sid = cookies.sid;
        if (!sid || !this.sessions.has(sid)) {
            sid = this.createSessionId();
            setCookie(res, "sid", sid, {
                httpOnly: true,
                path: "/",
                maxAge: Math.floor(this.ttlMs / 1000),
                sameSite: "Lax",
            });
        }
        this.touchSession(sid);
        return sid;
    }
    getPrevHtml(sid) {
        const record = this.getActiveRecord(sid);
        if (!record)
            return "";
        if (record.prevHtml)
            return record.prevHtml;
        const lastEntry = record.history.at(-1);
        return lastEntry?.response.html ?? "";
    }
    setPrevHtml(sid, html) {
        const record = this.ensureRecord(sid);
        record.prevHtml = String(html ?? "");
        this.persistRecord(sid, record);
    }
    getHistory(sid, limit) {
        const record = this.getActiveRecord(sid);
        if (!record)
            return [];
        const history = record.history ?? [];
        if (typeof limit === "number" && limit > 0) {
            return history.slice(-limit);
        }
        return history.slice();
    }
    appendHistoryEntry(sid, entry) {
        const record = this.ensureRecord(sid);
        record.history = [...(record.history ?? []), entry];
        record.prevHtml = entry.response.html;
        this.persistRecord(sid, record);
    }
    exportHistory() {
        const now = Date.now();
        return Array.from(this.sessions.entries())
            .filter(([, record]) => now - record.updatedAt <= this.ttlMs)
            .flatMap(([, record]) => record.history ?? []);
    }
    replaceHistory(entries) {
        this.sessions.clear();
        const now = Date.now();
        const sortedEntries = [...entries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        for (const entry of sortedEntries) {
            const sid = entry.sessionId;
            if (!sid)
                continue;
            const record = this.sessions.get(sid) ?? createSessionData();
            record.history = [...(record.history ?? []), entry];
            record.prevHtml = entry.response.html;
            record.updatedAt = now;
            this.sessions.set(sid, record);
        }
        this.pruneSessions();
    }
    touchSession(sid) {
        const record = this.ensureRecord(sid);
        record.updatedAt = Date.now();
        this.sessions.set(sid, record);
        this.pruneSessions();
    }
    pruneSessions() {
        if (this.sessions.size <= this.capacity)
            return;
        const entries = Array.from(this.sessions.entries());
        entries.sort((a, b) => a[1].updatedAt - b[1].updatedAt);
        const excess = entries.length - this.capacity;
        for (let i = 0; i < excess; i += 1) {
            this.sessions.delete(entries[i][0]);
        }
    }
    createSessionId() {
        return crypto.randomBytes(16).toString("hex");
    }
    ensureRecord(sid) {
        const existing = this.getActiveRecord(sid);
        if (existing) {
            return existing;
        }
        const fresh = createSessionData();
        this.sessions.set(sid, fresh);
        return fresh;
    }
    getActiveRecord(sid) {
        const record = this.sessions.get(sid);
        if (!record)
            return undefined;
        if (Date.now() - record.updatedAt > this.ttlMs) {
            this.sessions.delete(sid);
            return undefined;
        }
        return record;
    }
    persistRecord(sid, record) {
        record.updatedAt = Date.now();
        this.sessions.set(sid, record);
        this.pruneSessions();
    }
}
function createSessionData() {
    return {
        updatedAt: Date.now(),
        prevHtml: "",
        history: [],
    };
}
