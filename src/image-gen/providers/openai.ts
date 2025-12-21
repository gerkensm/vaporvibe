import OpenAI from "openai";

import type {
  ImageGenClient,
  ImageGenOptions,
  ImageGenResult,
} from "../types.js";
import { logger } from "../../logger.js";
import { withRetry } from "../retry.js";

export class OpenAiImageGenClient implements ImageGenClient {
  async generateImage(opts: ImageGenOptions): Promise<ImageGenResult> {
    const client = new OpenAI({ apiKey: opts.apiKey });
    const model = opts.modelId ?? "gpt-image-1.5";

    const GPT_1_5_SIZES: Record<
      string,
      "1024x1024" | "1536x1024" | "1024x1536"
    > = {
      "1:1": "1024x1024",
      "16:9": "1536x1024",
      "9:16": "1024x1536",
      "4:3": "1024x1024",
    };
    const DALLE_3_SIZES: Record<
      string,
      "1024x1024" | "1792x1024" | "1024x1792"
    > = {
      "1:1": "1024x1024",
      "16:9": "1792x1024",
      "9:16": "1024x1792",
      "4:3": "1024x1024",
    };

    const sizeMap = model === "dall-e-3" ? DALLE_3_SIZES : GPT_1_5_SIZES;
    logger.info(
      `Generating image with prompt "${opts.prompt}" and ratio ${opts.ratio
      } (resolution ${sizeMap[opts.ratio]}) and model ${model}.`
    );
    const response = await withRetry(
      () =>
        client.images.generate({
          model,
          prompt: opts.prompt,
          size: sizeMap[opts.ratio] ?? "1024x1024",
          n: 1,
        }),
      `OpenAI image generation (model=${model})`
    );

    const generatedImage = response.data?.[0];

    // OpenAI can return either a URL or base64-encoded JSON
    let imageUrl: string;
    if (generatedImage?.url) {
      imageUrl = generatedImage.url;
    } else if (generatedImage?.b64_json) {
      // Convert base64 to data URL
      imageUrl = `data:image/png;base64,${generatedImage.b64_json}`;
    } else {
      throw new Error(
        "OpenAI image generation did not return an image URL or base64 data"
      );
    }

    return {
      url: imageUrl,
      provider: "openai",
      originalPrompt: opts.prompt,
    };
  }
}
