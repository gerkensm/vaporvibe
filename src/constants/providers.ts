import type { ModelProvider, ReasoningMode, ImageGenProvider } from "../types.js";
import {
  PROVIDER_METADATA,
  type ProviderMetadata,
  type ModelMetadata,
  getModelOptions,
  getModelMetadata,
  getFeaturedModels,
} from "../llm/model-catalog.js";
import { DEFAULT_REASONING_TOKENS } from "../constants.js";

export interface NumericRangeSummary {
  min?: number;
  max?: number;
  default?: number;
  description?: string;
}

export interface ReasoningRangeSummary extends NumericRangeSummary {
  supported: boolean;
  helper?: string;
  allowDisable?: boolean;
}

export interface ProviderTokenGuidance {
  maxOutputTokens: NumericRangeSummary;
  reasoningTokens?: ReasoningRangeSummary;
}

export interface ProviderChoice {
  value: ModelProvider;
  title: string;
  subtitle: string;
  description: string;
  placeholder: string;
}

export const CUSTOM_MODEL_DESCRIPTION =
  "Provide a custom model identifier supported by the provider. You can adjust token budgets below.";

function providerChoiceFromMetadata(metadata: ProviderMetadata): ProviderChoice {
  return {
    value: metadata.provider,
    title: metadata.name,
    subtitle: metadata.tagline,
    description: metadata.description,
    placeholder: metadata.placeholder,
  };
}

export const PROVIDER_CHOICES: ProviderChoice[] = Object.values(PROVIDER_METADATA).map(
  (metadata) => providerChoiceFromMetadata(metadata),
);

export const PROVIDER_LABELS: Record<ModelProvider, string> = Object.fromEntries(
  PROVIDER_CHOICES.map((choice) => [choice.value, choice.title] as const),
) as Record<ModelProvider, string>;

export const PROVIDER_PLACEHOLDERS: Record<ModelProvider, string> = Object.fromEntries(
  PROVIDER_CHOICES.map((choice) => [choice.value, choice.placeholder] as const),
) as Record<ModelProvider, string>;

export const DEFAULT_MODEL_BY_PROVIDER: Record<ModelProvider, string> = {
  openai: PROVIDER_METADATA.openai.defaultModel,
  gemini: PROVIDER_METADATA.gemini.defaultModel,
  anthropic: PROVIDER_METADATA.anthropic.defaultModel,
  grok: PROVIDER_METADATA.grok.defaultModel,
  groq: PROVIDER_METADATA.groq.defaultModel,
  openrouter: PROVIDER_METADATA.openrouter.defaultModel,
};

export const DEFAULT_MAX_TOKENS_BY_PROVIDER: Record<ModelProvider, number> = {
  openai: PROVIDER_METADATA.openai.maxOutputTokens.default,
  gemini: PROVIDER_METADATA.gemini.maxOutputTokens.default,
  anthropic: PROVIDER_METADATA.anthropic.maxOutputTokens.default,
  grok: PROVIDER_METADATA.grok.maxOutputTokens.default,
  groq: PROVIDER_METADATA.groq.maxOutputTokens.default,
  openrouter: PROVIDER_METADATA.openrouter.maxOutputTokens.default,
};

export const REASONING_MODE_CHOICES: Array<{ value: ReasoningMode; label: string; description: string }> = [
  { value: "none", label: "None", description: "Disable the provider’s structured reasoning traces." },
  { value: "default", label: "Default", description: "Use the provider’s default reasoning effort." },
  { value: "low", label: "Low", description: "Allow short reasoning bursts for tricky prompts." },
  { value: "medium", label: "Medium", description: "Balance latency and introspection for complex flows." },
  { value: "high", label: "High", description: "Maximize deliberate reasoning when quality is critical." },
  { value: "xhigh", label: "Extra High", description: "Maximum reasoning for the most complex tasks (GPT-5.2+)." },
];

export const PROVIDER_REASONING_CAPABILITIES: Record<ModelProvider, { mode: boolean; tokens: boolean }> = Object.fromEntries(
  (Object.keys(PROVIDER_METADATA) as ModelProvider[]).map((provider) => {
    const metadata = PROVIDER_METADATA[provider];
    const supportsModes = metadata.reasoningModes.some((mode) => mode !== "none");
    const supportsTokens = metadata.reasoningTokens?.supported ?? false;
    return [provider, { mode: supportsModes, tokens: supportsTokens }] as const;
  }),
) as Record<ModelProvider, { mode: boolean; tokens: boolean }>;

export const PROVIDER_MEDIA_RESOLUTION_CAPABILITIES: Record<ModelProvider, boolean> = Object.fromEntries(
  (Object.keys(PROVIDER_METADATA) as ModelProvider[]).map((provider) => {
    const metadata = PROVIDER_METADATA[provider];
    const supports = metadata.models.some((model) => model.supportsMediaResolution);
    return [provider, supports] as const;
  }),
) as Record<ModelProvider, boolean>;

export const PROVIDER_REASONING_MODES: Record<ModelProvider, ReasoningMode[]> = Object.fromEntries(
  (Object.keys(PROVIDER_METADATA) as ModelProvider[]).map((provider) => [
    provider,
    PROVIDER_METADATA[provider].reasoningModes,
  ]),
) as Record<ModelProvider, ReasoningMode[]>;

export const PROVIDER_TOKEN_GUIDANCE: Record<ModelProvider, ProviderTokenGuidance> = Object.fromEntries(
  (Object.keys(PROVIDER_METADATA) as ModelProvider[]).map((provider) => {
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
    ] as const;
  }),
) as Record<ModelProvider, ProviderTokenGuidance>;

export const REASONING_TOKEN_MIN_BY_PROVIDER: Record<ModelProvider, number> = Object.fromEntries(
  (Object.keys(PROVIDER_METADATA) as ModelProvider[]).map((provider) => {
    const metadata = PROVIDER_METADATA[provider];
    const min = metadata.reasoningTokens?.min;
    return [provider, typeof min === "number" ? min : 0] as const;
  }),
) as Record<ModelProvider, number>;

export function getDefaultReasoningTokens(provider: ModelProvider): number | undefined {
  if (Object.prototype.hasOwnProperty.call(DEFAULT_REASONING_TOKENS, provider)) {
    return DEFAULT_REASONING_TOKENS[provider];
  }
  return PROVIDER_METADATA[provider]?.reasoningTokens?.default;
}

export const PROVIDER_MODEL_METADATA: Record<ModelProvider, ModelMetadata[]> = Object.fromEntries(
  (Object.keys(PROVIDER_METADATA) as ModelProvider[]).map((provider) => [
    provider,
    PROVIDER_METADATA[provider].models,
  ]),
) as Record<ModelProvider, ModelMetadata[]>;

export { getModelOptions, getModelMetadata, getFeaturedModels, type ModelMetadata };

export interface ImageModelOption {
  value: string;
  label: string;
  provider: ImageGenProvider;
}

export const STATIC_IMAGE_MODELS: ImageModelOption[] = [
  { value: "gpt-image-1.5", label: "GPT Image 1.5 (recommended)", provider: "openai" },
  { value: "dall-e-3", label: "DALL·E 3", provider: "openai" },
  { value: "gemini-3-pro-image-preview", label: "Nano Banana Pro (Gemini 3)", provider: "gemini" },
  { value: "gemini-2.5-flash-image", label: "Nano Banana (Gemini 2.5)", provider: "gemini" },
  { value: "imagen-4.0-fast-generate-001", label: "Imagen 4 (Fast)", provider: "gemini" },
  { value: "imagen-3.0-generate-002", label: "Imagen 3", provider: "gemini" },
];
