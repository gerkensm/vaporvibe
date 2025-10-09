import type { ChatMessage, ProviderSettings, VerificationResult } from "../types.js";
import type { LlmClient, LlmResult } from "./client.js";
export declare class AnthropicClient implements LlmClient {
    readonly settings: ProviderSettings;
    private readonly client;
    constructor(settings: ProviderSettings);
    generateHtml(messages: ChatMessage[]): Promise<LlmResult>;
    private generateWithThinking;
    private extractStreamDelta;
    private extractThinkingDelta;
    private combineContent;
    private collectThinking;
    private logAndCollectThinking;
    private retryOnOverload;
}
export declare function verifyAnthropicApiKey(apiKey: string): Promise<VerificationResult>;
