import { Buffer } from "node:buffer";
export function selectHistoryForPrompt(history, maxBytes) {
    if (history.length === 0) {
        return { entries: [], bytes: 0 };
    }
    const budget = maxBytes > 0 ? maxBytes : Number.POSITIVE_INFINITY;
    const reversed = [];
    let bytes = 0;
    for (let index = history.length - 1; index >= 0; index -= 1) {
        const entry = history[index];
        const size = estimateHistoryEntrySize(entry);
        if (reversed.length > 0 && bytes + size > budget) {
            break;
        }
        reversed.push(entry);
        bytes += size;
    }
    const entries = reversed.reverse();
    return { entries, bytes };
}
export function estimateHistoryEntrySize(entry) {
    const fragments = [
        entry.brief ?? "",
        entry.request.method,
        entry.request.path,
        JSON.stringify(entry.request.query ?? {}, null, 2),
        JSON.stringify(entry.request.body ?? {}, null, 2),
        entry.request.instructions ?? "",
        entry.response.html ?? "",
    ];
    if (entry.usage) {
        fragments.push(JSON.stringify(entry.usage, null, 2));
    }
    if (entry.briefAttachments?.length) {
        for (const attachment of entry.briefAttachments) {
            fragments.push(attachment.base64);
            fragments.push(attachment.name);
            fragments.push(attachment.mimeType);
        }
    }
    if (entry.reasoning?.summaries?.length) {
        fragments.push(entry.reasoning.summaries.join("\n"));
    }
    if (entry.reasoning?.details?.length) {
        fragments.push(entry.reasoning.details.join("\n"));
    }
    let bytes = 0;
    for (const fragment of fragments) {
        bytes += Buffer.byteLength(fragment, "utf8");
    }
    // Add a cushion for labels and formatting noise in prompts.
    return bytes + 1024;
}
