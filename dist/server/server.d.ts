import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import type { BriefAttachment, RuntimeConfig, ProviderSettings, ModelProvider } from "../types.js";
import type { LlmClient } from "../llm/client.js";
import { SessionStore } from "./session-store.js";
export interface ServerOptions {
    runtime: RuntimeConfig;
    provider: ProviderSettings;
    providerLocked: boolean;
    providerSelectionRequired: boolean;
    providersWithKeys: ModelProvider[];
    llmClient: LlmClient | null;
    sessionStore: SessionStore;
}
export interface RequestContext {
    req: IncomingMessage;
    res: ServerResponse;
    url: URL;
    method: string;
    path: string;
}
export interface MutableServerState {
    brief: string | null;
    briefAttachments: BriefAttachment[];
    runtime: RuntimeConfig;
    provider: ProviderSettings;
    llmClient: LlmClient | null;
    providerReady: boolean;
    providerLocked: boolean;
    providerSelectionRequired: boolean;
    providersWithKeys: Set<ModelProvider>;
    verifiedProviders: Partial<Record<ModelProvider, boolean>>;
    pendingHtml: Map<string, PendingHtmlEntry>;
}
interface PendingHtmlEntry {
    html: string;
    expiresAt: number;
}
export declare function createServer(options: ServerOptions): http.Server;
export {};
