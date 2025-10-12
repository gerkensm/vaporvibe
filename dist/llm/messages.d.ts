import type { BriefAttachment, ChatMessage, HistoryEntry } from "../types.js";
export interface MessageContext {
    brief: string;
    briefAttachments: BriefAttachment[];
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
    attachmentsEnabled: boolean;
}
export declare function buildMessages(context: MessageContext): ChatMessage[];
