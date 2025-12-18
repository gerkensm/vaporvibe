import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleImageGenClient } from "../../../src/image-gen/providers/google.js";
import type { ImageGenOptions } from "../../../src/image-gen/types.js";

// Mock the Google GenAI SDK
const mockGenerateContent = vi.fn();
const mockGenerateImages = vi.fn();

vi.mock("@google/genai", () => {
    return {
        GoogleGenAI: class GoogleGenAI {
            models = {
                generateContent: mockGenerateContent,
                generateImages: mockGenerateImages,
            };
            constructor(options: any) {
                // verify options if needed
            }
        },
    };
});

describe("GoogleImageGenClient", () => {
    let client: GoogleImageGenClient;

    beforeEach(() => {
        client = new GoogleImageGenClient();
        mockGenerateContent.mockReset();
        mockGenerateImages.mockReset();
    });

    describe("Gemini Models (generateContent)", () => {
        it("should use generateContent for gemini models", async () => {
            const options: ImageGenOptions = {
                prompt: "test prompt",
                ratio: "1:1",
                apiKey: "test-key",
                modelId: "gemini-2.5-flash-image",
            };

            mockGenerateContent.mockResolvedValue({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    inlineData: {
                                        data: "base64data",
                                        mimeType: "image/png",
                                    },
                                },
                            ],
                        },
                    },
                ],
            });

            const result = await client.generateImage(options);

            expect(mockGenerateContent).toHaveBeenCalledWith({
                model: "gemini-2.5-flash-image",
                contents: [
                    {
                        role: "user",
                        parts: [{ text: "test prompt" }],
                    },
                ],
            });

            expect(result).toEqual({
                url: "data:image/png;base64,base64data",
                provider: "gemini",
                originalPrompt: "test prompt",
            });
        });

        it("should throw error if no candidates returned", async () => {
            const options: ImageGenOptions = {
                prompt: "test prompt",
                ratio: "1:1",
                apiKey: "test-key",
                modelId: "gemini-2.5-flash-image",
            };

            mockGenerateContent.mockResolvedValue({
                candidates: [],
            });

            await expect(client.generateImage(options)).rejects.toThrow(
                "No candidates in response"
            );
        });
    });

    describe("Imagen Models (generateImages)", () => {
        it("should use generateImages for imagen models", async () => {
            const options: ImageGenOptions = {
                prompt: "test prompt",
                ratio: "16:9",
                apiKey: "test-key",
                modelId: "imagen-3.0-generate-002",
            };

            mockGenerateImages.mockResolvedValue({
                generatedImages: [
                    {
                        image: {
                            imageBytes: "base64data",
                            mimeType: "image/jpeg",
                        },
                    },
                ],
            });

            const result = await client.generateImage(options);

            expect(mockGenerateImages).toHaveBeenCalledWith({
                model: "imagen-3.0-generate-002",
                prompt: "test prompt",
                config: {
                    numberOfImages: 1,
                    aspectRatio: "16:9",
                },
            });

            expect(result).toEqual({
                url: "data:image/jpeg;base64,base64data",
                provider: "gemini",
                originalPrompt: "test prompt",
            });
        });

        it("should handle GCS URI response", async () => {
            const options: ImageGenOptions = {
                prompt: "test prompt",
                ratio: "1:1",
                apiKey: "test-key",
                modelId: "imagen-3.0-generate-002",
            };

            mockGenerateImages.mockResolvedValue({
                generatedImages: [
                    {
                        image: {
                            gcsUri: "gs://bucket/image.png",
                        },
                    },
                ],
            });

            const result = await client.generateImage(options);

            expect(result.url).toBe("gs://bucket/image.png");
        });

        it("should throw error if no image generated", async () => {
            const options: ImageGenOptions = {
                prompt: "test prompt",
                ratio: "1:1",
                apiKey: "test-key",
                modelId: "imagen-3.0-generate-002",
            };

            mockGenerateImages.mockResolvedValue({
                generatedImages: [],
            });

            await expect(client.generateImage(options)).rejects.toThrow(
                "No image generated"
            );
        });
    });
});
