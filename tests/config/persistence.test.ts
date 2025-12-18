
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAppConfig } from "../../src/config/runtime-config.js";
import type { CliOptions } from "../../src/cli/args.js";
import { getLoggerMock } from "../test-utils/logger.js";

const credentialStoreMock = {
    getApiKey: vi.fn(),
};

const configStoreMock = {
    getLlmSettings: vi.fn(),
    getImageGeneration: vi.fn(),
};

vi.mock("../../src/utils/credential-store.js", () => ({
    getCredentialStore: () => credentialStoreMock,
}));

vi.mock("../../src/utils/config-store.js", () => ({
    getConfigStore: () => configStoreMock,
}));

vi.mock("keytar", () => ({
    default: {
        setPassword: vi.fn(),
        getPassword: vi.fn(),
        deletePassword: vi.fn(),
    },
}));

const loggerMock = getLoggerMock();

function createEnv(overrides: Record<string, string | undefined> = {}) {
    return {
        ...overrides,
    } as NodeJS.ProcessEnv;
}

describe("App Config Persistence", () => {
    beforeEach(() => {
        credentialStoreMock.getApiKey.mockReset();
        configStoreMock.getLlmSettings.mockReset();
        configStoreMock.getImageGeneration.mockReset();
        (loggerMock.info as any).mockClear();
    });

    afterEach(() => {
        delete process.env.OPENAI_API_KEY;
        delete process.env.GEMINI_API_KEY;
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.XAI_API_KEY;
        delete process.env.GROQ_API_KEY;
    });

    it("should use persisted provider if no CLI/Env provider is specified", async () => {
        // Setup: Persisted settings say "gemini"
        configStoreMock.getLlmSettings.mockReturnValue({
            provider: "gemini",
            model: "gemini-1.5-pro",
            maxOutputTokens: 1000,
            reasoningMode: "enabled"
        });

        // Setup: Credentials exist for gemini
        credentialStoreMock.getApiKey.mockImplementation(async (provider) =>
            provider === "gemini" ? "stored-gemini-key" : null
        );

        const options: CliOptions = {};
        const env = createEnv();

        const config = await resolveAppConfig(options, env);

        expect(config.provider.provider).toBe("gemini");
        expect(config.provider.model).toBe("gemini-1.5-pro");
        expect(config.providersWithKeys).toContain("gemini");
    });

    it("should use persisted model options when provider matches", async () => {
        // Setup: Persisted settings for openai
        configStoreMock.getLlmSettings.mockReturnValue({
            provider: "openai",
            model: "gpt-4-persisted",
            maxOutputTokens: 4096,
        });

        // Setup: User provides openai key via env, force provider resolution to openai
        const options: CliOptions = {};
        const env = createEnv({ OPENAI_API_KEY: "env-key" });

        const config = await resolveAppConfig(options, env);

        expect(config.provider.provider).toBe("openai");
        expect(config.provider.model).toBe("gpt-4-persisted");
        expect(config.provider.maxOutputTokens).toBe(4096);
    });

    it("should prioritize CLI options over persisted settings", async () => {
        // Setup: Persisted settings say "gemini"
        configStoreMock.getLlmSettings.mockReturnValue({
            provider: "gemini",
            model: "gemini-old",
        });

        // Setup: CLI says "openai"
        const options: CliOptions = {
            provider: "openai",
            model: "gpt-cli"
        };
        const env = createEnv({ OPENAI_API_KEY: "env-key" });

        const config = await resolveAppConfig(options, env);

        expect(config.provider.provider).toBe("openai");
        expect(config.provider.model).toBe("gpt-cli");
    });

    it("should fallback to defaults if persisted settings are for a different provider", async () => {
        // Setup: Persisted settings say "gemini"
        configStoreMock.getLlmSettings.mockReturnValue({
            provider: "gemini",
            model: "gemini-pro",
        });

        // Setup: Run with openai (via env)
        const options: CliOptions = {};
        const env = createEnv({ OPENAI_API_KEY: "env-key" });

        const config = await resolveAppConfig(options, env);

        expect(config.provider.provider).toBe("openai");
        // Should NOT use gemini logic, should use openai default
        // We didn't mock defaults but we can check it's not gemini-pro
        expect(config.provider.model).not.toBe("gemini-pro");
    });
});
