import type { ModelProvider } from "../../types.js";
export declare function renderModelDetailPanel(provider: ModelProvider, modelValue: string): string;
export declare function renderModelLineup(provider: ModelProvider, activeModel: string): string;
export declare function getModelOptionList(provider: ModelProvider, selectedModel: string): Array<{
    value: string;
    label: string;
}>;
export declare function serializeModelCatalogForClient(): string;
