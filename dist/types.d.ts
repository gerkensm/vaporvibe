export type ModelProvider = "openai" | "gemini" | "anthropic";
export type ReasoningMode = "none" | "low" | "medium" | "high";
export interface ChatMessage {
    role: "system" | "user";
    content: string;
}
export interface ProviderSettings {
    provider: ModelProvider;
    apiKey: string;
    model: string;
    maxOutputTokens: number;
    reasoningMode: ReasoningMode;
    reasoningTokens?: number;
}
export interface RuntimeConfig {
    port: number;
    brief?: string;
    promptPath: string;
    sessionTtlMs: number;
    sessionCap: number;
    includeInstructionPanel: boolean;
}
export interface AppConfig {
    runtime: RuntimeConfig;
    provider: ProviderSettings;
}
