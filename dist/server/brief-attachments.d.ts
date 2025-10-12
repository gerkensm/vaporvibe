import type { BriefAttachment } from "../types.js";
import type { ParsedFile } from "../utils/body.js";
export interface ProcessedBriefAttachments {
    accepted: BriefAttachment[];
    rejected: Array<{
        filename: string;
        mimeType: string;
    }>;
}
export declare function isSupportedBriefAttachmentMime(mimeType: string): boolean;
export declare function processBriefAttachmentFiles(files: ParsedFile[]): ProcessedBriefAttachments;
