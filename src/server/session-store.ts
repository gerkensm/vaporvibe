import crypto from "node:crypto";
import type { ServerResponse } from "node:http";
import { setCookie } from "../utils/cookies.js";

interface SessionData {
  updatedAt: number;
  prevHtml: string;
}

export class SessionStore {
  private readonly ttlMs: number;
  private readonly capacity: number;
  private readonly sessions = new Map<string, SessionData>();

  constructor(ttlMs: number, capacity: number) {
    this.ttlMs = ttlMs;
    this.capacity = capacity;
  }

  getOrCreateSessionId(cookies: Record<string, string>, res: ServerResponse): string {
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

  getPrevHtml(sid: string): string {
    const record = this.sessions.get(sid);
    if (!record) return "";
    if (Date.now() - record.updatedAt > this.ttlMs) {
      this.sessions.delete(sid);
      return "";
    }
    return record.prevHtml ?? "";
  }

  setPrevHtml(sid: string, html: string): void {
    const record = this.sessions.get(sid) ?? { updatedAt: Date.now(), prevHtml: "" };
    record.prevHtml = String(html ?? "");
    record.updatedAt = Date.now();
    this.sessions.set(sid, record);
    this.pruneSessions();
  }

  private touchSession(sid: string): void {
    const record = this.sessions.get(sid) ?? { updatedAt: Date.now(), prevHtml: "" };
    record.updatedAt = Date.now();
    this.sessions.set(sid, record);
    this.pruneSessions();
  }

  private pruneSessions(): void {
    if (this.sessions.size <= this.capacity) return;
    const entries = Array.from(this.sessions.entries());
    entries.sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    const excess = entries.length - this.capacity;
    for (let i = 0; i < excess; i += 1) {
      this.sessions.delete(entries[i][0]);
    }
  }

  private createSessionId(): string {
    return crypto.randomBytes(16).toString("hex");
  }
}
