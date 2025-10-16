import type { ChatMessage, ProviderSettings, VerificationResult } from "../types.js";
import type { LlmClient, LlmResult } from "./client.js";
export declare class AnthropicClient implements LlmClient {
    readonly settings: ProviderSettings;
    private readonly client;
    constructor(settings: ProviderSettings);
    generateHtml(messages: ChatMessage[]): Promise<LlmResult>;
    private generateWithThinking;
    private combineContent;
    private collectThinking;
    private logAndCollectThinking;
    private retryOnOverload;
    private extractStreamDelta;
    private extractThinkingDelta;
}
export declare function verifyAnthropicApiKey(apiKey: string): Promise<VerificationResult>;
