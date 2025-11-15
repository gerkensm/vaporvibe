import Anthropic from "@anthropic-ai/sdk";
import type {
  BriefAttachment,
  CacheControlSettings,
  ChatMessage,
  LlmReasoningTrace,
  LlmUsageMetrics,
  ProviderSettings,
  VerificationResult,
} from "../types.js";
import type {
  LlmClient,
  LlmGenerateOptions,
  LlmResult,
  LlmStreamObserver,
} from "./client.js";
import { logger } from "../logger.js";

const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models";
const ANTHROPIC_VERSION = "2023-06-01";
const VERIFY_TIMEOUT_MS = 10_000;

type AnthropicCacheControl = {
  type: "ephemeral";
  ttl?: "5m" | "1h";
};

type AnthropicRequestContent =
  | { type: "text"; text: string; cache_control?: AnthropicCacheControl }
  | {
      type: "image";
      cache_control?: AnthropicCacheControl;
      source: { type: "base64"; media_type: string; data: string };
    };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: AnthropicRequestContent[];
};

type AnthropicContentBlock = {
  type?: string;
  text?: string;
  thinking?: string;
};

type AnthropicStreamEvent = {
  type?: string;
  delta?: { type?: string; text?: string; thinking?: string };
  content_block_delta?: { delta?: { type?: string; text?: string; thinking?: string } };
};

type AnthropicStream = AsyncIterable<AnthropicStreamEvent> & {
  finalMessage(): Promise<{ content?: AnthropicContentBlock[]; usage?: unknown } | null>;
  close?(): Promise<void>;
};

function createAnthropicImageContent(
  attachment: BriefAttachment,
): AnthropicRequestContent {
  const mediaType = attachment.mimeType?.toLowerCase().startsWith("image/")
    ? attachment.mimeType
    : "image/png";
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: mediaType,
      data: attachment.base64,
    },
  };
}

function applyCacheControl<T extends AnthropicRequestContent>(
  block: T,
  cacheControl?: CacheControlSettings
): T {
  if (!cacheControl) {
    return block;
  }
  block.cache_control = toAnthropicCacheControl(cacheControl);
  return block;
}

function toAnthropicCacheControl(cacheControl: CacheControlSettings): AnthropicCacheControl {
  const transformed: AnthropicCacheControl = { type: cacheControl.type };
  if (cacheControl.ttl) {
    transformed.ttl = cacheControl.ttl;
  }
  return transformed;
}

function buildSystemBlocks(messages: ChatMessage[]): AnthropicRequestContent[] {
  return messages
    .filter((message) => message.role === "system")
    .map((message) => applyCacheControl({ type: "text", text: message.content }, message.cacheControl));
}

export class AnthropicClient implements LlmClient {
  readonly settings: ProviderSettings;
  private readonly client: Anthropic;

  constructor(settings: ProviderSettings) {
    this.settings = settings;
    this.client = new Anthropic({ apiKey: settings.apiKey });
  }

  async generateHtml(
    messages: ChatMessage[],
    options: LlmGenerateOptions = {}
  ): Promise<LlmResult> {
    const systemBlocks = buildSystemBlocks(messages);
    const userMessages = messages.filter((message) => message.role === "user");

    const requestMessages: AnthropicMessage[] = userMessages.map((message) => {
      const content: AnthropicRequestContent[] = [
        applyCacheControl({ type: "text", text: message.content }, message.cacheControl),
      ];
      if (message.attachments?.length) {
        for (const attachment of message.attachments) {
          if (attachment.mimeType.startsWith("image/")) {
            content.push(
              applyCacheControl(createAnthropicImageContent(attachment), message.cacheControl)
            );
          } else {
            const descriptor =
              `Attachment ${attachment.name} (${attachment.mimeType}, ${attachment.size} bytes) encoded in Base64:`;
            content.push(
              applyCacheControl({ type: "text", text: descriptor }, message.cacheControl)
            );
            content.push(
              applyCacheControl({ type: "text", text: attachment.base64 }, message.cacheControl)
            );
          }
        }
      }
      return {
        role: "user",
        content,
      };
    });

    if (requestMessages.length === 0) {
      requestMessages.push({ role: "user", content: [{ type: "text", text: "" }] });
    }

    const wantsThinking = (
      (this.settings.reasoningMode && this.settings.reasoningMode !== "none")
      || (typeof this.settings.reasoningTokens === "number" && this.settings.reasoningTokens > 0)
    );

    if (wantsThinking) {
      return this.generateWithThinking(
        systemBlocks,
        requestMessages,
        options.streamObserver
      );
    }

    const betas = resolveBetas(this.settings.model);
    const createRequest: any = {
      model: this.settings.model,
      max_tokens: this.settings.maxOutputTokens,
      system: systemBlocks.length > 0 ? systemBlocks : undefined,
      messages: requestMessages,
    };
    if (betas) {
      createRequest.betas = betas;
    }

    const response = await this.retryOnOverload(() => this.client.messages.create(createRequest));

    const html = this.combineContent(response.content).trim();
    return { html, usage: extractUsage(response), raw: response };
  }

  private async generateWithThinking(
    systemBlocks: AnthropicRequestContent[],
    requestMessages: AnthropicMessage[],
    observer?: LlmStreamObserver
  ): Promise<LlmResult> {
    const thinkingBudgetCandidate = this.settings.reasoningTokens ?? this.settings.maxOutputTokens;
    const maxTokens = Math.max(1, this.settings.maxOutputTokens);
    const thinkingBudget = Math.max(1, Math.min(thinkingBudgetCandidate, Math.max(1, maxTokens - 1)));

    if (thinkingBudget >= maxTokens) {
      logger.warn(
        `Anthropic thinking budget ${thinkingBudgetCandidate} exceeds allowed maximum for model; using ${thinkingBudget} with max_tokens ${maxTokens}.`,
      );
    }

    const betas = resolveBetas(this.settings.model);
    const streamRequest: any = {
      model: this.settings.model,
      max_tokens: Math.max(thinkingBudget + 1, maxTokens),
      system: systemBlocks.length > 0 ? systemBlocks : undefined,
      messages: requestMessages,
      thinking: {
        type: "enabled",
        budget_tokens: thinkingBudget,
      } as any,
    };
    if (betas) {
      streamRequest.betas = betas;
    }

    const stream = await this.retryOnOverload(
      async () => this.client.messages.stream(streamRequest) as unknown as AnthropicStream
    );

    const captureDiagnostics = shouldCaptureStreamDiagnostics();
    const diagnostics: StreamEventSnapshot[] = [];
    let accumulated = "";
    let streamedThinking = "";
    for await (const event of stream) {
      accumulated += this.extractStreamDelta(event);
      const thinkingDelta = this.extractThinkingDelta(event);
      if (thinkingDelta) {
        streamedThinking += thinkingDelta;
        if (observer) {
          observer.onReasoningEvent({ kind: "thinking", text: thinkingDelta });
        }
      }
      if (captureDiagnostics) {
        diagnostics.push(summarizeStreamEvent(event));
        if (diagnostics.length > STREAM_DIAGNOSTIC_EVENT_LIMIT) {
          diagnostics.shift();
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    try {
      await stream.close?.();
    } catch (error) {
      logger.debug(
        { message: (error as Error)?.message ?? String(error) },
        "Failed to close Anthropic message stream gracefully",
      );
    }

    if (!accumulated) {
      accumulated = this.combineContent(finalMessage?.content).trim();
    }

    const usage = extractUsage(finalMessage);
    let reasoning = this.logAndCollectThinking(
      finalMessage,
      thinkingBudget,
      streamedThinking,
      usage?.reasoningTokens
    );
    const rawPayload = buildReasoningRawPayload(
      finalMessage,
      streamedThinking,
      captureDiagnostics ? diagnostics : undefined,
    );
    if (reasoning) {
      reasoning.raw = rawPayload;
    } else if (rawPayload) {
      reasoning = { raw: rawPayload };
    }

    if (captureDiagnostics && diagnostics.length > 0) {
      logger.debug({ events: diagnostics }, "Anthropic stream trace captured");
    }

    return {
      html: accumulated.trim(),
      usage,
      reasoning,
      raw: rawPayload ?? finalMessage,
    };
  }

  private combineContent(blocks: AnthropicContentBlock[] | undefined): string {
    if (!blocks || blocks.length === 0) {
      return "";
    }
    return blocks
      .map((block) => (block?.type === "text" || !block?.type ? block.text ?? "" : ""))
      .join("");
  }

  private collectThinking(blocks: AnthropicContentBlock[] | undefined): string[] {
    if (!blocks || blocks.length === 0) {
      return [];
    }
    return blocks
      .map((block) => {
        const normalizedType = typeof block?.type === "string" ? block.type.toLowerCase() : "";
        const isThinkingType = normalizedType.includes("thinking");
        if (isThinkingType) {
          return block?.thinking ?? block?.text ?? "";
        }
        if (typeof block?.thinking === "string" && block.thinking.trim().length > 0) {
          return block.thinking;
        }
        return undefined;
      })
      .filter((value): value is string => Boolean(value && value.trim().length > 0));
  }

  private logAndCollectThinking(
    finalMessage: { content?: AnthropicContentBlock[] } | null,
    budgetTokens: number,
    streamedThinking: string,
    tokensUsed?: number
  ): LlmReasoningTrace | undefined {
    const trimmedStream = streamedThinking.trim();
    let summaries = trimmedStream.length > 0
      ? [trimmedStream]
      : this.collectThinking(finalMessage?.content);

    if ((!summaries || summaries.length === 0) && typeof tokensUsed === "number" && tokensUsed > 0) {
      summaries = [`Anthropic generated ${tokensUsed} reasoning tokens (trace not returned by provider).`];
    }

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
    } catch (error) {
      logger.warn(`Failed to capture Anthropic thinking metadata: ${(error as Error).message}`);
    }
    return undefined;
  }

  private async retryOnOverload<T>(operation: () => Promise<T>): Promise<T> {
    const maxAttempts = 4;
    const baseDelayMs = 50;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!isAnthropicOverload(error) || attempt === maxAttempts - 1) {
          throw error;
        }
        const backoffMs = Math.min(baseDelayMs * (2 ** attempt), 400);
        const jitterMs = Math.random() * 25;
        const delayMs = Math.round(backoffMs + jitterMs);
        logger.debug(`Retrying Anthropic request after overload (${attempt + 1}/${maxAttempts}) in ${delayMs}ms.`);
        await wait(delayMs);
      }
    }
    throw new Error("Anthropic overload retry loop exhausted unexpectedly.");
  }

  private extractStreamDelta(event: AnthropicStreamEvent): string {
    if (!event) {
      return "";
    }
    const delta = event.delta ?? event.content_block_delta?.delta;
    if (delta?.type === "text_delta" && typeof delta.text === "string") {
      return delta.text;
    }
    return "";
  }

  private extractThinkingDelta(event: AnthropicStreamEvent): string {
    if (!event) {
      return "";
    }
    const delta = event.delta ?? event.content_block_delta?.delta;
    const eventType = typeof event.type === "string" ? event.type.toLowerCase() : "";
    const deltaType = typeof delta?.type === "string" ? delta.type.toLowerCase() : "";
    if (delta && typeof delta.thinking === "string" && delta.thinking.length > 0) {
      return delta.thinking;
    }
    if (deltaType.includes("thinking") && typeof delta?.text === "string") {
      return delta.text;
    }
    if (eventType.includes("thinking") && typeof delta?.text === "string") {
      return delta.text;
    }
    if (eventType.includes("thinking") && typeof (delta as Record<string, unknown>)?.partial_json === "string") {
      return (delta as Record<string, string>).partial_json;
    }
    return "";
  }
}

type StreamEventSnapshot = {
  type?: string;
  deltaType?: string;
  text?: string;
  thinking?: string;
};

const STREAM_DIAGNOSTIC_EVENT_LIMIT = 40;
const STREAM_DIAGNOSTIC_SNIPPET = 160;

function summarizeStreamEvent(event: AnthropicStreamEvent): StreamEventSnapshot {
  const delta = event?.delta ?? event?.content_block_delta?.delta;
  const text = typeof delta?.text === "string" ? delta.text : undefined;
  const thinking = typeof delta?.thinking === "string" ? delta.thinking : undefined;
  return {
    type: event?.type,
    deltaType: delta?.type,
    text: text ? truncateForDiagnostics(text) : undefined,
    thinking: thinking ? truncateForDiagnostics(thinking) : undefined,
  };
}

function truncateForDiagnostics(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= STREAM_DIAGNOSTIC_SNIPPET) {
    return trimmed;
  }
  return `${trimmed.slice(0, STREAM_DIAGNOSTIC_SNIPPET)}…`;
}

function shouldCaptureStreamDiagnostics(): boolean {
  const flag = process.env.ANTHROPIC_DEBUG_STREAM;
  if (!flag) {
    return false;
  }
  switch (flag.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "debug":
      return true;
    default:
      return false;
  }
}

function buildReasoningRawPayload(
  finalMessage: { content?: AnthropicContentBlock[] } | null,
  streamedThinking: string,
  diagnostics?: StreamEventSnapshot[]
):
  | {
      finalMessage?: { content?: AnthropicContentBlock[] } | null;
      streamedThinking?: string;
      diagnostics?: StreamEventSnapshot[];
    }
  | undefined {
  const hasStreamText = Boolean(streamedThinking && streamedThinking.trim().length > 0);
  const hasFinalContent = Boolean(finalMessage?.content && finalMessage.content.length > 0);
  const hasDiagnostics = Boolean(diagnostics && diagnostics.length > 0);
  if (!hasStreamText && !hasFinalContent && !hasDiagnostics) {
    return undefined;
  }
  return {
    finalMessage,
    streamedThinking: hasStreamText ? streamedThinking.trim() : undefined,
    diagnostics,
  };
}

export async function verifyAnthropicApiKey(apiKey: string): Promise<VerificationResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, message: "Enter an Anthropic API key to continue." };
  }
  const client = new Anthropic({ apiKey: trimmed });
  const modelsApi = (client as unknown as { models?: { list: () => Promise<unknown> } }).models;
  if (modelsApi?.list) {
    try {
      await modelsApi.list();
      return { ok: true };
    } catch (error) {
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
        "User-Agent": "vaporvibe-setup/1.0",
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
  } catch (error) {
    const status = extractStatus(error);
    const detail = extractAnthropicError(error);
    if (status === 401 || status === 403) {
      return { ok: false, message: detail ?? "Anthropic rejected that key. Confirm it has Messages API access." };
    }
    const message = detail ?? (error instanceof Error ? error.message : String(error));
    return { ok: false, message: `Unable to reach Anthropic: ${message}` };
  }
}

function extractUsage(response: any): LlmUsageMetrics | undefined {
  const usage = response?.usage ?? response?.usage_metadata;
  if (!usage || typeof usage !== "object") {
    return undefined;
  }
  const metrics: LlmUsageMetrics = {};
  const input = usage.input_tokens ?? usage.input_token_count;
  const output = usage.output_tokens ?? usage.output_token_count;
  const total = usage.total_tokens ?? usage.total_token_count;
  const reasoning = usage.thinking_tokens ?? usage.reasoning_tokens;
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
  logCacheUsageIfPresent(usage);
  return metrics;
}

function logCacheUsageIfPresent(usage: Record<string, unknown>): void {
  const cacheCreation = usage["cache_creation_input_tokens"];
  const cacheRead = usage["cache_read_input_tokens"];
  if (cacheCreation === undefined && cacheRead === undefined) {
    return;
  }
  logger.debug(
    {
      cacheCreationInputTokens: cacheCreation,
      cacheReadInputTokens: cacheRead,
      inputTokens: usage["input_tokens"],
      outputTokens: usage["output_tokens"],
    },
    "Anthropic usage (prompt cache)"
  );
}

const CONTEXT_1M_BETA = "context-1m-2025-08-07";

function resolveBetas(model: string | undefined): string[] | undefined {
  if (!model) return undefined;
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

function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const anyError = error as { status?: unknown; response?: { status?: unknown } };
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

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isAnthropicOverload(error: unknown): boolean {
  if (typeof error === "string") {
    const normalized = error.toLowerCase();
    if (normalized.includes("overload")) {
      return true;
    }
    try {
      const parsed = JSON.parse(error);
      return isAnthropicOverload(parsed);
    } catch {
      return false;
    }
  }

  const status = extractStatus(error);
  if (status === 529) {
    return true;
  }
  if (!error || typeof error !== "object") {
    return false;
  }
  const anyError = error as { type?: unknown; error?: { type?: unknown }; message?: unknown };
  const type = typeof anyError.type === "string" ? anyError.type : undefined;
  const nestedType = typeof anyError.error?.type === "string" ? anyError.error.type : undefined;
  if (type === "overloaded_error" || nestedType === "overloaded_error") {
    return true;
  }
  const message = extractAnthropicError(error);
  return typeof message === "string" && message.toLowerCase().includes("overload");
}

async function wait(durationMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}

function extractAnthropicError(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const anyError = error as { message?: unknown; error?: { message?: unknown; type?: unknown } };
  const direct = typeof anyError.message === "string" ? anyError.message : undefined;
  const nested = typeof anyError.error?.message === "string" ? anyError.error.message : undefined;
  return nested ?? direct;
}

async function extractAnthropicResponseMessage(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    if (!text) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
      return parsed?.error?.message ?? parsed?.message ?? text;
    } catch {
      return text;
    }
  } catch {
    return undefined;
  }
}
