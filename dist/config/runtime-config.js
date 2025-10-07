import { DEFAULT_GEMINI_MODEL, DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_OPENAI_MODEL, DEFAULT_PORT, BRIEF_FORM_ROUTE, DEFAULT_ANTHROPIC_MODEL, DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS, DEFAULT_HISTORY_LIMIT, DEFAULT_HISTORY_MAX_BYTES, LOOPBACK_HOST } from "../constants.js";
import { createPrompter } from "./prompter.js";
const SESSION_TTL_MS = 15 * 60 * 1000;
const SESSION_CAP = 200;
export async function resolveAppConfig(options, env) {
    const prompter = createPrompter();
    try {
        const provider = await determineProvider(options, env, prompter);
        const providerSettings = await resolveProviderSettings(provider, options, env, prompter);
        const runtime = resolveRuntime(options, env);
        runtime.brief = options.brief || env.BRIEF?.trim();
        return {
            provider: providerSettings,
            runtime,
        };
    }
    finally {
        await prompter?.close();
    }
}
function resolveRuntime(options, env) {
    const port = options.port ?? parsePositiveInt(env.PORT) ?? DEFAULT_PORT;
    const host = options.host?.trim() || env.HOST?.trim() || LOOPBACK_HOST;
    const maxOutputTokens = options.maxOutputTokens ?? parsePositiveInt(env.MAX_OUTPUT_TOKENS) ?? parsePositiveInt(env.MAX_TOKENS);
    const instructionSetting = options.instructionPanel ?? env.INSTRUCTION_PANEL ?? env.INSTRUCTIONS_PANEL;
    const historyLimit = options.historyLimit ?? parsePositiveInt(env.HISTORY_LIMIT) ?? DEFAULT_HISTORY_LIMIT;
    const historyMaxBytes = options.historyMaxBytes ?? parsePositiveInt(env.HISTORY_MAX_BYTES) ?? DEFAULT_HISTORY_MAX_BYTES;
    const runtime = {
        port,
        host,
        historyLimit,
        historyMaxBytes,
        brief: undefined,
        promptPath: BRIEF_FORM_ROUTE,
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
async function resolveProviderSettings(provider, options, env, prompter) {
    const modelFromCli = options.model?.trim();
    const maxOverride = options.maxOutputTokens ?? parsePositiveInt(env.MAX_OUTPUT_TOKENS) ?? parsePositiveInt(env.MAX_TOKENS);
    const reasoning = resolveReasoningOptions(options, env);
    if (provider === "openai") {
        const apiKey = await ensureApiKey(provider, env, prompter);
        const model = modelFromCli || env.MODEL?.trim() || DEFAULT_OPENAI_MODEL;
        const maxOutputTokens = maxOverride ?? DEFAULT_MAX_OUTPUT_TOKENS;
        process.env.OPENAI_API_KEY = apiKey;
        return {
            provider,
            apiKey,
            model,
            maxOutputTokens,
            reasoningMode: reasoning.mode,
            reasoningTokens: reasoning.mode === "none" ? undefined : reasoning.tokens,
        };
    }
    if (provider === "gemini") {
        const apiKey = await ensureApiKey(provider, env, prompter);
        const model = modelFromCli || env.GEMINI_MODEL?.trim() || env.MODEL?.trim() || DEFAULT_GEMINI_MODEL;
        const maxOutputTokens = maxOverride ?? DEFAULT_MAX_OUTPUT_TOKENS;
        process.env.GEMINI_API_KEY = apiKey;
        return {
            provider,
            apiKey,
            model,
            maxOutputTokens,
            reasoningMode: reasoning.mode,
            reasoningTokens: reasoning.mode === "none" ? undefined : reasoning.tokens,
        };
    }
    const apiKey = await ensureApiKey(provider, env, prompter);
    const model = modelFromCli || env.ANTHROPIC_MODEL?.trim() || env.MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
    const maxOutputTokens = typeof maxOverride === "number"
        ? Math.min(maxOverride, DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS)
        : DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS;
    const reasoningTokens = reasoning.mode === "none"
        ? undefined
        : Math.min(reasoning.tokens ?? DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS, DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS);
    process.env.ANTHROPIC_API_KEY = apiKey;
    return {
        provider,
        apiKey,
        model,
        maxOutputTokens,
        reasoningMode: reasoning.mode,
        reasoningTokens,
    };
}
async function determineProvider(options, env, prompter) {
    const explicit = parseProviderValue(options.provider)
        || parseProviderValue(env.SERVE_LLM_PROVIDER)
        || parseProviderValue(env.LLM_PROVIDER)
        || parseProviderValue(env.PROVIDER);
    if (explicit) {
        return explicit;
    }
    const hasOpenAiKey = Boolean(getOpenAiKey(env));
    const hasGeminiKey = Boolean(getGeminiKey(env));
    const hasAnthropicKey = Boolean(getAnthropicKey(env));
    if (hasOpenAiKey && !hasGeminiKey && !hasAnthropicKey) {
        return "openai";
    }
    if (hasGeminiKey && !hasOpenAiKey && !hasAnthropicKey) {
        return "gemini";
    }
    if (hasAnthropicKey && !hasOpenAiKey && !hasGeminiKey) {
        return "anthropic";
    }
    if (!prompter) {
        // Non-interactive fallback: prefer OpenAI to match historical default
        return "openai";
    }
    while (true) {
        const answer = await prompter.ask("Choose model provider [openai/gemini/anthropic]: ");
        const parsed = parseProviderValue(answer);
        if (parsed) {
            return parsed;
        }
        console.error("Invalid provider. Please enter 'openai', 'gemini', or 'anthropic'.");
    }
}
async function ensureApiKey(provider, env, prompter) {
    const existing = provider === "openai"
        ? getOpenAiKey(env)
        : provider === "gemini"
            ? getGeminiKey(env)
            : getAnthropicKey(env);
    if (existing) {
        return existing;
    }
    if (!prompter) {
        throw new Error(`${provider} API key is required. Set it via environment variable before launching.`);
    }
    const label = provider === "openai" ? "OpenAI" : provider === "gemini" ? "Gemini" : "Anthropic";
    while (true) {
        try {
            const answer = await prompter.askHidden(`Enter ${label} API key: `);
            if (answer) {
                return answer;
            }
            console.error("API key cannot be empty.");
        }
        catch (err) {
            throw new Error(`Cancelled while entering ${label} API key.`);
        }
    }
}
function resolveReasoningOptions(options, env) {
    let mode = parseReasoningMode(options.reasoningMode ?? env.REASONING_MODE);
    const tokensFromCli = options.reasoningTokens;
    const tokensFromEnv = parsePositiveInt(env.REASONING_TOKENS);
    const tokens = tokensFromCli ?? tokensFromEnv;
    if ((tokens ?? 0) > 0 && mode === "none") {
        mode = "medium";
    }
    return {
        mode,
        tokens: typeof tokens === "number" ? tokens : undefined,
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
    return env.GEMINI_API_KEY || env.GEMINI_KEY || env.GOOGLE_API_KEY || env.GOOGLE_GENAI_KEY || undefined;
}
function getAnthropicKey(env) {
    return env.ANTHROPIC_API_KEY || env.ANTHROPIC_KEY || undefined;
}
