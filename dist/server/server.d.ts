import http from "node:http";
import type { RuntimeConfig } from "../types.js";
import type { LlmClient } from "../llm/client.js";
import { SessionStore } from "./session-store.js";
export interface ServerOptions {
    runtime: RuntimeConfig;
    llmClient: LlmClient;
    sessionStore: SessionStore;
}
export declare function createServer(options: ServerOptions): http.Server;
