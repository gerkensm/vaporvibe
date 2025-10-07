import OpenAI from "openai";
import { logger } from "../logger.js";
const GROK_BASE_URL = "https://api.x.ai/v1";
const GROK_TIMEOUT_MS = 360_000;
const GROK_REASONING_ONLY_MODELS = new Set([
    "grok-4",
    "grok-4-fast-reasoning",
    "grok-3",
    "grok-3-mini",
    "grok-3-mini-fast",
]);
const GROK_REASONING_UNSUPPORTED_MODELS = new Set([
    "grok-4-fast-non-reasoning",
    "grok-code-fast-1",
]);
const GROK_REASONING_EFFORT_SUPPORTED_MODELS = new Set([
    "grok-3",
    "grok-3-mini",
    "grok-3-mini-fast",
]);
export class GrokClient {
    settings;
    client;
    constructor(settings) {
        this.settings = settings;
        this.client = new OpenAI({
            apiKey: settings.apiKey,
            baseURL: GROK_BASE_URL,
            timeout: GROK_TIMEOUT_MS,
        });
        if (typeof this.settings.reasoningTokens === "number") {
            logger.info(`Grok does not expose a separate reasoning token budget; ignoring requested value ${this.settings.reasoningTokens}.`);
        }
    }
    async generateHtml(messages) {
        const requestMessages = buildMessages(messages);
        const payload = {
            model: this.settings.model,
            messages: requestMessages,
            max_tokens: this.settings.maxOutputTokens,
            stream: false,
        };
        const reasoningEffort = resolveReasoningEffort(this.settings);
        if (reasoningEffort) {
            payload.reasoning_effort = reasoningEffort;
        }
        const response = await this.client.chat.completions.create(payload);
        const html = extractHtml(response);
        const reasoning = extractReasoning(response, this.settings.reasoningMode);
        return {
            html,
            usage: extractUsage(response),
            reasoning,
            raw: response,
        };
    }
}
export async function verifyGrokApiKey(apiKey) {
    const trimmed = apiKey.trim();
    if (!trimmed) {
        return { ok: false, message: "Enter an xAI API key to continue." };
    }
    const client = new OpenAI({
        apiKey: trimmed,
        baseURL: GROK_BASE_URL,
        timeout: GROK_TIMEOUT_MS,
    });
    try {
        await client.models.list();
        return { ok: true };
    }
    catch (error) {
        const status = extractStatus(error);
        if (status === 401 || status === 403) {
            return { ok: false, message: "xAI rejected that key. Confirm it has API access and try again." };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, message: `Unable to reach xAI: ${message}` };
    }
}
function buildMessages(messages) {
    const system = messages
        .filter((message) => message.role === "system")
        .map((message) => message.content.trim())
        .filter((content) => content.length > 0);
    const userMessages = messages.filter((message) => message.role === "user");
    const request = [];
    if (system.length > 0) {
        request.push({ role: "system", content: system.join("\n\n") });
    }
    if (userMessages.length === 0) {
        request.push({ role: "user", content: "" });
    }
    else {
        for (const user of userMessages) {
            request.push({ role: "user", content: user.content });
        }
    }
    return request;
}
function resolveReasoningEffort(settings) {
    const mode = settings.reasoningMode;
    const normalized = normalizeModelId(settings.model);
    if (GROK_REASONING_UNSUPPORTED_MODELS.has(normalized)) {
        logger.debug(`Model ${settings.model} does not support reasoning_effort; skipping reasoning mode ${mode}.`);
        return undefined;
    }
    const supportsEffort = GROK_REASONING_EFFORT_SUPPORTED_MODELS.has(normalized);
    let desiredMode = mode;
    if ((!mode || mode === "none") && GROK_REASONING_ONLY_MODELS.has(normalized)) {
        if (supportsEffort) {
            desiredMode = "low";
            logger.debug(`Model ${settings.model} expects reasoning; applying reasoning_effort=low.`);
        }
        else {
            logger.debug(`Model ${settings.model} includes reasoning by default but does not accept reasoning_effort; leaving unset.`);
            desiredMode = "none";
        }
    }
    if (!supportsEffort) {
        if (desiredMode && desiredMode !== "none") {
            logger.debug(`Model ${settings.model} ignores reasoning mode ${desiredMode}; reasoning_effort is unavailable.`);
        }
        return undefined;
    }
    if (!desiredMode || desiredMode === "none") {
        return undefined;
    }
    if (desiredMode === "low") {
        return "low";
    }
    return "high";
}
function normalizeModelId(model) {
    return model.trim().toLowerCase();
}
function extractHtml(response) {
    const choice = Array.isArray(response?.choices) ? response.choices[0] : undefined;
    if (!choice) {
        return "";
    }
    const content = choice.message?.content;
    if (typeof content === "string") {
        return content.trim();
    }
    if (Array.isArray(content)) {
        const joined = content
            .map((part) => (typeof part?.text === "string" ? part.text : typeof part === "string" ? part : ""))
            .join("");
        return joined.trim();
    }
    return "";
}
function extractReasoning(response, mode) {
    if (!mode || mode === "none") {
        return undefined;
    }
    try {
        const choice = Array.isArray(response?.choices) ? response.choices[0] : undefined;
        const reasoningContent = coalesceReasoningContent(choice, response);
        const summaries = normalizeReasoningContent(reasoningContent);
        const usage = response?.usage;
        const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens ?? usage?.reasoning_tokens;
        if (summaries.length > 0) {
            const header = `Grok reasoning (mode=${mode}, tokens=${reasoningTokens ?? "n/a"})`;
            logger.debug(`${header}\n${summaries.join("\n\n")}`);
            return {
                summaries,
                raw: reasoningContent,
            };
        }
        if (reasoningTokens !== undefined) {
            logger.debug(`Grok reasoning (mode=${mode}, tokens=${reasoningTokens}) — no reasoning text returned.`);
        }
        return undefined;
    }
    catch (error) {
        logger.warn(`Failed to capture Grok reasoning metadata: ${error.message}`);
        return undefined;
    }
}
function extractUsage(response) {
    const usage = response?.usage;
    if (!usage || typeof usage !== "object") {
        return undefined;
    }
    const metrics = {};
    const input = usage.prompt_tokens ?? usage.promptTokens;
    const output = usage.completion_tokens ?? usage.completionTokens;
    const total = usage.total_tokens ?? usage.totalTokens;
    const reasoning = usage.completion_tokens_details?.reasoning_tokens ?? usage.reasoning_tokens;
    if (Number.isFinite(input))
        metrics.inputTokens = Number(input);
    if (Number.isFinite(output))
        metrics.outputTokens = Number(output);
    if (Number.isFinite(total))
        metrics.totalTokens = Number(total);
    if (Number.isFinite(reasoning))
        metrics.reasoningTokens = Number(reasoning);
    const providerMetricsEntries = Object.entries(usage).filter(([, value]) => typeof value === "number" || typeof value === "string");
    if (providerMetricsEntries.length > 0) {
        metrics.providerMetrics = Object.fromEntries(providerMetricsEntries);
    }
    if (metrics.inputTokens === undefined
        && metrics.outputTokens === undefined
        && metrics.totalTokens === undefined
        && metrics.reasoningTokens === undefined
        && !metrics.providerMetrics) {
        return undefined;
    }
    return metrics;
}
function extractStatus(error) {
    if (!error || typeof error !== "object") {
        return undefined;
    }
    const anyError = error;
    const statusValue = anyError.status ?? anyError.response?.status;
    if (typeof statusValue === "number") {
        return statusValue;
    }
    if (typeof statusValue === "string") {
        const parsed = Number.parseInt(statusValue, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
}
function normalizeReasoningContent(raw) {
    if (!raw) {
        return [];
    }
    const values = [];
    const seen = new Set();
    const push = (text) => {
        if (!text)
            return;
        const trimmed = text.trim();
        if (trimmed.length === 0)
            return;
        if (seen.has(trimmed))
            return;
        seen.add(trimmed);
        values.push(trimmed);
    };
    const walk = (value) => {
        if (!value) {
            return;
        }
        if (typeof value === "string") {
            push(value);
            return;
        }
        if (Array.isArray(value)) {
            for (const part of value) {
                walk(part);
            }
            return;
        }
        if (typeof value === "object") {
            const objectValue = value;
            if (typeof objectValue.text === "string") {
                push(objectValue.text);
            }
            if (typeof objectValue.content === "string") {
                push(objectValue.content);
            }
            else if (Array.isArray(objectValue.content)) {
                for (const part of objectValue.content) {
                    walk(part);
                }
            }
        }
    };
    walk(raw);
    return values;
}
function coalesceReasoningContent(choice, response) {
    if (choice?.message?.reasoning_content) {
        return choice.message.reasoning_content;
    }
    if (choice?.message?.metadata?.reasoning_content) {
        return choice.message.metadata.reasoning_content;
    }
    if (choice?.reasoning_content) {
        return choice.reasoning_content;
    }
    if (response?.reasoning_content) {
        return response.reasoning_content;
    }
    if (response?.metadata?.reasoning_content) {
        return response.metadata.reasoning_content;
    }
    return undefined;
}
