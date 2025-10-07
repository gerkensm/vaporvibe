import OpenAI from "openai";
import { logger } from "../logger.js";
export class OpenAiClient {
    settings;
    client;
    constructor(settings) {
        this.settings = settings;
        this.client = new OpenAI({ apiKey: settings.apiKey });
        if (settings.reasoningTokens !== undefined) {
            logger.info(`OpenAI reasoning tokens are not a separate budget; ignoring requested value ${settings.reasoningTokens}. Use --reasoning-mode to control effort.`);
        }
    }
    async generateHtml(messages) {
        const input = messages.map((message) => ({
            type: "message",
            role: message.role,
            content: [{ type: "input_text", text: message.content }],
        }));
        const request = {
            model: this.settings.model,
            input,
            max_output_tokens: this.settings.maxOutputTokens,
        };
        if (this.settings.reasoningMode && this.settings.reasoningMode !== "none") {
            request.reasoning = {
                effort: this.settings.reasoningMode,
                summary: "auto",
            };
        }
        const response = await this.client.responses.create(request);
        const html = extractHtml(response);
        const reasoning = extractReasoning(response, this.settings.reasoningMode, this.settings.reasoningTokens);
        return {
            html,
            usage: extractUsageMetrics(response),
            reasoning,
            raw: response,
        };
    }
}
function extractReasoning(response, mode, tokens) {
    if (!mode || mode === "none") {
        return undefined;
    }
    try {
        const usage = response?.usage ?? response?.usage_metadata;
        const reasoningTokens = usage?.output_tokens_details?.reasoning_tokens ?? usage?.output?.reasoning_tokens;
        const outputItems = Array.isArray(response?.output) ? response.output : [];
        const reasoningItems = outputItems.filter((item) => item?.type === "reasoning");
        const reasoningSummaries = reasoningItems
            .flatMap((item) => item?.summary ?? [])
            .map((part) => (typeof part === "string" ? part : part?.text))
            .filter(Boolean);
        const reasoningTextBlocks = outputItems
            .filter((item) => item?.type === "message")
            .flatMap((item) => item?.content ?? [])
            .filter((part) => part?.type === "reasoning_text")
            .map((part) => part.text)
            .filter(Boolean);
        const header = `OpenAI reasoning (mode=${mode}, tokens=${reasoningTokens ?? "n/a"}, budget=${tokens ?? "n/a"})`;
        if (reasoningSummaries.length > 0 || reasoningTextBlocks.length > 0) {
            let message = header;
            if (reasoningSummaries.length > 0) {
                message += `\nSummary:\n${reasoningSummaries.join("\n\n")}`;
            }
            if (reasoningTextBlocks.length > 0) {
                message += `\nReasoning text:\n${reasoningTextBlocks.join("\n\n")}`;
            }
            logger.debug(message);
            return {
                summaries: reasoningSummaries.length > 0 ? reasoningSummaries : undefined,
                details: reasoningTextBlocks.length > 0 ? reasoningTextBlocks : undefined,
                raw: outputItems.filter((item) => item?.type === "reasoning"),
            };
        }
        else if (reasoningTokens !== undefined) {
            logger.debug(`${header} — no textual reasoning returned.`);
        }
        return undefined;
    }
    catch (error) {
        logger.warn(`Failed to capture OpenAI reasoning metadata: ${error.message}`);
        return undefined;
    }
}
function extractHtml(response) {
    const direct = response?.output_text;
    if (typeof direct === "string" && direct.trim().length > 0) {
        return direct.trim();
    }
    if (Array.isArray(response?.output)) {
        const text = response.output
            .map((item) => {
            if (item?.type !== "message" || !Array.isArray(item?.content)) {
                return "";
            }
            return item.content
                .map((part) => part?.type === "output_text" && typeof part?.text === "string" ? part.text : "")
                .join("");
        })
            .join("");
        if (text.trim().length > 0) {
            return text.trim();
        }
    }
    return "";
}
function extractUsageMetrics(response) {
    const usage = response?.usage ?? response?.usage_metadata;
    if (!usage || typeof usage !== "object") {
        return undefined;
    }
    const metrics = {};
    const input = usage.input_tokens ?? usage.input_token_count;
    const output = usage.output_tokens ?? usage.output_token_count;
    const total = usage.total_tokens ?? usage.total_token_count;
    const reasoning = usage.output_tokens_details?.reasoning_tokens ?? usage.reasoning_tokens;
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
