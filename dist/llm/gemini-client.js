import { GoogleGenAI } from "@google/genai";
import { logger } from "../logger.js";
export class GeminiClient {
    settings;
    client;
    constructor(settings) {
        this.settings = settings;
        this.client = new GoogleGenAI({ apiKey: settings.apiKey });
    }
    async generateHtml(messages) {
        const systemMessages = messages.filter((message) => message.role === "system");
        const userMessages = messages.filter((message) => message.role === "user");
        const contents = userMessages.map((message) => {
            const parts = [{ text: message.content }];
            if (message.attachments?.length) {
                for (const attachment of message.attachments) {
                    if (attachment.mimeType.startsWith("image/") || attachment.mimeType === "application/pdf") {
                        parts.push({
                            inlineData: {
                                data: attachment.base64,
                                mimeType: attachment.mimeType,
                            },
                        });
                    }
                    else {
                        const descriptor = `Attachment ${attachment.name} (${attachment.mimeType}, ${attachment.size} bytes) encoded in Base64:\n${attachment.base64}`;
                        parts.push({ text: descriptor });
                    }
                }
            }
            return { role: "user", parts };
        });
        if (contents.length === 0) {
            contents.push({ role: "user", parts: [{ text: "" }] });
        }
        const config = {};
        if (this.settings.maxOutputTokens) {
            config.maxOutputTokens = this.settings.maxOutputTokens;
        }
        if (systemMessages.length > 0) {
            config.systemInstruction = {
                role: "system",
                parts: [{ text: systemMessages.map((message) => message.content).join("\n\n") }],
            };
        }
        const includeThoughts = shouldEnableGeminiThoughts(this.settings.reasoningMode, this.settings.reasoningTokens);
        if (includeThoughts) {
            config.thinkingConfig = {
                includeThoughts: true,
                thinkingBudget: clampGeminiBudget(this.settings.reasoningTokens ?? -1, this.settings.maxOutputTokens, this.settings.model),
            };
        }
        const response = await this.client.models.generateContent({
            model: this.settings.model,
            contents,
            config,
        });
        const reasoning = extractGeminiThinking(response, this.settings.reasoningMode, this.settings.reasoningTokens);
        const text = response.text?.trim();
        if (text) {
            return { html: text, usage: extractUsage(response), reasoning, raw: response };
        }
        const firstCandidate = response.candidates?.[0];
        const fallback = firstCandidate?.content?.parts
            ?.map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
            .join("") ?? "";
        return { html: fallback.trim(), usage: extractUsage(response), reasoning, raw: response };
    }
}
export async function verifyGeminiApiKey(apiKey) {
    const trimmed = apiKey.trim();
    if (!trimmed) {
        return { ok: false, message: "Enter a Gemini API key to continue." };
    }
    const client = new GoogleGenAI({ apiKey: trimmed });
    try {
        await client.models.list({ config: { pageSize: 1 } });
        return { ok: true };
    }
    catch (error) {
        const status = extractStatus(error);
        if (status === 401 || status === 403) {
            return { ok: false, message: "Gemini rejected that key. Confirm the key has Generative Language API access." };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, message: `Unable to reach Gemini: ${message}` };
    }
}
function clampGeminiBudget(requested, maxOutputTokens, model) {
    const limits = getGeminiThinkingLimits(model);
    if (Number.isNaN(requested)) {
        return limits.allowDynamic ? -1 : limits.minPositive ?? 0;
    }
    if (requested < 0) {
        return limits.allowDynamic ? -1 : limits.minPositive ?? 0;
    }
    if (requested === 0) {
        return limits.allowZero ? 0 : limits.minPositive ?? 0;
    }
    const boundedByMaxTokens = Number.isFinite(maxOutputTokens) && maxOutputTokens > 0
        ? Math.min(requested, maxOutputTokens)
        : requested;
    const boundedByModel = limits.max
        ? Math.min(boundedByMaxTokens, limits.max)
        : boundedByMaxTokens;
    let finalBudget = Math.floor(Math.max(0, boundedByModel));
    if (finalBudget === 0 && !limits.allowZero) {
        finalBudget = limits.minPositive ?? 1;
    }
    if (finalBudget > 0 && limits.minPositive && finalBudget < limits.minPositive) {
        finalBudget = limits.minPositive;
    }
    if (finalBudget !== requested) {
        logger.debug({
            requested,
            finalBudget,
            model,
            maxOutputTokens,
        }, "Adjusted Gemini thinking budget to comply with model limits");
    }
    return finalBudget;
}
function extractUsage(response) {
    const usage = response?.usageMetadata ?? response?.usage_metadata;
    if (!usage || typeof usage !== "object") {
        return undefined;
    }
    const metrics = {};
    const input = usage.promptTokenCount ?? usage.prompt_token_count;
    const output = usage.candidatesTokenCount ?? usage.candidates_token_count;
    const total = usage.totalTokenCount ?? usage.total_token_count;
    const thoughts = usage.thoughtsTokenCount ?? usage.thoughts_token_count;
    if (Number.isFinite(input))
        metrics.inputTokens = Number(input);
    if (Number.isFinite(output))
        metrics.outputTokens = Number(output);
    if (Number.isFinite(total))
        metrics.totalTokens = Number(total);
    if (Number.isFinite(thoughts))
        metrics.reasoningTokens = Number(thoughts);
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
function extractGeminiThinking(response, mode, requestedTokens) {
    if (!shouldEnableGeminiThoughts(mode, requestedTokens)) {
        return undefined;
    }
    try {
        const firstCandidate = response?.candidates?.[0];
        const parts = firstCandidate?.content?.parts ?? [];
        const thoughtSummaries = parts
            .filter((part) => part?.thought === true && typeof part?.text === "string")
            .map((part) => part.text);
        const usage = response?.usageMetadata ?? response?.usage_metadata;
        const thoughtsTokenCount = usage?.thoughtsTokenCount ?? usage?.thoughts_token_count;
        const budgetLabel = requestedTokens ?? "auto";
        const header = `Gemini thinking (mode=${mode}, budget=${budgetLabel}, thoughtTokens=${thoughtsTokenCount ?? "n/a"})`;
        if (thoughtSummaries.length > 0) {
            logger.debug(`${header}\n${thoughtSummaries.join("\n\n")}`);
            return {
                summaries: thoughtSummaries,
                raw: thoughtSummaries,
            };
        }
        logger.debug(`${header} — no thought summaries returned.`);
        return undefined;
    }
    catch (error) {
        logger.warn(`Failed to capture Gemini thinking metadata: ${error.message}`);
        return undefined;
    }
}
function shouldEnableGeminiThoughts(mode, requestedTokens) {
    if (mode && mode !== "none") {
        return true;
    }
    if (typeof requestedTokens === "number") {
        return requestedTokens !== 0;
    }
    return false;
}
function getGeminiThinkingLimits(model) {
    const normalized = model.trim().toLowerCase();
    if (normalized.includes("2.5-pro")) {
        return {
            allowDynamic: true,
            allowZero: false,
            minPositive: 128,
            max: 32_768,
        };
    }
    if (normalized.includes("2.5-flash-lite")) {
        return {
            allowDynamic: true,
            allowZero: true,
            minPositive: 512,
            max: 24_576,
        };
    }
    if (normalized.includes("2.5-flash")) {
        return {
            allowDynamic: true,
            allowZero: true,
            minPositive: 0,
            max: 24_576,
        };
    }
    if (normalized.includes("2.0")) {
        return {
            allowDynamic: true,
            allowZero: true,
            max: 16_384,
        };
    }
    return {
        allowDynamic: true,
        allowZero: true,
    };
}
function extractStatus(error) {
    if (!error || typeof error !== "object") {
        return undefined;
    }
    const anyError = error;
    if (typeof anyError.status === "number") {
        return anyError.status;
    }
    if (typeof anyError.status === "string") {
        const parsed = Number.parseInt(anyError.status, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
}
