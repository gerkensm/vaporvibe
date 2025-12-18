import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAiImageGenClient } from "../../../src/image-gen/providers/openai.js";
import type { ImageGenOptions } from "../../../src/image-gen/types.js";

// Mock the OpenAI SDK
const mockGenerate = vi.fn();
vi.mock("openai", () => {
    return {
        default: class OpenAI {
            images = {
                generate: mockGenerate,
            };
            constructor(options: any) {
                // verify options if needed
            }
        },
    };
});

describe("OpenAiImageGenClient", () => {
    let client: OpenAiImageGenClient;

    beforeEach(() => {
        client = new OpenAiImageGenClient();
        mockGenerate.mockReset();
    });

    it("should generate an image using the default model and size mapping", async () => {
        const options: ImageGenOptions = {
            prompt: "test prompt",
            ratio: "1:1",
            apiKey: "test-key",
        };

        mockGenerate.mockResolvedValue({
            data: [{ url: "http://example.com/image.png" }],
        });

        const result = await client.generateImage(options);

        expect(mockGenerate).toHaveBeenCalledWith({
            model: "gpt-image-1.5", // Default model
            prompt: "test prompt",
            size: "1024x1024", // Default for 1:1
            n: 1,
        });

        expect(result).toEqual({
            url: "http://example.com/image.png",
            provider: "openai",
            originalPrompt: "test prompt",
        });
    });

    it("should use specific model and corresponding size mapping (dall-e-3)", async () => {
        const options: ImageGenOptions = {
            prompt: "test prompt",
            ratio: "16:9",
            apiKey: "test-key",
            modelId: "dall-e-3",
        };

        mockGenerate.mockResolvedValue({
            data: [{ url: "http://example.com/dalle3.png" }],
        });

        await client.generateImage(options);

        expect(mockGenerate).toHaveBeenCalledWith({
            model: "dall-e-3",
            prompt: "test prompt",
            size: "1792x1024", // Specific size for 16:9 in DALL-E 3
            n: 1,
        });
    });

    it("should handle base64 JSON response", async () => {
        const options: ImageGenOptions = {
            prompt: "test prompt",
            ratio: "1:1",
            apiKey: "test-key",
        };

        mockGenerate.mockResolvedValue({
            data: [{ b64_json: "base64data" }],
        });

        const result = await client.generateImage(options);

        expect(result.url).toBe("data:image/png;base64,base64data");
    });

    it("should throw error if no image returned", async () => {
        const options: ImageGenOptions = {
            prompt: "test prompt",
            ratio: "1:1",
            apiKey: "test-key",
        };

        mockGenerate.mockResolvedValue({
            data: [],
        });

        await expect(client.generateImage(options)).rejects.toThrow(
            "OpenAI image generation did not return an image URL or base64 data"
        );
    });
});
