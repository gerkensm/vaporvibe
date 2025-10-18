import type { ModelProvider, ReasoningMode } from "../types.js";
export interface NumericRange {
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly default?: number;
    readonly description?: string;
    readonly allowDisable?: boolean;
}
export interface ModelCostInfo {
    readonly currency: "USD";
    readonly unit: "1M tokens";
    readonly input?: number | null;
    readonly output?: number | null;
    readonly reasoning?: number | null;
    readonly notes?: string;
}
export interface ModelCompositeScores {
    readonly reasoning: number;
    readonly codingSkill: number;
    readonly responsiveness: number;
    readonly valueForMoney: number;
}
export interface ModelReasoningTokens extends NumericRange {
    readonly supported: boolean;
    readonly helper?: string;
}
export interface ModelMetadata {
    readonly value: string;
    readonly label: string;
    readonly tagline?: string;
    readonly description: string;
    readonly recommendedFor?: string;
    readonly highlights?: string[];
    readonly release?: string;
    readonly contextWindow?: number;
    readonly contextWindowUnit?: string;
    readonly featured?: boolean;
    readonly isMultimodal?: boolean;
    readonly supportsImageInput?: boolean;
    readonly supportsPDFInput?: boolean;
    readonly maxOutputTokens?: NumericRange;
    readonly reasoningTokens: ModelReasoningTokens;
    readonly reasoningModeNotes?: string;
    readonly documentationUrl?: string;
    readonly cost?: ModelCostInfo;
    readonly compositeScores?: ModelCompositeScores;
    readonly supportsReasoningMode?: boolean;
    readonly reasoningModes?: ReasoningMode[];
}
export interface ProviderMetadata {
    readonly provider: ModelProvider;
    readonly name: string;
    readonly shortName?: string;
    readonly tagline: string;
    readonly description: string;
    readonly placeholder: string;
    readonly defaultModel: string;
    readonly defaultReasoningMode: ReasoningMode;
    readonly reasoningModes: ReasoningMode[];
    readonly maxOutputTokens: NumericRange & {
        readonly default: number;
    };
    readonly reasoningTokens?: (NumericRange & {
        readonly supported: boolean;
        readonly allowDisable?: boolean;
    }) & {
        readonly helper?: string;
    };
    readonly models: ModelMetadata[];
}
export declare const PROVIDER_METADATA: Record<ModelProvider, ProviderMetadata>;
export type ProviderCatalog = typeof PROVIDER_METADATA;
export declare function getProviderMetadata(provider: ModelProvider): ProviderMetadata;
export declare function getModelMetadata(provider: ModelProvider, modelValue: string): ModelMetadata | undefined;
export declare function getModelOptions(provider: ModelProvider): Array<{
    value: string;
    label: string;
}>;
export declare function getFeaturedModels(provider: ModelProvider): ModelMetadata[];
