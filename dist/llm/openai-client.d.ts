import type { ChatMessage, ProviderSettings } from "../types.js";
import type { LlmClient, LlmResult } from "./client.js";
export declare class OpenAiClient implements LlmClient {
    readonly settings: ProviderSettings;
    private readonly client;
    constructor(settings: ProviderSettings);
    generateHtml(messages: ChatMessage[]): Promise<LlmResult>;
}
