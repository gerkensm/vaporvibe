import type { IncomingMessage } from "node:http";
export interface ParsedBody {
    raw: string;
    data: Record<string, unknown>;
    files: ParsedFile[];
}
export interface ParsedFile {
    fieldName: string;
    filename: string;
    mimeType: string;
    size: number;
    data: Buffer;
}
export declare function readBody(req: IncomingMessage): Promise<ParsedBody>;
