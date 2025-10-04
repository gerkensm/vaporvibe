import OpenAI from "openai";
import type { ChatMessage, ProviderSettings } from "../types.js";
import type { LlmClient } from "./client.js";
import { logger } from "../logger.js";

type InputMessage = {
  type: "message";
  role: "system" | "user";
  content: Array<{ type: "input_text"; text: string }>;
};

export class OpenAiClient implements LlmClient {
  readonly settings: ProviderSettings;
  private readonly client: OpenAI;

  constructor(settings: ProviderSettings) {
    this.settings = settings;
    this.client = new OpenAI({ apiKey: settings.apiKey });
    if (settings.reasoningTokens !== undefined) {
      logger.info(
        `OpenAI reasoning tokens are not a separate budget; ignoring requested value ${settings.reasoningTokens}. Use --reasoning-mode to control effort.`,
      );
    }
  }

  async generateHtml(messages: ChatMessage[]): Promise<string> {
    const input: InputMessage[] = messages.map((message) => ({
      type: "message",
      role: message.role,
      content: [{ type: "input_text", text: message.content }],
    }));

    const request: Record<string, unknown> = {
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

    const response = await this.client.responses.create(request as never);

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
                .map((part) =>
                  part.type === "output_text" && typeof part.text === "string"
                    ? part.text
                    : "",
                )
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

function maybeLogReasoning(
  response: any,
  mode: ProviderSettings["reasoningMode"],
  tokens?: number,
): void {
  if (!mode || mode === "none") {
    return;
  }
  try {
    const usage = response?.usage ?? response?.usage_metadata;
    const reasoningTokens = usage?.output_tokens_details?.reasoning_tokens ?? usage?.output?.reasoning_tokens;
    const outputItems = Array.isArray(response?.output) ? response.output : [];
    const reasoningItems = outputItems.filter((item: any) => item?.type === "reasoning");

    const reasoningSummaries = reasoningItems
      .flatMap((item: any) => item?.summary ?? [])
      .map((part: any) => (typeof part === "string" ? part : part?.text))
      .filter(Boolean);

    const reasoningTextBlocks = outputItems
      .filter((item: any) => item?.type === "message")
      .flatMap((item: any) => item?.content ?? [])
      .filter((part: any) => part?.type === "reasoning_text")
      .map((part: any) => part.text)
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
    } else if (reasoningTokens !== undefined) {
      logger.debug(`${header} — no textual reasoning returned.`);
    }
  } catch (error) {
    logger.warn(`Failed to capture OpenAI reasoning metadata: ${(error as Error).message}`);
  }
}
