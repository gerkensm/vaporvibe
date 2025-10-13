import { PROVIDER_METADATA, getModelOptions, getModelMetadata, getFeaturedModels, } from "../llm/model-catalog.js";
import { DEFAULT_REASONING_TOKENS } from "../constants.js";
function providerChoiceFromMetadata(metadata) {
    return {
        value: metadata.provider,
        title: metadata.name,
        subtitle: metadata.tagline,
        description: metadata.description,
        placeholder: metadata.placeholder,
    };
}
export const PROVIDER_CHOICES = Object.values(PROVIDER_METADATA).map((metadata) => providerChoiceFromMetadata(metadata));
export const PROVIDER_LABELS = Object.fromEntries(PROVIDER_CHOICES.map((choice) => [choice.value, choice.title]));
export const PROVIDER_PLACEHOLDERS = Object.fromEntries(PROVIDER_CHOICES.map((choice) => [choice.value, choice.placeholder]));
export const DEFAULT_MODEL_BY_PROVIDER = {
    openai: PROVIDER_METADATA.openai.defaultModel,
    gemini: PROVIDER_METADATA.gemini.defaultModel,
    anthropic: PROVIDER_METADATA.anthropic.defaultModel,
    grok: PROVIDER_METADATA.grok.defaultModel,
    groq: PROVIDER_METADATA.groq.defaultModel,
};
export const DEFAULT_MAX_TOKENS_BY_PROVIDER = {
    openai: PROVIDER_METADATA.openai.maxOutputTokens.default,
    gemini: PROVIDER_METADATA.gemini.maxOutputTokens.default,
    anthropic: PROVIDER_METADATA.anthropic.maxOutputTokens.default,
    grok: PROVIDER_METADATA.grok.maxOutputTokens.default,
    groq: PROVIDER_METADATA.groq.maxOutputTokens.default,
};
export const REASONING_MODE_CHOICES = [
    { value: "none", label: "None", description: "Disable the provider’s structured reasoning traces." },
    { value: "low", label: "Low", description: "Allow short reasoning bursts for tricky prompts." },
    { value: "medium", label: "Medium", description: "Balance latency and introspection for complex flows." },
    { value: "high", label: "High", description: "Maximize deliberate reasoning when quality is critical." },
];
export const PROVIDER_REASONING_CAPABILITIES = Object.fromEntries(Object.keys(PROVIDER_METADATA).map((provider) => {
    const metadata = PROVIDER_METADATA[provider];
    const supportsModes = metadata.reasoningModes.some((mode) => mode !== "none");
    const supportsTokens = metadata.reasoningTokens?.supported ?? false;
    return [provider, { mode: supportsModes, tokens: supportsTokens }];
}));
export const PROVIDER_TOKEN_GUIDANCE = Object.fromEntries(Object.keys(PROVIDER_METADATA).map((provider) => {
    const metadata = PROVIDER_METADATA[provider];
    const reasoning = metadata.reasoningTokens;
    return [
        provider,
        {
            maxOutputTokens: {
                min: metadata.maxOutputTokens.min,
                max: metadata.maxOutputTokens.max,
                default: metadata.maxOutputTokens.default,
                description: metadata.maxOutputTokens.description,
            },
            reasoningTokens: reasoning
                ? {
                    supported: Boolean(reasoning.supported),
                    min: reasoning.min,
                    max: reasoning.max,
                    default: reasoning.default,
                    description: reasoning.description,
                    helper: reasoning.helper,
                    allowDisable: reasoning.allowDisable,
                }
                : undefined,
        },
    ];
}));
export const REASONING_TOKEN_MIN_BY_PROVIDER = Object.fromEntries(Object.keys(PROVIDER_METADATA).map((provider) => {
    const metadata = PROVIDER_METADATA[provider];
    const min = metadata.reasoningTokens?.min;
    return [provider, typeof min === "number" ? min : 0];
}));
export function getDefaultReasoningTokens(provider) {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_REASONING_TOKENS, provider)) {
        return DEFAULT_REASONING_TOKENS[provider];
    }
    return PROVIDER_METADATA[provider]?.reasoningTokens?.default;
}
export const PROVIDER_MODEL_METADATA = Object.fromEntries(Object.keys(PROVIDER_METADATA).map((provider) => [
    provider,
    PROVIDER_METADATA[provider].models,
]));
export { getModelOptions, getModelMetadata, getFeaturedModels };
