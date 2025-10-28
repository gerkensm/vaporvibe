import { beforeEach, describe, expect, it, vi } from "vitest";

const { setCookieMock } = vi.hoisted(() => ({
  setCookieMock: vi.fn(),
}));

vi.mock("../../src/utils/cookies.js", () => ({
  setCookie: setCookieMock,
}));

import { SessionStore } from "../../src/server/session-store.js";
import type { HistoryEntry } from "../../src/types.js";
import {
  createHistoryEntry,
  createRestMutation,
  createRestQuery,
} from "../test-utils/factories.js";

class FakeResponse {
  private headers = new Map<string, string | string[]>();

  getHeader(name: string): string | string[] | undefined {
    return this.headers.get(name.toLowerCase());
  }

  setHeader(name: string, value: string | string[]): void {
    this.headers.set(name.toLowerCase(), value);
  }
}

type WritableResponse = NodeJS.WritableStream & {
  getHeader(name: string): string | string[] | undefined;
  setHeader(name: string, value: string | string[]): void;
};

function createWritableResponse(): WritableResponse {
  return new FakeResponse() as unknown as WritableResponse;
}

describe("SessionStore", () => {
  const ttl = 60_000;
  const capacity = 5;
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(ttl, capacity);
    setCookieMock.mockClear();
  });

  function seedBaseSession(
    overrides: Partial<HistoryEntry> = {}
  ): { sid: string; entry: HistoryEntry } {
    const res = createWritableResponse();
    const sid = store.getOrCreateSessionId({}, res);
    const entry = createHistoryEntry({
      response: { html: "<html><body>Origin</body></html>" },
      componentCache: { "sl-gen-1": "<div>base</div>" },
      styleCache: { "sl-style-1": ".base{}" },
      ...overrides,
    });
    store.appendHistoryEntry(sid, entry);
    store.setPrevHtml(sid, entry.response.html);
    return { sid, entry };
  }

  it("creates a session id and sets cookie when missing", () => {
    const res = createWritableResponse();
    const sid = store.getOrCreateSessionId({}, res);

    expect(sid).toMatch(/^[a-f0-9]{32}$/);
    expect(setCookieMock).toHaveBeenCalled();
  });

  it("returns existing session id without setting cookie", () => {
    const res = createWritableResponse();
    const sid = store.getOrCreateSessionId({}, res);

    setCookieMock.mockClear();
    const sidAgain = store.getOrCreateSessionId({ sid }, res);

    expect(sidAgain).toBe(sid);
    expect(setCookieMock).not.toHaveBeenCalled();
  });

  it("tracks previous html and history entries", () => {
    const res = createWritableResponse();
    const sid = store.getOrCreateSessionId({}, res);

    const history: HistoryEntry = createHistoryEntry({
      response: { html: "<html><body>Initial</body></html>" },
    });

    store.appendHistoryEntry(sid, history);
    expect(store.getPrevHtml(sid)).toContain("Initial");

    store.setPrevHtml(sid, "<html><body>Manual</body></html>");
    expect(store.getPrevHtml(sid)).toContain("Manual");

    const trimmedHistory = store.getHistory(sid, 1);
    expect(trimmedHistory).toHaveLength(1);
    expect(trimmedHistory[0].id).toBe(history.id);
  });

  it("clamps stored rest records and returns clones", () => {
    const res = createWritableResponse();
    const sid = store.getOrCreateSessionId({}, res);

    for (let index = 0; index < 30; index += 1) {
      store.appendMutationRecord(
        sid,
        createRestMutation({ id: `mutation-${index}` })
      );
      store.appendQueryRecord(
        sid,
        createRestQuery({ id: `query-${index}` })
      );
    }

    const restState = store.getRestState(sid);
    expect(restState.mutations).toHaveLength(25);
    expect(restState.queries).toHaveLength(25);

    restState.mutations[0].id = "mutated";
    const restStateAgain = store.getRestState(sid);
    expect(restStateAgain.mutations[0].id).not.toBe("mutated");
  });

  it("exports and imports snapshots without sharing references", () => {
    const res = createWritableResponse();
    const sid = store.getOrCreateSessionId({}, res);

    store.appendHistoryEntry(
      sid,
      createHistoryEntry({ response: { html: "<html>Snapshot</html>" } })
    );

    const snapshot = store.exportSnapshot();
    expect(snapshot.sessions).toHaveLength(1);

    const beforeImport = store.getPrevHtml(sid);
    snapshot.sessions[0][1].prevHtml = "tampered";
    expect(store.getPrevHtml(sid)).toBe(beforeImport);

    const restored = new SessionStore(ttl, capacity);
    restored.importSnapshot(snapshot);
    expect(restored.getPrevHtml(sid)).toBe("tampered");
  });

  it("replaces history for the current session id when importing", () => {
    const res = createWritableResponse();
    const sid = store.getOrCreateSessionId({}, res);

    store.appendHistoryEntry(
      sid,
      createHistoryEntry({
        sessionId: sid,
        response: { html: "<html><body>Original</body></html>" },
      })
    );

    const importedEntries = [
      createHistoryEntry({
        sessionId: "external-session",
        createdAt: "2024-01-01T00:00:00.000Z",
        response: { html: "<html><body>First</body></html>" },
      }),
      createHistoryEntry({
        sessionId: "external-session",
        createdAt: "2024-01-02T00:00:00.000Z",
        response: { html: "<html><body>Latest</body></html>" },
      }),
    ];

    store.replaceSessionHistory(sid, importedEntries);

    const history = store.getHistory(sid);
    expect(history).toHaveLength(2);
    expect(history.every((entry) => entry.sessionId === sid)).toBe(true);
    expect(store.getPrevHtml(sid)).toContain("Latest");

    const restState = store.getRestState(sid);
    expect(restState.mutations).toHaveLength(0);
    expect(restState.queries).toHaveLength(0);
  });

  it("appends REST history entries with preserved previous html", () => {
    const res = createWritableResponse();
    const sid = store.getOrCreateSessionId({}, res);

    store.setPrevHtml(sid, "<html><body>Existing</body></html>");

    const mutation = createRestMutation({ body: { updated: true } });
    store.appendRestHistoryEntry(sid, {
      type: "mutation",
      record: mutation,
      ok: true,
      durationMs: 123,
    });

    const history = store.getHistory(sid);
    const restEntry = history.at(-1)!;
    expect(restEntry.entryKind).toBe("rest-mutation");
    expect(restEntry.response.html).toContain("vaporvibe-rest-json");
    expect(store.getPrevHtml(sid)).toContain("Existing");
  });

  describe("fork support", () => {
    it("creates fork branches with cloned state and instructions", () => {
      const { sid, entry } = seedBaseSession();

      const { forkId, branchIdA, branchIdB } = store.startFork(
        sid,
        entry.id,
        "Instruction A",
        "Instruction B"
      );

      expect(forkId).toBeTypeOf("string");
      expect(branchIdA).toBeTypeOf("string");
      expect(branchIdB).toBeTypeOf("string");

      const summary = store.getActiveForkSummary(sid);
      expect(summary).not.toBeNull();
      expect(summary).toMatchObject({
        forkId,
        originEntryId: entry.id,
      });
      expect(summary!.branches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            branchId: branchIdA,
            label: "A",
            instructions: "Instruction A",
            entryCount: 0,
          }),
          expect.objectContaining({
            branchId: branchIdB,
            label: "B",
            instructions: "Instruction B",
            entryCount: 0,
          }),
        ])
      );

      expect(store.getPrevHtml(sid, branchIdA)).toContain("Origin");
      expect(store.getPrevHtml(sid, branchIdB)).toContain("Origin");
      expect(() => store.appendHistoryEntry(sid, createHistoryEntry())).toThrow(
        /fork is active/i
      );
    });

    it("isolates branch histories and prev html until resolution", () => {
      const { sid, entry } = seedBaseSession();
      const { forkId, branchIdA, branchIdB } = store.startFork(
        sid,
        entry.id,
        "Variant A",
        "Variant B"
      );

      const branchEntryA = createHistoryEntry({
        id: "branch-a-1",
        response: { html: "<html><body>A1</body></html>" },
        componentCache: { "sl-gen-2": "<div>A</div>" },
        styleCache: { "sl-style-2": ".a{}" },
      });
      store.appendToBranchHistory(sid, branchIdA, branchEntryA);

      const branchEntryB = createHistoryEntry({
        id: "branch-b-1",
        response: { html: "<html><body>B1</body></html>" },
      });
      store.appendToBranchHistory(sid, branchIdB, branchEntryB);

      const branchHistory = store.getHistoryForPrompt(sid, branchIdA);
      expect(branchHistory.map((item) => item.id)).toEqual([
        entry.id,
        branchEntryA.id,
      ]);
      expect(branchHistory.at(-1)?.forkInfo).toMatchObject({
        forkId,
        branchId: branchIdA,
        label: "A",
        status: "in-progress",
      });
      expect(store.getPrevHtml(sid, branchIdA)).toContain("A1");
      expect(store.getPrevHtml(sid, branchIdB)).toContain("B1");
      expect(store.getPrevHtml(sid)).toContain("Origin");
    });

    it("merges chosen branch history and rest records on resolve", () => {
      const { sid, entry } = seedBaseSession();
      const { forkId, branchIdA, branchIdB } = store.startFork(
        sid,
        entry.id,
        "Keep A",
        "Keep B"
      );

      const branchEntryA = createHistoryEntry({
        id: "branch-a-final",
        response: { html: "<html><body>Chosen</body></html>" },
      });
      store.appendToBranchHistory(sid, branchIdA, branchEntryA);
      store.appendMutationRecord(
        sid,
        createRestMutation({ id: "mutation-a" }),
        branchIdA
      );
      store.appendQueryRecord(
        sid,
        createRestQuery({ id: "query-a" }),
        branchIdA
      );

      const branchEntryB = createHistoryEntry({
        id: "branch-b-final",
        response: { html: "<html><body>Discarded</body></html>" },
      });
      store.appendToBranchHistory(sid, branchIdB, branchEntryB);

      store.resolveFork(sid, forkId, branchIdA);

      const mergedHistory = store.getHistory(sid);
      expect(mergedHistory.map((item) => item.id)).toEqual([
        entry.id,
        branchEntryA.id,
      ]);
      expect(mergedHistory.at(-1)?.forkInfo).toMatchObject({
        forkId,
        branchId: branchIdA,
        status: "chosen",
      });
      expect(store.isForkActive(sid)).toBe(false);
      expect(store.getPrevHtml(sid)).toContain("Chosen");

      const restState = store.getRestState(sid);
      expect(restState.mutations.at(-1)?.id).toBe("mutation-a");
      expect(restState.queries.at(-1)?.id).toBe("query-a");
    });

    it("discards branches without altering base history", () => {
      const { sid, entry } = seedBaseSession();
      const { forkId, branchIdA } = store.startFork(
        sid,
        entry.id,
        "Keep",
        "Discard"
      );

      store.appendToBranchHistory(
        sid,
        branchIdA,
        createHistoryEntry({ id: "branch-a" })
      );

      store.discardFork(sid, forkId);

      const baseHistory = store.getHistory(sid);
      expect(baseHistory.map((item) => item.id)).toEqual([entry.id]);
      expect(store.isForkActive(sid)).toBe(false);
      expect(store.getPrevHtml(sid)).toContain("Origin");
    });

    it("routes rest records to branches when a fork is active", () => {
      const { sid, entry } = seedBaseSession();
      const { branchIdA } = store.startFork(sid, entry.id, "A", "B");

      store.appendMutationRecord(
        sid,
        createRestMutation({ id: "branch-mutation" }),
        branchIdA
      );
      store.appendQueryRecord(
        sid,
        createRestQuery({ id: "branch-query" }),
        branchIdA
      );

      const branchRest = store.getRestState(sid, undefined, branchIdA);
      expect(branchRest.mutations.at(-1)?.id).toBe("branch-mutation");
      expect(branchRest.queries.at(-1)?.id).toBe("branch-query");

      expect(() =>
        store.appendMutationRecord(sid, createRestMutation({ id: "base" }))
      ).toThrow(/fork is active/i);
      expect(() =>
        store.appendQueryRecord(sid, createRestQuery({ id: "base" }))
      ).toThrow(/fork is active/i);
    });
  });
});
