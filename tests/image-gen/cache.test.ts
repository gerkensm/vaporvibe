import { describe, it, expect, vi, beforeEach } from "vitest";
import { CachedImageGenClient } from "../../src/image-gen/cache.js";
import type { ImageGenClient, ImageGenOptions, ImageGenResult } from "../../src/image-gen/types.js";

describe("CachedImageGenClient", () => {
    let mockClient: ImageGenClient;
    let cachedClient: CachedImageGenClient;

    beforeEach(() => {
        // Clear the static cache before each test (using a private access hack or just recreating if possible,
        // but since it's static, we might need to rely on different keys or just accept it persists.
        // Actually, for unit tests, we can just use unique prompts to avoid collisions.)

        mockClient = {
            generateImage: vi.fn().mockResolvedValue({
                url: "http://example.com/image.png",
                provider: "mock",
            }),
        };
        cachedClient = new CachedImageGenClient(mockClient);
    });

    it("should call the underlying client on the first request", async () => {
        const options: ImageGenOptions = {
            prompt: "test prompt 1",
            ratio: "1:1",
            apiKey: "key",
            modelId: "gpt-image-1.5",
        };

        const result = await cachedClient.generateImage(options);

        expect(result).toEqual({
            url: "http://example.com/image.png",
            provider: "mock",
        });
        expect(mockClient.generateImage).toHaveBeenCalledTimes(1);
        expect(mockClient.generateImage).toHaveBeenCalledWith(options);
    });

    it("should return cached result on the second request with same options", async () => {
        const options: ImageGenOptions = {
            prompt: "test prompt 2", // Unique prompt to avoid interference from previous test
            ratio: "1:1",
            apiKey: "key",
            modelId: "gpt-image-1.5",
        };

        // First call
        await cachedClient.generateImage(options);
        expect(mockClient.generateImage).toHaveBeenCalledTimes(1);

        // Second call
        const result = await cachedClient.generateImage(options);

        expect(result).toEqual({
            url: "http://example.com/image.png",
            provider: "mock",
        });
        // Should still be called only once
        expect(mockClient.generateImage).toHaveBeenCalledTimes(1);
    });

    it("should distinguish between different prompts", async () => {
        const options1: ImageGenOptions = {
            prompt: "test prompt 3a",
            ratio: "1:1",
            apiKey: "key",
            modelId: "gpt-image-1.5",
        };
        const options2: ImageGenOptions = {
            prompt: "test prompt 3b",
            ratio: "1:1",
            apiKey: "key",
            modelId: "gpt-image-1.5",
        };

        await cachedClient.generateImage(options1);
        await cachedClient.generateImage(options2);

        expect(mockClient.generateImage).toHaveBeenCalledTimes(2);
    });

    it("should distinguish between different ratios", async () => {
        const options1: ImageGenOptions = {
            prompt: "test prompt 4",
            ratio: "1:1",
            apiKey: "key",
            modelId: "gpt-image-1.5",
        };
        const options2: ImageGenOptions = {
            prompt: "test prompt 4",
            ratio: "16:9",
            apiKey: "key",
            modelId: "gpt-image-1.5",
        };

        await cachedClient.generateImage(options1);
        await cachedClient.generateImage(options2);

        expect(mockClient.generateImage).toHaveBeenCalledTimes(2);
    });

    it("should distinguish between different models", async () => {
        const options1: ImageGenOptions = {
            prompt: "test prompt 5",
            ratio: "1:1",
            apiKey: "key",
            modelId: "gpt-image-1.5",
        };
        const options2: ImageGenOptions = {
            prompt: "test prompt 5",
            ratio: "1:1",
            apiKey: "key",
            modelId: "dall-e-3",
        };

        await cachedClient.generateImage(options1);
        await cachedClient.generateImage(options2);

        expect(mockClient.generateImage).toHaveBeenCalledTimes(2);
    });
});
