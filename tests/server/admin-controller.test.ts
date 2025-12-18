import { existsSync, rmSync } from "node:fs";
import type { ServerResponse } from "node:http";
import type { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminController } from "../../src/server/admin-controller.js";
import type { MutableServerState, RequestContext } from "../../src/server/server.js";
import { SessionStore } from "../../src/server/session-store.js";
import { createHistoryEntry } from "../test-utils/factories.js";
import { createIncomingMessage } from "../test-utils/http.js";
import { getLoggerMock } from "../test-utils/logger.js";
import { getGeneratedImagePath } from "../../src/image-gen/paths.js";

const credentialStoreMock = {
  saveApiKey: vi.fn(),
  getApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  hasStoredKey: vi.fn(),
  clearAll: vi.fn(),
  getStorageInfo: vi.fn(),
  isAvailable: vi.fn(),
};

vi.mock("../../src/utils/credential-store.js", () => ({
  getCredentialStore: () => credentialStoreMock,
}));

class MockServerResponse {
  statusCode = 200;
  private headers = new Map<string, string | string[]>();
  body: string | null = null;

  setHeader(name: string, value: string | string[]): void {
    this.headers.set(name.toLowerCase(), value);
  }

  getHeader(name: string): string | string[] | undefined {
    return this.headers.get(name.toLowerCase());
  }

  end(chunk?: string | Buffer): void {
    if (chunk != null) {
      this.body = chunk instanceof Buffer ? chunk.toString("utf8") : chunk as string;
    }
  }
}

type TestResponse = ServerResponse & MockServerResponse;

function createResponse(): TestResponse {
  const base = new MockServerResponse();
  return base as unknown as TestResponse;
}

function createState(): MutableServerState {
  return {
    brief: null,
    briefAttachments: [],
    runtime: {
      port: 3000,
      host: 'localhost',
      promptPath: '',
      sessionTtlMs: 3600000,
      sessionCap: 100,
      historyLimit: 50,
      historyMaxBytes: 2_000_000,
      includeInstructionPanel: true,
    },
    provider: {
      provider: "openai",
      apiKey: "",
      model: "gpt-4o-mini",
      reasoningMode: "default",
      reasoningTokensEnabled: false,
      maxOutputTokens: 1024,
      imageGeneration: {
        enabled: false,
        provider: "openai",
        modelId: "gpt-image-1.5",
      },
    },
    llmClient: null,
    providerReady: false,
    providerLocked: false,
    providerSelectionRequired: false,
    providersWithKeys: new Set(),
    verifiedProviders: {},
    pendingHtml: new Map(),
    reasoningStreams: new Map(),
  };
}

function createContext(
  path: string,
  method: string,
  req: Parameters<typeof createIncomingMessage>[0],
  res: TestResponse
): RequestContext {
  const request = createIncomingMessage(req);
  (request as unknown as { method: string }).method = method;
  return {
    req: request,
    res,
    url: new URL(`http://localhost${path}`),
    method,
    path,
  } satisfies RequestContext;
}

describe("AdminController forks", () => {
  const ttl = 60_000;
  const capacity = 50;
  let sessionStore: SessionStore;
  let controller: AdminController;
  const logger = getLoggerMock() as unknown as Logger;

  beforeEach(() => {
    sessionStore = new SessionStore(ttl, capacity);
    controller = new AdminController({ state: createState(), sessionStore });
    Object.values(credentialStoreMock).forEach((mockFn) => mockFn.mockReset?.());
  });

  function seedSessionWithHistory(): { sid: string; entryId: string } {
    const response = createResponse();
    const sid = sessionStore.getOrCreateSessionId({}, response);
    const entry = createHistoryEntry({
      id: "origin",
      response: { html: "<html><body>Base</body></html>" },
    });
    sessionStore.appendHistoryEntry(sid, entry);
    sessionStore.setPrevHtml(sid, entry.response.html);
    return { sid, entryId: entry.id };
  }

  it("starts a fork via the API", async () => {
    const { sid, entryId } = seedSessionWithHistory();

    const res = createResponse();
    const context = createContext(
      "/api/admin/forks/start",
      "POST",
      {
        headers: {
          "content-type": "application/json",
          cookie: `sid=${sid}`,
        },
        body: [
          JSON.stringify({
            instructionsA: "Try blue",
            instructionsB: "Try green",
            baseEntryId: entryId,
          }),
        ],
      },
      res
    );

    const handled = await controller.handle(context, Date.now(), logger);
    expect(handled).toBe(true);
    const payload = JSON.parse(res.body ?? "{}") as {
      success?: boolean;
      forkId?: string;
      branchIdA?: string;
      branchIdB?: string;
    };
    expect(payload.success).toBe(true);
    expect(payload.forkId).toBeDefined();
    expect(payload.branchIdA).toBeDefined();
    expect(payload.branchIdB).toBeDefined();
    const summary = sessionStore.getActiveForkSummary(sid);
    expect(summary?.forkId).toBe(payload.forkId);
  });

  it("rejects starting a second fork for the same session", async () => {
    const { sid, entryId } = seedSessionWithHistory();
    const first = createResponse();
    await controller.handle(
      createContext(
        "/api/admin/forks/start",
        "POST",
        {
          headers: {
            "content-type": "application/json",
            cookie: `sid=${sid}`,
          },
          body: [
            JSON.stringify({
              instructionsA: "Option A",
              instructionsB: "Option B",
              baseEntryId: entryId,
            }),
          ],
        },
        first
      ),
      Date.now(),
      logger
    );

    const res = createResponse();
    const handled = await controller.handle(
      createContext(
        "/api/admin/forks/start",
        "POST",
        {
          headers: {
            "content-type": "application/json",
            cookie: `sid=${sid}`,
          },
          body: [
            JSON.stringify({
              instructionsA: "Another",
              instructionsB: "Variant",
            }),
          ],
        },
        res
      ),
      Date.now(),
      logger
    );
    expect(handled).toBe(true);
    const payload = JSON.parse(res.body ?? "{}") as { success?: boolean; message?: string };
    expect(payload.success).toBe(false);
    expect(res.statusCode).toBe(409);
    expect(payload.message).toMatch(/already active/i);
  });

  it("commits a fork and merges the chosen branch", async () => {
    const { sid, entryId } = seedSessionWithHistory();
    const startRes = createResponse();
    await controller.handle(
      createContext(
        "/api/admin/forks/start",
        "POST",
        {
          headers: {
            "content-type": "application/json",
            cookie: `sid=${sid}`,
          },
          body: [
            JSON.stringify({
              instructionsA: "Keep",
              instructionsB: "Discard",
              baseEntryId: entryId,
            }),
          ],
        },
        startRes
      ),
      Date.now(),
      logger
    );
    const startPayload = JSON.parse(startRes.body ?? "{}") as {
      forkId: string;
      branchIdA: string;
      branchIdB: string;
    };
    sessionStore.appendToBranchHistory(
      sid,
      startPayload.branchIdA,
      createHistoryEntry({ id: "branch-choice", response: { html: "<html>A</html>" } })
    );

    const res = createResponse();
    const commitPath = `/api/admin/forks/${startPayload.forkId}/commit/${startPayload.branchIdA}`;
    const handled = await controller.handle(
      createContext(
        commitPath,
        "POST",
        { headers: { cookie: `sid=${sid}` } },
        res
      ),
      Date.now(),
      logger
    );
    expect(handled).toBe(true);
    const payload = JSON.parse(res.body ?? "{}") as { success?: boolean };
    expect(payload.success).toBe(true);
    expect(sessionStore.isForkActive(sid)).toBe(false);
    const history = sessionStore.getHistory(sid);
    expect(history.map((item) => item.id)).toContain("branch-choice");
  });

  it("discards an active fork", async () => {
    const { sid, entryId } = seedSessionWithHistory();
    const startRes = createResponse();
    await controller.handle(
      createContext(
        "/api/admin/forks/start",
        "POST",
        {
          headers: {
            "content-type": "application/json",
            cookie: `sid=${sid}`,
          },
          body: [
            JSON.stringify({
              instructionsA: "Alpha",
              instructionsB: "Beta",
              baseEntryId: entryId,
            }),
          ],
        },
        startRes
      ),
      Date.now(),
      logger
    );
    const startPayload = JSON.parse(startRes.body ?? "{}") as { forkId: string };

    const res = createResponse();
    const handled = await controller.handle(
      createContext(
        `/api/admin/forks/${startPayload.forkId}/discard`,
        "POST",
        { headers: { cookie: `sid=${sid}` } },
        res
      ),
      Date.now(),
      logger
    );
    expect(handled).toBe(true);
    const payload = JSON.parse(res.body ?? "{}") as { success?: boolean };
    expect(payload.success).toBe(true);
    expect(sessionStore.isForkActive(sid)).toBe(false);
  });

  it("blocks history export while a fork is active", async () => {
    const { sid, entryId } = seedSessionWithHistory();
    const startRes = createResponse();
    await controller.handle(
      createContext(
        "/api/admin/forks/start",
        "POST",
        {
          headers: {
            "content-type": "application/json",
            cookie: `sid=${sid}`,
          },
          body: [
            JSON.stringify({
              instructionsA: "A",
              instructionsB: "B",
              baseEntryId: entryId,
            }),
          ],
        },
        startRes
      ),
      Date.now(),
      logger
    );

    const res = createResponse();
    const context = createContext(
      "/vaporvibe/history.json",
      "GET",
      { headers: { cookie: `sid=${sid}` } },
      res
    );
    const handled = await controller.handle(context, Date.now(), logger);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(409);
    const payload = JSON.parse(res.body ?? "{}") as { success?: boolean };
    expect(payload.success).toBe(false);
  });
});

describe("AdminController history import", () => {
  const ttl = 60_000;
  const capacity = 50;
  let sessionStore: SessionStore;
  let controller: AdminController;
  const logger = getLoggerMock() as unknown as Logger;

  beforeEach(() => {
    sessionStore = new SessionStore(ttl, capacity);
    controller = new AdminController({ state: createState(), sessionStore });
    Object.values(credentialStoreMock).forEach((mockFn) => mockFn.mockReset?.());
  });

  it("imports snapshot history into the active session id", async () => {
    const response = createResponse();
    const sid = sessionStore.getOrCreateSessionId({}, response);
    sessionStore.appendHistoryEntry(
      sid,
      createHistoryEntry({
        sessionId: sid,
        response: { html: "<html><body>Existing</body></html>" },
      })
    );

    const snapshot = {
      version: 1,
      exportedAt: new Date().toISOString(),
      brief: "Imported brief",
      briefAttachments: [],
      history: [
        createHistoryEntry({
          sessionId: "other-session",
          createdAt: "2024-01-01T00:00:00.000Z",
          response: { html: "<html><body>Imported</body></html>" },
        }),
      ],
      runtime: {
        historyLimit: 100,
        historyMaxBytes: 5_000_000,
        includeInstructionPanel: true,
      },
      llm: {
        provider: "openai",
        model: "gpt-4o-mini",
        maxOutputTokens: 2048,
        reasoningMode: "default",
      },
    };

    const res = createResponse();
    const context = createContext(
      "/api/admin/history/import",
      "POST",
      {
        headers: {
          "content-type": "application/json",
          cookie: `sid=${sid}`,
        },
        body: [JSON.stringify({ snapshot })],
      },
      res
    );

    const handled = await controller.handle(context, Date.now(), logger);
    expect(handled).toBe(true);

    const payload = JSON.parse(res.body ?? "{}") as {
      success?: boolean;
      state?: MutableServerState;
    };

    expect(payload.success).toBe(true);
    const history = sessionStore.getHistory(sid);
    expect(history).toHaveLength(1);
    expect(history[0].sessionId).toBe(sid);
    expect(history[0].response.html).toContain("Imported");
    expect(payload.state?.brief).toBe("Imported brief");
  });

  it("restores generated image caches during import", async () => {
    const response = createResponse();
    const sid = sessionStore.getOrCreateSessionId({}, response);
    const base64 = Buffer.from("image-binary").toString("base64");

    const snapshot = {
      version: 1,
      exportedAt: new Date().toISOString(),
      brief: "Imported brief",
      briefAttachments: [],
      history: [
        createHistoryEntry({
          sessionId: "external",
          createdAt: "2024-02-01T00:00:00.000Z",
          response: { html: "<html><body>Imported</body></html>" },
          generatedImages: [
            {
              id: "img-1",
              cacheKey: "cache-key-1",
              url: "/generated-images/cache-key-1.png",
              prompt: "A neon skyline",
              ratio: "16:9",
              provider: "openai",
              modelId: "gpt-image-1.5",
              mimeType: "image/png",
              base64,
              createdAt: "2024-02-01T00:00:00.000Z",
            },
          ],
        }),
      ],
      runtime: {
        historyLimit: 100,
        historyMaxBytes: 5_000_000,
        includeInstructionPanel: true,
      },
      llm: {
        provider: "openai",
        model: "gpt-4o-mini",
        maxOutputTokens: 2048,
        reasoningMode: "default",
      },
    };

    const res = createResponse();
    const context = createContext(
      "/api/admin/history/import",
      "POST",
      {
        headers: {
          "content-type": "application/json",
          cookie: `sid=${sid}`,
        },
        body: [JSON.stringify({ snapshot })],
      },
      res
    );

    await controller.handle(context, Date.now(), logger);

    const history = sessionStore.getHistory(sid);
    expect(history[0].generatedImages).toHaveLength(1);
    const cacheKey = history[0].generatedImages?.[0]?.cacheKey ?? "";
    const { filePath } = getGeneratedImagePath(cacheKey);
    expect(existsSync(filePath)).toBe(true);

    rmSync(filePath, { force: true });
  });
});
