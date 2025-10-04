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
        const text = response.output_text?.trim();
        if (text) {
            maybeLogReasoning(response, this.settings.reasoningMode, this.settings.reasoningTokens);
            return text;
        }
        const fallback = Array.isArray(response.output)
            ? response.output
                .map((item) => {
                if (item.type === "message" && Array.isArray(item.content)) {
                    return item.content
                        .map((part) => part.type === "output_text" && typeof part.text === "string"
                        ? part.text
                        : "")
                        .join("");
                }
                return "";
            })
                .join("")
            : "";
        maybeLogReasoning(response, this.settings.reasoningMode, this.settings.reasoningTokens);
        return fallback.trim();
    }
}
function maybeLogReasoning(response, mode, tokens) {
    if (!mode || mode === "none") {
        return;
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
        }
        else if (reasoningTokens !== undefined) {
            logger.debug(`${header} — no textual reasoning returned.`);
        }
    }
    catch (error) {
        logger.warn(`Failed to capture OpenAI reasoning metadata: ${error.message}`);
    }
}
