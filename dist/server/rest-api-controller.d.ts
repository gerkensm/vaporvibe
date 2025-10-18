import type { Logger } from "pino";
import type { LlmClient } from "../llm/client.js";
import type { BriefAttachment, RuntimeConfig } from "../types.js";
import type { RequestContext } from "./server.js";
import { SessionStore } from "./session-store.js";
interface RestEnvironmentSnapshot {
    brief: string | null;
    briefAttachments: BriefAttachment[];
    runtime: RuntimeConfig;
    llmClient: LlmClient | null;
    providerReady: boolean;
    providerSelectionRequired: boolean;
}
interface RestApiControllerOptions {
    sessionStore: SessionStore;
    adminPath: string;
    getEnvironment(): RestEnvironmentSnapshot;
}
export declare class RestApiController {
    private readonly sessionStore;
    private readonly adminPath;
    private readonly getEnvironment;
    constructor(options: RestApiControllerOptions);
    handle(context: RequestContext, reqLogger: Logger): Promise<boolean>;
    private handleMutation;
    private handleQuery;
    private preparePromptContext;
}
export {};
