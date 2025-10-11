import type { ModelProvider, ReasoningMode } from "../types.js";
import {
  PROVIDER_METADATA,
  type ProviderMetadata,
  type ModelMetadata,
  getModelOptions,
  getModelMetadata,
  getFeaturedModels,
} from "../llm/model-catalog.js";
import { DEFAULT_REASONING_TOKENS } from "../constants.js";

export interface ProviderChoice {
  value: ModelProvider;
  title: string;
  subtitle: string;
  description: string;
  placeholder: string;
}

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
};

export const DEFAULT_MAX_TOKENS_BY_PROVIDER: Record<ModelProvider, number> = {
  openai: PROVIDER_METADATA.openai.maxOutputTokens.default,
  gemini: PROVIDER_METADATA.gemini.maxOutputTokens.default,
  anthropic: PROVIDER_METADATA.anthropic.maxOutputTokens.default,
  grok: PROVIDER_METADATA.grok.maxOutputTokens.default,
};

export const REASONING_MODE_CHOICES: Array<{ value: ReasoningMode; label: string; description: string }> = [
  { value: "none", label: "None", description: "Disable the provider’s structured reasoning traces." },
  { value: "low", label: "Low", description: "Allow short reasoning bursts for tricky prompts." },
  { value: "medium", label: "Medium", description: "Balance latency and introspection for complex flows." },
  { value: "high", label: "High", description: "Maximize deliberate reasoning when quality is critical." },
];

export const PROVIDER_REASONING_CAPABILITIES: Record<ModelProvider, { mode: boolean; tokens: boolean }> = Object.fromEntries(
  (Object.keys(PROVIDER_METADATA) as ModelProvider[]).map((provider) => {
    const metadata = PROVIDER_METADATA[provider];
    const supportsModes = metadata.reasoningModes.some((mode) => mode !== "none");
    const supportsTokens = metadata.reasoningTokens?.supported ?? false;
    return [provider, { mode: supportsModes, tokens: supportsTokens }] as const;
  }),
) as Record<ModelProvider, { mode: boolean; tokens: boolean }>;

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

export { getModelOptions, getModelMetadata, getFeaturedModels };
