import { verifyOpenAiApiKey } from "./openai-client.js";
import { verifyGeminiApiKey } from "./gemini-client.js";
import { verifyAnthropicApiKey } from "./anthropic-client.js";
import { verifyGrokApiKey } from "./grok-client.js";
import { verifyGroqApiKey } from "./groq-client.js";
export async function verifyProviderApiKey(provider, apiKey) {
    if (provider === "openai") {
        return verifyOpenAiApiKey(apiKey);
    }
    if (provider === "gemini") {
        return verifyGeminiApiKey(apiKey);
    }
    if (provider === "grok") {
        return verifyGrokApiKey(apiKey);
    }
    if (provider === "groq") {
        return verifyGroqApiKey(apiKey);
    }
    return verifyAnthropicApiKey(apiKey);
}
