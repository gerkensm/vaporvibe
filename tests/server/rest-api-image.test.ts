import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerResponse } from "node:http";
import { RestApiController } from "../../src/server/rest-api-controller.js";
import { SessionStore } from "../../src/server/session-store.js";
import type { RequestContext } from "../../src/server/server.js";
import type { ProviderSettings, RuntimeConfig, BriefAttachment } from "../../src/types.js";
import { getLoggerMock } from "../test-utils/logger.js";
import { createIncomingMessage } from "../test-utils/http.js";

// Mock dependencies
const mockGenerateImage = vi.fn();
const mockCredentialStore = {
    getApiKey: vi.fn<[string], Promise<string | null>>(),
};

vi.mock("../../src/image-gen/factory.js", () => ({
    createImageGenClient: () => ({
        generateImage: mockGenerateImage,
    }),
}));

vi.mock("../../src/utils/credential-store.js", () => ({
    getCredentialStore: () => mockCredentialStore,
}));

vi.mock("node:fs", async (importOriginal) => {
    const original = await importOriginal<typeof import("node:fs")>();
    return {
        ...original,
        existsSync: vi.fn(() => false),
    };
});

vi.mock("node:fs/promises", () => ({
    mkdir: vi.fn(),
    writeFile: vi.fn(),
}));

function createMockResponse(): ServerResponse & {
    _body: string;
    _headers: Map<string, string>;
} {
    const headers = new Map<string, string>();
    const res = {
        statusCode: 200,
        _body: "",
        _headers: headers,
        setHeader: vi.fn((name: string, value: string) => {
            headers.set(name.toLowerCase(), value);
        }),
        getHeader: vi.fn((name: string) => headers.get(name.toLowerCase())),
        end: vi.fn(function (this: { _body: string }, chunk?: string) {
            if (chunk) this._body = chunk;
        }),
    } as unknown as ServerResponse & { _body: string; _headers: Map<string, string> };
    return res;
}

function createTestContext(
    path: string,
    method: string,
    body: Record<string, unknown> = {}
): RequestContext {
    const bodyJson = JSON.stringify(body);
    const req = createIncomingMessage({
        headers: { "content-type": "application/json" },
        body: Object.keys(body).length > 0 ? [bodyJson] : [],
    });
    (req as any).method = method;

    const res = createMockResponse();
    const url = new URL(`http://localhost${path}`);

    return {
        req,
        res,
        url,
        path,
        method,
        query: Object.fromEntries(url.searchParams),
        cookies: {},
    } as RequestContext;
}

function createProviderSettings(imageGenEnabled: boolean): ProviderSettings {
    return {
        provider: "openai",
        apiKey: "test-openai-key",
        model: "gpt-4o",
        maxOutputTokens: 4096,
        reasoningMode: "none",
        imageGeneration: imageGenEnabled ? {
            enabled: true,
            provider: "openai",
            modelId: "gpt-image-1.5",
        } : {
            enabled: false,
            provider: "openai",
        },
    };
}

function createEnvironment(imageGenEnabled: boolean) {
    return {
        brief: "Test app",
        briefAttachments: [] as BriefAttachment[],
        runtime: {
            port: 3000,
            host: "localhost",
            historyLimit: 100,
            historyMaxBytes: 1024,
        } as RuntimeConfig,
        llmClient: null,
        provider: createProviderSettings(imageGenEnabled),
        providerReady: true,
        providerSelectionRequired: false,
    };
}

describe("RestApiController Image Generation", () => {
    let controller: RestApiController;
    let sessionStore: SessionStore;
    const logger = getLoggerMock();

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStore = new SessionStore({ ttlMs: 3600000, cap: 100 });
        controller = new RestApiController({
            sessionStore,
            adminPath: "/vaporvibe",
            getEnvironment: () => createEnvironment(true),
        });
        mockCredentialStore.getApiKey.mockResolvedValue(null);
    });

    it("returns 405 for non-POST requests", async () => {
        const context = createTestContext("/rest_api/image/generate", "GET");

        await controller.handle(context, logger);

        expect(context.res.statusCode).toBe(405);
        const body = JSON.parse((context.res as any)._body);
        expect(body.error).toBe("Method Not Allowed");
    });

    it("returns 403 when image generation is disabled", async () => {
        controller = new RestApiController({
            sessionStore,
            adminPath: "/vaporvibe",
            getEnvironment: () => createEnvironment(false),
        });

        const context = createTestContext("/rest_api/image/generate", "POST", {
            prompt: "A sunset over mountains",
        });

        await controller.handle(context, logger);

        expect(context.res.statusCode).toBe(403);
        const body = JSON.parse((context.res as any)._body);
        expect(body.error).toBe("Image generation disabled");
    });

    it("returns 400 when prompt is missing", async () => {
        const context = createTestContext("/rest_api/image/generate", "POST", {
            ratio: "16:9",
        });

        await controller.handle(context, logger);

        expect(context.res.statusCode).toBe(400);
        const body = JSON.parse((context.res as any)._body);
        expect(body.error).toBe("Missing prompt");
    });

    it("returns 500 when API key is missing", async () => {
        // Override environment to have no API key
        const envWithNoKey = createEnvironment(true);
        envWithNoKey.provider!.apiKey = "";
        controller = new RestApiController({
            sessionStore,
            adminPath: "/vaporvibe",
            getEnvironment: () => envWithNoKey,
        });
        mockCredentialStore.getApiKey.mockResolvedValue(null);

        const context = createTestContext("/rest_api/image/generate", "POST", {
            prompt: "A sunset over mountains",
        });

        await controller.handle(context, logger);

        expect(context.res.statusCode).toBe(500);
        const body = JSON.parse((context.res as any)._body);
        expect(body.error).toBe("Missing API key for image provider");
    });

    it("successfully generates an image and returns a URL", async () => {
        mockGenerateImage.mockResolvedValue({
            url: "data:image/png;base64,iVBORw0KGg...",
            provider: "openai",
            originalPrompt: "A sunset over mountains",
        });

        const context = createTestContext("/rest_api/image/generate", "POST", {
            prompt: "A sunset over mountains",
            ratio: "16:9",
        });

        await controller.handle(context, logger);

        expect(context.res.statusCode).toBe(200);
        const body = JSON.parse((context.res as any)._body);
        expect(body.url).toMatch(/^\/generated-images\//);
        expect(mockGenerateImage).toHaveBeenCalledWith({
            prompt: "A sunset over mountains",
            ratio: "16:9",
            apiKey: "test-openai-key",
            modelId: "gpt-image-1.5",
        });
    });

    it("normalizes invalid aspect ratios to 1:1", async () => {
        mockGenerateImage.mockResolvedValue({
            url: "data:image/png;base64,iVBORw0KGg...",
            provider: "openai",
        });

        const context = createTestContext("/rest_api/image/generate", "POST", {
            prompt: "A test image",
            ratio: "invalid-ratio",
        });

        await controller.handle(context, logger);

        expect(mockGenerateImage).toHaveBeenCalledWith(
            expect.objectContaining({ ratio: "1:1" })
        );
    });

    it("returns 500 when image generation fails", async () => {
        mockGenerateImage.mockRejectedValue(new Error("Provider API error"));

        const context = createTestContext("/rest_api/image/generate", "POST", {
            prompt: "A failing image",
        });

        await controller.handle(context, logger);

        expect(context.res.statusCode).toBe(500);
        const body = JSON.parse((context.res as any)._body);
        expect(body.error).toBe("Provider API error");
    });

    it("returns 404 for unknown image endpoints", async () => {
        const context = createTestContext("/rest_api/image/unknown", "POST", {
            prompt: "test",
        });

        await controller.handle(context, logger);

        expect(context.res.statusCode).toBe(404);
    });
});
