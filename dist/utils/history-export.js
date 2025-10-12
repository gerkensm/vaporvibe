import { maskSensitive } from "./sensitive.js";
import { cloneAttachments } from "./attachments.js";
const NEWLINE = "\n";
export function createHistorySnapshot(context) {
    const { history, brief, briefAttachments, runtime, provider } = context;
    const providerSummary = {
        provider: provider.provider,
        model: provider.model,
        maxOutputTokens: provider.maxOutputTokens,
        reasoningMode: provider.reasoningMode,
        reasoningTokens: provider.reasoningTokens,
        apiKeyMask: maskSensitive(provider.apiKey),
    };
    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        brief,
        briefAttachments: briefAttachments && briefAttachments.length > 0
            ? cloneAttachments(briefAttachments)
            : [],
        history,
        runtime: {
            historyLimit: runtime.historyLimit,
            historyMaxBytes: runtime.historyMaxBytes,
            includeInstructionPanel: runtime.includeInstructionPanel,
        },
        llm: providerSummary,
    };
}
export function createPromptMarkdown(context) {
    const { history, brief, briefAttachments, runtime, provider } = context;
    const lines = [];
    lines.push("# serve-llm Session Export");
    lines.push("");
    lines.push("This document captures a snapshot of a serve-llm development session. It includes the product brief we supplied to the language model, each HTTP request the sourcecodeless server handled, and the full HTML render the LLM produced for that step. Share this file with a vibe coding companion to resume work from the exact same context.");
    lines.push("");
    lines.push("The brief explains the fictional web app we are building. Each subsequent step represents a full-page render triggered by a navigation or form submission. Query and body parameters show how the user steered the flow, while HTML blocks contain the exact UI the model returned.");
    lines.push("");
    lines.push("## App Brief");
    lines.push("```text");
    lines.push(brief ?? "(brief not set yet)");
    lines.push("```");
    lines.push("");
    if (briefAttachments && briefAttachments.length > 0) {
        lines.push("## Brief Attachments");
        briefAttachments.forEach((attachment, index) => {
            lines.push(`${index + 1}. ${attachment.name} (${attachment.mimeType}, ${formatBytes(attachment.size ?? 0)})`);
        });
        lines.push("");
    }
    lines.push("## Runtime Configuration");
    lines.push(`- Provider: ${provider.provider} (${provider.model})`);
    lines.push(`- Max Output Tokens: ${provider.maxOutputTokens}`);
    lines.push(`- Reasoning Mode: ${provider.reasoningMode}`);
    lines.push(`- Reasoning Tokens Budget: ${provider.reasoningTokens ?? "n/a"}`);
    lines.push(`- History Limit (prompt context): ${runtime.historyLimit}`);
    lines.push(`- History Byte Budget: ${runtime.historyMaxBytes}`);
    lines.push(`- Instruction Panel Enabled: ${runtime.includeInstructionPanel ? "yes" : "no"}`);
    lines.push("");
    history.forEach((entry, index) => {
        lines.push(`## Step ${index + 1} – ${entry.request.method} ${entry.request.path}`);
        lines.push(`- Timestamp: ${entry.createdAt}`);
        lines.push(`- Session: ${entry.sessionId}`);
        lines.push(`- Duration: ${entry.durationMs} ms`);
        lines.push(`- Reasoning Mode: ${entry.llm.reasoningMode}`);
        lines.push(`- Reasoning Tokens Budget: ${entry.llm.reasoningTokens ?? "n/a"}`);
        if (entry.request.instructions) {
            lines.push(`- Instructions Provided: ${entry.request.instructions}`);
        }
        if (entry.attachments?.length) {
            lines.push("- Attachments:");
            lines.push("```text");
            entry.attachments.forEach((attachment, attachmentIndex) => {
                lines.push(`${attachmentIndex + 1}. ${attachment.name} (${attachment.mimeType}, ${formatBytes(attachment.size ?? 0)})`);
            });
            lines.push("```");
        }
        lines.push("- Query Parameters:");
        lines.push("```json");
        lines.push(JSON.stringify(entry.request.query ?? {}, null, 2));
        lines.push("```");
        lines.push("- Body Parameters:");
        lines.push("```json");
        lines.push(JSON.stringify(entry.request.body ?? {}, null, 2));
        lines.push("```");
        lines.push("- Generated HTML:");
        lines.push("```html");
        lines.push(entry.response.html);
        lines.push("```");
        lines.push("");
    });
    if (history.length === 0) {
        lines.push("## History");
        lines.push("No pages have been generated yet.");
        lines.push("");
    }
    return lines.join(NEWLINE);
}
function formatBytes(size) {
    if (!Number.isFinite(size) || size <= 0) {
        return "0 B";
    }
    const units = ["B", "KB", "MB", "GB"];
    let value = size;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
    return `${value.toFixed(precision)} ${units[unitIndex]}`;
}
