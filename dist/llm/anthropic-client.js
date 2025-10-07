import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../logger.js";
const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models";
const ANTHROPIC_VERSION = "2023-06-01";
const VERIFY_TIMEOUT_MS = 10_000;
export class AnthropicClient {
    settings;
    client;
    constructor(settings) {
        this.settings = settings;
        this.client = new Anthropic({ apiKey: settings.apiKey });
    }
    async generateHtml(messages) {
        const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content);
        const userMessages = messages.filter((message) => message.role === "user");
        const requestMessages = userMessages.map((message) => ({
            role: "user",
            content: [{ type: "text", text: message.content }],
        }));
        if (requestMessages.length === 0) {
            requestMessages.push({ role: "user", content: [{ type: "text", text: "" }] });
        }
        const wantsThinking = ((this.settings.reasoningMode && this.settings.reasoningMode !== "none")
            || (typeof this.settings.reasoningTokens === "number" && this.settings.reasoningTokens > 0));
        if (wantsThinking) {
            return this.generateWithThinking(systemMessages, requestMessages);
        }
        const betas = resolveBetas(this.settings.model);
        const createRequest = {
            model: this.settings.model,
            max_tokens: this.settings.maxOutputTokens,
            system: systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
            messages: requestMessages,
        };
        if (betas) {
            createRequest.betas = betas;
        }
        const response = await this.client.messages.create(createRequest);
        const html = this.combineContent(response.content).trim();
        return { html, usage: extractUsage(response), raw: response };
    }
    async generateWithThinking(systemMessages, requestMessages) {
        const thinkingBudgetCandidate = this.settings.reasoningTokens ?? this.settings.maxOutputTokens;
        const maxTokens = Math.max(1, this.settings.maxOutputTokens);
        const thinkingBudget = Math.max(1, Math.min(thinkingBudgetCandidate, Math.max(1, maxTokens - 1)));
        if (thinkingBudget >= maxTokens) {
            logger.warn(`Anthropic thinking budget ${thinkingBudgetCandidate} exceeds allowed maximum for model; using ${thinkingBudget} with max_tokens ${maxTokens}.`);
        }
        const betas = resolveBetas(this.settings.model);
        const streamRequest = {
            model: this.settings.model,
            max_tokens: Math.max(thinkingBudget + 1, maxTokens),
            system: systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
            messages: requestMessages,
            thinking: {
                type: "enabled",
                budget_tokens: thinkingBudget,
            },
        };
        if (betas) {
            streamRequest.betas = betas;
        }
        const stream = await this.client.messages.stream(streamRequest);
        let accumulated = "";
        let streamedThinking = "";
        for await (const event of stream) {
            accumulated += this.extractStreamDelta(event);
            streamedThinking += this.extractThinkingDelta(event);
        }
        const finalMessage = await stream.finalMessage();
        await stream.close?.();
        if (!accumulated) {
            accumulated = this.combineContent(finalMessage?.content).trim();
        }
        const reasoning = this.logAndCollectThinking(finalMessage, thinkingBudget, streamedThinking);
        return { html: accumulated.trim(), usage: extractUsage(finalMessage), reasoning, raw: finalMessage };
    }
    extractStreamDelta(event) {
        if (!event) {
            return "";
        }
        const delta = event.delta ?? event.content_block_delta?.delta;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
            return delta.text;
        }
        return "";
    }
    extractThinkingDelta(event) {
        if (!event) {
            return "";
        }
        const delta = event.delta ?? event.content_block_delta?.delta;
        if (delta?.type === "thinking_delta" && typeof delta.thinking === "string") {
            return delta.thinking;
        }
        return "";
    }
    combineContent(blocks) {
        if (!blocks || blocks.length === 0) {
            return "";
        }
        return blocks
            .map((block) => (block?.type === "text" || !block?.type ? block.text ?? "" : ""))
            .join("");
    }
    collectThinking(blocks) {
        if (!blocks || blocks.length === 0) {
            return [];
        }
        return blocks
            .filter((block) => block?.type === "thinking")
            .map((block) => block?.thinking ?? block?.text ?? "")
            .filter((value) => Boolean(value && value.trim().length > 0));
    }
    logAndCollectThinking(finalMessage, budgetTokens, streamedThinking) {
        const trimmedStream = streamedThinking.trim();
        const summaries = trimmedStream.length > 0
            ? [trimmedStream]
            : this.collectThinking(finalMessage?.content);
        if (!summaries || summaries.length === 0) {
            return undefined;
        }
        try {
            const thoughts = summaries;
            if (thoughts.length > 0) {
                const modeLabel = this.settings.reasoningMode && this.settings.reasoningMode !== "none"
                    ? this.settings.reasoningMode
                    : "token-only";
                const header = `Anthropic thinking (mode=${modeLabel}, budget=${budgetTokens})`;
                logger.debug(`${header}\n${thoughts.join("\n\n")}`);
                return {
                    summaries: thoughts,
                    raw: thoughts,
                };
            }
        }
        catch (error) {
            logger.warn(`Failed to capture Anthropic thinking metadata: ${error.message}`);
        }
        return undefined;
    }
}
export async function verifyAnthropicApiKey(apiKey) {
    const trimmed = apiKey.trim();
    if (!trimmed) {
        return { ok: false, message: "Enter an Anthropic API key to continue." };
    }
    const client = new Anthropic({ apiKey: trimmed });
    const modelsApi = client.models;
    if (modelsApi?.list) {
        try {
            await modelsApi.list();
            return { ok: true };
        }
        catch (error) {
            const status = extractStatus(error);
            const message = extractAnthropicError(error) ?? "Anthropic rejected that key. Confirm it has Messages API access.";
            if (status === 401 || status === 403) {
                return { ok: false, message };
            }
            return { ok: false, message };
        }
    }
    try {
        const response = await fetchWithTimeout(ANTHROPIC_MODELS_URL, {
            method: "GET",
            headers: {
                "x-api-key": trimmed,
                "anthropic-version": ANTHROPIC_VERSION,
                "User-Agent": "serve-llm-setup/1.0",
                Accept: "application/json",
            },
        });
        if (response.ok) {
            return { ok: true };
        }
        const detail = await extractAnthropicResponseMessage(response);
        if (response.status === 401 || response.status === 403) {
            return { ok: false, message: detail ?? "Anthropic rejected that key. Confirm it has Messages API access." };
        }
        return { ok: false, message: detail ?? `Anthropic responded with status ${response.status}. Try again shortly.` };
    }
    catch (error) {
        const status = extractStatus(error);
        const detail = extractAnthropicError(error);
        if (status === 401 || status === 403) {
            return { ok: false, message: detail ?? "Anthropic rejected that key. Confirm it has Messages API access." };
        }
        const message = detail ?? (error instanceof Error ? error.message : String(error));
        return { ok: false, message: `Unable to reach Anthropic: ${message}` };
    }
}
function extractUsage(response) {
    const usage = response?.usage ?? response?.usage_metadata;
    if (!usage || typeof usage !== "object") {
        return undefined;
    }
    const metrics = {};
    const input = usage.input_tokens ?? usage.input_token_count;
    const output = usage.output_tokens ?? usage.output_token_count;
    const total = usage.total_tokens ?? usage.total_token_count;
    const reasoning = usage.thinking_tokens ?? usage.reasoning_tokens;
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
const CONTEXT_1M_BETA = "context-1m-2025-08-07";
function resolveBetas(model) {
    if (!model)
        return undefined;
    const flag = process.env.ANTHROPIC_ENABLE_CONTEXT_1M;
    if (!flag || flag.toLowerCase() === "false" || flag === "0") {
        return undefined;
    }
    const normalized = model.toLowerCase();
    if (normalized.startsWith("claude-sonnet-4-5") || normalized.startsWith("claude-sonnet-4")) {
        return [CONTEXT_1M_BETA];
    }
    return undefined;
}
function extractStatus(error) {
    if (!error || typeof error !== "object") {
        return undefined;
    }
    const anyError = error;
    const value = anyError.status ?? anyError.response?.status;
    if (typeof value === "number") {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
}
async function fetchWithTimeout(url, init) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    }
    finally {
        clearTimeout(timer);
    }
}
function extractAnthropicError(error) {
    if (!error || typeof error !== "object") {
        return undefined;
    }
    const anyError = error;
    const direct = typeof anyError.message === "string" ? anyError.message : undefined;
    const nested = typeof anyError.error?.message === "string" ? anyError.error.message : undefined;
    return nested ?? direct;
}
async function extractAnthropicResponseMessage(response) {
    try {
        const text = await response.text();
        if (!text) {
            return undefined;
        }
        try {
            const parsed = JSON.parse(text);
            return parsed?.error?.message ?? parsed?.message ?? text;
        }
        catch {
            return text;
        }
    }
    catch {
        return undefined;
    }
}
