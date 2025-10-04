import type { ChatMessage, ProviderSettings } from "../types.js";
export interface LlmClient {
    readonly settings: ProviderSettings;
    generateHtml(messages: ChatMessage[]): Promise<string>;
}
