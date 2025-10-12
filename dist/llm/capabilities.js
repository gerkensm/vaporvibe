const OPENAI_IMAGE_MODEL_PATTERNS = [
    /gpt-4/i,
    /gpt-5/i,
    /^o\d/i,
    /omni/i,
];
const ANTHROPIC_IMAGE_MODEL_PATTERNS = [
    /^claude-3/i,
    /^claude-3\.5/i,
    /opus/i,
    /sonnet/i,
    /haiku/i,
];
export function supportsImageInput(provider, model) {
    const normalizedModel = model.trim().toLowerCase();
    if (!normalizedModel) {
        return false;
    }
    switch (provider) {
        case "openai":
            return OPENAI_IMAGE_MODEL_PATTERNS.some((pattern) => pattern.test(normalizedModel));
        case "gemini":
            return true;
        case "anthropic":
            return ANTHROPIC_IMAGE_MODEL_PATTERNS.some((pattern) => pattern.test(normalizedModel));
        default:
            return false;
    }
}
