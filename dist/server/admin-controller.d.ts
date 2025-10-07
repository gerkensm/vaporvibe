import type { Logger } from "pino";
import type { MutableServerState, RequestContext } from "./server.js";
import { SessionStore } from "./session-store.js";
interface AdminControllerOptions {
    state: MutableServerState;
    sessionStore: SessionStore;
}
export declare class AdminController {
    private readonly state;
    private readonly sessionStore;
    private readonly providerKeyMemory;
    constructor(options: AdminControllerOptions);
    handle(context: RequestContext, _requestStart: number, reqLogger: Logger): Promise<boolean>;
    private renderDashboard;
    private handleHistoryJson;
    private handlePromptMarkdown;
    private handleHistoryResource;
    private handleProviderUpdate;
    private handleRuntimeUpdate;
    private handleBriefUpdate;
    private handleHistoryImport;
    private handleHistoryLatest;
    private getSortedHistoryEntries;
    private redirectWithMessage;
    private redirect;
    private respondNotFound;
    private applyProviderEnv;
    private toAdminHistoryItem;
}
export {};
