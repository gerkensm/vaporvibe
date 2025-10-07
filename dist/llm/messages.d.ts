import type { ChatMessage, HistoryEntry } from "../types.js";
export interface MessageContext {
    brief: string;
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
}
export declare function buildMessages(context: MessageContext): ChatMessage[];
