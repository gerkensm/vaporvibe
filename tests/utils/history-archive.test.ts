import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { createHistorySnapshot } from "../../src/utils/history-export.js";
import { createHistoryArchiveZip } from "../../src/utils/history-archive.js";
import type {
  BriefAttachment,
  GeneratedImage,
  HistoryEntry,
  ProviderSettings,
  RuntimeConfig,
} from "../../src/types.js";

describe("createHistoryArchiveZip", () => {
  const runtime: RuntimeConfig = {
    port: 3000,
    host: "localhost",
    historyLimit: 10,
    historyMaxBytes: 1024 * 1024,
    promptPath: "./prompts",
    sessionTtlMs: 60_000,
    sessionCap: 10,
    includeInstructionPanel: true,
  };

  const provider: ProviderSettings = {
    provider: "openai",
    apiKey: "sk-test",
    model: "gpt-4o",
    maxOutputTokens: 1000,
    reasoningMode: "none",
    imageGeneration: {
      enabled: true,
      provider: "openai",
      modelId: "gpt-image-1.5",
    },
  };

  const attachmentBase64 = Buffer.from("attachment-body").toString("base64");
  const imageBase64 = Buffer.from("image-body").toString("base64");

  const attachments: BriefAttachment[] = [
    {
      id: "att-1",
      name: "brief doc.txt",
      mimeType: "text/plain",
      size: attachmentBase64.length,
      base64: attachmentBase64,
    },
  ];

  const generatedImages: GeneratedImage[] = [
    {
      id: "img-1",
      cacheKey: "image-cache-key",
      url: "",
      prompt: "render a scene",
      ratio: "1:1",
      provider: "openai",
      modelId: "gpt-image-1.5",
      mimeType: "image/png",
      base64: imageBase64,
      createdAt: new Date().toISOString(),
    },
  ];

  const history: HistoryEntry[] = [
    {
      id: "entry-1",
      sessionId: "session-1",
      createdAt: new Date().toISOString(),
      durationMs: 1234,
      brief: "A sample brief",
      briefAttachments: attachments,
      request: {
        method: "GET",
        path: "/",
        query: {},
        body: {},
      },
      response: { html: "<div>Hello</div>" },
      entryKind: "html",
      generatedImages,
    },
  ];

  it("stores binary assets in the archive and strips base64 from the manifest", async () => {
    const snapshot = createHistorySnapshot({
      history,
      brief: "A sample brief",
      briefAttachments: attachments,
      runtime,
      provider,
    });

    const zipBuffer = await createHistoryArchiveZip(snapshot);
    const zip = await JSZip.loadAsync(zipBuffer);
    const manifestContent = await zip.file("history.json")?.async("string");

    expect(manifestContent).toBeTruthy();
    const manifest = JSON.parse(manifestContent ?? "{}");

    expect(manifest.briefAttachments[0].base64).toBeUndefined();
    expect(manifest.briefAttachments[0].blobName).toBe("attachments/brief-doc.txt");

    const attachmentFile = zip.file("attachments/brief-doc.txt");
    const attachmentBuffer = await attachmentFile?.async("nodebuffer");
    expect(Buffer.from(attachmentBuffer ?? "").toString("base64")).toBe(
      attachmentBase64,
    );

    const imageFile = zip.file("images/image-cache-key.png");
    const imageBuffer = await imageFile?.async("nodebuffer");
    expect(Buffer.from(imageBuffer ?? "").toString("base64")).toBe(imageBase64);

    const manifestImage = manifest.history[0].generatedImages[0];
    expect(manifestImage.base64).toBeUndefined();
    expect(manifestImage.blobName).toBe("images/image-cache-key.png");
  });
});
