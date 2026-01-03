import type { ImageGenClient, ImageGenOptions, ImageGenResult } from "../types.js";
import { logger } from "../../logger.js";
import { withRetry } from "../retry.js";

/**
 * OpenRouter image generation client.
 * 
 * Uses raw fetch instead of the @openrouter/sdk because the SDK strips
 * the `images` array from responses.
 */
export class OpenRouterImageGenClient implements ImageGenClient {
    async generateImage(opts: ImageGenOptions): Promise<ImageGenResult> {
        const model = opts.modelId || "google/gemini-2.0-flash-001";

        logger.info({
            model,
            hasInputImages: !!(opts.inputImages?.length),
            inputImagesCount: opts.inputImages?.length ?? 0,
        }, `OpenRouter generating image`);

        const response = await withRetry(
            () => this.fetchImage(opts.apiKey, model, opts.prompt, opts.ratio, opts.inputImages),
            `OpenRouter image generation (model=${model})`
        );

        return {
            url: response.imageUrl,
            provider: "openrouter",
            originalPrompt: opts.prompt,
        };
    }

    private async fetchImage(
        apiKey: string,
        model: string,
        prompt: string,
        ratio?: string,
        inputImages?: Array<{ base64: string; mimeType: string }>
    ): Promise<{ imageUrl: string }> {
        const requestBody: Record<string, any> = {
            model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: `Generate an image: ${prompt}` },
                    ],
                }
            ],
            modalities: ["image", "text"],
            stream: false,
        };

        if (inputImages?.length) {
            const target = requestBody.messages[0].content as Array<any>;
            for (const image of inputImages) {
                target.push({
                    type: "image_url",
                    image_url: {
                        url: `data:${image.mimeType || "image/png"};base64,${image.base64}`,
                    }
                });
            }
        }

        // Add aspect ratio config for models that support it
        const imageConfig = this.buildImageConfig(ratio);
        if (imageConfig) {
            requestBody.image_config = imageConfig;
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/gerkensm/vaporvibe",
                "X-Title": "VaporVibe"
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
        }

        const json = await response.json();

        // Response format: choices[0].message.images[0].image_url.url
        const message = json.choices?.[0]?.message;
        const images = message?.images;

        if (!images || images.length === 0) {
            logger.error(`OpenRouter response missing images: ${JSON.stringify(json)}`);
            throw new Error("OpenRouter image generation did not return an image");
        }

        const firstImage = images[0];
        // API returns snake_case: image_url.url
        const imageUrl = firstImage?.image_url?.url;

        if (!imageUrl) {
            logger.error(`OpenRouter image missing URL: ${JSON.stringify(firstImage)}`);
            throw new Error("OpenRouter image response missing URL");
        }

        logger.debug(`OpenRouter image generated successfully, URL length: ${imageUrl.length}`);
        return { imageUrl };
    }

    private buildImageConfig(ratio?: string): { aspect_ratio?: string } | undefined {
        if (!ratio) return undefined;

        // Supported aspect ratios
        const validRatios = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
        if (validRatios.includes(ratio)) {
            return { aspect_ratio: ratio };
        }
        return undefined;
    }
}
