import { GoogleGenAI } from "@google/genai";

import type {
  ImageGenClient,
  ImageGenOptions,
  ImageGenResult,
} from "../types.js";
import { logger } from "../../logger.js";
import { withRetry } from "../retry.js";

export class GoogleImageGenClient implements ImageGenClient {
  async generateImage(opts: ImageGenOptions): Promise<ImageGenResult> {
    const client = new GoogleGenAI({ apiKey: opts.apiKey });
    const modelId = opts.modelId ?? "gemini-2.5-flash-image";

    logger.info(
      `Generating image with prompt "${opts.prompt}" and ratio ${opts.ratio
      } and model ${modelId}.`
    );

    // Gemini models (gemini-*) use generateContent API
    // Imagen models (imagen-*) use generateImages API
    const useGenerateContent = modelId.startsWith("gemini");

    if (useGenerateContent) {
      logger.debug("Using generateContent API");
      // Both Gemini models use generateContent API (2.5 Flash and 3 Pro)
      const response = await withRetry(
        () =>
          client.models.generateContent({
            model: modelId,
            contents: [
              {
                role: "user",
                parts: [{ text: opts.prompt }],
              },
            ],
          }),
        `Google generateContent (model=${modelId})`
      );

      // Extract the image from the response
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error("No candidates in response");
      }

      const firstCandidate = candidates[0];
      const parts = firstCandidate.content?.parts;
      if (!parts || parts.length === 0) {
        throw new Error("No parts in candidate content");
      }

      // Find the inline data part containing the image
      let imageData: string | undefined;
      let mimeType = "image/png";

      for (const part of parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
          mimeType = part.inlineData.mimeType || "image/png";
          break;
        }
      }

      if (!imageData) {
        throw new Error("No image data found in response");
      }

      return {
        url: `data:${mimeType};base64,${imageData}`,
        provider: "gemini",
        originalPrompt: opts.prompt,
      };
    } else {
      // imagen-3 and gemini-3-pro-image-preview use generateImages API
      logger.debug("Using generateImages API")
      const validRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
      const ratio = validRatios.includes(opts.ratio) ? opts.ratio : "1:1";

      const response = await withRetry(
        () =>
          client.models.generateImages({
            model: modelId,
            prompt: opts.prompt,
            config: {
              numberOfImages: 1,
              aspectRatio: ratio,
            },
          }),
        `Google generateImages (model=${modelId})`
      );

      logger.info(response);

      const firstImage = response.generatedImages?.[0]?.image;
      if (!firstImage) {
        throw new Error("No image generated");
      }

      const base64 = firstImage.imageBytes;
      const mimeType = firstImage.mimeType ?? "image/png";
      const url = firstImage.gcsUri;

      if (base64) {
        return {
          url: `data:${mimeType};base64,${base64}`,
          provider: "gemini",
          originalPrompt: opts.prompt,
        };
      }

      if (url) {
        return { url, provider: "gemini", originalPrompt: opts.prompt };
      }

      throw new Error("No image generated");
    }
  }
}
