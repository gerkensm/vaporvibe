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

export interface LlmStreamObserver {
  onReasoningEvent(event: LlmReasoningStreamEvent): void;
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
