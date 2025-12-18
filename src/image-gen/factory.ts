import { CachedImageGenClient } from "./cache.js";
import { GoogleImageGenClient } from "./providers/google.js";
import { OpenAiImageGenClient } from "./providers/openai.js";
import type { ImageGenClient } from "./types.js";

export function createImageGenClient(provider: "openai" | "gemini"): ImageGenClient {
  if (provider === "gemini") {
    return new CachedImageGenClient(new GoogleImageGenClient());
  }
  return new CachedImageGenClient(new OpenAiImageGenClient());
}
