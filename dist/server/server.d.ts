import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import type { RuntimeConfig, ProviderSettings } from "../types.js";
import type { LlmClient } from "../llm/client.js";
import { SessionStore } from "./session-store.js";
export interface ServerOptions {
    runtime: RuntimeConfig;
    provider: ProviderSettings;
    providerLocked: boolean;
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
    runtime: RuntimeConfig;
    provider: ProviderSettings;
    llmClient: LlmClient | null;
    providerReady: boolean;
    providerLocked: boolean;
}
export declare function createServer(options: ServerOptions): http.Server;
