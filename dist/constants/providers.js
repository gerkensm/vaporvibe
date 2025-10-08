import { DEFAULT_OPENAI_MODEL, DEFAULT_GEMINI_MODEL, DEFAULT_ANTHROPIC_MODEL, DEFAULT_GROK_MODEL, DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS, DEFAULT_REASONING_TOKENS, } from "../constants.js";
export const PROVIDER_CHOICES = [
    {
        value: "openai",
        title: "OpenAI",
        subtitle: "GPT-5 Pro · o3 · GPT-4.1",
        description: "Flagship frontier models with rich reasoning and polished UX—ideal when you want maximum quality and ecosystem reach.",
        placeholder: "sk-...",
    },
    {
        value: "gemini",
        title: "Google Gemini",
        subtitle: "1M context · Flash & Pro",
        description: "Flash is blisteringly fast for iteration; Pro delivers frontier depth with the same expansive context window.",
        placeholder: "AIza...",
    },
    {
        value: "grok",
        title: "xAI Grok",
        subtitle: "Fast frontier reasoning",
        description: "Frontier reasoning with realtime context. Choose the reasoning or non-reasoning Grok 4 variants, or scale down to Grok 3 for lighter latency.",
        placeholder: "xai-...",
    },
    {
        value: "anthropic",
        title: "Anthropic",
        subtitle: "Claude Sonnet · Claude Opus",
        description: "Sonnet balances quality and speed for product and code; Opus is the premium deep-thinker when you need Anthropic's top shelf.",
        placeholder: "sk-ant-...",
    },
];
export const PROVIDER_LABELS = Object.fromEntries(PROVIDER_CHOICES.map((choice) => [choice.value, choice.title]));
export const PROVIDER_PLACEHOLDERS = Object.fromEntries(PROVIDER_CHOICES.map((choice) => [choice.value, choice.placeholder]));
export const DEFAULT_MODEL_BY_PROVIDER = {
    openai: DEFAULT_OPENAI_MODEL,
    gemini: DEFAULT_GEMINI_MODEL,
    anthropic: DEFAULT_ANTHROPIC_MODEL,
    grok: DEFAULT_GROK_MODEL,
};
export const DEFAULT_MAX_TOKENS_BY_PROVIDER = {
    openai: DEFAULT_MAX_OUTPUT_TOKENS,
    gemini: DEFAULT_MAX_OUTPUT_TOKENS,
    anthropic: DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS,
    grok: DEFAULT_MAX_OUTPUT_TOKENS,
};
export const REASONING_MODE_CHOICES = [
    { value: "none", label: "None", description: "Disable the provider’s structured reasoning traces." },
    { value: "low", label: "Low", description: "Allow short reasoning bursts for tricky prompts." },
    { value: "medium", label: "Medium", description: "Balance latency and introspection for complex flows." },
    { value: "high", label: "High", description: "Maximize deliberate reasoning when quality is critical." },
];
export const PROVIDER_REASONING_CAPABILITIES = {
    openai: { mode: true, tokens: false },
    gemini: { mode: false, tokens: true },
    anthropic: { mode: false, tokens: true },
    grok: { mode: true, tokens: false },
};
export const REASONING_TOKEN_MIN_BY_PROVIDER = {
    openai: 0,
    gemini: -1,
    anthropic: 0,
    grok: 0,
};
export function getDefaultReasoningTokens(provider) {
    return DEFAULT_REASONING_TOKENS[provider];
}
