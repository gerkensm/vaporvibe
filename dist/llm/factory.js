import { OpenAiClient } from "./openai-client.js";
import { GeminiClient } from "./gemini-client.js";
import { AnthropicClient } from "./anthropic-client.js";
export function createLlmClient(settings) {
    if (settings.provider === "openai") {
        return new OpenAiClient(settings);
    }
    if (settings.provider === "gemini") {
        return new GeminiClient(settings);
    }
    return new AnthropicClient(settings);
}
