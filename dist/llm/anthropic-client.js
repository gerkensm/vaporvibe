import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../logger.js";
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
        if (this.settings.reasoningMode && this.settings.reasoningMode !== "none") {
            return this.generateWithThinking(systemMessages, requestMessages);
        }
        const response = await this.client.messages.create({
            model: this.settings.model,
            max_output_tokens: this.settings.maxOutputTokens,
            system: systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
            messages: requestMessages,
        });
        const html = this.combineContent(response.content).trim();
        return html;
    }
    async generateWithThinking(systemMessages, requestMessages) {
        const thinkingBudgetCandidate = this.settings.reasoningTokens ?? this.settings.maxOutputTokens;
        const thinkingBudget = Math.max(1, Math.min(thinkingBudgetCandidate, this.settings.maxOutputTokens));
        const stream = await this.client.messages.stream({
            model: this.settings.model,
            max_output_tokens: this.settings.maxOutputTokens,
            system: systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
            messages: requestMessages,
            thinking: {
                type: "enabled",
                budget_tokens: thinkingBudget,
            },
        });
        let accumulated = "";
        for await (const event of stream) {
            accumulated += this.extractStreamDelta(event);
        }
        const finalMessage = await stream.finalMessage();
        await stream.close?.();
        if (!accumulated) {
            accumulated = this.combineContent(finalMessage?.content).trim();
        }
        this.logThinkingMetadata(finalMessage, thinkingBudget);
        return accumulated.trim();
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
    combineContent(blocks) {
        if (!blocks || blocks.length === 0) {
            return "";
        }
        return blocks
            .map((block) => (block?.type === "text" || !block?.type ? block.text ?? "" : ""))
            .join("");
    }
    logThinkingMetadata(finalMessage, budgetTokens) {
        if (!finalMessage?.content) {
            return;
        }
        try {
            const thoughts = finalMessage.content
                .filter((block) => block?.type === "thinking" && typeof block.text === "string")
                .map((block) => block.text ?? "");
            if (thoughts.length > 0) {
                const header = `Anthropic thinking (mode=${this.settings.reasoningMode}, budget=${budgetTokens})`;
                logger.debug(`${header}\n${thoughts.join("\n\n")}`);
            }
        }
        catch (error) {
            logger.warn(`Failed to capture Anthropic thinking metadata: ${error.message}`);
        }
    }
}
