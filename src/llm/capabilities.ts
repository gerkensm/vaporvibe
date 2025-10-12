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
    default:
      return false;
  }
}
