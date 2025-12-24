import crypto from "node:crypto";
import type { ServerResponse } from "node:http";
import { setCookie } from "../utils/cookies.js";
import { escapeHtml } from "../utils/html.js";
import { getGeneratedImagePath } from "../image-gen/paths.js";
import type {
  BranchState,
  ForkState,
  ImageAspectRatio,
  ImageModelId,
  GeneratedImage,
  HistoryEntry,
  HistoryForkInfo,
  LlmReasoningTrace,
  LlmUsageMetrics,
  RestMutationRecord,
  RestQueryRecord,
} from "../types.js";

interface SessionData {
  updatedAt: number;
  prevHtml: string;
  history: HistoryEntry[];
  rest: {
    mutations: RestMutationRecord[];
    queries: RestQueryRecord[];
  };
  activeFork?: ForkState;
}

export interface SessionDataSnapshot {
  updatedAt: number;
  prevHtml: string;
  history: HistoryEntry[];
  rest: {
    mutations: RestMutationRecord[];
    queries: RestQueryRecord[];
  };
  activeFork?: ForkState;
}

export interface ForkSummary {
  forkId: string;
  originEntryId: string;
  createdAt: number;
  branches: Array<{
    branchId: string;
    label: "A" | "B";
    instructions: string;
    entryCount: number;
  }>;
}

export interface SessionStoreSnapshot {
  sessions: Array<[string, SessionDataSnapshot]>;
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

  getPrevHtml(sid: string, branchId?: string): string {
    const record = this.getActiveRecord(sid);
    if (!record) return "";
    if (branchId) {
      const branch = this.getBranch(record, branchId);
      if (branch.prevHtml) {
        return branch.prevHtml;
      }
      const lastHtmlEntry = findLastHtmlEntry(branch.history ?? []);
      return lastHtmlEntry?.response.html ?? "";
    }
    if (record.prevHtml) return record.prevHtml;
    const lastHtmlEntry = findLastHtmlEntry(record.history ?? []);
    return lastHtmlEntry?.response.html ?? "";
  }

  setPrevHtml(sid: string, html: string, branchId?: string): void {
    const record = this.ensureRecord(sid);
    if (branchId) {
      const { fork, branch } = this.getBranchWithFork(record, branchId);
      branch.prevHtml = String(html ?? "");
      fork.branches.set(branchId, branch);
      record.activeFork = fork;
      this.persistRecord(sid, record);
      return;
    }
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

  getHistoryForPrompt(sid: string, branchId?: string): HistoryEntry[] {
    const record = this.getActiveRecord(sid);
    if (!record) {
      return [];
    }
    const baseHistory = record.history ?? [];
    if (!branchId) {
      return baseHistory.slice();
    }
    const fork = this.getActiveFork(record);
    if (!fork) {
      return baseHistory.slice();
    }
    const branch = fork.branches.get(branchId);
    if (!branch) {
      return baseHistory.slice();
    }
    return [...baseHistory, ...branch.history].map((entry) => structuredClone(entry));
  }

  isBranchEmpty(sid: string, branchId: string): boolean {
    const record = this.getActiveRecord(sid);
    if (!record) {
      return false;
    }
    const fork = this.getActiveFork(record);
    if (!fork) {
      return false;
    }
    const branch = fork.branches.get(branchId);
    if (!branch) {
      return false;
    }
    return branch.history.length === 0;
  }

  appendHistoryEntry(
    sid: string,
    entry: HistoryEntry,
    options: { preservePrevHtml?: boolean } = {}
  ): void {
    const record = this.ensureRecord(sid);
    const fork = this.getActiveFork(record);
    if (fork) {
      throw new Error("Cannot append base history while a fork is active");
    }
    record.history = [...(record.history ?? []), entry];
    if (!options.preservePrevHtml) {
      record.prevHtml = entry.response.html;
    }
    this.persistRecord(sid, record);
  }

  appendToBranchHistory(
    sid: string,
    branchId: string,
    entry: HistoryEntry,
    options: { preservePrevHtml?: boolean } = {}
  ): void {
    const record = this.ensureRecord(sid);
    const { fork, branch } = this.getBranchWithFork(record, branchId);
    const entryClone: HistoryEntry = {
      ...structuredClone(entry),
      forkInfo: {
        forkId: fork.forkId,
        branchId,
        label: branch.label,
        status: "in-progress",
      },
    };
    branch.history = [...branch.history, entryClone];
    if (!options.preservePrevHtml) {
      branch.prevHtml = entryClone.response.html;
    }
    if (entryClone.componentCache) {
      branch.componentCache = {
        ...branch.componentCache,
        ...structuredClone(entryClone.componentCache),
      };
      branch.nextComponentId = computeNextIdFromCache(
        branch.componentCache,
        "sl-gen-"
      );
    }
    if (entryClone.styleCache) {
      branch.styleCache = {
        ...branch.styleCache,
        ...structuredClone(entryClone.styleCache),
      };
      branch.nextStyleId = computeNextIdFromCache(branch.styleCache, "sl-style-");
    }
    fork.branches.set(branchId, branch);
    record.activeFork = fork;
    this.persistRecord(sid, record);
  }

  startFork(
    sid: string,
    baseEntryId: string | null | undefined,
    instructionsA: string,
    instructionsB: string
  ): { forkId: string; branchIdA: string; branchIdB: string } {
    const record = this.ensureRecord(sid);
    if (this.getActiveFork(record)) {
      throw new Error("A fork is already active for this session");
    }
    const history = record.history ?? [];
    const baseIndex = baseEntryId
      ? history.findIndex((entry) => entry.id === baseEntryId)
      : -1;
    const originEntry =
      baseIndex >= 0 ? history[baseIndex] : findLastHtmlEntry(history);
    if (!originEntry) {
      throw new Error("Cannot start fork without a base history entry");
    }

    const forkId = crypto.randomUUID();
    const branchIdA = crypto.randomUUID();
    const branchIdB = crypto.randomUUID();
    const createdAt = Date.now();
    const baseComponentCache = originEntry.componentCache
      ? structuredClone(originEntry.componentCache)
      : {};
    const baseStyleCache = originEntry.styleCache
      ? structuredClone(originEntry.styleCache)
      : {};

    const createBranchState = (
      branchId: string,
      label: "A" | "B",
      instructions: string
    ): BranchState => ({
      branchId,
      label,
      instructions,
      history: [],
      rest: {
        mutations: [],
        queries: [],
      },
      prevHtml: record.prevHtml,
      componentCache: { ...baseComponentCache },
      styleCache: { ...baseStyleCache },
      nextComponentId: computeNextIdFromCache(baseComponentCache, "sl-gen-"),
      nextStyleId: computeNextIdFromCache(baseStyleCache, "sl-style-"),
    });

    const forkState: ForkState = {
      forkId,
      originEntryId: originEntry.id,
      status: "active",
      branches: new Map([
        [branchIdA, createBranchState(branchIdA, "A", instructionsA)],
        [branchIdB, createBranchState(branchIdB, "B", instructionsB)],
      ]),
      createdAt,
    };

    record.activeFork = forkState;
    this.persistRecord(sid, record);

    return { forkId, branchIdA, branchIdB };
  }

  getBranchRestState(
    sid: string,
    branchId: string
  ): { mutations: RestMutationRecord[]; queries: RestQueryRecord[] } {
    const record = this.ensureRecord(sid);
    const { branch } = this.getBranchWithFork(record, branchId);
    return {
      mutations: branch.rest.mutations.map(cloneRestRecord),
      queries: branch.rest.queries.map(cloneRestRecord),
    };
  }

  resolveFork(sid: string, forkId: string, chosenBranchId: string): void {
    const record = this.ensureRecord(sid);
    const { fork, branch } = this.getBranchWithFork(record, chosenBranchId);
    if (fork.forkId !== forkId) {
      throw new Error("Fork mismatch for resolution");
    }
    const originIndex = record.history.findIndex(
      (entry) => entry.id === fork.originEntryId
    );
    const baseHistory =
      originIndex >= 0
        ? record.history.slice(0, originIndex + 1)
        : record.history.slice();

    const chosenHistory: HistoryEntry[] = branch.history.map((entry) => {
      const cloned = structuredClone(entry) as HistoryEntry;
      const forkInfo: HistoryForkInfo = cloned.forkInfo
        ? { ...cloned.forkInfo, status: "chosen" }
        : {
          forkId: fork.forkId,
          branchId: chosenBranchId,
          label: branch.label,
          status: "chosen",
        };
      cloned.forkInfo = forkInfo;
      return cloned;
    });

    for (const [id, otherBranch] of fork.branches.entries()) {
      if (id === chosenBranchId) {
        continue;
      }
      otherBranch.history = otherBranch.history.map((entry) => {
        const cloned = structuredClone(entry) as HistoryEntry;
        const forkInfo: HistoryForkInfo = cloned.forkInfo
          ? { ...cloned.forkInfo, status: "discarded" }
          : {
            forkId: fork.forkId,
            branchId: id,
            label: otherBranch.label,
            status: "discarded",
          };
        cloned.forkInfo = forkInfo;
        return cloned;
      });
    }

    record.history = [...baseHistory, ...chosenHistory];
    record.prevHtml = branch.prevHtml;
    record.rest = {
      mutations: clampRestRecords([
        ...record.rest.mutations,
        ...branch.rest.mutations.map(cloneRestRecord),
      ]),
      queries: clampRestRecords([
        ...record.rest.queries,
        ...branch.rest.queries.map(cloneRestRecord),
      ]),
    };
    fork.status = "resolved";
    record.activeFork = undefined;
    this.persistRecord(sid, record);
  }

  discardFork(sid: string, forkId?: string): void {
    const record = this.ensureRecord(sid);
    const fork = this.getActiveFork(record);
    if (!fork) {
      return;
    }
    if (forkId && fork.forkId !== forkId) {
      throw new Error("Fork mismatch for discard");
    }
    for (const branch of fork.branches.values()) {
      branch.history = branch.history.map((entry) => {
        const cloned = structuredClone(entry) as HistoryEntry;
        const forkInfo: HistoryForkInfo = cloned.forkInfo
          ? { ...cloned.forkInfo, status: "discarded" }
          : {
            forkId: fork.forkId,
            branchId: branch.branchId,
            label: branch.label,
            status: "discarded",
          };
        cloned.forkInfo = forkInfo;
        return cloned;
      });
    }
    fork.status = "resolved";
    record.activeFork = undefined;
    this.persistRecord(sid, record);
  }

  isForkActive(sid: string): boolean {
    const record = this.getActiveRecord(sid);
    if (!record) {
      return false;
    }
    return Boolean(this.getActiveFork(record));
  }

  hasAnyActiveFork(): boolean {
    for (const record of this.sessions.values()) {
      if (this.getActiveFork(record)) {
        return true;
      }
    }
    return false;
  }

  getActiveForkSummary(sid: string): ForkSummary | null {
    const record = this.getActiveRecord(sid);
    if (!record) {
      return null;
    }
    const fork = this.getActiveFork(record);
    if (!fork) {
      return null;
    }
    return summarizeFork(fork);
  }

  getActiveForkSummaries(): Array<{ sessionId: string; fork: ForkSummary }> {
    const summaries: Array<{ sessionId: string; fork: ForkSummary }> = [];
    for (const [sid, record] of this.sessions.entries()) {
      const fork = this.getActiveFork(record);
      if (!fork) continue;
      summaries.push({ sessionId: sid, fork: summarizeFork(fork) });
    }
    return summaries;
  }

  appendMutationRecord(
    sid: string,
    record: RestMutationRecord,
    branchId?: string
  ): void {
    const session = this.ensureRecord(sid);
    if (branchId) {
      const { fork, branch } = this.getBranchWithFork(session, branchId);
      const mutations = [...branch.rest.mutations, cloneRestRecord(record)];
      branch.rest.mutations = clampRestRecords(mutations);
      fork.branches.set(branchId, branch);
      session.activeFork = fork;
      this.persistRecord(sid, session);
      return;
    }
    const fork = this.getActiveFork(session);
    if (fork) {
      throw new Error("Cannot append base REST mutation while a fork is active");
    }
    const mutations = [...session.rest.mutations, record];
    session.rest.mutations = clampRestRecords(mutations);
    this.persistRecord(sid, session);
  }

  appendQueryRecord(
    sid: string,
    record: RestQueryRecord,
    branchId?: string
  ): void {
    const session = this.ensureRecord(sid);
    if (branchId) {
      const { fork, branch } = this.getBranchWithFork(session, branchId);
      const queries = [...branch.rest.queries, cloneRestRecord(record)];
      branch.rest.queries = clampRestRecords(queries);
      fork.branches.set(branchId, branch);
      session.activeFork = fork;
      this.persistRecord(sid, session);
      return;
    }
    const fork = this.getActiveFork(session);
    if (fork) {
      throw new Error("Cannot append base REST query while a fork is active");
    }
    const queries = [...session.rest.queries, record];
    session.rest.queries = clampRestRecords(queries);
    this.persistRecord(sid, session);
  }

  getRestState(
    sid: string,
    limit?: number,
    branchId?: string
  ): { mutations: RestMutationRecord[]; queries: RestQueryRecord[] } {
    const record = this.getActiveRecord(sid);
    if (!record) {
      return { mutations: [], queries: [] };
    }
    const clamp = typeof limit === "number" && limit > 0 ? limit : undefined;
    const baseMutations = clamp
      ? record.rest.mutations.slice(-clamp)
      : record.rest.mutations.slice();
    const baseQueries = clamp
      ? record.rest.queries.slice(-clamp)
      : record.rest.queries.slice();
    if (!branchId) {
      return {
        mutations: baseMutations.map(cloneRestRecord),
        queries: baseQueries.map(cloneRestRecord),
      };
    }
    const { branch } = this.getBranchWithFork(record, branchId);
    const combinedMutations = clamp
      ? [...baseMutations, ...branch.rest.mutations].slice(-clamp)
      : [...baseMutations, ...branch.rest.mutations];
    const combinedQueries = clamp
      ? [...baseQueries, ...branch.rest.queries].slice(-clamp)
      : [...baseQueries, ...branch.rest.queries];
    return {
      mutations: combinedMutations.map(cloneRestRecord),
      queries: combinedQueries.map(cloneRestRecord),
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

  clearHistory(): number {
    let removedCount = 0;
    for (const [sid, record] of this.sessions.entries()) {
      const history = record.history ?? [];
      const nextRecord: SessionData = {
        ...record,
        history: [],
        prevHtml: "",
        rest: {
          mutations: [],
          queries: [],
        },
        activeFork: undefined,
      };

      if (history.length > 0) {
        removedCount += history.length;
      }

      this.persistRecord(sid, nextRecord);
    }
    return removedCount;
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
      record.activeFork = undefined;
      this.sessions.set(sid, record);
    }
    this.pruneSessions();
  }

  replaceSessionHistory(sid: string, entries: HistoryEntry[]): void {
    const now = Date.now();
    const sortedEntries = [...entries]
      .map((entry) => normalizeImportedEntry(structuredClone(entry)))
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .map((entry) => ({
        ...entry,
        sessionId: sid,
      }));

    const nextRecord: SessionData = {
      updatedAt: now,
      prevHtml: findLastHtmlEntry(sortedEntries)?.response.html ?? "",
      history: sortedEntries,
      rest: {
        mutations: [],
        queries: [],
      },
      activeFork: undefined,
    };

    this.sessions.set(sid, nextRecord);
    this.pruneSessions();
  }

  exportSnapshot(): SessionStoreSnapshot {
    return {
      sessions: Array.from(this.sessions.entries()).map(([sid, record]) => [
        sid,
        cloneSessionData(record),
      ]),
    };
  }

  importSnapshot(snapshot: SessionStoreSnapshot | null | undefined): void {
    if (!snapshot) {
      return;
    }
    this.sessions.clear();
    const cutoff = Date.now() - this.ttlMs;
    for (const [sid, record] of snapshot.sessions) {
      if (record.updatedAt < cutoff) {
        continue;
      }
      this.sessions.set(sid, cloneSessionData(record));
    }
    this.pruneSessions();
  }

  private touchSession(sid: string): void {
    const record = this.ensureRecord(sid);
    record.updatedAt = Date.now();
    this.sessions.set(sid, record);
    this.pruneSessions();
  }

  private getActiveFork(record: SessionData): ForkState | undefined {
    const fork = record.activeFork;
    if (!fork || fork.status !== "active") {
      return undefined;
    }
    return fork;
  }

  private getBranch(record: SessionData, branchId: string): BranchState {
    const fork = this.getActiveFork(record);
    if (!fork) {
      throw new Error("No active fork for session");
    }
    const branch = fork.branches.get(branchId);
    if (!branch) {
      throw new Error(`Unknown branch: ${branchId}`);
    }
    return branch;
  }

  private getBranchWithFork(
    record: SessionData,
    branchId: string
  ): { fork: ForkState; branch: BranchState } {
    const fork = this.getActiveFork(record);
    if (!fork) {
      throw new Error("No active fork for session");
    }
    const branch = fork.branches.get(branchId);
    if (!branch) {
      throw new Error(`Unknown branch: ${branchId}`);
    }
    return { fork, branch };
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
      usage?: LlmUsageMetrics;
      reasoning?: LlmReasoningTrace;
      branchId?: string;
    }
  ): void {
    const {
      type,
      record,
      response,
      rawResponse,
      ok,
      error,
      durationMs,
      usage,
      reasoning,
      branchId,
    } = options;
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
      usage,
      reasoning,
    };

    if (branchId) {
      this.appendToBranchHistory(sid, branchId, entry, {
        preservePrevHtml: true,
      });
      return;
    }

    this.appendHistoryEntry(sid, entry, { preservePrevHtml: true });
  }

  recordGeneratedImage(
    sid: string,
    image: GeneratedImage,
    branchId?: string
  ): void {
    const normalizedImage = normalizeGeneratedImages([image])?.[0];
    if (!normalizedImage) {
      return;
    }

    const record = this.ensureRecord(sid);

    if (branchId) {
      const { fork, branch } = this.getBranchWithFork(record, branchId);
      const targetIndex = findLastHtmlEntryIndex(branch.history);
      if (targetIndex === -1) {
        return;
      }
      const nextHistory = branch.history.slice();
      const target = nextHistory[targetIndex];
      nextHistory[targetIndex] = {
        ...target,
        generatedImages: [...(target.generatedImages ?? []), normalizedImage],
      };
      branch.history = nextHistory;
      fork.branches.set(branchId, branch);
      record.activeFork = fork;
      this.persistRecord(sid, record);
      return;
    }

    const targetIndex = findLastHtmlEntryIndex(record.history);
    if (targetIndex === -1) {
      return;
    }
    const nextHistory = record.history.slice();
    const target = nextHistory[targetIndex];
    nextHistory[targetIndex] = {
      ...target,
      generatedImages: [...(target.generatedImages ?? []), normalizedImage],
    };
    record.history = nextHistory;
    this.persistRecord(sid, record);
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
    activeFork: undefined,
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

function cloneSessionData(record: SessionDataSnapshot): SessionData {
  return {
    updatedAt: record.updatedAt,
    prevHtml: record.prevHtml,
    history: record.history.map((entry) => structuredClone(entry)),
    rest: {
      mutations: record.rest.mutations.map((mutation) => cloneRestRecord(mutation)),
      queries: record.rest.queries.map((query) => cloneRestRecord(query)),
    },
    activeFork: record.activeFork ? cloneForkState(record.activeFork) : undefined,
  };
}

function cloneForkState(state: ForkState): ForkState {
  return {
    forkId: state.forkId,
    originEntryId: state.originEntryId,
    status: state.status,
    branches: new Map(
      Array.from(state.branches.entries()).map(([branchId, branchState]) => [
        branchId,
        cloneBranchState(branchState),
      ])
    ),
    createdAt: state.createdAt,
  };
}

function cloneBranchState(state: BranchState): BranchState {
  return {
    branchId: state.branchId,
    label: state.label,
    instructions: state.instructions,
    history: state.history.map((entry) => structuredClone(entry)),
    rest: {
      mutations: state.rest.mutations.map((mutation) => cloneRestRecord(mutation)),
      queries: state.rest.queries.map((query) => cloneRestRecord(query)),
    },
    prevHtml: state.prevHtml,
    componentCache: { ...state.componentCache },
    styleCache: { ...state.styleCache },
    nextComponentId: state.nextComponentId,
    nextStyleId: state.nextStyleId,
  };
}

function computeNextIdFromCache(
  cache: Record<string, string>,
  prefix: string
): number {
  let max = 0;
  for (const key of Object.keys(cache ?? {})) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    const numeric = Number.parseInt(key.slice(prefix.length), 10);
    if (!Number.isNaN(numeric)) {
      max = Math.max(max, numeric);
    }
  }
  return max + 1;
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

function findLastHtmlEntryIndex(history: HistoryEntry[]): number {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.entryKind === "html") {
      return index;
    }
  }
  return -1;
}

function summarizeFork(fork: ForkState): ForkSummary {
  return {
    forkId: fork.forkId,
    originEntryId: fork.originEntryId,
    createdAt: fork.createdAt,
    branches: Array.from(fork.branches.values()).map((branch) => ({
      branchId: branch.branchId,
      label: branch.label,
      instructions: branch.instructions,
      entryCount: branch.history.length,
    })),
  };
}

function formatJsonForHtml(payload: unknown): string {
  try {
    const json = JSON.stringify(payload ?? null, null, 2);
    return `<pre class="vaporvibe-rest-json">${escapeHtml(json)}</pre>`;
  } catch {
    return `<pre class="vaporvibe-rest-json">${escapeHtml(String(payload ?? ""))}</pre>`;
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

  const generatedImages = normalizeGeneratedImages(entry.generatedImages);
  if (generatedImages?.length) {
    normalized.generatedImages = generatedImages;
  }

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

function normalizeGeneratedImages(
  images: GeneratedImage[] | undefined
): GeneratedImage[] | undefined {
  if (!images || images.length === 0) {
    return undefined;
  }

  const allowedRatios: ImageAspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];

  return images
    .map((image): GeneratedImage | null => {
      if (!image || typeof image !== "object") {
        return null;
      }
      const ratio = allowedRatios.includes(image.ratio as ImageAspectRatio)
        ? (image.ratio as ImageAspectRatio)
        : "1:1";
      const validProviders = ["gemini", "openai", "openrouter"] as const;
      const provider = validProviders.includes(image.provider as typeof validProviders[number])
        ? (image.provider as typeof validProviders[number])
        : "openai";
      const modelId =
        typeof image.modelId === "string"
          ? (image.modelId as ImageModelId)
          : "gpt-image-1.5";
      const mimeType =
        typeof image.mimeType === "string" && image.mimeType.trim().length > 0
          ? image.mimeType
          : "image/png";
      const cacheKey =
        typeof image.cacheKey === "string" && image.cacheKey.trim().length > 0
          ? image.cacheKey
          : crypto.randomUUID();
      const url =
        typeof image.url === "string" && image.url.trim().length > 0
          ? image.url
          : getGeneratedImagePath(cacheKey).route;
      const createdAt =
        typeof image.createdAt === "string" && image.createdAt.trim().length > 0
          ? image.createdAt
          : new Date().toISOString();
      const prompt = typeof image.prompt === "string" ? image.prompt : "";
      const base64 =
        typeof image.base64 === "string" && image.base64.trim().length > 0
          ? image.base64
          : undefined;
      const blobName =
        typeof image.blobName === "string" && image.blobName.trim().length > 0
          ? image.blobName.trim()
          : undefined;
      const id =
        typeof image.id === "string" && image.id.trim().length > 0
          ? image.id
          : crypto.randomUUID();

      const result: GeneratedImage = {
        id,
        cacheKey,
        url,
        prompt,
        ratio,
        provider,
        modelId,
        mimeType,
        createdAt,
      };

      if (base64) {
        result.base64 = base64;
      }

      if (blobName) {
        result.blobName = blobName;
      }

      return result;
    })
    .filter((image): image is GeneratedImage => image !== null);
}
