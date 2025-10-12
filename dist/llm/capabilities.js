const OPENAI_IMAGE_MODEL_PATTERNS = [
    /gpt-4/i,
    /gpt-5/i,
    /^o\d/i,
    /omni/i,
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
        default:
            return false;
    }
}
