import type { ImageAspectRatio } from "../types.js";

export type { ImageAspectRatio } from "../types.js";

export interface ImageGenOptions {
  prompt: string;
  ratio: ImageAspectRatio;
  apiKey: string;
  modelId?: import("../types.js").ImageModelId;
}

export interface ImageGenResult {
  url: string;
  provider: string;
  originalPrompt?: string;
  mimeType?: string;
}

export interface ImageGenClient {
  generateImage(options: ImageGenOptions): Promise<ImageGenResult>;
}
