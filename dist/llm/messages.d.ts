import type { ChatMessage } from "../types.js";
export interface MessageContext {
    brief: string;
    method: string;
    path: string;
    query: Record<string, unknown>;
    body: Record<string, unknown>;
    prevHtml: string;
    timestamp: Date;
    includeInstructionPanel: boolean;
}
export declare function buildMessages(context: MessageContext): ChatMessage[];
