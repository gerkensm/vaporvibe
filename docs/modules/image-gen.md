# Image Generation Module

The `src/image-gen/` directory contains the logic for generating images using various providers (OpenAI, Google).

## Architecture

The image generation system is designed to be modular and provider-agnostic.

- **`factory.ts`**: Creates instances of `ImageGenClient` based on the configured provider. It wraps the client in a `CachedImageGenClient` to provide in-memory caching.
- **`cache.ts`**: Implements `CachedImageGenClient`, which checks a static `Map` before delegating to the underlying provider client.
- **`types.ts`**: Defines the `ImageGenClient` interface and related types (`ImageGenOptions`, `ImageGenResult`).
- **`providers/`**: Contains provider-specific implementations (e.g., `openai.ts`, `google.ts`).

## Caching

To prevent redundant API calls and reduce costs, image generation results are cached in memory.

- **Cache Key**: `modelId:ratio:prompt`
- **Persistence**: The cache is in-memory only and is cleared when the server restarts.
- **Logic**: If a request matches an existing cache key, the cached URL is returned immediately.

## Usage

The image generation client is primarily used by the `RestApiController` to handle requests to `/rest_api/image/generate`.

```typescript
const client = createImageGenClient(provider);
const result = await client.generateImage({
  prompt: "A futuristic city",
  ratio: "16:9",
  apiKey: "...",
  modelId: "dall-e-3"
});
```
