import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { logger } from "../logger.js";
import type { ImageGenClient, ImageGenOptions, ImageGenResult } from "./types.js";
import type {
  ImageAspectRatio,
  ImageGenProvider,
  ImageModelId,
} from "../types.js";
import { GENERATED_IMAGES_DIR, getGeneratedImagePath } from "./paths.js";

export class CachedImageGenClient implements ImageGenClient {
  private static cache = new Map<string, ImageGenResult>();
  private readonly client: ImageGenClient;

  constructor(client: ImageGenClient) {
    this.client = client;
  }

  async generateImage(options: ImageGenOptions): Promise<ImageGenResult> {
    const key = this.getCacheKey(options);
    const cached = CachedImageGenClient.cache.get(key);

    if (cached) {
      logger.debug({ key }, "Image generation cache hit");
      return cached;
    }

    logger.debug({ key }, "Image generation cache miss");
    const result = await this.client.generateImage(options);
    CachedImageGenClient.cache.set(key, result);
    return result;
  }

  private getCacheKey(options: ImageGenOptions): string {
    const inputHash =
      options.inputHash ??
      (options.inputImages && options.inputImages.length > 0
        ? createHash("sha256")
          .update(
            options.inputImages
              .map((img) => `${img.mimeType}:${img.base64.slice(0, 2048)}`)
              .join("|")
          )
          .digest("hex")
        : "");
    return `${options.modelId || "default"}:${options.ratio}:${options.prompt.trim()}:${inputHash}`;
  }
}

export function buildImageCacheKey(options: {
  provider: ImageGenProvider;
  modelId: ImageModelId;
  prompt: string;
  ratio: ImageAspectRatio;
  inputHash?: string;
}): string {
  const { provider, modelId, prompt, ratio, inputHash } = options;
  return createHash("sha256")
    .update(`${provider}:${modelId}:${prompt}:${ratio}:${inputHash ?? ""}`)
    .digest("hex");
}

export async function ensureImageCacheDir(): Promise<void> {
  await mkdir(GENERATED_IMAGES_DIR, { recursive: true });
}

export async function writeImageCache(
  cacheKey: string,
  base64: string
): Promise<{ filePath: string; route: string }> {
  await ensureImageCacheDir();
  const { filePath, route } = getGeneratedImagePath(cacheKey);
  if (!existsSync(filePath)) {
    await writeFile(filePath, Buffer.from(base64, "base64"));
  }
  return { filePath, route };
}

export async function readImageCacheBase64(
  cacheKey: string
): Promise<{ base64: string; filePath: string; route: string }> {
  await ensureImageCacheDir();
  const { filePath, route } = getGeneratedImagePath(cacheKey);
  const buffer = await readFile(filePath);
  return { base64: buffer.toString("base64"), filePath, route };
}
