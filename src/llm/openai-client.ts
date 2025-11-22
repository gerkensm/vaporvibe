import OpenAI from "openai";
import type { ChatMessage, LlmReasoningTrace, LlmUsageMetrics, ProviderSettings, VerificationResult } from "../types.js";
import type { LlmClient, LlmResult, LlmGenerateOptions } from "./client.js";
import { logger } from "../logger.js";

type InputContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "low" | "high" };

type InputMessage = {
  type: "message";
  role: "system" | "user";
  content: InputContentPart[];
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

  async generateHtml(
    messages: ChatMessage[],
    options: LlmGenerateOptions = {}
  ): Promise<LlmResult> {
    const input: InputMessage[] = messages.map((message) => {
      const content: InputContentPart[] = [
        { type: "input_text", text: message.content },
      ];
      if (message.attachments?.length) {
        for (const attachment of message.attachments) {
          const mimeType = attachment.mimeType.toLowerCase();
          if (mimeType.startsWith("image/")) {
            const imageContent: InputContentPart = {
              type: "input_image",
              image_url: buildImageDataUrl(attachment.mimeType, attachment.base64),
            };
            content.push(imageContent);
          } else {
            const descriptor =
              `Attachment ${attachment.name} (${attachment.mimeType}, ${attachment.size} bytes) encoded in Base64:`;
            content.push({ type: "input_text", text: descriptor });
            content.push({ type: "input_text", text: attachment.base64 });
          }
        }
      }
      return { type: "message", role: message.role, content };
    });

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

    const observer = options.streamObserver;
    const stream = this.client.responses.stream({ ...request, stream: true } as never);

    let streamedHtml = "";
    const reasoningBuffers: Record<"thinking" | "summary", string> = {
      thinking: "",
      summary: "",
    };

    const emitReasoningChunk = (
      kind: "thinking" | "summary",
      value: unknown
    ): void => {
      if (!observer) return;
      const currentBuffer = reasoningBuffers[kind];
      const normalized = normalizeReasoningChunk(currentBuffer, value);
      if (!normalized) return;

      // Use merge logic to determine if we need to insert extra newlines
      const merged = mergeOpenAiReasoning(currentBuffer, normalized);

      // Calculate the actual delta to emit
      const delta = merged.slice(currentBuffer.length);

      if (delta.length > 0) {
        observer.onReasoningEvent({ kind, text: delta });
        reasoningBuffers[kind] = merged;
      }
    };

    if (observer) {
      stream.on("response.reasoning_text.delta", (event: any) => {
        emitReasoningChunk("thinking", event?.delta);
      });
      stream.on("response.reasoning_summary_text.delta", (event: any) => {
        emitReasoningChunk("summary", event?.delta);
      });
    }

    stream.on("response.output_text.delta", (event: any) => {
      if (typeof event?.snapshot === "string") {
        streamedHtml = event.snapshot;
      } else if (typeof event?.delta === "string") {
        streamedHtml += event.delta;
      }
    });

    const response = await stream.finalResponse();

    const html = streamedHtml.trim().length > 0 ? streamedHtml : extractHtml(response);
    const reasoning = extractReasoning(response, this.settings.reasoningMode, this.settings.reasoningTokens);

    return {
      html,
      usage: extractUsageMetrics(response),
      reasoning,
      raw: response,
    };
  }
}

function buildImageDataUrl(mimeType: string, base64: string): string {
  const safeMime = mimeType && mimeType.trim().length > 0 ? mimeType : "image/png";
  return `data:${safeMime};base64,${base64}`;
}

export async function verifyOpenAiApiKey(apiKey: string): Promise<VerificationResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, message: "Enter an OpenAI API key to continue." };
  }
  const client = new OpenAI({ apiKey: trimmed });
  try {
    await client.models.list();
    return { ok: true };
  } catch (error) {
    const status = extractStatus(error);
    if (status === 401 || status === 403) {
      return { ok: false, message: "OpenAI rejected that key. Confirm the value and try again." };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Unable to reach OpenAI: ${message}` };
  }
}

function extractReasoning(
  response: any,
  mode: ProviderSettings["reasoningMode"],
  tokens?: number,
): LlmReasoningTrace | undefined {
  if (!mode || mode === "none") {
    return undefined;
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
        message += `\n${reasoningSummaries.join("\n\n")}`;
      }
      if (reasoningTextBlocks.length > 0) {
        message += `\n${reasoningTextBlocks.join("\n\n")}`;
      }
      logger.debug(message);
      return {
        summaries: reasoningSummaries.length > 0 ? reasoningSummaries : undefined,
        details: reasoningTextBlocks.length > 0 ? reasoningTextBlocks : undefined,
        raw: outputItems.filter((item: any) => item?.type === "reasoning"),
      };
    } else if (reasoningTokens !== undefined) {
      logger.debug(`${header} — no textual reasoning returned.`);
    }
    return undefined;
  } catch (error) {
    logger.warn(`Failed to capture OpenAI reasoning metadata: ${(error as Error).message}`);
    return undefined;
  }
}

function extractHtml(response: any): string {
  const direct = response?.output_text;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  if (Array.isArray(response?.output)) {
    const text = response.output
      .map((item: any) => {
        if (item?.type !== "message" || !Array.isArray(item?.content)) {
          return "";
        }
        return item.content
          .map((part: any) =>
            part?.type === "output_text" && typeof part?.text === "string" ? part.text : "",
          )
          .join("");
      })
      .join("");
    if (text.trim().length > 0) {
      return text.trim();
    }
  }
  return "";
}

function extractUsageMetrics(response: any): LlmUsageMetrics | undefined {
  const usage = response?.usage ?? response?.usage_metadata;
  if (!usage || typeof usage !== "object") {
    return undefined;
  }
  const metrics: LlmUsageMetrics = {};
  const input = usage.input_tokens ?? usage.input_token_count;
  const output = usage.output_tokens ?? usage.output_token_count;
  const total = usage.total_tokens ?? usage.total_token_count;
  const reasoning = usage.output_tokens_details?.reasoning_tokens ?? usage.reasoning_tokens;
  if (Number.isFinite(input)) metrics.inputTokens = Number(input);
  if (Number.isFinite(output)) metrics.outputTokens = Number(output);
  if (Number.isFinite(total)) metrics.totalTokens = Number(total);
  if (Number.isFinite(reasoning)) metrics.reasoningTokens = Number(reasoning);

  const providerMetricsEntries = Object.entries(usage).filter(
    ([, value]) => typeof value === "number" || typeof value === "string",
  );
  if (providerMetricsEntries.length > 0) {
    metrics.providerMetrics = Object.fromEntries(providerMetricsEntries);
  }
  if (
    metrics.inputTokens === undefined
    && metrics.outputTokens === undefined
    && metrics.totalTokens === undefined
    && metrics.reasoningTokens === undefined
    && !metrics.providerMetrics
  ) {
    return undefined;
  }
  return metrics;
}

function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const anyError = error as { status?: unknown; response?: { status?: unknown } };
  const statusValue = anyError.status ?? anyError.response?.status;
  if (typeof statusValue === "number") {
    return statusValue;
  }
  const maybeString = typeof statusValue === "string" ? Number.parseInt(statusValue, 10) : undefined;
  return Number.isFinite(maybeString) ? maybeString : undefined;
}

export function normalizeReasoningChunk(previous: string, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Don't strip carriage returns blindly if they are part of a valid sequence, but usually safe to remove
  const sanitized = raw.replace(/\r/g, "");

  if (sanitized.length === 0) {
    return null;
  }
  return sanitized;
}

export function mergeOpenAiReasoning(
  existing: string,
  incoming: string
): string {
  if (!existing) {
    return incoming;
  }

  // If existing ends with a newline or incoming starts with one, we might be okay, 
  // but let's ensure at least 2 newlines if it looks like a new paragraph.

  const existingEndsWithNewline = existing.endsWith("\n");
  const incomingStartsWithNewline = incoming.startsWith("\n");

  // Heuristic: If existing ends with punctuation and incoming starts with a Markdown block indicator,
  // and there is NO newline, force a double newline.
  // We avoid splitting sentences by checking for specific markdown markers instead of just capital letters.
  const existingEndsWithPunctuation = /[.!?)]$/.test(existing.trimEnd());

  // Matches:
  // **Bold**
  // ## Header
  // * List item
  // - List item
  // 1. List item
  const incomingIsMarkdownBlock = /^(\*\*|#{1,6} |[\*-] |\d+\. )/.test(incoming.trimStart());

  if (existingEndsWithPunctuation && incomingIsMarkdownBlock && !existingEndsWithNewline && !incomingStartsWithNewline) {
    return existing + "\n\n" + incoming;
  }

  return existing + incoming;
}
