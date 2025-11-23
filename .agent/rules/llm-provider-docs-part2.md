---
trigger: always_on
globs: **/*
---


-   **Grok 3 / Grok 3 Mini**: Reasoning-capable models.
-   **Grok 4**: Future reasoning model.

## Features

### 1. OpenAI SDK Compatibility
The client reuses the `openai` NPM package but overrides the `baseURL` to `https://api.x.ai/v1`. This ensures high stability and reuses existing type definitions.

### 2. Reasoning Effort Logic
Grok has complex rules for when `reasoning_effort` can be specified. The client implements a `resolveReasoningEffort` function to handle this:
-   **Unsupported**: Models like `grok-4-fast-non-reasoning` ignore the setting.
-   **Supported**: Models like `grok-3` accept `low` or `high`.
-   **Defaulting**: If a reasoning model is selected but `reasoningMode` is "none", the client may force `low` or leave it unset depending on the specific model's requirements.

### 3. Reasoning Extraction
xAI's API has experimented with different fields for returning reasoning traces. The client robustly checks multiple locations:
-   `choice.message.reasoning_content`
-   `choice.message.metadata.reasoning_content`
-   `choice.reasoning_content`
-   `response.reasoning_content`

It also implements `normalizeReasoningContent` to deduplicate and clean up the extracted text.

## Configuration (`ProviderSettings`)
-   **`apiKey`**: Required.
-   **`model`**: Required.
-   **`reasoningMode`**: Maps to `reasoning_effort` (`low`/`high`) for supported models.

## Error Handling
-   **Verification**: `verifyGrokApiKey` performs a standard `models.list` call.
-   **Timeouts**: Uses a generous 6-minute timeout (`GROK_TIMEOUT_MS`) to accommodate deep reasoning queries.

## Usage Example
```typescript
const client = new GrokClient({
  apiKey: "xai-...",
  model: "grok-3",
  reasoningMode: "high"
});

const result = await client.generateHtml([
  { role: "user", content: "Solve the Riemann Hypothesis" }
]);

// Result contains the reasoning trace
console.log(result.reasoning.summaries); 
```

