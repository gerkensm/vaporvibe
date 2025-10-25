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
});
