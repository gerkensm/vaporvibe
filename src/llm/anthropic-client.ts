import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, LlmReasoningTrace, LlmUsageMetrics, ProviderSettings } from "../types.js";
import type { LlmClient, LlmResult } from "./client.js";
import { logger } from "../logger.js";

type AnthropicMessage = {
  role: "user" | "assistant";
  content: Array<{ type: "text"; text: string }>;
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
  finalMessage(): Promise<{ content?: AnthropicContentBlock[] } | null>;
  close?(): Promise<void>;
};

export class AnthropicClient implements LlmClient {
  readonly settings: ProviderSettings;
  private readonly client: Anthropic;

  constructor(settings: ProviderSettings) {
    this.settings = settings;
    this.client = new Anthropic({ apiKey: settings.apiKey });
  }

  async generateHtml(messages: ChatMessage[]): Promise<LlmResult> {
    const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content);
    const userMessages = messages.filter((message) => message.role === "user");

    const requestMessages: AnthropicMessage[] = userMessages.map((message) => ({
      role: "user",
      content: [{ type: "text", text: message.content }],
    }));

    if (requestMessages.length === 0) {
      requestMessages.push({ role: "user", content: [{ type: "text", text: "" }] });
    }

    if (this.settings.reasoningMode && this.settings.reasoningMode !== "none") {
      return this.generateWithThinking(systemMessages, requestMessages);
    }

    const betas = resolveBetas(this.settings.model);
    const createRequest: any = {
      model: this.settings.model,
      max_tokens: this.settings.maxOutputTokens,
      system: systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
      messages: requestMessages,
    };
    if (betas) {
      createRequest.betas = betas;
    }

    const response = await this.client.messages.create(createRequest);

    const html = this.combineContent(response.content).trim();
    return { html, usage: extractUsage(response), raw: response };
  }

  private async generateWithThinking(systemMessages: string[], requestMessages: AnthropicMessage[]): Promise<LlmResult> {
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
      system: systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
      messages: requestMessages,
      thinking: {
        type: "enabled",
        budget_tokens: thinkingBudget,
      } as any,
    };
    if (betas) {
      streamRequest.betas = betas;
    }

    const stream = await this.client.messages.stream(streamRequest) as unknown as AnthropicStream;

    let accumulated = "";
    let streamedThinking = "";
    for await (const event of stream) {
      accumulated += this.extractStreamDelta(event);
      streamedThinking += this.extractThinkingDelta(event);
    }

    const finalMessage = await stream.finalMessage();
    await stream.close?.();

    if (!accumulated) {
      accumulated = this.combineContent(finalMessage?.content).trim();
    }

    const reasoning = this.logAndCollectThinking(finalMessage, thinkingBudget, streamedThinking);

    return { html: accumulated.trim(), usage: extractUsage(finalMessage), reasoning, raw: finalMessage };
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
    if (delta?.type === "thinking_delta" && typeof delta.thinking === "string") {
      return delta.thinking;
    }
    return "";
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
      .filter((block) => block?.type === "thinking")
      .map((block) => block?.thinking ?? block?.text ?? "")
      .filter((value): value is string => Boolean(value && value.trim().length > 0));
  }

  private logAndCollectThinking(
    finalMessage: { content?: AnthropicContentBlock[] } | null,
    budgetTokens: number,
    streamedThinking: string,
  ): LlmReasoningTrace | undefined {
    const trimmedStream = streamedThinking.trim();
    const summaries = trimmedStream.length > 0
      ? [trimmedStream]
      : this.collectThinking(finalMessage?.content);

    if (!summaries || summaries.length === 0) {
      return undefined;
    }
    try {
      const thoughts = summaries;
      if (thoughts.length > 0) {
        const header = `Anthropic thinking (mode=${this.settings.reasoningMode}, budget=${budgetTokens})`;
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
  return metrics;
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
