import type { IncomingMessage } from "node:http";
export interface ParsedBody {
    raw: string;
    data: Record<string, unknown>;
}
export declare function readBody(req: IncomingMessage): Promise<ParsedBody>;
