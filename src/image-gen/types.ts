export type ImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

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
}

export interface ImageGenClient {
  generateImage(options: ImageGenOptions): Promise<ImageGenResult>;
}
