import { OpenRouter } from "@openrouter/sdk";
import type {
    ChatMessage,
    LlmReasoningTrace,
    LlmUsageMetrics,
    ProviderSettings,
    VerificationResult,
} from "../types.js";
import type {
    LlmClient,
    LlmGenerateOptions,
    LlmResult,
    LlmStreamObserver,
} from "./client.js";
import { logger } from "../logger.js";

/**
 * OpenRouter LLM client using the official TypeScript SDK.
 * 
 * OpenRouter provides unified access to 200+ models from multiple providers
 * (OpenAI, Anthropic, Google, Meta, and others) through a single API.
 * 
 * Models are fetched dynamically at runtime via the /api/v1/models endpoint.
 * 
 * @see https://openrouter.ai/docs
 */
export class OpenRouterClient implements LlmClient {
    readonly settings: ProviderSettings;
    private readonly client: OpenRouter;

    constructor(settings: ProviderSettings) {
        this.settings = settings;
        this.client = new OpenRouter({
            apiKey: settings.apiKey,
            httpReferer: "https://github.com/gerkensm/vaporvibe",
            xTitle: "VaporVibe (serve-llm)",
        });

        // OpenRouter uses reasoningMode, not a separate reasoningTokens budget
        if (settings.reasoningTokens !== undefined) {
            logger.info(
                `OpenRouter reasoning is controlled via model selection (e.g., using reasoning-capable models). Ignoring requested reasoning tokens value ${settings.reasoningTokens}.`
            );
        }
    }

    async generateHtml(
        messages: ChatMessage[],
        options: LlmGenerateOptions = {}
    ): Promise<LlmResult> {
        // Convert internal ChatMessage format to OpenRouter API format
        const apiMessages = messages.map((message) => {
            // Text-only: simpler content structure
            if (!message.attachments?.length) {
                return {
                    role: message.role,
                    content: message.content,
                };
            }

            // Multimodal content
            const content: Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }> = [
                { type: "text", text: message.content },
            ];

            for (const attachment of message.attachments) {
                if (!attachment.base64) continue;

                const mimeType = attachment.mimeType.toLowerCase();
                if (mimeType.startsWith("image/")) {
                    content.push({
                        type: "image_url",
                        image_url: {
                            url: `data:${attachment.mimeType};base64,${attachment.base64}`,
                        },
                    });
                } else {
                    // Non-image attachments as text context
                    const descriptor = `\nAttachment ${attachment.name} (${attachment.mimeType}, ${attachment.size} bytes) encoded in Base64:\n`;
                    content.push({ type: "text", text: descriptor });
                    content.push({ type: "text", text: attachment.base64 });
                }
            }

            return {
                role: message.role,
                content: content as any,
            };
        });

        // Build request parameters
        const requestParams: any = {
            model: this.settings.model,
            messages: apiMessages,
            stream: true,
        };

        if (this.settings.maxOutputTokens) {
            requestParams.max_tokens = this.settings.maxOutputTokens;
        }

        if (this.settings.reasoningMode && this.settings.reasoningMode !== "none") {
            requestParams.reasoning = {
                effort: this.settings.reasoningMode,
            };
        }

        const observer = options.streamObserver;

        try {
            // Use the verified client.chat.send method as requested
            // Debug: Log supported parameters for the selected model
            try {
                const { getOpenRouterModelRaw } = await import("./openrouter-models.js");
                const rawModel = await getOpenRouterModelRaw(this.settings.apiKey, this.settings.model);
                if (rawModel) {
                    logger.debug({
                        modelId: this.settings.model,
                        supportedParameters: rawModel.supported_parameters || rawModel.supportedParameters
                    }, "OpenRouter model capabilities debug");
                }
            } catch (err) {
                // Ignore module load errors in tests
            }

            const stream = await this.client.chat.send(requestParams);

            let streamedHtml = "";
            const reasoningBuffers: { thinking: string; summary: string } = {
                thinking: "",
                summary: "",
            };
            let usage: LlmUsageMetrics = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

            for await (const chunk of stream as unknown as AsyncIterable<any>) {
                // Check for errors in chunk (OpenRouter way)
                if (chunk.error) {
                    throw new Error(`OpenRouter Stream Error: ${chunk.error.message}`);
                }

                // Capture usage if present (often in the last chunk)
                if (chunk.usage) {
                    usage = {
                        inputTokens: chunk.usage.prompt_tokens || 0,
                        outputTokens: chunk.usage.completion_tokens || 0,
                        totalTokens: chunk.usage.total_tokens || 0,
                    };
                }

                const choice = chunk.choices?.[0];
                if (!choice) continue;

                const delta = choice.delta;
                if (!delta) continue;

                // 1. Text Content
                if (typeof delta.content === "string") {
                    streamedHtml += delta.content;
                }

                // 2. Reasoning Content
                // Check various fields used by different providers on OpenRouter
                const reasoningChunk = delta.reasoning || delta.reasoning_content || delta.reasoning_text;
                if (typeof reasoningChunk === "string" && reasoningChunk.length > 0) {
                    const sanitized = reasoningChunk.replace(/\r/g, "");
                    if (sanitized.length > 0) {
                        if (observer) {
                            observer.onReasoningEvent({ kind: "thinking", text: sanitized });
                        }
                        reasoningBuffers.thinking += sanitized;
                    }
                }
            }

            const html = streamedHtml.trim();

            const reasoning: LlmReasoningTrace = {
                details: reasoningBuffers.thinking ? [reasoningBuffers.thinking] : [],
                summaries: reasoningBuffers.summary ? [reasoningBuffers.summary] : [],
                raw: reasoningBuffers.thinking,
            };

            return {
                html,
                usage,
                reasoning,
                raw: { choices: [{ message: { content: html } }] }, // Minimal raw response reconstruction
            };

        } catch (error) {
            logger.error(`OpenRouter API error: ${(error as Error).message}`);
            logger.debug({ err: error }, "Full OpenRouter error details");
            throw error;
        }
    }
}

/**
 * Verifies an OpenRouter API key by checking the current key status.
 */
export async function verifyOpenRouterApiKey(
    apiKey: string
): Promise<VerificationResult> {
    const trimmed = apiKey.trim();
    if (!trimmed) {
        return { ok: false, message: "Enter an OpenRouter API key to continue." };
    }

    const client = new OpenRouter({
        apiKey: trimmed,
        httpReferer: "https://github.com/gerkensm/vaporvibe",
        xTitle: "VaporVibe (serve-llm)",
    });

    try {
        // Verify the API key by checking its status
        await client.apiKeys.getCurrentKeyMetadata();
        return { ok: true };
    } catch (error: any) {
        logger.warn({ err: error }, "OpenRouter verification failed");

        const status = error?.status || error?.response?.status;
        if (status === 401 || status === 403) {
            return {
                ok: false,
                message: "OpenRouter rejected that key. Confirm the value and try again.",
            };
        }

        if (error?.name === "ResponseValidationError" || error?.message?.includes("validation failed")) {
            return {
                ok: false,
                message: `OpenRouter validation error: ${error.message}. Check your key.`,
            };
        }

        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, message: `Unable to reach OpenRouter: ${message}` };
    }
}
