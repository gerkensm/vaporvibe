import type { ModelProvider, VerificationResult } from "../types.js";
import { verifyOpenAiApiKey } from "./openai-client.js";
import { verifyGeminiApiKey } from "./gemini-client.js";
import { verifyAnthropicApiKey } from "./anthropic-client.js";
import { verifyGrokApiKey } from "./grok-client.js";
import { verifyGroqApiKey } from "./groq-client.js";
import { verifyOpenRouterApiKey } from "./openrouter-client.js";

export async function verifyProviderApiKey(provider: ModelProvider, apiKey: string): Promise<VerificationResult> {
  if (provider === "openai") {
    return verifyOpenAiApiKey(apiKey);
  }
  if (provider === "gemini") {
    return verifyGeminiApiKey(apiKey);
  }
  if (provider === "anthropic") {
    return verifyAnthropicApiKey(apiKey);
  }
  if (provider === "grok") {
    return verifyGrokApiKey(apiKey);
  }
  if (provider === "groq") {
    return verifyGroqApiKey(apiKey);
  }
  if (provider === "openrouter") {
    return verifyOpenRouterApiKey(apiKey);
  }
  throw new Error(`Unknown provider: ${provider}`);
}
