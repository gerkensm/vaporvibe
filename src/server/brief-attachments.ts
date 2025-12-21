import { randomUUID } from "node:crypto";
import type { BriefAttachment } from "../types.js";
import type { ParsedFile } from "../utils/body.js";

export interface ProcessedBriefAttachments {
  accepted: BriefAttachment[];
  rejected: Array<{ filename: string; mimeType: string }>;
}

export function isSupportedBriefAttachmentMime(mimeType: string): boolean {
  if (!mimeType) {
    return false;
  }
  if (mimeType.startsWith("image/")) {
    return true;
  }
  return mimeType === "application/pdf";
}

export function processBriefAttachmentFiles(
  files: ParsedFile[],
): ProcessedBriefAttachments {
  const accepted: BriefAttachment[] = [];
  const rejected: Array<{ filename: string; mimeType: string }> = [];

  for (const file of files) {
    const mimeType = (file.mimeType || "application/octet-stream").toLowerCase();
    const name = file.filename || "attachment";
    if (!isSupportedBriefAttachmentMime(mimeType)) {
      rejected.push({ filename: name, mimeType });
      continue;
    }
    if (!file.size || !file.data) {
      rejected.push({ filename: name, mimeType });
      continue;
    }
    accepted.push({
      id: randomUUID(),
      name,
      mimeType,
      size: file.size,
      base64: file.data.toString("base64"),
    });
  }

  return { accepted, rejected };
}

export function cloneAttachment(attachment: BriefAttachment): BriefAttachment {
  return { ...attachment };
}
