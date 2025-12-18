import { logger } from "../logger.js";
import type { ImageGenClient, ImageGenOptions, ImageGenResult } from "./types.js";

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
        // We include the modelId, ratio, and prompt in the cache key.
        // The apiKey is NOT included because we want to share results even if the key changes slightly
        // (though usually it won't), but more importantly, we don't want to leak keys in logs if we ever log keys.
        // Also, if the user switches keys but requests the same image, we can still serve the cached one.
        return `${options.modelId || "default"}:${options.ratio}:${options.prompt.trim()}`;
    }
}
