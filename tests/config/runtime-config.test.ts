import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAppConfig } from "../../src/config/runtime-config.js";
import { DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS } from "../../src/constants.js";
import type { CliOptions } from "../../src/cli/args.js";
import { getLoggerMock } from "../test-utils/logger.js";

const credentialStoreMock = {
  getApiKey: vi.fn<[], Promise<string | null>>(),
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

const loggerMock = getLoggerMock();

function createEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe("resolveAppConfig", () => {
  beforeEach(() => {
    credentialStoreMock.getApiKey.mockReset();
    loggerMock.info.mockClear();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.GROQ_API_KEY;
  });

  it("marks provider ready when CLI options include provider and model", async () => {
    credentialStoreMock.getApiKey.mockResolvedValue(null);

    const options: CliOptions = {
      provider: "openai",
      model: "gpt-test",
    };
    const env = createEnv({ OPENAI_API_KEY: "cli-key" });

    const config = await resolveAppConfig(options, env);

    expect(config.providerReady).toBe(true);
    expect(config.providerSelectionRequired).toBe(false);
    expect(config.provider.provider).toBe("openai");
    expect(config.provider.model).toBe("gpt-test");
    expect(process.env.OPENAI_API_KEY).toBe("cli-key");
  });

  it("prefers stored credentials when environment lacks keys", async () => {
    credentialStoreMock.getApiKey.mockImplementation(async (provider) =>
      provider === "gemini" ? "stored-gemini" : null
    );

    const options: CliOptions = {};
    const env = createEnv();

    const config = await resolveAppConfig(options, env);

    expect(config.provider.provider).toBe("gemini");
    expect(config.providersWithKeys).toContain("gemini");
    expect(config.provider.apiKey).toBe("stored-gemini");
  });

  it("caps anthropic reasoning tokens to the provider maximum", async () => {
    credentialStoreMock.getApiKey.mockResolvedValue(null);

    const options: CliOptions = {
      provider: "anthropic",
      model: "claude-test",
      reasoningTokens: 1_000_000,
    };
    const env = createEnv({ ANTHROPIC_API_KEY: "anthropic-key" });

    const config = await resolveAppConfig(options, env);

    expect(config.provider.provider).toBe("anthropic");
    expect(config.provider.reasoningTokens).toBe(
      DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS
    );
  });

  it("logs when groq reasoning token overrides are ignored", async () => {
    credentialStoreMock.getApiKey.mockResolvedValue(null);

    const options: CliOptions = {
      provider: "groq",
      model: "groq-test",
      reasoningTokens: 500,
    };
    const env = createEnv({ GROQ_API_KEY: "groq-key" });

    await resolveAppConfig(options, env);

    const infoCalls = loggerMock.info.mock.calls.flatMap((call) => call);
    expect(infoCalls.join(" ")).toContain("Groq does not expose reasoning token budgets");
  });
});
