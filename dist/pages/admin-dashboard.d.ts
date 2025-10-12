import type { BriefAttachment, ModelProvider, ReasoningMode } from "../types.js";
export interface AdminProviderInfo {
    provider: string;
    model: string;
    maxOutputTokens: number;
    reasoningMode: ReasoningMode;
    reasoningTokens?: number;
    apiKeyMask: string;
}
export interface AdminRuntimeInfo {
    historyLimit: number;
    historyMaxBytes: number;
    includeInstructionPanel: boolean;
}
export interface AdminHistoryItem {
    id: string;
    createdAt: string;
    method: string;
    path: string;
    durationMs: number;
    instructions?: string;
    querySummary: string;
    bodySummary: string;
    usageSummary?: string;
    reasoningSummaries?: string[];
    reasoningDetails?: string[];
    attachments?: BriefAttachment[];
    html: string;
    viewUrl: string;
    downloadUrl: string;
}
export interface AdminPageProps {
    brief: string | null;
    briefAttachments: BriefAttachment[];
    attachmentsEnabled: boolean;
    provider: AdminProviderInfo;
    runtime: AdminRuntimeInfo;
    history: AdminHistoryItem[];
    totalHistoryCount: number;
    sessionCount: number;
    statusMessage?: string;
    errorMessage?: string;
    exportJsonUrl: string;
    exportMarkdownUrl: string;
    historyEndpoint: string;
    providerKeyStatuses: Record<ModelProvider, {
        hasKey: boolean;
        verified: boolean;
    }>;
}
export declare function renderAdminDashboard(props: AdminPageProps): string;
export declare function renderHistory(history: AdminHistoryItem[]): string;
