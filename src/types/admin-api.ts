import type {
  HistoryEntryKind,
  HistoryForkInfo,
  ModelProvider,
  ImageAspectRatio,
  ImageGenProvider,
  ImageModelId,
  ReasoningMode,
  RestHistoryMetadata,
} from "../types.js";
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
  mediaResolution?: string;
  imageGeneration: AdminImageGenerationInfo;
}

export interface AdminRuntimeInfo {
  historyLimit: number;
  historyMaxBytes: number;
  includeInstructionPanel: boolean;
  enableStandardLibrary: boolean;
}

export interface AdminImageGenerationInfo {
  enabled: boolean;
  provider?: "openai" | "gemini" | "openrouter";
  modelId: string;
  hasApiKey: boolean;
}

export interface AdminBriefAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  isImage: boolean;
  blobName?: string;
}

export interface AdminGeneratedImage {
  id: string;
  url: string;
  downloadUrl: string;
  prompt: string;
  ratio: ImageAspectRatio;
  provider: ImageGenProvider;
  modelId: ImageModelId;
  mimeType: string;
  createdAt: string;
  blobName?: string;
}

export interface AdminRestItem {
  type: "mutation" | "query";
  request: RestHistoryMetadata["request"];
  responseSummary?: string;
  ok?: boolean;
  error?: string;
}

export interface AdminRestMutationItem {
  id: string;
  createdAt: string;
  method: string;
  path: string;
  querySummary: string;
  bodySummary: string;
}

export interface AdminRestQueryItem extends AdminRestMutationItem {
  ok: boolean;
  responseSummary: string;
  error?: string;
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
  generatedImages?: AdminGeneratedImage[];
  entryKind: HistoryEntryKind;
  rest?: AdminRestItem;
  restMutations?: AdminRestMutationItem[];
  restQueries?: AdminRestQueryItem[];
  viewUrl: string;
  downloadUrl: string;
  deleteUrl: string;
  forkInfo?: HistoryForkInfo;
}

export interface AdminForkBranchSummary {
  branchId: string;
  label: "A" | "B";
  instructions: string;
  entryCount: number;
}

export interface AdminActiveForkSummary {
  sessionId: string;
  forkId: string;
  originEntryId: string;
  createdAt: number;
  branches: AdminForkBranchSummary[];
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
  primarySessionId: string | null;
  exportJsonUrl: string;
  exportMarkdownUrl: string;
  exportTourUrl: string;
  exportPrototypeUrl: string;
  isForkActive: boolean;
  activeForks: AdminActiveForkSummary[];
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
  providerReasoningModes: Record<ModelProvider, ReasoningMode[]>;
  providerReasoningCapabilities: Record<
    ModelProvider,
    { mode: boolean; tokens: boolean }
  >;
  providerMediaResolutionCapabilities: Record<ModelProvider, boolean>;
  imageModelCatalog: Record<ImageGenProvider, Array<{ value: string; label: string }>>
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
