export type ModelProvider = "openai" | "gemini" | "anthropic" | "grok" | "groq";

export type ImageGenProvider = "openai" | "gemini";

export type ImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export type ImageModelId =
  | "gpt-image-1.5"
  | "dall-e-3"
  | "gemini-2.5-flash-image"
  | "gemini-3-pro-image-preview"
  | "imagen-3.0-generate-002"
  | "imagen-4.0-fast-generate-001";

export type ReasoningMode = "none" | "low" | "medium" | "high" | "xhigh" | "default";

export interface BriefAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  base64?: string;
  blobName?: string;
}

export interface CacheControlSettings {
  type: "ephemeral";
  ttl?: "5m" | "1h";
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
  attachments?: BriefAttachment[];
  cacheControl?: CacheControlSettings;
}

export interface ProviderSettings {
  provider: ModelProvider;
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  reasoningMode: ReasoningMode;
  reasoningTokensEnabled?: boolean;
  reasoningTokens?: number;
  mediaResolution?: "low" | "medium" | "high" | "ultra_high";
  imageGeneration: ImageGenConfig;
}

export interface LlmUsageMetrics {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  providerMetrics?: Record<string, unknown>;
}

export interface LlmReasoningTrace {
  summaries?: string[];
  details?: string[];
  raw?: unknown;
}

export interface VerificationResult {
  ok: boolean;
  message?: string;
}

export type HistoryEntryKind = "html" | "rest-mutation" | "rest-query";

export interface HistoryEntry {
  id: string;
  sessionId: string;
  createdAt: string;
  durationMs: number;
  brief: string;
  briefAttachments?: BriefAttachment[];
  request: {
    method: string;
    path: string;
    query: Record<string, unknown>;
    body: Record<string, unknown>;
    instructions?: string;
  };
  response: {
    html: string;
  };
  llm?: {
    provider: ModelProvider;
    model: string;
    maxOutputTokens: number;
    reasoningMode: ReasoningMode;
    reasoningTokens?: number;
  };
  usage?: LlmUsageMetrics;
  reasoning?: LlmReasoningTrace;
  restMutations?: RestMutationRecord[];
  restQueries?: RestQueryRecord[];
  entryKind: HistoryEntryKind;
  rest?: RestHistoryMetadata;
  componentCache?: Record<string, string>;
  styleCache?: Record<string, string>;
  generatedImages?: GeneratedImage[];
  forkInfo?: HistoryForkInfo;
}

export interface GeneratedImage {
  id: string;
  cacheKey: string;
  url: string;
  prompt: string;
  ratio: ImageAspectRatio;
  aspectRatio?: ImageAspectRatio; // Alias for LLM compatibility (some models may hallucinate this name)
  provider: ImageGenProvider;
  modelId: ImageModelId;
  mimeType: string;
  base64?: string;
  blobName?: string;
  createdAt: string;
}

export interface RestHistoryMetadata {
  type: "mutation" | "query";
  request: {
    method: string;
    path: string;
    query: Record<string, unknown>;
    body: Record<string, unknown>;
  };
  response?: unknown;
  rawResponse?: string;
  ok?: boolean;
  error?: string;
}

export interface RestMutationRecord {
  id: string;
  path: string;
  method: string;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
  createdAt: string;
}

export interface RestQueryRecord {
  id: string;
  path: string;
  method: string;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
  createdAt: string;
  ok: boolean;
  response: unknown;
  rawResponse: string;
  error?: string;
}

export interface ProviderSettingsSummary {
  provider: ModelProvider;
  model: string;
  maxOutputTokens: number;
  reasoningMode: ReasoningMode;
  reasoningTokensEnabled?: boolean;
  reasoningTokens?: number;
  mediaResolution?: "low" | "medium" | "high" | "ultra_high";
  apiKeyMask?: string;
  imageGeneration?: ImageGenConfig;
}

export type BranchLabel = "A" | "B";

export interface HistoryForkInfo {
  forkId: string;
  branchId: string;
  label: BranchLabel;
  status: "in-progress" | "chosen" | "discarded";
}

export interface BranchState {
  branchId: string;
  label: BranchLabel;
  instructions: string;
  history: HistoryEntry[];
  rest: {
    mutations: RestMutationRecord[];
    queries: RestQueryRecord[];
  };
  prevHtml: string;
  componentCache: Record<string, string>;
  styleCache: Record<string, string>;
  nextComponentId: number;
  nextStyleId: number;
}

export interface ForkState {
  forkId: string;
  originEntryId: string;
  status: "active" | "resolved";
  branches: Map<string, BranchState>;
  createdAt: number;
}

export interface HistorySnapshot {
  version: 1;
  exportedAt: string;
  brief: string | null;
  briefAttachments: BriefAttachment[];
  history: HistoryEntry[];
  runtime: Pick<
    RuntimeConfig,
    "historyLimit" | "historyMaxBytes" | "includeInstructionPanel"
  >;
  llm: ProviderSettingsSummary;
}

export interface RuntimeConfig {
  port: number;
  host: string;
  historyLimit: number;
  historyMaxBytes: number;
  brief?: string;
  promptPath: string;
  sessionTtlMs: number;
  sessionCap: number;
  includeInstructionPanel: boolean;
  enableStandardLibrary: boolean;
}

export interface ImageGenConfig {
  enabled: boolean;
  provider: ImageGenProvider;
  modelId: ImageModelId;
}

export interface AppConfig {
  runtime: RuntimeConfig;
  provider: ProviderSettings;
  providerReady: boolean;
  providerLocked: boolean;
  providerSelectionRequired: boolean;
  providersWithKeys: ModelProvider[];
}
