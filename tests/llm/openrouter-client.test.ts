import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenRouterClient, verifyOpenRouterApiKey } from "../../src/llm/openrouter-client.js";
import { logger } from "../../src/logger.js";

// Hoist mocks to be accessible inside vi.mock
const mocks = vi.hoisted(() => {
    const mockSend = vi.fn();
    const mockGetCurrentKeyMetadata = vi.fn();
    const mockGetOpenRouterModelRaw = vi.fn();

    // Use a real class for the mock to ensure it is constructable
    class MockOpenRouter {
        chat = { send: mockSend };
        apiKeys = { getCurrentKeyMetadata: mockGetCurrentKeyMetadata };
        constructor() { }
    }

    return {
        mockSend,
        mockGetCurrentKeyMetadata,
        mockGetOpenRouterModelRaw,
        MockOpenRouter,
    };
});

// Mock the Logger
vi.mock("../../src/logger.js", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock the OpenRouter SDK
vi.mock("@openrouter/sdk", () => ({
    OpenRouter: mocks.MockOpenRouter,
}));

// Mock OpenRouter models module
vi.mock("../../src/llm/openrouter-models.js", () => ({
    getOpenRouterModelRaw: mocks.mockGetOpenRouterModelRaw,
}));

describe("OpenRouterClient", () => {
    let client: OpenRouterClient;

    const mockSettings = {
        provider: "openrouter" as const,
        apiKey: "test-key",
        model: "openai/gpt-4o",
        reasoningMode: "none" as const,
        maxOutputTokens: 1000,
        imageGeneration: {
            enabled: false,
            provider: "openai" as const,
            model: "dall-e-3",
            modelId: "dall-e-3" as const,
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset our specific mocks
        mocks.mockSend.mockReset();
        mocks.mockGetCurrentKeyMetadata.mockReset();
        mocks.mockGetOpenRouterModelRaw.mockReset();

        // Note: We cannot easily checktoHaveBeenCalledWith on a real class constructor
        // without wrapping it in a spy, but for this test checking instance methods is enough.

        client = new OpenRouterClient(mockSettings);
    });

    describe("generateHtml", () => {
        it("should call client.chat.send with correct parameters", async () => {
            const messages = [{ role: "user" as const, content: "Hello" }];

            // Mock empty stream
            mocks.mockSend.mockResolvedValue({
                [Symbol.asyncIterator]: async function* () {
                    yield { choices: [{ delta: { content: "<html>From Stream</html>" } }] };
                }
            });

            const result = await client.generateHtml(messages);

            expect(mocks.mockSend).toHaveBeenCalledWith(expect.objectContaining({
                model: "openai/gpt-4o",
                messages: [{ role: "user", content: "Hello" }],
                stream: true,
            }));
            expect(result.html).toBe("<html>From Stream</html>");
        });

        it("should log supported parameters for OpenRouter models", async () => {
            const messages = [{ role: "user" as const, content: "Hello" }];
            const mockRawModel = {
                id: mockSettings.model,
                name: "GPT-4o",
                description: "OpenAI GPT-4o",
                context_length: 128000,
                supportedParameters: ["reasoning_effort", "temperature"],
                pricing: { prompt: "0.000005", completion: "0.000015" },
            };

            // Setup hoisted mock return value
            mocks.mockGetOpenRouterModelRaw.mockResolvedValue(mockRawModel);

            // Mock successful stream response
            mocks.mockSend.mockResolvedValue({
                [Symbol.asyncIterator]: async function* () {
                    yield { choices: [{ delta: { content: "Response" } }] };
                }
            });

            await client.generateHtml(messages);

            // Expect logger.debug to have been called with the supported parameters
            expect(logger.debug).toHaveBeenCalledWith(
                expect.objectContaining({
                    modelId: mockSettings.model,
                    supportedParameters: ["reasoning_effort", "temperature"],
                }),
                "OpenRouter model capabilities debug"
            );
        });

        it("should handle multimodal attachments correctly", async () => {
            const messages = [{
                role: "user" as const,
                content: "Look at this",
                attachments: [{
                    id: "att-1",
                    name: "image.png",
                    mimeType: "image/png",
                    base64: "base64data",
                    size: 100
                }]
            }];

            mocks.mockSend.mockResolvedValue({
                [Symbol.asyncIterator]: async function* () {
                    yield { choices: [{ delta: { content: "Analyzed" } }] };
                }
            });

            await client.generateHtml(messages);

            expect(mocks.mockSend).toHaveBeenCalledWith(expect.objectContaining({
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Look at this" },
                            { type: "image_url", image_url: { url: "data:image/png;base64,base64data" } }
                        ]
                    }
                ]
            }));
        });

        it("should process thinking/reasoning from stream", async () => {
            const messages = [{ role: "user" as const, content: "Reason" }];
            const observer = { onReasoningEvent: vi.fn() };

            // Mock stream with reasoning chunks
            mocks.mockSend.mockResolvedValue({
                [Symbol.asyncIterator]: async function* () {
                    yield { choices: [{ delta: { reasoning: "Thinking..." } }] };
                    yield { choices: [{ delta: { content: "Answer" } }] };
                }
            });

            const result = await client.generateHtml(messages, { streamObserver: observer });

            expect(result.html).toBe("Answer");
            expect(result.reasoning?.raw).toBe("Thinking...");
            expect(observer.onReasoningEvent).toHaveBeenCalledWith({ kind: "thinking", text: "Thinking..." });
        });

        it("should handle error chunks in stream", async () => {
            const messages = [{ role: "user" as const, content: "Error" }];

            mocks.mockSend.mockResolvedValue({
                [Symbol.asyncIterator]: async function* () {
                    yield { error: { message: "Stream failed" } };
                }
            });

            await expect(client.generateHtml(messages)).rejects.toThrow("OpenRouter Stream Error: Stream failed");
        });
    });

    describe("verifyOpenRouterApiKey", () => {
        it("should return true for valid key", async () => {
            mocks.mockGetCurrentKeyMetadata.mockResolvedValue({});

            const result = await verifyOpenRouterApiKey("valid-key");
            expect(result.ok).toBe(true);
        });

        it("should return false for invalid key (401)", async () => {
            mocks.mockGetCurrentKeyMetadata.mockRejectedValue({ status: 401 });

            const result = await verifyOpenRouterApiKey("invalid-key");
            expect(result.ok).toBe(false);
            expect(result.message).toContain("OpenRouter rejected that key");
        });
    });
});
