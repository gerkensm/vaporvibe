import type { ModelProvider, ReasoningMode } from "../types.js";
export interface AdminProviderInfo {
    provider: string;
    model: string;
    maxOutputTokens: number;
    reasoningMode: ReasoningMode;
    reasoningTokensEnabled?: boolean;
    reasoningTokens?: number;
    apiKeyMask: string;
}
export interface AdminRuntimeInfo {
    historyLimit: number;
    historyMaxBytes: number;
    includeInstructionPanel: boolean;
}
export interface AdminBriefAttachment {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    dataUrl: string;
    isImage: boolean;
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
    html: string;
    attachments?: AdminBriefAttachment[];
    viewUrl: string;
    downloadUrl: string;
}
export interface AdminPageProps {
    brief: string | null;
    attachments: AdminBriefAttachment[];
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
