
import type { ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminController } from "../../src/server/admin-controller.js";
import type { MutableServerState, RequestContext } from "../../src/server/server.js";
import { SessionStore } from "../../src/server/session-store.js";
import { createIncomingMessage } from "../test-utils/http.js";
import { getLoggerMock } from "../test-utils/logger.js";

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

const configStoreMock = {
    setLlmSettings: vi.fn(),
    getImageGeneration: vi.fn(),
    getLlmSettings: vi.fn(),
};

vi.mock("../../src/utils/config-store.js", () => ({
    getConfigStore: () => configStoreMock,
}));

vi.mock("../../src/llm/verification.js", () => ({
    verifyProviderApiKey: vi.fn().mockResolvedValue({ ok: true }),
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
            this.body = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
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
            historyLimit: 50,
            historyMaxBytes: 2_000_000,
            includeInstructionPanel: true,
            port: 3000,
            host: "localhost",
            promptPath: "prompt.md",
            sessionTtlMs: 3600000,
            sessionCap: 100,
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

describe("AdminController Persistence", () => {
    const ttl = 60_000;
    const capacity = 50;
    let sessionStore: SessionStore;
    let controller: AdminController;
    const logger = getLoggerMock();

    beforeEach(() => {
        sessionStore = new SessionStore(ttl, capacity);
        controller = new AdminController({ state: createState(), sessionStore });
        Object.values(credentialStoreMock).forEach((mockFn) => mockFn.mockReset?.());
        configStoreMock.setLlmSettings.mockReset();
    });

    it("persists provider settings to config store on update", async () => {
        const res = createResponse();
        const context = createContext(
            "/api/admin/provider",
            "POST",
            {
                headers: { "content-type": "application/json" },
                body: [
                    JSON.stringify({
                        provider: "anthropic",
                        model: "claude-3-opus-20240229",
                        maxOutputTokens: 2000,
                        reasoningTokensEnabled: true,
                        // In applyProviderUpdate it reads body via readBody. 
                        // The body is expected to resolve to ParsedFile or string.
                        // AdminController.ts uses readBody then JSON.parse if it's string.
                        // And maps payload to updatedSettings.
                        // Let's verify payload structure in AdminController.
                        reasoningTokens: 1000,
                    }),
                ],
            },
            res
        );

        credentialStoreMock.getApiKey.mockResolvedValue("test-key");
        credentialStoreMock.hasStoredKey.mockResolvedValue(true);
        credentialStoreMock.saveApiKey.mockResolvedValue(undefined);

        const handled = await controller.handle(context, Date.now(), logger as any);
        expect(handled).toBe(true);

        expect(configStoreMock.setLlmSettings).toHaveBeenCalledWith(expect.objectContaining({
            provider: "anthropic",
            model: "claude-3-opus-20240229",
            maxOutputTokens: 2000,
            reasoningTokensEnabled: true,
            reasoningTokens: 1000,
        }));
    });
});
