import { DEFAULT_GEMINI_MODEL, DEFAULT_GROK_MODEL, DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_OPENAI_MODEL, DEFAULT_PORT, DEFAULT_ANTHROPIC_MODEL, DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS, DEFAULT_HISTORY_LIMIT, DEFAULT_HISTORY_MAX_BYTES, DEFAULT_REASONING_TOKENS, LOOPBACK_HOST, SETUP_ROUTE, } from "../constants.js";
import { getCredentialStore } from "../utils/credential-store.js";
const SESSION_TTL_MS = 15 * 60 * 1000;
const SESSION_CAP = 200;
export async function resolveAppConfig(options, env) {
    const providerResolution = await determineProvider(options, env);
    const providerSettings = await resolveProviderSettings(providerResolution.provider, options, env);
    const runtime = resolveRuntime(options, env);
    runtime.brief = options.brief || env.BRIEF?.trim();
    const hasApiKey = providerSettings.apiKey.trim().length > 0;
    if (hasApiKey) {
        applyProviderEnv(providerSettings);
    }
    const providersWithKeys = providerResolution.providersWithKeys;
    const providerSelectionRequired = !providerResolution.locked &&
        providersWithKeys.filter((value, index) => providersWithKeys.indexOf(value) === index).length > 1;
    return {
        provider: providerSettings,
        runtime,
        providerReady: hasApiKey,
        providerLocked: providerResolution.locked,
        providerSelectionRequired,
        providersWithKeys,
    };
}
function resolveRuntime(options, env) {
    const port = options.port ?? parsePositiveInt(env.PORT) ?? DEFAULT_PORT;
    const host = options.host?.trim() || env.HOST?.trim() || LOOPBACK_HOST;
    const maxOutputTokens = options.maxOutputTokens ??
        parsePositiveInt(env.MAX_OUTPUT_TOKENS) ??
        parsePositiveInt(env.MAX_TOKENS);
    const instructionSetting = options.instructionPanel ?? env.INSTRUCTION_PANEL ?? env.INSTRUCTIONS_PANEL;
    const historyLimit = options.historyLimit ??
        parsePositiveInt(env.HISTORY_LIMIT) ??
        DEFAULT_HISTORY_LIMIT;
    const historyMaxBytes = options.historyMaxBytes ??
        parsePositiveInt(env.HISTORY_MAX_BYTES) ??
        DEFAULT_HISTORY_MAX_BYTES;
    const runtime = {
        port,
        host,
        historyLimit,
        historyMaxBytes,
        brief: undefined,
        promptPath: SETUP_ROUTE,
        sessionTtlMs: SESSION_TTL_MS,
        sessionCap: SESSION_CAP,
        includeInstructionPanel: parseInstructionPanelSetting(instructionSetting),
    };
    if (typeof maxOutputTokens === "number") {
        // Allow runtime override via env even if provider settings pick defaults later
        // The provider resolver will respect this if present.
    }
    return runtime;
}
async function resolveProviderSettings(provider, options, env) {
    const modelFromCli = options.model?.trim();
    const maxOverride = options.maxOutputTokens ??
        parsePositiveInt(env.MAX_OUTPUT_TOKENS) ??
        parsePositiveInt(env.MAX_TOKENS);
    const reasoning = resolveReasoningOptions(options, env);
    // Check environment first, then credential store for UI-entered keys
    let apiKey = lookupEnvApiKey(provider, env)?.trim() ?? "";
    if (!apiKey) {
        try {
            const stored = await getCredentialStore().getApiKey(provider);
            if (stored) {
                apiKey = stored;
            }
        }
        catch {
            // Ignore credential retrieval errors
        }
    }
    if (provider === "openai") {
        const model = modelFromCli || env.MODEL?.trim() || DEFAULT_OPENAI_MODEL;
        const maxOutputTokens = maxOverride ?? DEFAULT_MAX_OUTPUT_TOKENS;
        const reasoningMode = reasoning.modeExplicit ? reasoning.mode : "low";
        return {
            provider,
            apiKey,
            model,
            maxOutputTokens,
            reasoningMode,
            reasoningTokens: undefined,
        };
    }
    if (provider === "gemini") {
        const model = modelFromCli ||
            env.GEMINI_MODEL?.trim() ||
            env.MODEL?.trim() ||
            DEFAULT_GEMINI_MODEL;
        const maxOutputTokens = maxOverride ?? DEFAULT_MAX_OUTPUT_TOKENS;
        let reasoningTokens;
        if (reasoning.tokensExplicit && typeof reasoning.tokens === "number") {
            reasoningTokens = reasoning.tokens;
        }
        else {
            reasoningTokens = DEFAULT_REASONING_TOKENS.gemini;
        }
        return {
            provider,
            apiKey,
            model,
            maxOutputTokens,
            reasoningMode: reasoning.mode,
            reasoningTokens,
        };
    }
    if (provider === "grok") {
        const model = modelFromCli ||
            env.GROK_MODEL?.trim() ||
            env.XAI_MODEL?.trim() ||
            env.MODEL?.trim() ||
            DEFAULT_GROK_MODEL;
        const maxOutputTokens = maxOverride ?? DEFAULT_MAX_OUTPUT_TOKENS;
        const reasoningMode = reasoning.modeExplicit ? reasoning.mode : "low";
        return {
            provider,
            apiKey,
            model,
            maxOutputTokens,
            reasoningMode,
            reasoningTokens: undefined,
        };
    }
    const model = modelFromCli ||
        env.ANTHROPIC_MODEL?.trim() ||
        env.MODEL?.trim() ||
        DEFAULT_ANTHROPIC_MODEL;
    const maxOutputTokens = typeof maxOverride === "number"
        ? Math.min(maxOverride, DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS)
        : DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS;
    let reasoningTokens = reasoning.tokensExplicit && typeof reasoning.tokens === "number"
        ? Math.min(reasoning.tokens, DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS)
        : DEFAULT_REASONING_TOKENS.anthropic;
    return {
        provider,
        apiKey,
        model,
        maxOutputTokens,
        reasoningMode: "none",
        reasoningTokens,
    };
}
async function determineProvider(options, env) {
    const explicit = parseProviderValue(options.provider) ||
        parseProviderValue(env.SERVE_LLM_PROVIDER) ||
        parseProviderValue(env.LLM_PROVIDER) ||
        parseProviderValue(env.PROVIDER);
    if (explicit) {
        const detected = await detectProvidersWithKeys(env);
        return { provider: explicit, locked: true, providersWithKeys: detected };
    }
    const hasOpenAiKey = Boolean(getOpenAiKey(env)) || (await hasStoredKey("openai"));
    const hasGeminiKey = Boolean(getGeminiKey(env)) || (await hasStoredKey("gemini"));
    const hasAnthropicKey = Boolean(getAnthropicKey(env)) || (await hasStoredKey("anthropic"));
    const hasGrokKey = Boolean(getGrokKey(env)) || (await hasStoredKey("grok"));
    const providersWithKeys = [];
    if (hasOpenAiKey)
        providersWithKeys.push("openai");
    if (hasGeminiKey)
        providersWithKeys.push("gemini");
    if (hasAnthropicKey)
        providersWithKeys.push("anthropic");
    if (hasGrokKey)
        providersWithKeys.push("grok");
    if (hasOpenAiKey && !hasGeminiKey && !hasAnthropicKey) {
        return { provider: "openai", locked: false, providersWithKeys };
    }
    if (hasGeminiKey && !hasOpenAiKey && !hasAnthropicKey) {
        return { provider: "gemini", locked: false, providersWithKeys };
    }
    if (hasAnthropicKey && !hasOpenAiKey && !hasGeminiKey) {
        return { provider: "anthropic", locked: false, providersWithKeys };
    }
    if (hasGrokKey && !hasOpenAiKey && !hasGeminiKey && !hasAnthropicKey) {
        return { provider: "grok", locked: false, providersWithKeys };
    }
    if (hasOpenAiKey) {
        return { provider: "openai", locked: false, providersWithKeys };
    }
    if (hasGeminiKey) {
        return { provider: "gemini", locked: false, providersWithKeys };
    }
    if (hasAnthropicKey) {
        return { provider: "anthropic", locked: false, providersWithKeys };
    }
    if (hasGrokKey) {
        return { provider: "grok", locked: false, providersWithKeys };
    }
    // Default to OpenAI when no preference is supplied.
    return { provider: "openai", locked: false, providersWithKeys };
}
async function detectProvidersWithKeys(env) {
    const detected = [];
    if (getOpenAiKey(env) || (await hasStoredKey("openai")))
        detected.push("openai");
    if (getGeminiKey(env) || (await hasStoredKey("gemini")))
        detected.push("gemini");
    if (getAnthropicKey(env) || (await hasStoredKey("anthropic")))
        detected.push("anthropic");
    if (getGrokKey(env) || (await hasStoredKey("grok")))
        detected.push("grok");
    return detected;
}
async function hasStoredKey(provider) {
    try {
        const key = await getCredentialStore().getApiKey(provider);
        return Boolean(key && key.trim().length > 0);
    }
    catch {
        return false;
    }
}
function resolveReasoningOptions(options, env) {
    const rawMode = options.reasoningMode ?? env.REASONING_MODE;
    const modeExplicit = typeof rawMode === "string" && rawMode.trim() !== "";
    let mode = parseReasoningMode(modeExplicit ? rawMode : undefined);
    const rawTokens = options.reasoningTokens ?? env.REASONING_TOKENS;
    const tokensExplicit = rawTokens !== undefined &&
        !(typeof rawTokens === "string" && rawTokens.trim() === "");
    let tokens;
    if (tokensExplicit) {
        const parsed = typeof rawTokens === "number"
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
function parseReasoningMode(value) {
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
function parseInstructionPanelSetting(value) {
    if (value === undefined || value === null) {
        return true;
    }
    if (typeof value !== "string") {
        return Boolean(value);
    }
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "off", "disable", "disabled", "no", "none"].includes(normalized)) {
        return false;
    }
    if (["true", "1", "on", "enable", "enabled", "yes"].includes(normalized)) {
        return true;
    }
    console.warn(`Unknown instruction panel setting '${value}', defaulting to enabled.`);
    return true;
}
function parseProviderValue(value) {
    if (!value || typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "openai")
        return "openai";
    if (normalized === "gemini")
        return "gemini";
    if (normalized === "anthropic")
        return "anthropic";
    if (normalized === "grok" || normalized === "xai" || normalized === "x.ai")
        return "grok";
    return undefined;
}
function parsePositiveInt(value) {
    if (typeof value !== "string" || value.trim() === "") {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }
    return undefined;
}
function getOpenAiKey(env) {
    return env.OPENAI_API_KEY || env.OPENAI_APIKEY || env.OPENAI_KEY || undefined;
}
function getGeminiKey(env) {
    return (env.GEMINI_API_KEY ||
        env.GEMINI_KEY ||
        env.GOOGLE_API_KEY ||
        env.GOOGLE_GENAI_KEY ||
        undefined);
}
function getAnthropicKey(env) {
    return env.ANTHROPIC_API_KEY || env.ANTHROPIC_KEY || undefined;
}
function getGrokKey(env) {
    return env.XAI_API_KEY || env.GROK_API_KEY || env.XAI_KEY || undefined;
}
function lookupEnvApiKey(provider, env) {
    if (provider === "openai") {
        return getOpenAiKey(env);
    }
    if (provider === "gemini") {
        return getGeminiKey(env);
    }
    if (provider === "grok") {
        return getGrokKey(env);
    }
    return getAnthropicKey(env);
}
function applyProviderEnv(settings) {
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
    process.env.ANTHROPIC_API_KEY = settings.apiKey;
}
