import type { ModelProvider, VerificationResult } from "../types.js";
import { verifyOpenAiApiKey } from "./openai-client.js";
import { verifyGeminiApiKey } from "./gemini-client.js";
import { verifyAnthropicApiKey } from "./anthropic-client.js";

export async function verifyProviderApiKey(provider: ModelProvider, apiKey: string): Promise<VerificationResult> {
  if (provider === "openai") {
    return verifyOpenAiApiKey(apiKey);
  }
  if (provider === "gemini") {
    return verifyGeminiApiKey(apiKey);
  }
  return verifyAnthropicApiKey(apiKey);
}
