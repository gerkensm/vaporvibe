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
        const record = this.sessions.get(sid);
        if (!record)
            return "";
        if (Date.now() - record.updatedAt > this.ttlMs) {
            this.sessions.delete(sid);
            return "";
        }
        return record.prevHtml ?? "";
    }
    setPrevHtml(sid, html) {
        const record = this.sessions.get(sid) ?? { updatedAt: Date.now(), prevHtml: "" };
        record.prevHtml = String(html ?? "");
        record.updatedAt = Date.now();
        this.sessions.set(sid, record);
        this.pruneSessions();
    }
    touchSession(sid) {
        const record = this.sessions.get(sid) ?? { updatedAt: Date.now(), prevHtml: "" };
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
}
