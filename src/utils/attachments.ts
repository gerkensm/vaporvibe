import type { BriefAttachment } from "../types.js";

export function cloneAttachments(
  attachments: BriefAttachment[]
): BriefAttachment[] {
  return attachments.map((attachment) => ({ ...attachment }));
}
