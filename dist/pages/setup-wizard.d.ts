import type { ModelProvider, ReasoningMode } from "../types.js";
type ProviderKeyStatus = {
    hasKey: boolean;
    verified: boolean;
};
export type SetupWizardStep = "provider" | "brief";
interface SetupWizardPageOptions {
    step: SetupWizardStep;
    providerLabel: string;
    providerName: string;
    verifyAction: string;
    briefAction: string;
    setupPath: string;
    adminPath: string;
    providerReady: boolean;
    canSelectProvider: boolean;
    selectedProvider: ModelProvider;
    selectedModel: string;
    providerSelectionRequired: boolean;
    providerKeyStatuses: Record<ModelProvider, ProviderKeyStatus>;
    maxOutputTokens: number;
    reasoningMode: ReasoningMode;
    reasoningTokensEnabled?: boolean;
    reasoningTokens?: number;
    statusMessage?: string;
    errorMessage?: string;
    briefValue?: string;
}
export declare function renderSetupWizardPage(options: SetupWizardPageOptions): string;
export {};
