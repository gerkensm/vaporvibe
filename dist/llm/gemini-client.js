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
        const contents = userMessages.map((message) => ({
            role: "user",
            parts: [{ text: message.content }],
        }));
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
        if (this.settings.reasoningMode && this.settings.reasoningMode !== "none") {
            config.thinkingConfig = {
                includeThoughts: true,
                thinkingBudget: clampGeminiBudget(this.settings.reasoningTokens ?? -1, this.settings.maxOutputTokens),
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
function clampGeminiBudget(requested, maxOutputTokens) {
    if (requested === 0) {
        return 0;
    }
    if (requested < 0 || Number.isNaN(requested)) {
        return -1;
    }
    const upperBound = Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? maxOutputTokens : requested;
    return Math.max(0, Math.min(requested, upperBound));
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
    if (!mode || mode === "none") {
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
