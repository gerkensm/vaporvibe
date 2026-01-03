
import type { ImageAspectRatio, ImageModelId, ImageGenProvider } from "../types.js";

export type { ImageAspectRatio } from "../types.js";

export interface ImageGenOptions {
  prompt: string;
  ratio: ImageAspectRatio;
  apiKey: string;
  modelId?: ImageModelId;
  inputImages?: Array<{ base64: string; mimeType: string; fieldName?: string }>;
  inputHash?: string;
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

export const VALID_IMAGE_PROVIDERS: ImageGenProvider[] = ["openai", "gemini", "openrouter"];

export const VALID_IMAGE_MODELS: ImageModelId[] = [
  "gpt-image-1.5",
  "dall-e-3",
  "gemini-2.5-flash-image",
  "gemini-3-pro-image-preview",
  "imagen-3.0-generate-002",
  "imagen-4.0-fast-generate-001",
];
