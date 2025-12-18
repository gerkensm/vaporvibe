import type {
  BriefAttachment,
  HistoryEntry,
  HistorySnapshot,
  ProviderSettings,
  ProviderSettingsSummary,
  RuntimeConfig,
} from "../types.js";
import { maskSensitive } from "./sensitive.js";

const NEWLINE = "\n";

function stringifyForExport(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return JSON.stringify(String(value ?? ""), null, 2);
  }
}

export interface HistoryExportContext {
  history: HistoryEntry[];
  brief: string | null;
  briefAttachments: BriefAttachment[];
  runtime: RuntimeConfig;
  provider: ProviderSettings;
}

export function createHistorySnapshot(context: HistoryExportContext): HistorySnapshot {
  const { history, brief, briefAttachments, runtime, provider } = context;
  const providerSummary: ProviderSettingsSummary = {
    provider: provider.provider,
    model: provider.model,
    maxOutputTokens: provider.maxOutputTokens,
    reasoningMode: provider.reasoningMode,
    reasoningTokensEnabled: provider.reasoningTokensEnabled,
    reasoningTokens: provider.reasoningTokens,
    apiKeyMask: maskSensitive(provider.apiKey),
  };

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    brief,
    briefAttachments: briefAttachments.map((attachment) => ({ ...attachment })),
    history,
    runtime: {
      historyLimit: runtime.historyLimit,
      historyMaxBytes: runtime.historyMaxBytes,
      includeInstructionPanel: runtime.includeInstructionPanel,
      imageGeneration: runtime.imageGeneration,
    },
    llm: providerSummary,
  };
}

export function createPromptMarkdown(context: HistoryExportContext): string {
  const { history, brief, briefAttachments, runtime, provider } = context;
  const lines: string[] = [];

  lines.push("# vaporvibe Session Export");
  lines.push("");
  lines.push("This document captures a snapshot of a vaporvibe development session. It includes the product brief we supplied to the language model, each HTTP request the sourcecodeless server handled, and the full HTML render the LLM produced for that step. Share this file with a vibe coding companion to resume work from the exact same context.");
  lines.push("");
  lines.push("The brief explains the fictional web app we are building. Each subsequent step represents a full-page render triggered by a navigation or form submission. Query and body parameters show how the user steered the flow, while HTML blocks contain the exact UI the model returned.");
  lines.push("");

  lines.push("## App Brief");
  lines.push("```text");
  lines.push(brief ?? "(brief not set yet)");
  lines.push("```");
  lines.push("");

  if (briefAttachments.length > 0) {
    lines.push("## Brief Attachments");
    briefAttachments.forEach((attachment, index) => {
      lines.push(`### Attachment ${index + 1}: ${attachment.name}`);
      lines.push(`- MIME Type: ${attachment.mimeType}`);
      lines.push(`- Size: ${attachment.size} bytes`);
      lines.push("```base64");
      lines.push(attachment.base64);
      lines.push("```");
      lines.push("");
    });
  }

  lines.push("## Runtime Configuration");
  lines.push(`- Provider: ${provider.provider} (${provider.model})`);
  lines.push(`- Max Output Tokens: ${provider.maxOutputTokens}`);
  lines.push(`- Reasoning Mode: ${provider.reasoningMode}`);
  lines.push(`- Reasoning Tokens Budget: ${provider.reasoningTokens ?? "n/a"}`);
  lines.push(`- History Limit (prompt context): ${runtime.historyLimit}`);
  lines.push(`- History Byte Budget: ${runtime.historyMaxBytes}`);
  lines.push(`- Instruction Panel Enabled: ${runtime.includeInstructionPanel ? "yes" : "no"}`);
  lines.push(
    `- Image Generation: ${runtime.imageGeneration.enabled ? "enabled" : "disabled"}`
  );
  lines.push(`- Image Provider: ${runtime.imageGeneration.provider}`);
  lines.push(`- Image Model: ${runtime.imageGeneration.modelId}`);
  lines.push("");

  history.forEach((entry, index) => {
    lines.push(`## Step ${index + 1} – ${entry.request.method} ${entry.request.path}`);
    lines.push(`- Timestamp: ${entry.createdAt}`);
    lines.push(`- Session: ${entry.sessionId}`);
    lines.push(`- Duration: ${entry.durationMs} ms`);
    if (entry.llm) {
      lines.push(`- Reasoning Mode: ${entry.llm.reasoningMode}`);
      lines.push(`- Reasoning Tokens Budget: ${entry.llm.reasoningTokens ?? "n/a"}`);
    } else {
      lines.push("- Reasoning Mode: n/a");
      lines.push("- Reasoning Tokens Budget: n/a");
    }
    if (entry.request.instructions) {
      lines.push(`- Instructions Provided: ${entry.request.instructions}`);
    }
    lines.push(`- Entry Type: ${entry.entryKind}`);
    lines.push("- Query Parameters:");
    lines.push("```json");
    lines.push(JSON.stringify(entry.request.query ?? {}, null, 2));
    lines.push("```");
    lines.push("- Body Parameters:");
    lines.push("```json");
    lines.push(JSON.stringify(entry.request.body ?? {}, null, 2));
    lines.push("```");
    if (entry.entryKind === "html") {
      if (entry.restMutations?.length) {
        lines.push("- REST Mutations:");
        entry.restMutations.forEach((mutation) => {
          lines.push(`  - ${mutation.method} ${mutation.path} @ ${mutation.createdAt}`);
          lines.push("    - Query:");
          lines.push("    ```json");
          lines.push(stringifyForExport(mutation.query ?? {}));
          lines.push("    ```");
          lines.push("    - Body:");
          lines.push("    ```json");
          lines.push(stringifyForExport(mutation.body ?? {}));
          lines.push("    ```");
        });
      }
      if (entry.restQueries?.length) {
        lines.push("- REST Queries:");
        entry.restQueries.forEach((query) => {
          lines.push(`  - ${query.method} ${query.path} @ ${query.createdAt} (${query.ok ? "ok" : "error"})`);
          lines.push("    - Query:");
          lines.push("    ```json");
          lines.push(stringifyForExport(query.query ?? {}));
          lines.push("    ```");
          lines.push("    - Body:");
          lines.push("    ```json");
          lines.push(stringifyForExport(query.body ?? {}));
          lines.push("    ```");
          const responseLabel = query.ok ? "Response" : "Error Response";
          lines.push(`    - ${responseLabel}:`);
          lines.push("    ```json");
          lines.push(stringifyForExport(query.response ?? null));
          lines.push("    ```");
          if (query.error) {
            lines.push(`    - Error Message: ${query.error}`);
          }
        });
      }
    } else if (entry.rest) {
      lines.push("- REST Request:");
      lines.push("```json");
      lines.push(
        stringifyForExport({
          method: entry.rest.request.method,
          path: entry.rest.request.path,
          query: entry.rest.request.query,
          body: entry.rest.request.body,
        })
      );
      lines.push("```");
      if ("response" in entry.rest) {
        lines.push("- REST Response:");
        lines.push("```json");
        lines.push(stringifyForExport(entry.rest.response ?? null));
        lines.push("```");
      }
      if (entry.rest.error) {
        lines.push(`- Error: ${entry.rest.error}`);
      }
    }
    if (entry.briefAttachments?.length) {
      entry.briefAttachments.forEach((attachment, attachmentIndex) => {
        lines.push(
          `- Brief Attachment ${attachmentIndex + 1}: ${attachment.name} (${attachment.mimeType}, ${attachment.size} bytes)`
        );
        lines.push("```base64");
        lines.push(attachment.base64);
        lines.push("```");
      });
    }
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
