import type { ChatMessage, LlmReasoningTrace, LlmUsageMetrics, ProviderSettings } from "../types.js";
export interface LlmResult {
    html: string;
    usage?: LlmUsageMetrics;
    raw?: unknown;
    reasoning?: LlmReasoningTrace;
}
export interface LlmClient {
    readonly settings: ProviderSettings;
    generateHtml(messages: ChatMessage[]): Promise<LlmResult>;
}
