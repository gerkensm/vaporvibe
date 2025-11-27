import type {
  ChatMessage,
  LlmReasoningTrace,
  LlmUsageMetrics,
  ProviderSettings,
} from "../types.js";

export interface LlmReasoningStreamEvent {
  kind: "thinking" | "summary";
  text: string;
}

export interface LlmTokenUsageDelta {
  produced: number;
  maxOutputTokens?: number;
}

export interface LlmStreamObserver {
  onReasoningEvent(event: LlmReasoningStreamEvent): void;
  onTokenDelta?(delta: LlmTokenUsageDelta): void;
}

export interface LlmGenerateOptions {
  streamObserver?: LlmStreamObserver;
}

export interface LlmResult {
  html: string;
  usage?: LlmUsageMetrics;
  raw?: unknown;
  reasoning?: LlmReasoningTrace;
}

export interface LlmClient {
  readonly settings: ProviderSettings;
  generateHtml(messages: ChatMessage[], options?: LlmGenerateOptions): Promise<LlmResult>;
}
