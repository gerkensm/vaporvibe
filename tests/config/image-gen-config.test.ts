import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAppConfig } from "../../src/config/runtime-config.js";
import type { CliOptions } from "../../src/cli/args.js";

// Mock ConfigStore for image generation settings
const configStoreMock = {
    getLlmSettings: vi.fn(),
    getImageGeneration: vi.fn(),
    setLlmSettings: vi.fn(),
    setImageGeneration: vi.fn(),
};

vi.mock("../../src/utils/config-store.js", () => ({
    getConfigStore: () => configStoreMock,
}));

const credentialStoreMock = {
    getApiKey: vi.fn<(provider: string) => Promise<string | null>>(),
};

vi.mock("../../src/utils/credential-store.js", () => ({
    getCredentialStore: () => credentialStoreMock,
}));

vi.mock("keytar", () => ({
    default: {
        setPassword: vi.fn(),
        getPassword: vi.fn(),
        deletePassword: vi.fn(),
    },
}));

function createEnv(overrides: Record<string, string | undefined> = {}) {
    return {
        ...overrides,
    } as NodeJS.ProcessEnv;
}

describe("Image Generation Config Resolution", () => {
    beforeEach(() => {
        credentialStoreMock.getApiKey.mockReset();
        configStoreMock.getLlmSettings.mockReset();
        configStoreMock.getImageGeneration.mockReset();
    });

    afterEach(() => {
        delete process.env.OPENAI_API_KEY;
        delete process.env.GEMINI_API_KEY;
        delete process.env.IMAGE_GENERATION_ENABLED;
        delete process.env.IMAGE_GENERATION_PROVIDER;
        delete process.env.IMAGE_GENERATION_MODEL;
    });

    it("defaults to disabled when no persisted settings exist", async () => {
        credentialStoreMock.getApiKey.mockResolvedValue(null);
        configStoreMock.getImageGeneration.mockReturnValue(undefined);
        configStoreMock.getLlmSettings.mockReturnValue(undefined);

        const options: CliOptions = { provider: "openai", model: "gpt-4o" };
        const env = createEnv({ OPENAI_API_KEY: "test-key" });

        const config = await resolveAppConfig(options, env);

        expect(config.provider.imageGeneration).toBeDefined();
        expect(config.provider.imageGeneration?.enabled).toBe(false);
    });

    it("uses persisted image generation settings", async () => {
        credentialStoreMock.getApiKey.mockResolvedValue(null);
        configStoreMock.getImageGeneration.mockReturnValue({
            enabled: true,
            provider: "gemini",
            modelId: "imagen-3.0-generate-002",
        });
        configStoreMock.getLlmSettings.mockReturnValue(undefined);

        const options: CliOptions = { provider: "openai", model: "gpt-4o" };
        const env = createEnv({ OPENAI_API_KEY: "test-key" });

        const config = await resolveAppConfig(options, env);

        expect(config.provider.imageGeneration?.enabled).toBe(true);
        expect(config.provider.imageGeneration?.provider).toBe("gemini");
        expect(config.provider.imageGeneration?.modelId).toBe("imagen-3.0-generate-002");
    });

    it("environment variables override persisted settings", async () => {
        credentialStoreMock.getApiKey.mockResolvedValue(null);
        configStoreMock.getImageGeneration.mockReturnValue({
            enabled: false,
            provider: "gemini",
            modelId: "imagen-3.0-generate-002",
        });
        configStoreMock.getLlmSettings.mockReturnValue(undefined);

        const options: CliOptions = { provider: "openai", model: "gpt-4o" };
        const env = createEnv({
            OPENAI_API_KEY: "test-key",
            IMAGE_GENERATION_ENABLED: "true",
            IMAGE_GENERATION_PROVIDER: "openai",
            IMAGE_GENERATION_MODEL: "dall-e-3",
        });

        const config = await resolveAppConfig(options, env);

        expect(config.provider.imageGeneration?.enabled).toBe(true);
        expect(config.provider.imageGeneration?.provider).toBe("openai");
        expect(config.provider.imageGeneration?.modelId).toBe("dall-e-3");
    });

    it("defaults to gemini provider when only gemini key is available", async () => {
        credentialStoreMock.getApiKey.mockImplementation(async (provider: string) =>
            provider === "gemini" ? "gemini-key" : null
        );
        configStoreMock.getImageGeneration.mockReturnValue(undefined);
        configStoreMock.getLlmSettings.mockReturnValue(undefined);

        const options: CliOptions = { provider: "gemini", model: "gemini-1.5-pro" };
        const env = createEnv({ GEMINI_API_KEY: "gemini-key" });

        const config = await resolveAppConfig(options, env);

        // Default provider should be gemini when only gemini key is available
        expect(config.provider.imageGeneration?.provider).toBe("gemini");
        expect(config.provider.imageGeneration?.modelId).toBe("imagen-3.0-generate-002");
    });

    it("defaults to openai provider when both openai and gemini keys are available", async () => {
        credentialStoreMock.getApiKey.mockResolvedValue(null);
        configStoreMock.getImageGeneration.mockReturnValue(undefined);
        configStoreMock.getLlmSettings.mockReturnValue(undefined);

        const options: CliOptions = { provider: "openai", model: "gpt-4o" };
        const env = createEnv({
            OPENAI_API_KEY: "openai-key",
            GEMINI_API_KEY: "gemini-key",
        });

        const config = await resolveAppConfig(options, env);

        // Default provider should be openai when both keys are available
        expect(config.provider.imageGeneration?.provider).toBe("openai");
        expect(config.provider.imageGeneration?.modelId).toBe("gpt-image-1.5");
    });
});
