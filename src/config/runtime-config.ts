import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROK_MODEL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_PORT,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS,
  DEFAULT_HISTORY_LIMIT,
  DEFAULT_HISTORY_MAX_BYTES,
  DEFAULT_REASONING_TOKENS,
  LOOPBACK_HOST,
  SETUP_ROUTE,
} from "../constants.js";
import type {
  AppConfig,
  ModelProvider,
  ImageModelId,
  ImageGenConfig,
  ProviderSettings,
  ReasoningMode,
  RuntimeConfig,
} from "../types.js";
import type { CliOptions } from "../cli/args.js";
import { getCredentialStore } from "../utils/credential-store.js";
import { getConfigStore } from "../utils/config-store.js";
import { logger } from "../logger.js";

const SESSION_TTL_MS = Number.MAX_SAFE_INTEGER;
const SESSION_CAP = 200;

export async function resolveAppConfig(
  options: CliOptions,
  env: NodeJS.ProcessEnv
): Promise<AppConfig> {
  const providerResolution = await determineProvider(options, env);
  const providerSettings = await resolveProviderSettings(
    providerResolution.provider,
    providerResolution.providersWithKeys,
    options,
    env
  );
  const runtime = resolveRuntime(options, env);
  runtime.brief = options.brief || env.BRIEF?.trim();

  const hasApiKey = providerSettings.apiKey.trim().length > 0;
  const providerConfiguredViaCli = Boolean(
    options.provider && options.provider.trim().length > 0
  );
  const modelConfiguredViaCli = Boolean(
    options.model && options.model.trim().length > 0
  );

  if (hasApiKey && providerConfiguredViaCli && modelConfiguredViaCli) {
    applyProviderEnv(providerSettings);
  }

  const providersWithKeys = providerResolution.providersWithKeys;

  // Check if we have valid persisted settings - if so, skip the model selector
  const configStore = getConfigStore();
  const persistedLlm = configStore.getLlmSettings();
  const hasPersistedSettings = Boolean(
    persistedLlm?.provider &&
    persistedLlm?.model &&
    persistedLlm.provider === providerSettings.provider
  );

  // Provider selection is only required if:
  // 1. Not configured via CLI AND
  // 2. Not previously configured via persisted settings (with a valid key)
  const providerSelectionRequired = !(
    (providerConfiguredViaCli && modelConfiguredViaCli) ||
    (hasPersistedSettings && hasApiKey)
  );

  const providerReady =
    hasApiKey && !providerSelectionRequired;

  return {
    provider: providerSettings,
    runtime,
    providerReady,
    providerLocked: providerResolution.locked,
    providerSelectionRequired,
    providersWithKeys,
  };
}

function resolveRuntime(
  options: CliOptions,
  env: NodeJS.ProcessEnv
): RuntimeConfig {
  const port = options.port ?? parsePositiveInt(env.PORT) ?? DEFAULT_PORT;
  const host = options.host?.trim() || env.HOST?.trim() || LOOPBACK_HOST;
  const maxOutputTokens =
    options.maxOutputTokens ??
    parsePositiveInt(env.MAX_OUTPUT_TOKENS) ??
    parsePositiveInt(env.MAX_TOKENS);
  const instructionSetting =
    options.instructionPanel ?? env.INSTRUCTION_PANEL ?? env.INSTRUCTIONS_PANEL;
  const historyLimit =
    options.historyLimit ??
    parsePositiveInt(env.HISTORY_LIMIT) ??
    DEFAULT_HISTORY_LIMIT;
  const historyMaxBytes =
    options.historyMaxBytes ??
    parsePositiveInt(env.HISTORY_MAX_BYTES) ??
    DEFAULT_HISTORY_MAX_BYTES;
  const configStore = getConfigStore();
  const persistedRuntime = configStore.getRuntimeSettings();

  const enableStandardLibrarySetting = parseBooleanFlag(
    options.enableStandardLibrary ?? env.ENABLE_STANDARD_LIBRARY
  );

  const runtime: RuntimeConfig = {
    port,
    host,
    historyLimit,
    historyMaxBytes,
    brief: undefined,
    promptPath: SETUP_ROUTE,
    sessionTtlMs: SESSION_TTL_MS,
    sessionCap: SESSION_CAP,
    includeInstructionPanel: parseInstructionPanelSetting(instructionSetting),
    enableStandardLibrary:
      enableStandardLibrarySetting !== undefined
        ? enableStandardLibrarySetting
        : persistedRuntime?.enableStandardLibrary ?? true,
  };
  return runtime;
}

function resolveImageGenConfig(
  env: NodeJS.ProcessEnv,
  detectedProviders: ModelProvider[]
): ImageGenConfig {
  const configStore = getConfigStore();
  const persisted = configStore.getImageGeneration();

  const hasGeminiKey = detectedProviders.includes("gemini");
  const hasOpenAiKey = detectedProviders.includes("openai");

  // Default provider: use Gemini if only Gemini keys exist, otherwise OpenAI
  const defaultProvider = hasGeminiKey && !hasOpenAiKey ? "gemini" : "openai";
  const defaultModel =
    defaultProvider === "gemini"
      ? "imagen-3.0-generate-002"
      : "gpt-image-1.5";

  // Image generation: Env > Persisted > Defaults
  const enabled =
    (env.IMAGE_GENERATION_ENABLED ?? "").toLowerCase() === "true" ||
    (persisted?.enabled ?? false);
  const provider =
    (env.IMAGE_GENERATION_PROVIDER as "openai" | "gemini" | "openrouter" | undefined) ??
    persisted?.provider ??
    defaultProvider;
  const modelId =
    (env.IMAGE_GENERATION_MODEL as ImageModelId | undefined) ??
    persisted?.modelId ??
    defaultModel;

  return {
    enabled,
    provider,
    modelId,
  };
}

async function resolveProviderSettings(
  provider: ModelProvider,
  detectedProviders: ModelProvider[],
  options: CliOptions,
  env: NodeJS.ProcessEnv
): Promise<ProviderSettings> {
  const modelFromCli = options.model?.trim();
  const maxOverride =
    options.maxOutputTokens ??
    parsePositiveInt(env.MAX_OUTPUT_TOKENS) ??
    parsePositiveInt(env.MAX_TOKENS);
  const reasoning = resolveReasoningOptions(options, env);
  const imageGeneration = resolveImageGenConfig(env, detectedProviders);

  // Load persisted settings
  const configStore = getConfigStore();
  const persistedLlm = configStore.getLlmSettings();
  const persistedForProvider =
    persistedLlm?.provider === provider ? persistedLlm : undefined;

  // Check environment first, then credential store for UI-entered keys
  let apiKey = lookupEnvApiKey(provider, env)?.trim() ?? "";
  if (!apiKey) {
    try {
      const stored = await getCredentialStore().getApiKey(provider);
      if (stored) {
        apiKey = stored;
      }
    } catch {
      // Ignore credential retrieval errors
    }
  }

  if (provider === "openai") {
    const model =
      modelFromCli ||
      env.MODEL?.trim() ||
      persistedForProvider?.model ||
      DEFAULT_OPENAI_MODEL;
    const maxOutputTokens =
      maxOverride ??
      persistedForProvider?.maxOutputTokens ??
      DEFAULT_MAX_OUTPUT_TOKENS;
    const reasoningMode = reasoning.modeExplicit
      ? reasoning.mode
      : persistedForProvider?.reasoningMode ?? "low";
    return {
      provider,
      apiKey,
      model,
      maxOutputTokens,
      reasoningMode,
      reasoningTokens: undefined,
      imageGeneration,
    };
  }

  if (provider === "gemini") {
    const model =
      modelFromCli ||
      env.GEMINI_MODEL?.trim() ||
      env.MODEL?.trim() ||
      persistedForProvider?.model ||
      DEFAULT_GEMINI_MODEL;
    const maxOutputTokens =
      maxOverride ??
      persistedForProvider?.maxOutputTokens ??
      DEFAULT_MAX_OUTPUT_TOKENS;
    const reasoningTokensExplicit =
      reasoning.tokensExplicit && typeof reasoning.tokens === "number";

    // Fallback to persisted settings if not explicit in CLI/Env
    const reasoningTokensEnabled = reasoningTokensExplicit
      ? reasoning.tokens !== 0
      : persistedForProvider?.reasoningTokensEnabled ?? true;

    let reasoningTokens: number | undefined;
    if (reasoningTokensEnabled) {
      reasoningTokens = reasoningTokensExplicit
        ? reasoning.tokens
        : persistedForProvider?.reasoningTokens ??
        DEFAULT_REASONING_TOKENS.gemini;
    }

    const reasoningMode = reasoning.modeExplicit
      ? reasoning.mode
      : persistedForProvider?.reasoningMode ??
      (reasoningTokensEnabled ? "low" : "none");

    return {
      provider,
      apiKey,
      model,
      maxOutputTokens,
      reasoningMode,
      reasoningTokensEnabled,
      reasoningTokens,
      imageGeneration,
    };
  }

  if (provider === "grok") {
    const model =
      modelFromCli ||
      env.GROK_MODEL?.trim() ||
      env.XAI_MODEL?.trim() ||
      env.MODEL?.trim() ||
      persistedForProvider?.model ||
      DEFAULT_GROK_MODEL;
    const maxOutputTokens =
      maxOverride ??
      persistedForProvider?.maxOutputTokens ??
      DEFAULT_MAX_OUTPUT_TOKENS;
    const reasoningMode = reasoning.modeExplicit
      ? reasoning.mode
      : persistedForProvider?.reasoningMode ?? "low";
    return {
      provider,
      apiKey,
      model,
      maxOutputTokens,
      reasoningMode,
      reasoningTokens: undefined,
      imageGeneration,
    };
  }

  if (provider === "groq") {
    const model =
      modelFromCli ||
      env.GROQ_MODEL?.trim() ||
      env.MODEL?.trim() ||
      persistedForProvider?.model ||
      DEFAULT_GROQ_MODEL;
    const maxOutputTokens =
      maxOverride ??
      persistedForProvider?.maxOutputTokens ??
      DEFAULT_MAX_OUTPUT_TOKENS;
    if (
      reasoning.tokensExplicit &&
      typeof reasoning.tokens === "number" &&
      reasoning.tokens > 0
    ) {
      logger.info(
        `Groq does not expose reasoning token budgets; requested value ${reasoning.tokens} will be ignored.`
      );
    }
    const reasoningMode = reasoning.modeExplicit
      ? reasoning.mode
      : persistedForProvider?.reasoningMode ?? "none";
    return {
      provider,
      apiKey,
      model,
      maxOutputTokens,
      reasoningMode,
      reasoningTokens: undefined,
      imageGeneration,
    };
  }

  if (provider === "openrouter") {
    const model =
      modelFromCli ||
      env.OPENROUTER_MODEL?.trim() ||
      env.MODEL?.trim() ||
      persistedForProvider?.model ||
      DEFAULT_OPENROUTER_MODEL;
    const maxOutputTokens =
      maxOverride ??
      persistedForProvider?.maxOutputTokens ??
      DEFAULT_MAX_OUTPUT_TOKENS;
    const reasoningMode = reasoning.modeExplicit
      ? reasoning.mode
      : persistedForProvider?.reasoningMode ?? "low";
    return {
      provider,
      apiKey,
      model,
      maxOutputTokens,
      reasoningMode,
      reasoningTokens: undefined,
      imageGeneration,
    };
  }

  const model =
    modelFromCli ||
    env.ANTHROPIC_MODEL?.trim() ||
    env.MODEL?.trim() ||
    persistedForProvider?.model ||
    DEFAULT_ANTHROPIC_MODEL;
  const maxOutputTokens =
    typeof maxOverride === "number"
      ? Math.min(maxOverride, DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS)
      : persistedForProvider?.maxOutputTokens ??
      DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS;

  const reasoningTokensExplicit =
    reasoning.tokensExplicit && typeof reasoning.tokens === "number";

  // Fallback to persisted settings
  const reasoningTokensEnabled = reasoningTokensExplicit
    ? reasoning.tokens !== 0
    : persistedForProvider?.reasoningTokensEnabled ?? true;

  let reasoningTokens: number | undefined;
  if (reasoningTokensEnabled) {
    reasoningTokens = reasoningTokensExplicit
      ? Math.min(reasoning.tokens!, DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS)
      : persistedForProvider?.reasoningTokens ??
      DEFAULT_REASONING_TOKENS.anthropic;
  }

  const reasoningMode = reasoning.modeExplicit
    ? reasoning.mode
    : persistedForProvider?.reasoningMode ??
    (reasoningTokensEnabled ? "low" : "none");

  return {
    provider,
    apiKey,
    model,
    maxOutputTokens,
    reasoningMode,
    reasoningTokensEnabled,
    reasoningTokens,
    imageGeneration,
  };
}

async function determineProvider(
  options: CliOptions,
  env: NodeJS.ProcessEnv
): Promise<{
  provider: ModelProvider;
  locked: boolean;
  providersWithKeys: ModelProvider[];
}> {
  const explicit =
    parseProviderValue(options.provider) ||
    parseProviderValue(env.SERVE_LLM_PROVIDER) ||
    parseProviderValue(env.LLM_PROVIDER) ||
    parseProviderValue(env.PROVIDER);

  const detected = await detectProvidersWithKeys(env);

  if (explicit) {
    return { provider: explicit, locked: true, providersWithKeys: detected };
  }

  // Check for persisted provider preference
  const configStore = getConfigStore();
  const persistedLlm = configStore.getLlmSettings();
  if (persistedLlm?.provider) {
    // Only use persisted provider if we actually have a key for it (or it's in the detected list)
    if (detected.includes(persistedLlm.provider)) {
      return {
        provider: persistedLlm.provider,
        locked: false,
        providersWithKeys: detected,
      };
    }
  }

  const hasOpenAiKey = detected.includes("openai");
  const hasGeminiKey = detected.includes("gemini");
  const hasAnthropicKey = detected.includes("anthropic");
  const hasGrokKey = detected.includes("grok");
  const hasGroqKey = detected.includes("groq");

  if (hasOpenAiKey && !hasGeminiKey && !hasAnthropicKey) {
    return { provider: "openai", locked: false, providersWithKeys: detected };
  }
  if (hasGeminiKey && !hasOpenAiKey && !hasAnthropicKey) {
    return { provider: "gemini", locked: false, providersWithKeys: detected };
  }
  if (hasAnthropicKey && !hasOpenAiKey && !hasGeminiKey) {
    return { provider: "anthropic", locked: false, providersWithKeys: detected };
  }
  if (
    hasGrokKey &&
    !hasOpenAiKey &&
    !hasGeminiKey &&
    !hasAnthropicKey &&
    !hasGroqKey
  ) {
    return { provider: "grok", locked: false, providersWithKeys: detected };
  }
  if (
    hasGroqKey &&
    !hasOpenAiKey &&
    !hasGeminiKey &&
    !hasAnthropicKey &&
    !hasGrokKey
  ) {
    return { provider: "groq", locked: false, providersWithKeys: detected };
  }

  if (hasOpenAiKey) {
    return { provider: "openai", locked: false, providersWithKeys: detected };
  }
  if (hasGeminiKey) {
    return { provider: "gemini", locked: false, providersWithKeys: detected };
  }
  if (hasAnthropicKey) {
    return { provider: "anthropic", locked: false, providersWithKeys: detected };
  }
  if (hasGrokKey) {
    return { provider: "grok", locked: false, providersWithKeys: detected };
  }
  if (hasGroqKey) {
    return { provider: "groq", locked: false, providersWithKeys: detected };
  }

  // Default to OpenAI when no preference is supplied.
  return { provider: "openai", locked: false, providersWithKeys: detected };
}

async function detectProvidersWithKeys(
  env: NodeJS.ProcessEnv
): Promise<ModelProvider[]> {
  const detected: ModelProvider[] = [];
  if (getOpenAiKey(env) || (await hasStoredKey("openai")))
    detected.push("openai");
  if (getGeminiKey(env) || (await hasStoredKey("gemini")))
    detected.push("gemini");
  if (getAnthropicKey(env) || (await hasStoredKey("anthropic")))
    detected.push("anthropic");
  if (getGrokKey(env) || (await hasStoredKey("grok"))) detected.push("grok");
  if (getGroqKey(env) || (await hasStoredKey("groq"))) detected.push("groq");
  if (getOpenRouterKey(env) || (await hasStoredKey("openrouter")))
    detected.push("openrouter");
  return detected;
}

async function hasStoredKey(provider: ModelProvider): Promise<boolean> {
  try {
    const key = await getCredentialStore().getApiKey(provider);
    return Boolean(key && key.trim().length > 0);
  } catch {
    return false;
  }
}

interface ResolvedReasoningOptions {
  mode: ReasoningMode;
  tokens?: number;
  modeExplicit: boolean;
  tokensExplicit: boolean;
}

function resolveReasoningOptions(
  options: CliOptions,
  env: NodeJS.ProcessEnv
): ResolvedReasoningOptions {
  const rawMode = options.reasoningMode ?? env.REASONING_MODE;
  const modeExplicit = typeof rawMode === "string" && rawMode.trim() !== "";
  let mode = parseReasoningMode(modeExplicit ? rawMode : undefined);

  const rawTokens = options.reasoningTokens ?? env.REASONING_TOKENS;
  const tokensExplicit =
    rawTokens !== undefined &&
    !(typeof rawTokens === "string" && rawTokens.trim() === "");
  let tokens: number | undefined;
  if (tokensExplicit) {
    const parsed =
      typeof rawTokens === "number"
        ? rawTokens
        : Number.parseInt(String(rawTokens), 10);
    if (Number.isFinite(parsed) && (parsed === -1 || parsed >= 0)) {
      tokens = Math.floor(parsed);
    }
  }

  if (tokensExplicit && (tokens ?? 0) > 0 && mode === "none") {
    mode = "medium";
  }

  return {
    mode,
    tokens,
    modeExplicit,
    tokensExplicit,
  };
}

function parseReasoningMode(value: unknown): ReasoningMode {
  if (!value || (typeof value === "string" && value.trim() === "")) {
    return "none";
  }
  if (typeof value !== "string") {
    return "none";
  }
  const normalized = value.trim().toLowerCase();
  if (["none", "off", "disabled", "no"].includes(normalized)) {
    return "none";
  }
  if (["low", "light", "minimal"].includes(normalized)) {
    return "low";
  }
  if (["medium", "moderate", "mid"].includes(normalized)) {
    return "medium";
  }
  if (["high", "deep", "max"].includes(normalized)) {
    return "high";
  }
  console.warn(`Unknown reasoning mode '${value}', defaulting to none.`);
  return "none";
}

function parseInstructionPanelSetting(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value !== "string") {
    return Boolean(value);
  }
  const normalized = value.trim().toLowerCase();
  if (
    ["false", "0", "off", "disable", "disabled", "no", "none"].includes(
      normalized
    )
  ) {
    return false;
  }
  if (["true", "1", "on", "enable", "enabled", "yes"].includes(normalized)) {
    return true;
  }
  console.warn(
    `Unknown instruction panel setting '${value}', defaulting to enabled.`
  );
  return true;
}

function parseBooleanFlag(value: unknown): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on", "enable", "enabled"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off", "disable", "disabled"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function parseProviderValue(value: unknown): ModelProvider | undefined {
  if (!value || typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "openai") return "openai";
  if (normalized === "gemini") return "gemini";
  if (normalized === "anthropic") return "anthropic";
  if (normalized === "grok" || normalized === "xai" || normalized === "x.ai")
    return "grok";
  if (normalized === "groq") return "groq";
  if (normalized === "openrouter") return "openrouter";
  return undefined;
}

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return undefined;
}

function getOpenAiKey(env: NodeJS.ProcessEnv): string | undefined {
  return env.OPENAI_API_KEY || env.OPENAI_APIKEY || env.OPENAI_KEY || undefined;
}

function getGeminiKey(env: NodeJS.ProcessEnv): string | undefined {
  return (
    env.GEMINI_API_KEY ||
    env.GEMINI_KEY ||
    env.GOOGLE_API_KEY ||
    env.GOOGLE_GENAI_KEY ||
    undefined
  );
}

function getAnthropicKey(env: NodeJS.ProcessEnv): string | undefined {
  return env.ANTHROPIC_API_KEY || env.ANTHROPIC_KEY || undefined;
}

function getGrokKey(env: NodeJS.ProcessEnv): string | undefined {
  return env.XAI_API_KEY || env.GROK_API_KEY || env.XAI_KEY || undefined;
}

function getGroqKey(env: NodeJS.ProcessEnv): string | undefined {
  return env.GROQ_API_KEY || env.GROQ_KEY || undefined;
}

function getOpenRouterKey(env: NodeJS.ProcessEnv): string | undefined {
  return env.OPENROUTER_API_KEY || env.OPENROUTER_KEY || undefined;
}

export function lookupEnvApiKey(
  provider: ModelProvider,
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  if (provider === "openai") {
    return getOpenAiKey(env)?.trim() || undefined;
  }
  if (provider === "gemini") {
    return getGeminiKey(env)?.trim() || undefined;
  }
  if (provider === "anthropic") {
    return getAnthropicKey(env)?.trim() || undefined;
  }
  if (provider === "grok") {
    return getGrokKey(env)?.trim() || undefined;
  }
  if (provider === "groq") {
    return getGroqKey(env)?.trim() || undefined;
  }
  if (provider === "openrouter") {
    return getOpenRouterKey(env)?.trim() || undefined;
  }
  return undefined;
}

function applyProviderEnv(settings: ProviderSettings): void {
  if (!settings.apiKey || settings.apiKey.trim().length === 0) {
    return;
  }
  if (settings.provider === "openai") {
    process.env.OPENAI_API_KEY = settings.apiKey;
    return;
  }
  if (settings.provider === "gemini") {
    process.env.GEMINI_API_KEY = settings.apiKey;
    return;
  }
  if (settings.provider === "grok") {
    process.env.XAI_API_KEY = settings.apiKey;
    return;
  }
  if (settings.provider === "groq") {
    process.env.GROQ_API_KEY = settings.apiKey;
    return;
  }
  if (settings.provider === "openrouter") {
    process.env.OPENROUTER_API_KEY = settings.apiKey;
    return;
  }
  process.env.ANTHROPIC_API_KEY = settings.apiKey;
}
