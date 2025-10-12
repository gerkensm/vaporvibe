export function supportsImageInputs(provider, model) {
    const normalizedModel = (model ?? "").toLowerCase();
    if (provider === "openai") {
        return (normalizedModel.includes("gpt-4o") ||
            normalizedModel.includes("gpt-4.1") ||
            normalizedModel.includes("gpt-5") ||
            normalizedModel.startsWith("o"));
    }
    return false;
}
