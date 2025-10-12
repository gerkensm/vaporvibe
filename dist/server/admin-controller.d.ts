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
    private readonly credentialStore;
    constructor(options: AdminControllerOptions);
    handle(context: RequestContext, _requestStart: number, reqLogger: Logger): Promise<boolean>;
    private renderDashboard;
    private computeProviderKeyStatuses;
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
    private toAdminBriefAttachment;
    private applyProviderEnv;
    private isKeyFromEnvironment;
    private toAdminHistoryItem;
}
export {};
