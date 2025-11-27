import { GoogleGenAI } from "@google/genai";
import type {
  ChatMessage,
  LlmReasoningTrace,
  LlmUsageMetrics,
  ProviderSettings,
  VerificationResult,
} from "../types.js";
import type {
  LlmClient,
  LlmResult,
  LlmGenerateOptions,
  LlmStreamObserver,
} from "./client.js";
import { logger } from "../logger.js";
import { GenerateContentConfig } from "@google/genai";
import { ThinkingLevel } from "@google/genai";
import { createStreamingTokenTracker } from "./token-tracker.js";

type ContentPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } };
type ContentMessage = { role?: string; parts: ContentPart[] };


export class GeminiClient implements LlmClient {
  readonly settings: ProviderSettings;
  private readonly client: GoogleGenAI;

  constructor(settings: ProviderSettings) {
    this.settings = settings;
    this.client = new GoogleGenAI({ apiKey: settings.apiKey });
  }

  async generateHtml(
    messages: ChatMessage[],
    _options: LlmGenerateOptions = {}
  ): Promise<LlmResult> {
    const systemMessages = messages.filter(
      (message) => message.role === "system"
    );
    const userMessages = messages.filter((message) => message.role === "user");

    const contents: ContentMessage[] = userMessages.map((message) => {
      const parts: ContentPart[] = [{ text: message.content }];
      if (message.attachments?.length) {
        for (const attachment of message.attachments) {
          if (
            attachment.mimeType.startsWith("image/") ||
            attachment.mimeType === "application/pdf"
          ) {
            parts.push({
              inlineData: {
                data: attachment.base64,
                mimeType: attachment.mimeType,
              },
            });
          } else {
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

    const config: GenerateContentConfig = {};
    if (this.settings.maxOutputTokens) {
      config.maxOutputTokens = this.settings.maxOutputTokens;
    }
    if (systemMessages.length > 0) {
      config.systemInstruction = {
        role: "system",
        parts: [
          {
            text: systemMessages.map((message) => message.content).join("\n\n"),
          },
        ],
      };
    }
    const includeThoughts = shouldEnableGeminiThoughts(this.settings);
    logger.debug({
      includeThoughts,
      reasoningTokensEnabled: this.settings.reasoningTokensEnabled,
      reasoningTokens: this.settings.reasoningTokens,
      reasoningMode: this.settings.reasoningMode
    }, "GeminiClient: includeThoughts calculation");

    if (includeThoughts) {
      if (this.settings.model.includes("gemini-3-pro")) {
        config.thinkingConfig = {
          includeThoughts: true,
          thinkingLevel: this.settings.reasoningMode === "low" ? ThinkingLevel.LOW : ThinkingLevel.HIGH,
        };
      } else {
        const budget =
          this.settings.reasoningTokensEnabled === false
            ? -1
            : this.settings.reasoningTokens ?? -1;

        const clampedBudget = clampGeminiBudget(
          budget,
          this.settings.maxOutputTokens,
          this.settings.model,
        );

        config.thinkingConfig = {
          includeThoughts: true,
          thinkingBudget: clampedBudget,  // Always set budget (including 0) when config is set; for Pro models with allowZero: false, config is omitted entirely when thinking is disabled (see below)
        };

        logger.debug({ thinkingConfig: config.thinkingConfig }, "Gemini thinking config");
      }
    } else {
      // When thinking is disabled, explicitly set budget to 0 to prevent implicit thinking
      // But only for models that allow zero budget (Flash models)
      // Pro models (gemini-3-pro, gemini-2.5-pro) reject budget:0, so omit config entirely
      const limits = getGeminiThinkingLimits(this.settings.model);

      if (limits.allowZero) {
        config.thinkingConfig = {
          includeThoughts: true,
          thinkingBudget: 0,
        };
        logger.debug({ thinkingConfig: config.thinkingConfig }, "Gemini thinking disabled (budget=0)");
      } else {
        logger.debug({ model: this.settings.model }, "Gemini thinking disabled (omitting config for Pro model)");
      }
    }

    const stream = await this.client.models.generateContentStream({
      model: this.settings.model,
      contents,
      config: config as any,
    });

    let finalResponse: any = null;
    const streamedPieces: string[] = [];
    const streamedThoughtSummaries: string[] = [];
    const streamedThoughtSnapshots: string[] = [];
    const observer = includeThoughts ? _options.streamObserver : undefined;
    const tokenTracker = createStreamingTokenTracker(
      _options.streamObserver,
      this.settings.maxOutputTokens
    );
    for await (const chunk of stream) {
      finalResponse = chunk;
      const chunkText = coerceGeminiText(chunk);
      if (typeof chunkText === "string" && chunkText.trim().length > 0) {
        streamedPieces.push(chunkText);
        tokenTracker.addFromText(chunkText);
      }
      if (includeThoughts) {
        collectGeminiThoughtSummaries(
          chunk,
          streamedThoughtSummaries,
          streamedThoughtSnapshots,
          observer,
          tokenTracker,
        );
      }
    }

    const response =
      finalResponse ??
      (await this.client.models.generateContent({
        model: this.settings.model,
        contents,
        config,
      }));

    if (includeThoughts && finalResponse === null) {
      collectGeminiThoughtSummaries(
        response,
        streamedThoughtSummaries,
        streamedThoughtSnapshots,
        observer,
        tokenTracker,
      );
    }

    const reasoning = includeThoughts
      ? extractGeminiThinking(response, this.settings, streamedThoughtSummaries)
      : undefined;
    const usage = extractUsage(response);
    tokenTracker.finalize(
      usage?.outputTokens !== undefined || usage?.reasoningTokens !== undefined
        ? (usage?.outputTokens ?? 0) + (usage?.reasoningTokens ?? 0)
        : undefined,
    );

    const streamedHtml = streamedPieces.join("").trim();
    if (streamedHtml.length > 0) {
      return {
        html: streamedHtml,
        usage,
        reasoning,
        raw: response,
      };
    }

    const text = coerceGeminiText(response);
    if (typeof text === "string" && text.trim().length > 0) {
      return {
        html: text.trim(),
        usage,
        reasoning,
        raw: response,
      };
    }

    const firstCandidate = response.candidates?.[0];
    const fallback =
      firstCandidate?.content?.parts
        ?.map((part: any) =>
          "text" in part && typeof part.text === "string" ? part.text : ""
        )
        .join("") ?? "";

    return {
      html: fallback.trim(),
      usage,
      reasoning,
      raw: response,
    };
  }
}

export async function verifyGeminiApiKey(
  apiKey: string
): Promise<VerificationResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, message: "Enter a Gemini API key to continue." };
  }
  const client = new GoogleGenAI({ apiKey: trimmed });
  try {
    await client.models.list({ config: { pageSize: 1 } });
    return { ok: true };
  } catch (error) {
    const status = extractStatus(error);
    if (status === 401 || status === 403) {
      return {
        ok: false,
        message:
          "Gemini rejected that key. Confirm the key has Generative Language API access.",
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Unable to reach Gemini: ${message}` };
  }
}

function clampGeminiBudget(
  requested: number,
  maxOutputTokens: number,
  model: string
): number {
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

  const boundedByMaxTokens =
    Number.isFinite(maxOutputTokens) && maxOutputTokens > 0
      ? Math.min(requested, maxOutputTokens)
      : requested;
  const boundedByModel = limits.max
    ? Math.min(boundedByMaxTokens, limits.max)
    : boundedByMaxTokens;

  let finalBudget = Math.floor(Math.max(0, boundedByModel));
  if (finalBudget === 0 && !limits.allowZero) {
    finalBudget = limits.minPositive ?? 1;
  }
  if (
    finalBudget > 0 &&
    limits.minPositive &&
    finalBudget < limits.minPositive
  ) {
    finalBudget = limits.minPositive;
  }

  if (finalBudget !== requested) {
    logger.debug(
      {
        requested,
        finalBudget,
        model,
        maxOutputTokens,
      },
      "Adjusted Gemini thinking budget to comply with model limits"
    );
  }

  return finalBudget;
}

function coerceGeminiText(chunk: unknown): string | undefined {
  const value = (chunk as any)?.text;
  if (typeof value === "function") {
    try {
      return value();
    } catch (error) {
      logger.warn({ error }, "Gemini chunk text getter threw an error");
      return undefined;
    }
  }
  return typeof value === "string" ? value : undefined;
}

function collectGeminiThoughtSummaries(
  chunk: any,
  aggregate: string[],
  snapshots: string[],
  observer?: LlmStreamObserver,
  tokenTracker?: ReturnType<typeof createStreamingTokenTracker>
): void {
  const parts = chunk?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return;
  }
  let thoughtIndex = 0;
  for (const part of parts) {
    if (part?.thought === true && typeof part?.text === "string") {
      const normalized = part.text.trim();
      if (normalized.length === 0) {
        thoughtIndex += 1;
        continue;
      }
      const previousSnapshot = snapshots[thoughtIndex] ?? "";
      if (normalized === previousSnapshot) {
        thoughtIndex += 1;
        continue;
      }
      snapshots[thoughtIndex] = normalized;
      const merged = mergeGeminiThoughtSummary(
        aggregate[thoughtIndex],
        normalized
      );
      aggregate[thoughtIndex] = merged;
      if (observer) {
        let delta = normalized;
        if (previousSnapshot && normalized.startsWith(previousSnapshot)) {
          delta = normalized.slice(previousSnapshot.length);
        } else if (previousSnapshot && normalized !== previousSnapshot) {
          const tailIndex = normalized.lastIndexOf(previousSnapshot);
          if (tailIndex > 0) {
            delta = normalized.slice(0, tailIndex);
          }
        }
        const emission = delta.length > 0 ? delta : normalized;
        if (emission.length > 0) {
          observer.onReasoningEvent({
            kind: "thinking",
            text: emission + "\n\n",
          });
          tokenTracker?.addFromText(emission);
        }
      }
      thoughtIndex += 1;
    }
  }
}

export function mergeGeminiThoughtSummary(
  existing: string | undefined,
  incoming: string
): string {
  if (!existing) {
    return incoming;
  }
  if (incoming === existing) {
    return existing;
  }
  if (incoming.startsWith(existing)) {
    return incoming;
  }
  if (existing.startsWith(incoming)) {
    return existing;
  }
  if (incoming.endsWith(existing)) {
    return incoming;
  }
  if (existing.endsWith(incoming)) {
    return existing;
  }
  const existingNewlines = existing.match(/\n+$/)?.[0].length || 0;
  const incomingNewlines = incoming.match(/^\n+/)?.[0].length || 0;
  const needed = Math.max(0, 2 - existingNewlines - incomingNewlines);
  return existing + "\n".repeat(needed) + incoming;
}

function extractUsage(response: any): LlmUsageMetrics | undefined {
  const usage = response?.usageMetadata ?? response?.usage_metadata;
  if (!usage || typeof usage !== "object") {
    return undefined;
  }
  const metrics: LlmUsageMetrics = {};
  const input = usage.promptTokenCount ?? usage.prompt_token_count;
  const output = usage.candidatesTokenCount ?? usage.candidates_token_count;
  const total = usage.totalTokenCount ?? usage.total_token_count;
  const thoughts = usage.thoughtsTokenCount ?? usage.thoughts_token_count;
  if (Number.isFinite(input)) metrics.inputTokens = Number(input);
  if (Number.isFinite(output)) metrics.outputTokens = Number(output);
  if (Number.isFinite(total)) metrics.totalTokens = Number(total);
  if (Number.isFinite(thoughts)) metrics.reasoningTokens = Number(thoughts);
  const providerMetricsEntries = Object.entries(usage).filter(
    ([, value]) => typeof value === "number" || typeof value === "string"
  );
  if (providerMetricsEntries.length > 0) {
    metrics.providerMetrics = Object.fromEntries(providerMetricsEntries);
  }
  if (
    metrics.inputTokens === undefined &&
    metrics.outputTokens === undefined &&
    metrics.totalTokens === undefined &&
    metrics.reasoningTokens === undefined &&
    !metrics.providerMetrics
  ) {
    return undefined;
  }
  return metrics;
}

function extractGeminiThinking(
  response: any,
  settings: ProviderSettings,
  streamedSummaries?: readonly string[]
): LlmReasoningTrace | undefined {
  try {
    const firstCandidate = response?.candidates?.[0];
    const parts = firstCandidate?.content?.parts ?? [];
    const summarySet: string[] = Array.isArray(streamedSummaries)
      ? streamedSummaries
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
      : [];

    for (const part of parts) {
      if (part?.thought === true && typeof part?.text === "string") {
        const trimmed = part.text.trim();
        if (trimmed.length === 0) {
          continue;
        }
        if (!summarySet.some((existing) => existing === trimmed)) {
          summarySet.push(trimmed);
        }
      }
    }

    const thoughtSummaries = summarySet;
    const usage = response?.usageMetadata ?? response?.usage_metadata;
    const thoughtsTokenCount =
      usage?.thoughtsTokenCount ?? usage?.thoughts_token_count;

    const budgetLabel =
      settings.reasoningTokensEnabled === false
        ? "auto"
        : typeof settings.reasoningTokens === "number"
          ? settings.reasoningTokens
          : "auto";
    const header = `Gemini thinking (mode=${settings.reasoningMode}, budget=${budgetLabel}, thoughtTokens=${thoughtsTokenCount ?? "n/a"})`;
    if (thoughtSummaries.length > 0) {
      logger.debug(`${header}\n${thoughtSummaries.join("\n\n")}`);
      return {
        details: thoughtSummaries,
        raw: thoughtSummaries,
      };
    }
    if (typeof thoughtsTokenCount === "number" && thoughtsTokenCount > 0) {
      const fallback = `Gemini generated ${thoughtsTokenCount} reasoning tokens (thought text unavailable).`;
      logger.debug(`${header} — ${fallback}`);
      return {
        details: [fallback],
        raw: [fallback],
      };
    }
    logger.debug(`${header} — no thought summaries returned.`);
    return undefined;
  } catch (error) {
    logger.warn(
      `Failed to capture Gemini thinking metadata: ${(error as Error).message}`
    );
    return undefined;
  }
}

export function shouldEnableGeminiThoughts(settings: ProviderSettings): boolean {
  // For gemini-3-pro and similar models that use thinkingLevel (reasoningMode)
  if (settings.model.includes("gemini-3-pro")) {
    // These models use reasoningMode (low/high/none)
    if (settings.reasoningMode === "none") {
      return false;
    }
    return true;
  }

  // For other Gemini models (like Flash) that use thinkingBudget (reasoningTokens)
  // These models don't have a reasoningMode concept, so we ignore that setting

  // If manual budget is disabled (reasoningTokensEnabled: false), we assume Auto (enabled)
  if (settings.reasoningTokensEnabled === false) {
    return true;
  }

  // If manual budget is enabled, check if tokens > 0
  if (typeof settings.reasoningTokens === "number") {
    return settings.reasoningTokens !== 0;
  }

  // Default to enabled
  return true;
}

type GeminiThinkingLimits = {
  allowDynamic: boolean;
  allowZero: boolean;
  minPositive?: number;
  max?: number;
};

function getGeminiThinkingLimits(model: string): GeminiThinkingLimits {
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

function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const anyError = error as { status?: unknown };
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
