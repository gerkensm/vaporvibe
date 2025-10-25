import type {
  BriefAttachment,
  HistoryEntry,
  RestMutationRecord,
  RestQueryRecord,
} from "../../src/types.js";

let historyCounter = 0;

export function createHistoryEntry(
  overrides: Partial<HistoryEntry> = {}
): HistoryEntry {
  historyCounter += 1;
  const base: HistoryEntry = {
    id: overrides.id ?? `history-${historyCounter}`,
    sessionId: overrides.sessionId ?? "session-1",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    durationMs: overrides.durationMs ?? 100,
    brief: overrides.brief ?? "An app brief",
    request:
      overrides.request ??
      ({
        method: "GET",
        path: "/",
        query: {},
        body: {},
      } satisfies HistoryEntry["request"]),
    response:
      overrides.response ??
      ({
        html: "<html><body>Example</body></html>",
      } satisfies HistoryEntry["response"]),
    entryKind: overrides.entryKind ?? "html",
  };
  return {
    ...base,
    ...overrides,
    request: {
      ...base.request,
      ...(overrides.request ?? {}),
    },
    response: {
      ...base.response,
      ...(overrides.response ?? {}),
    },
  };
}

export function createAttachment(
  overrides: Partial<BriefAttachment> = {}
): BriefAttachment {
  return {
    id: overrides.id ?? "att-1",
    name: overrides.name ?? "Attachment",
    mimeType: overrides.mimeType ?? "text/plain",
    size: overrides.size ?? 12,
    base64: overrides.base64 ?? "c2FtcGxl",
  };
}

export function createRestMutation(
  overrides: Partial<RestMutationRecord> = {}
): RestMutationRecord {
  return {
    id: overrides.id ?? "mutation-1",
    path: overrides.path ?? "/rest_api/mutation/test",
    method: overrides.method ?? "POST",
    query: overrides.query ?? {},
    body: overrides.body ?? { value: 1 },
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

export function createRestQuery(
  overrides: Partial<RestQueryRecord> = {}
): RestQueryRecord {
  return {
    id: overrides.id ?? "query-1",
    path: overrides.path ?? "/rest_api/query/test",
    method: overrides.method ?? "GET",
    query: overrides.query ?? {},
    body: overrides.body ?? {},
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ok: overrides.ok ?? true,
    response: overrides.response ?? { data: [] },
    rawResponse: overrides.rawResponse ?? "{}",
    error: overrides.error,
  };
}
