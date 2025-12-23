import { CachedImageGenClient } from "./cache.js";
import { GoogleImageGenClient } from "./providers/google.js";
import { OpenAiImageGenClient } from "./providers/openai.js";
import { OpenRouterImageGenClient } from "./providers/openrouter.js";
import type { ImageGenClient } from "./types.js";

export function createImageGenClient(provider: "openai" | "gemini" | "openrouter"): ImageGenClient {
  if (provider === "gemini") {
    return new CachedImageGenClient(new GoogleImageGenClient());
  }
  if (provider === "openrouter") {
    return new CachedImageGenClient(new OpenRouterImageGenClient());
  }
  return new CachedImageGenClient(new OpenAiImageGenClient());
}

