import type { ChatMessage, ProviderSettings, VerificationResult } from "../types.js";
import type { LlmClient, LlmResult } from "./client.js";
export declare class GrokClient implements LlmClient {
    readonly settings: ProviderSettings;
    private readonly client;
    constructor(settings: ProviderSettings);
    generateHtml(messages: ChatMessage[]): Promise<LlmResult>;
}
export declare function verifyGrokApiKey(apiKey: string): Promise<VerificationResult>;
