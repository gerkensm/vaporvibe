import type { BriefAttachment, ChatMessage, HistoryEntry, RestMutationRecord, RestQueryRecord } from "../types.js";
export interface MessageContext {
    brief: string;
    briefAttachments: BriefAttachment[];
    omittedAttachmentCount: number;
    method: string;
    path: string;
    query: Record<string, unknown>;
    body: Record<string, unknown>;
    prevHtml: string;
    timestamp: Date;
    includeInstructionPanel: boolean;
    history: HistoryEntry[];
    historyTotal: number;
    historyLimit: number;
    historyMaxBytes: number;
    historyBytesUsed: number;
    historyLimitOmitted: number;
    historyByteOmitted: number;
    adminPath: string;
    restMutations: RestMutationRecord[];
    restQueries: RestQueryRecord[];
    mode?: "page" | "json-query";
}
export declare function buildMessages(context: MessageContext): ChatMessage[];
