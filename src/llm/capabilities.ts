import type { ModelProvider } from "../types.js";

const OPENAI_IMAGE_MODEL_PATTERNS: RegExp[] = [
  /gpt-4/i,
  /gpt-5/i,
  /^o\d/i,
  /omni/i,
];

const ANTHROPIC_IMAGE_MODEL_PATTERNS: RegExp[] = [
  /^claude-3/i,
  /^claude-3\.5/i,
  /opus/i,
  /sonnet/i,
  /haiku/i,
];

const GROQ_IMAGE_MODELS = new Set<string>([
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct",
]);

export function supportsImageInput(
  provider: ModelProvider,
  model: string,
): boolean {
  const normalizedModel = model.trim().toLowerCase();
  if (!normalizedModel) {
    return false;
  }

  switch (provider) {
    case "openai":
      return OPENAI_IMAGE_MODEL_PATTERNS.some((pattern) =>
        pattern.test(normalizedModel)
      );
    case "gemini":
      return true;
    case "anthropic":
      return ANTHROPIC_IMAGE_MODEL_PATTERNS.some((pattern) =>
        pattern.test(normalizedModel)
      );
    case "groq":
      return GROQ_IMAGE_MODELS.has(normalizedModel);
    case "openrouter":
      // OpenRouter supports multimodal inputs for most models via its unified API
      return true;
    default:
      return false;
  }
}
