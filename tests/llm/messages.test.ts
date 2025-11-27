import { describe, expect, it } from "vitest";

import { buildMessages } from "../../src/llm/messages.js";
import type { MessageContext } from "../../src/llm/messages.js";
import { createAttachment, createHistoryEntry } from "../test-utils/factories.js";

function createContext(overrides: Partial<MessageContext> = {}): MessageContext {
  const history = overrides.history ?? [createHistoryEntry()];
  return {
    brief: overrides.brief ?? "Build a productivity dashboard.",
    briefAttachments: overrides.briefAttachments ?? [createAttachment()],
    omittedAttachmentCount: overrides.omittedAttachmentCount ?? 0,
    method: overrides.method ?? "GET",
    path: overrides.path ?? "/",
    query: overrides.query ?? { view: "home" },
    body: overrides.body ?? {},
    prevHtml:
      overrides.prevHtml ??
      "<html><body><div data-id=\"example\">Previous</div></body></html>",
    timestamp: overrides.timestamp ?? new Date("2024-01-01T00:00:00Z"),
    includeInstructionPanel:
      overrides.includeInstructionPanel ?? true,
    history,
    historyTotal: overrides.historyTotal ?? history.length,
    historyLimit: overrides.historyLimit ?? 10,
    historyMaxBytes: overrides.historyMaxBytes ?? 16,
    historyBytesUsed: overrides.historyBytesUsed ?? 128,
    historyLimitOmitted: overrides.historyLimitOmitted ?? 0,
    historyByteOmitted: overrides.historyByteOmitted ?? 0,
    adminPath: overrides.adminPath ?? "/vaporvibe",
    mode: overrides.mode,
  };
}

describe("buildMessages", () => {
  it("constructs system, stable, history, and dynamic messages for page mode", () => {
    const context = createContext({ historyMaxBytes: 32 });

    const messages = buildMessages(context);

    expect(messages).toHaveLength(3 + context.history.length);
    const [system, stable, historyMessage, dynamic] = messages;

    expect(system.role).toBe("system");
    expect(system.content).toContain("SYSTEM — Single-View HTML Application Generator");

    expect(stable.role).toBe("user");
    expect(stable.attachments).toHaveLength(1);
    expect(stable.content).toContain("App Brief:");
    expect(stable.content).toContain("Brief Attachments:");

    expect(historyMessage.content).toContain("History Entry 1");
    expect(historyMessage.cacheControl).toEqual({ type: "ephemeral" });

    expect(dynamic.content).toContain("Current Request:");
    expect(dynamic.content).toContain("Previous HTML");
    expect(dynamic.content).toContain("-----BEGIN PREVIOUS HTML-----");
    expect(dynamic.content).toContain(context.prevHtml.slice(0, 32));
  });

  it("switches to JSON instructions when mode is json-query", () => {
    const context = createContext({
      mode: "json-query",
      history: [],
      historyTotal: 0,
    });

    const messages = buildMessages(context);

    expect(messages[0].content).toContain("You are a JSON data generator");
    expect(messages[1].content).toContain("Remember:");
    expect(messages.at(-1)?.content).toContain("Body Params (URL-decoded JSON)");
  });

  it("summarises omitted attachments", () => {
    const context = createContext({
      omittedAttachmentCount: 2,
      briefAttachments: [createAttachment({ name: "Primary" })],
    });

    const [, stable] = buildMessages(context);
    expect(stable.content).toContain("2 additional attachments");
  });
});
