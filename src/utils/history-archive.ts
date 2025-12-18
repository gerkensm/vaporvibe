import JSZip from "jszip";
import type {
  BriefAttachment,
  GeneratedImage,
  HistoryEntry,
  HistorySnapshot,
} from "../types.js";
import { createHistorySnapshot } from "./history-export.js";

export interface HistoryArchive {
  snapshot: HistorySnapshot;
  assets: Map<string, Buffer>;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function getImageExtension(mimeType: string | undefined): string {
  if (mimeType?.includes("jpeg") || mimeType?.includes("jpg")) {
    return "jpg";
  }
  if (mimeType?.includes("webp")) {
    return "webp";
  }
  if (mimeType?.includes("gif")) {
    return "gif";
  }
  return "png";
}

function cloneHistoryForArchive(snapshot: HistorySnapshot): HistoryArchive {
  const assets = new Map<string, Buffer>();

  const briefAttachments = snapshot.briefAttachments.map((attachment) => {
    const blobName = attachment.blobName
      || `attachments/${sanitizeFileName(attachment.name) || attachment.id}`;
    if (attachment.base64) {
      assets.set(blobName, Buffer.from(attachment.base64, "base64"));
    }
    const { base64, ...rest } = attachment;
    return { ...rest, blobName } satisfies BriefAttachment;
  });

  const history: HistoryEntry[] = snapshot.history.map((entry) => {
    if (!entry.generatedImages?.length) {
      return { ...entry };
    }
    const generatedImages: GeneratedImage[] = entry.generatedImages.map(
      (image, index) => {
        const blobName =
          image.blobName ||
          `images/${sanitizeFileName(image.cacheKey || `${index}`)}.${getImageExtension(image.mimeType)}`;
        if (image.base64) {
          assets.set(blobName, Buffer.from(image.base64, "base64"));
        }
        const { base64, ...rest } = image;
        return { ...rest, blobName } satisfies GeneratedImage;
      },
    );
    return { ...entry, generatedImages };
  });

  return {
    snapshot: {
      ...snapshot,
      briefAttachments,
      history,
    },
    assets,
  };
}

export async function createHistoryArchiveZip(
  snapshot: HistorySnapshot,
): Promise<Buffer> {
  const { snapshot: normalizedSnapshot, assets } = cloneHistoryForArchive(snapshot);
  const zip = new JSZip();

  zip.file("history.json", JSON.stringify(normalizedSnapshot, null, 2));

  for (const [name, buffer] of assets) {
    zip.file(name, buffer);
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
