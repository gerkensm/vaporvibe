import type { ModelProvider, ReasoningMode } from "../types.js";
import type {
  ProviderChoice,
  ProviderTokenGuidance,
} from "../constants/providers.js";
import type { ModelMetadata } from "../llm/model-catalog.js";

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

export interface AdminStateResponse {
  brief: string | null;
  attachments: AdminBriefAttachment[];
  provider: AdminProviderInfo;
  runtime: AdminRuntimeInfo;
  providerReady: boolean;
  providerSelectionRequired: boolean;
  providerLocked: boolean;
  totalHistoryCount: number;
  sessionCount: number;
  exportJsonUrl: string;
  exportMarkdownUrl: string;
  providerKeyStatuses: Record<
    ModelProvider,
    { hasKey: boolean; verified: boolean }
  >;
  providerChoices: ProviderChoice[];
  providerLabels: Record<ModelProvider, string>;
  providerPlaceholders: Record<ModelProvider, string>;
  defaultModelByProvider: Record<ModelProvider, string>;
  defaultMaxOutputTokens: Record<ModelProvider, number>;
  providerTokenGuidance: Record<ModelProvider, ProviderTokenGuidance>;
  reasoningModeChoices: Array<{
    value: ReasoningMode;
    label: string;
    description: string;
  }>;
  customModelDescription: string;
  modelCatalog: Record<ModelProvider, ModelMetadata[]>;
  modelOptions: Record<
    ModelProvider,
    Array<{ value: string; label: string; tagline?: string }>
  >;
  featuredModels: Record<
    ModelProvider,
    Array<{ value: string; label: string; tagline?: string }>
  >;
  providerReasoningCapabilities: Record<
    ModelProvider,
    { mode: boolean; tokens: boolean }
  >;
}

export interface AdminHistoryResponse {
  items: AdminHistoryItem[];
  totalCount: number;
  sessionCount: number;
  pagination: {
    limit: number;
    offset: number;
    nextOffset: number | null;
  };
}

export interface AdminUpdateResponse<T = unknown> {
  success: boolean;
  message: string;
  state?: AdminStateResponse;
  detail?: T;
}
