import { randomUUID } from "node:crypto";
export function isSupportedBriefAttachmentMime(mimeType) {
    if (!mimeType) {
        return false;
    }
    if (mimeType.startsWith("image/")) {
        return true;
    }
    return mimeType === "application/pdf";
}
export function processBriefAttachmentFiles(files) {
    const accepted = [];
    const rejected = [];
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
