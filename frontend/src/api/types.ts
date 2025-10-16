export interface AdminBriefAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  isImage: boolean;
}

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
  documentationUrl?: string;
  cost?: ModelCostInfo;
  compositeScores?: ModelCompositeScores;
  supportsReasoningMode?: boolean;
}

export interface AdminProviderInfo {
  provider: string;
  model: string;
  maxOutputTokens: number;
  reasoningMode: string;
  reasoningTokensEnabled?: boolean;
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
  providerReasoningCapabilities: Record<
    string,
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

export interface AdminUpdateResponse {
  success: boolean;
  message: string;
  state?: AdminStateResponse;
}
