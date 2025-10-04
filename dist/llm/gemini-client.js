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
        maybeLogGeminiThinking(response, this.settings.reasoningMode, this.settings.reasoningTokens);
        const text = response.text?.trim();
        if (text) {
            return text;
        }
        const firstCandidate = response.candidates?.[0];
        const fallback = firstCandidate?.content?.parts
            ?.map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
            .join("") ?? "";
        return fallback.trim();
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
function maybeLogGeminiThinking(response, mode, requestedTokens) {
    if (!mode || mode === "none") {
        return;
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
        }
        else {
            logger.debug(`${header} — no thought summaries returned.`);
        }
    }
    catch (error) {
        logger.warn(`Failed to capture Gemini thinking metadata: ${error.message}`);
    }
}
