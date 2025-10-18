import crypto from "node:crypto";
import type { ServerResponse } from "node:http";
import { setCookie } from "../utils/cookies.js";
import { escapeHtml } from "../utils/html.js";
import type { HistoryEntry, RestMutationRecord, RestQueryRecord } from "../types.js";

interface SessionData {
  updatedAt: number;
  prevHtml: string;
  history: HistoryEntry[];
  rest: {
    mutations: RestMutationRecord[];
    queries: RestQueryRecord[];
  };
}

const REST_RECORD_LIMIT = 25;

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
    const lastHtmlEntry = findLastHtmlEntry(record.history ?? []);
    return lastHtmlEntry?.response.html ?? "";
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

  appendHistoryEntry(
    sid: string,
    entry: HistoryEntry,
    options: { preservePrevHtml?: boolean } = {}
  ): void {
    const record = this.ensureRecord(sid);
    record.history = [...(record.history ?? []), entry];
    if (!options.preservePrevHtml) {
      record.prevHtml = entry.response.html;
    }
    this.persistRecord(sid, record);
  }

  appendMutationRecord(sid: string, record: RestMutationRecord): void {
    const session = this.ensureRecord(sid);
    const mutations = [...session.rest.mutations, record];
    session.rest.mutations = clampRestRecords(mutations);
    this.persistRecord(sid, session);
  }

  appendQueryRecord(sid: string, record: RestQueryRecord): void {
    const session = this.ensureRecord(sid);
    const queries = [...session.rest.queries, record];
    session.rest.queries = clampRestRecords(queries);
    this.persistRecord(sid, session);
  }

  getRestState(
    sid: string,
    limit?: number
  ): { mutations: RestMutationRecord[]; queries: RestQueryRecord[] } {
    const record = this.getActiveRecord(sid);
    if (!record) {
      return { mutations: [], queries: [] };
    }
    const clamp = typeof limit === "number" && limit > 0 ? limit : undefined;
    const mutations = clamp
      ? record.rest.mutations.slice(-clamp)
      : record.rest.mutations.slice();
    const queries = clamp
      ? record.rest.queries.slice(-clamp)
      : record.rest.queries.slice();
    return {
      mutations: mutations.map(cloneRestRecord),
      queries: queries.map(cloneRestRecord),
    };
  }

  removeHistoryEntry(entryId: string): boolean {
    let removed = false;
    for (const [sid, record] of this.sessions.entries()) {
      const history = record.history ?? [];
      if (!history.length) continue;
      const nextHistory = history.filter((entry) => entry.id !== entryId);
      if (nextHistory.length === history.length) {
        continue;
      }

      const nextRecord: SessionData = {
        ...record,
        history: nextHistory,
        prevHtml: findLastHtmlEntry(nextHistory)?.response.html ?? "",
      };

      this.persistRecord(sid, nextRecord);
      removed = true;
      break;
    }
    return removed;
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
      const normalized = normalizeImportedEntry(entry);
      record.history = [...(record.history ?? []), normalized];
      if (normalized.entryKind === "html") {
        record.prevHtml = normalized.response.html;
      }
      record.rest.mutations = [];
      record.rest.queries = [];
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

  appendRestHistoryEntry(
    sid: string,
    options: {
      type: "mutation" | "query";
      record: RestMutationRecord | RestQueryRecord;
      response?: unknown;
      rawResponse?: string;
      ok?: boolean;
      error?: string;
      durationMs?: number;
    }
  ): void {
    const { type, record, response, rawResponse, ok, error, durationMs } = options;
    const restRequest = {
      method: record.method,
      path: record.path,
      query: record.query,
      body: record.body,
    };

    const formattedJson = formatJsonForHtml(
      type === "query" && response !== undefined ? response : record.body
    );

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      sessionId: sid,
      createdAt: record.createdAt,
      durationMs: durationMs ?? 0,
      brief: "",
      request: restRequest,
      response: {
        html: formattedJson,
      },
      entryKind: type === "mutation" ? "rest-mutation" : "rest-query",
      rest:
        type === "mutation"
          ? {
              type,
              request: restRequest,
              response,
              rawResponse,
              ok,
              error,
            }
          : {
              type,
              request: restRequest,
              response,
              rawResponse,
              ok,
              error,
            },
      usage: undefined,
    };

    this.appendHistoryEntry(sid, entry, { preservePrevHtml: true });
  }
}

function createSessionData(): SessionData {
  return {
    updatedAt: Date.now(),
    prevHtml: "",
    history: [],
    rest: {
      mutations: [],
      queries: [],
    },
  };
}

function clampRestRecords<T>(records: T[]): T[] {
  if (records.length <= REST_RECORD_LIMIT) {
    return records;
  }
  return records.slice(-REST_RECORD_LIMIT);
}

function cloneRestRecord<T>(record: T): T {
  return structuredClone(record);
}

function findLastHtmlEntry(history: HistoryEntry[]): HistoryEntry | undefined {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry.entryKind === "html") {
      return entry;
    }
  }
  return undefined;
}

function formatJsonForHtml(payload: unknown): string {
  try {
    const json = JSON.stringify(payload ?? null, null, 2);
    return `<pre class="serve-llm-rest-json">${escapeHtml(json)}</pre>`;
  } catch {
    return `<pre class="serve-llm-rest-json">${escapeHtml(String(payload ?? ""))}</pre>`;
  }
}

function normalizeImportedEntry(entry: HistoryEntry): HistoryEntry {
  const entryKind = entry.entryKind ?? "html";
  const request = {
    method: entry.request?.method ?? "GET",
    path: entry.request?.path ?? "/",
    query: entry.request?.query ?? {},
    body: entry.request?.body ?? {},
    instructions: entry.request?.instructions,
  };

  const normalized: HistoryEntry = {
    ...entry,
    request,
    entryKind,
  };

  if (entryKind === "html") {
    normalized.llm = entry.llm;
    return normalized;
  }

  const restType = entryKind === "rest-mutation" ? "mutation" : "query";
  normalized.llm = undefined;
  normalized.rest = entry.rest ?? {
    type: restType,
    request: {
      method: request.method,
      path: request.path,
      query: request.query,
      body: request.body,
    },
  };
  return normalized;
}
