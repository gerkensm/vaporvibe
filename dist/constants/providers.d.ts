import type { ModelProvider, ReasoningMode } from "../types.js";
import { type ModelMetadata, getModelOptions, getModelMetadata, getFeaturedModels } from "../llm/model-catalog.js";
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
export declare const PROVIDER_CHOICES: ProviderChoice[];
export declare const PROVIDER_LABELS: Record<ModelProvider, string>;
export declare const PROVIDER_PLACEHOLDERS: Record<ModelProvider, string>;
export declare const DEFAULT_MODEL_BY_PROVIDER: Record<ModelProvider, string>;
export declare const DEFAULT_MAX_TOKENS_BY_PROVIDER: Record<ModelProvider, number>;
export declare const REASONING_MODE_CHOICES: Array<{
    value: ReasoningMode;
    label: string;
    description: string;
}>;
export declare const PROVIDER_REASONING_CAPABILITIES: Record<ModelProvider, {
    mode: boolean;
    tokens: boolean;
}>;
export declare const PROVIDER_TOKEN_GUIDANCE: Record<ModelProvider, ProviderTokenGuidance>;
export declare const REASONING_TOKEN_MIN_BY_PROVIDER: Record<ModelProvider, number>;
export declare function getDefaultReasoningTokens(provider: ModelProvider): number | undefined;
export declare const PROVIDER_MODEL_METADATA: Record<ModelProvider, ModelMetadata[]>;
export { getModelOptions, getModelMetadata, getFeaturedModels };
