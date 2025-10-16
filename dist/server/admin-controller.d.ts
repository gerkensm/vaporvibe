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
    private handleApi;
    private computeProviderKeyStatuses;
    private buildAdminStateResponse;
    private buildAdminHistoryResponse;
    private handleHistoryJson;
    private handlePromptMarkdown;
    private respondJson;
    private handleHistoryResource;
    private applyProviderUpdate;
    private handleProviderUpdate;
    private applyRuntimeUpdate;
    private handleRuntimeUpdate;
    private applyBriefUpdate;
    private handleBriefUpdate;
    private handleHistoryImport;
    private importHistorySnapshot;
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
