import { GoogleGenAI } from "@google/genai";
import type { ChatMessage, ProviderSettings } from "../types.js";
import type { LlmClient } from "./client.js";
import { logger } from "../logger.js";

type ContentPart = { text: string };
type ContentMessage = { role?: string; parts: ContentPart[] };

type GenerateConfig = {
  maxOutputTokens?: number;
  systemInstruction?: ContentMessage;
  thinkingConfig?: {
    includeThoughts?: boolean;
    thinkingBudget?: number;
  };
};

export class GeminiClient implements LlmClient {
  readonly settings: ProviderSettings;
  private readonly client: GoogleGenAI;

  constructor(settings: ProviderSettings) {
    this.settings = settings;
    this.client = new GoogleGenAI({ apiKey: settings.apiKey });
  }

  async generateHtml(messages: ChatMessage[]): Promise<string> {
    const systemMessages = messages.filter((message) => message.role === "system");
    const userMessages = messages.filter((message) => message.role === "user");

    const contents: ContentMessage[] = userMessages.map((message) => ({
      role: "user",
      parts: [{ text: message.content }],
    }));

    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "" }] });
    }

    const config: GenerateConfig = {};
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

function clampGeminiBudget(requested: number, maxOutputTokens: number): number {
  if (requested === 0) {
    return 0;
  }
  if (requested < 0 || Number.isNaN(requested)) {
    return -1;
  }
  const upperBound = Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? maxOutputTokens : requested;
  return Math.max(0, Math.min(requested, upperBound));
}

function maybeLogGeminiThinking(response: any, mode: ProviderSettings["reasoningMode"], requestedTokens?: number): void {
  if (!mode || mode === "none") {
    return;
  }
  try {
    const firstCandidate = response?.candidates?.[0];
    const parts = firstCandidate?.content?.parts ?? [];
    const thoughtSummaries = parts
      .filter((part: any) => part?.thought === true && typeof part?.text === "string")
      .map((part: any) => part.text);
    const usage = response?.usageMetadata ?? response?.usage_metadata;
    const thoughtsTokenCount = usage?.thoughtsTokenCount ?? usage?.thoughts_token_count;

    const budgetLabel = requestedTokens ?? "auto";
    const header = `Gemini thinking (mode=${mode}, budget=${budgetLabel}, thoughtTokens=${thoughtsTokenCount ?? "n/a"})`;
    if (thoughtSummaries.length > 0) {
      logger.debug(`${header}\n${thoughtSummaries.join("\n\n")}`);
    } else {
      logger.debug(`${header} — no thought summaries returned.`);
    }
  } catch (error) {
    logger.warn(`Failed to capture Gemini thinking metadata: ${(error as Error).message}`);
  }
}
