import crypto from "node:crypto";
import type { ServerResponse } from "node:http";
import { setCookie } from "../utils/cookies.js";
import type { HistoryEntry } from "../types.js";

interface SessionData {
  updatedAt: number;
  prevHtml: string;
  history: HistoryEntry[];
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
    const record = this.getActiveRecord(sid);
    if (!record) return "";
    if (record.prevHtml) return record.prevHtml;
    const lastEntry = record.history.at(-1);
    return lastEntry?.response.html ?? "";
  }

  setPrevHtml(sid: string, html: string): void {
    const record = this.ensureRecord(sid);
    record.prevHtml = String(html ?? "");
    this.persistRecord(sid, record);
  }

  getHistory(sid: string, limit?: number): HistoryEntry[] {
    const record = this.getActiveRecord(sid);
    if (!record) return [];
    const history = record.history ?? [];
    if (typeof limit === "number" && limit > 0) {
      return history.slice(-limit);
    }
    return history.slice();
  }

  appendHistoryEntry(sid: string, entry: HistoryEntry): void {
    const record = this.ensureRecord(sid);
    record.history = [...(record.history ?? []), entry];
    record.prevHtml = entry.response.html;
    this.persistRecord(sid, record);
  }

  exportHistory(): HistoryEntry[] {
    const now = Date.now();
    return Array.from(this.sessions.entries())
      .filter(([, record]) => now - record.updatedAt <= this.ttlMs)
      .flatMap(([, record]) => record.history ?? []);
  }

  replaceHistory(entries: HistoryEntry[]): void {
    this.sessions.clear();
    const now = Date.now();
    const sortedEntries = [...entries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    for (const entry of sortedEntries) {
      const sid = entry.sessionId;
      if (!sid) continue;
      const record = this.sessions.get(sid) ?? createSessionData();
      record.history = [...(record.history ?? []), entry];
      record.prevHtml = entry.response.html;
      record.updatedAt = now;
      this.sessions.set(sid, record);
    }
    this.pruneSessions();
  }

  private touchSession(sid: string): void {
    const record = this.ensureRecord(sid);
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

  private ensureRecord(sid: string): SessionData {
    const existing = this.getActiveRecord(sid);
    if (existing) {
      return existing;
    }
    const fresh = createSessionData();
    this.sessions.set(sid, fresh);
    return fresh;
  }

  private getActiveRecord(sid: string): SessionData | undefined {
    const record = this.sessions.get(sid);
    if (!record) return undefined;
    if (Date.now() - record.updatedAt > this.ttlMs) {
      this.sessions.delete(sid);
      return undefined;
    }
    return record;
  }

  private persistRecord(sid: string, record: SessionData): void {
    record.updatedAt = Date.now();
    this.sessions.set(sid, record);
    this.pruneSessions();
  }
}

function createSessionData(): SessionData {
  return {
    updatedAt: Date.now(),
    prevHtml: "",
    history: [],
  };
}
