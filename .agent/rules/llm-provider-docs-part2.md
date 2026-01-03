---
trigger: glob
globs: **/src/llm/*-client.ts, **/src/llm/providers/*.ts
---

-   **Mime Types**: `image/png`, `image/jpeg`, `image/webp`, `image/gif`.
-   **Format**: Converted to `data:image/...;base64,...` URLs.
-   **Detail**: Defaults to `auto` (handled by API), but client structure supports explicit detail levels.

### 2. Streaming
Uses `client.responses.stream()` to receive server-sent events.
-   **Events Monitored**:
    -   `response.output_text.delta`: Standard content generation.
    -   `response.reasoning_text.delta`: "Thinking" process (for supported models).
    -   `response.reasoning_summary_text.delta`: Summarized reasoning.
-   **Observer Pattern**: Emits `LlmReasoningStreamEvent` to the provided `LlmStreamObserver`.

### 3. Reasoning Extraction
For models that support it (like o1), the client extracts "hidden" reasoning tokens.
-   **Streaming**: Emits `thinking` events in real-time.
-   **Final Response**: Parses `usage.output_tokens_details.reasoning_tokens` to report "Reasoning Tokens" usage in the final `LlmResult`.
-   **Normalization**: The `normalizeReasoningChunk` and `mergeOpenAiReasoning` functions ensure clean text output, handling edge cases like split newlines or markdown artifacts.

## Configuration (`ProviderSettings`)
-   **`apiKey`**: Required.
-   **`model`**: Required (e.g., "gpt-4o").
-   **`reasoningMode`**:
    -   `none`: Standard behavior.
    -   `low`/`medium`/`high`: Maps to `reasoning_effort` parameter (if supported).
-   **`maxOutputTokens`**: Caps the response length.

## Error Handling
-   **Verification**: `verifyOpenAiApiKey` performs a lightweight `client.models.list()` call to validate credentials before saving.
-   **Status Codes**: Maps 401/403 to user-friendly "Rejected key" messages.

## Usage Example
```typescript
const client = new OpenAiClient({
  apiKey: "sk-...",
  model: "gpt-4o",
  reasoningMode: "high"
});

const result = await client.generateHtml([
  { role: "user", content: "Build a snake game" }
]);

console.log(result.html); // "<html>..."
console.log(result.reasoning); // { details: ["Thinking about game loop..."] }
```


# Content from docs/modules/llm/providers/openrouter.md

# Module: OpenRouter Provider

> **File**: `src/llm/openrouter-client.ts`
> **Class**: `OpenRouterClient`

## Overview
The `OpenRouterClient` implements the `LlmClient` interface for OpenRouter's unified API. OpenRouter provides access to 200+ models from multiple providers (OpenAI, Anthropic, Google, Meta, and others) through a single API key.

## Key Features

### 1. Dynamic Model Catalog
Unlike other providers with static model lists, OpenRouter models are fetched dynamically at runtime.
-   **File**: `src/llm/openrouter-models.ts`
-   **Caching**: 5-minute TTL for model list, 1-hour for rankings
-   **Sorting**: Models sorted by usage (total tokens) from OpenRouter leaderboards
-   **Featured**: Top 20 most-used models automatically marked as featured

### 2. Unified Reasoning Support
OpenRouter provides a `reasoning` parameter that works across all providers.
-   **Effort Modes**: `low`, `medium`, `high` (qualitative control)
-   **Auto-Conversion**: OpenRouter converts effort to provider-native format:
    -   Anthropic: `budget_tokens`
    -   Gemini: `thinking_budget`
    -   OpenAI o-series: `reasoning_effort`
-   **Detection**: Models reporting `"reasoning"` in `supported_parameters` enable reasoning modes.

### 3. Multimodal Input
The client supports image attachments for models that accept multimodal input.
-   **Format**: Base64 data URLs (`data:image/...;base64,...`)
-   **Non-Image Attachments**: Injected as Base64 text content
-   **Universal Support**: OpenRouter's unified API handles multimodal routing
-   **⚠️ User Role Only**: OpenRouter requires multimodal content arrays (with `image_url` parts) to be on `user` role messages only. System and assistant messages with attachments are automatically flattened to text descriptions.
-   **SDK Casing**: The SDK uses camelCase internally (`imageUrl`) and transforms to snake_case (`image_url`) when sending to the API. Code must use `imageUrl` to pass SDK validation.

### 4. Streaming
Uses `client.chat.send()` with `stream: true` to receive server-sent events.
-   **Content Chunks**: `delta.content` for main response
-   **Reasoning Chunks**: `delta.reasoning`, `delta.reasoning_content`, or `delta.reasoning_text` (varies by upstream provider)
-   **Usage Metrics**: Captured from final chunk

## Configuration (`ProviderSettings`)
-   **`apiKey`**: Required. OpenRouter API key (`sk-or-v1-...`).
-   **`model`**: Required. Full model ID (e.g., `anthropic/claude-3.5-sonnet`).
-   **`reasoningMode`**: `none`, `low`, `medium`, or `high` (converted to `reasoning.effort`).
-   **`maxOutputTokens`**: Caps response length.

> **Note**: `reasoningTokens` is ignored. OpenRouter uses qualitative effort modes, not token budgets.

## Model Fetching (`openrouter-models.ts`)

### Rankings Integration
The module scrapes OpenRouter's `/rankings` page to get usage data:
-   Parses embedded JSON (`rankingData`) from HTML
-   Uses total tokens (prompt + completion) for sorting
-   Marks top 20 models as "featured"

### Model Metadata Transformation
Raw OpenRouter model data is transformed to VaporVibe's `ModelMetadata` format:
-   **Context Window**: From `context_length`
-   **Max Output**: From `top_provider.max_completion_tokens` with fallback heuristics
-   **Pricing**: Scaled to per-1M tokens format
-   **Reasoning Support**: Detected from `supported_parameters`

### Image Model Fetching
Separate function for image-capable models:
-   Filters by `output_modalities.includes("image")`
-   Also fetches unlisted models from RSS feed (Flux, Riverflow)

## Error Handling
-   **Verification**: `verifyOpenRouterApiKey` calls `client.apiKeys.getCurrentKeyMetadata()`
-   **Status Codes**: Maps 401/403 to "Rejected key" messages
-   **Stream Errors**: Detected via `chunk.error` field

## Environment Variables
| Variable             | Description            |
| -------------------- | ---------------------- |
| `OPENROUTER_API_KEY` | Primary API key        |
| `OPENROUTER_KEY`     | Alias for API key      |
| `OPENROUTER_MODEL`   | Default model override |

## Usage Example
```typescript
const client = new OpenRouterClient({
  apiKey: "sk-or-v1-...",
  model: "anthropic/claude-3.5-sonnet",
  reasoningMode: "high",
  maxOutputTokens: 16384
});

const result = await client.generateHtml([
  { role: "user", content: "Build a todo app" }
]);

console.log(result.html); // "<html>..."
console.log(result.reasoning); // { details: ["Thinking..."] }
```

## Image Generation

OpenRouter also supports image generation through models like Gemini 2.0 Flash.

> **File**: `src/image-gen/providers/openrouter.ts`
> **Class**: `OpenRouterImageGenClient`

### Key Differences from LLM Client
-   Uses raw `fetch` instead of SDK (SDK strips `images` array from responses)
-   Sends `modalities: ["image", "text"]` in request
-   Parses `choices[0].message.images[0].image_url.url` from response

### Supported Aspect Ratios
`1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`

