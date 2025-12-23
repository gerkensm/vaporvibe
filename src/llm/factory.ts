import type { ProviderSettings } from "../types.js";
import { OpenAiClient } from "./openai-client.js";
import { GeminiClient } from "./gemini-client.js";
import { AnthropicClient } from "./anthropic-client.js";
import { GrokClient } from "./grok-client.js";
import { GroqClient } from "./groq-client.js";
import { OpenRouterClient } from "./openrouter-client.js";
import type { LlmClient } from "./client.js";

export function createLlmClient(settings: ProviderSettings): LlmClient {
  if (settings.provider === "openai") {
    return new OpenAiClient(settings);
  }
  if (settings.provider === "gemini") {
    return new GeminiClient(settings);
  }
  if (settings.provider === "anthropic") {
    return new AnthropicClient(settings);
  }
  if (settings.provider === "grok") {
    return new GrokClient(settings);
  }
  if (settings.provider === "groq") {
    return new GroqClient(settings);
  }
  if (settings.provider === "openrouter") {
    return new OpenRouterClient(settings);
  }
  throw new Error(`Unknown provider: ${settings.provider}`);
}
