import type { ModelProvider, ReasoningMode } from "../types.js";
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
    maxOutputTokens: number;
    reasoningMode: ReasoningMode;
    reasoningTokens?: number;
    statusMessage?: string;
    errorMessage?: string;
    briefValue?: string;
}
export declare function renderSetupWizardPage(options: SetupWizardPageOptions): string;
export {};
