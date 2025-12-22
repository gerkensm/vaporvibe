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
  ratio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  provider: "openai" | "gemini";
  modelId: string;
  mimeType: string;
  createdAt: string;
  blobName?: string;
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

export type AdminHistoryEntryKind = "html" | "rest-mutation" | "rest-query";

export interface NumericRange {
  min?: number;
  max?: number;
  step?: number;
  default?: number;
  description?: string;
  allowDisable?: boolean;
  helper?: string;
}

export interface ModelReasoningTokens extends NumericRange {
  supported: boolean;
}

export interface ProviderTokenGuidanceEntry {
  maxOutputTokens: NumericRange;
  reasoningTokens?: ModelReasoningTokens;
}

export interface ModelCostInfo {
  currency: string;
  unit: string;
  input?: number | null;
  output?: number | null;
  reasoning?: number | null;
  notes?: string;
}

export interface ModelCompositeScores {
  reasoning: number;
  codingSkill: number;
  responsiveness: number;
  valueForMoney: number;
}

export interface ModelMetadata {
  value: string;
  label: string;
  tagline?: string;
  description: string;
  recommendedFor?: string;
  highlights?: string[];
  release?: string;
  contextWindow?: number;
  contextWindowUnit?: string;
  featured?: boolean;
  isMultimodal?: boolean;
  supportsImageInput?: boolean;
  supportsPDFInput?: boolean;
  maxOutputTokens?: NumericRange;
  reasoningTokens: ModelReasoningTokens;
  reasoningModeNotes?: string;
  reasoningModes?: string[];
  defaultReasoningMode?: string;
  documentationUrl?: string;
  cost?: ModelCostInfo;
  compositeScores?: ModelCompositeScores;
  supportsReasoningMode?: boolean;
  supportsMediaResolution?: boolean;
}

export interface AdminProviderInfo {
  provider: string;
  model: string;
  maxOutputTokens: number;
  reasoningMode: string;
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
  provider?: "openai" | "gemini";
  modelId: string;
  hasApiKey: boolean;
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
  entryKind: AdminHistoryEntryKind;
  rest?: {
    type: "mutation" | "query";
    request: {
      method: string;
      path: string;
      query: Record<string, unknown>;
      body: Record<string, unknown>;
    };
    responseSummary?: string;
    ok?: boolean;
    error?: string;
  };
  restMutations?: AdminRestMutationItem[];
  restQueries?: AdminRestQueryItem[];
  viewUrl: string;
  downloadUrl: string;
  deleteUrl: string;
  forkInfo?: {
    forkId: string;
    branchId: string;
    label: "A" | "B";
    status: "in-progress" | "chosen" | "discarded";
  };
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
  isForkActive: boolean;
  activeForks: AdminActiveForkSummary[];
  providerKeyStatuses: Record<
    string,
    {
      hasKey: boolean;
      verified: boolean;
    }
  >;
  providerChoices: Array<{
    value: string;
    title: string;
    subtitle: string;
    description: string;
    placeholder: string;
  }>;
  providerLabels: Record<string, string>;
  providerPlaceholders: Record<string, string>;
  defaultModelByProvider: Record<string, string>;
  defaultMaxOutputTokens: Record<string, number>;
  providerTokenGuidance: Record<string, ProviderTokenGuidanceEntry>;
  reasoningModeChoices: Array<{
    value: string;
    label: string;
    description: string;
  }>;
  customModelDescription: string;
  modelCatalog: Record<string, ModelMetadata[]>;
  modelOptions: Record<
    string,
    Array<{ value: string; label: string; tagline?: string }>
  >;
  featuredModels: Record<
    string,
    Array<{ value: string; label: string; tagline?: string }>
  >;
  providerReasoningModes: Record<string, string[]>;
  providerReasoningCapabilities: Record<
    string,
    { mode: boolean; tokens: boolean }
  >;
  providerMediaResolutionCapabilities: Record<string, boolean>;
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

export interface AdminUpdateResponse {
  success: boolean;
  message: string;
  state?: AdminStateResponse;
}
