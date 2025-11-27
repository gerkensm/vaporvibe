# Module: Anthropic Provider

> **File**: `src/llm/anthropic-client.ts`
> **Class**: `AnthropicClient`

## Overview
The `AnthropicClient` integrates with the Anthropic Messages API. It supports Claude 3.5 Sonnet, Haiku, and Opus models, with specialized handling for "Thinking" blocks, prompt caching, and overload retries.

## Supported Models
-   **Claude 3.5 Sonnet** (`claude-3-5-sonnet-latest`): The primary workhorse.
-   **Claude 3.5 Haiku** (`claude-3-5-haiku-latest`): Fast, low-cost.
-   **Claude 3 Opus** (`claude-3-opus-latest`): High reasoning capability.

## Features

### 1. Thinking Blocks (Reasoning)
The client supports Anthropic's "Thinking" feature, which allows the model to output a hidden chain of thought before the final answer.
-   **Activation**: Enabled if `reasoningMode` is set or `reasoningTokens` > 0.
-   **Budgeting**: Allocates a token budget (defaulting to `maxOutputTokens` if not specified).
-   **Streaming**: Emits `thinking` events as they arrive in the stream.
-   **Extraction**: Captures the `thinking` block from the final message or accumulates it from the stream delta.

### 2. Prompt Caching
To reduce costs and latency, the client intelligently applies Anthropic's `cache_control` markers.
-   **System Prompts**: Automatically marked as `ephemeral` cache points.
-   **User Messages**: Large attachments or long context blocks can be marked for caching via `ChatMessage.cacheControl`.
-   **Usage Logging**: Logs `cache_creation_input_tokens` and `cache_read_input_tokens` to debug cache hits.

### 3. Overload Handling
Anthropic's API can return 529 "Overloaded" errors during peak times. The client implements a custom exponential backoff retry loop.
-   **Strategy**: Retries up to 4 times.
-   **Backoff**: `50ms * 2^attempt` + jitter.
-   **Detection**: Checks for status 529 or "overloaded_error" type.

### 4. Diagnostics
For debugging complex streams, the client can capture a trace of all stream events.
-   **Flag**: `ANTHROPIC_DEBUG_STREAM=true`.
-   **Output**: Logs a summarized timeline of `text_delta` vs `thinking_delta` events.

## Configuration (`ProviderSettings`)
-   **`apiKey`**: Required.
-   **`model`**: Required.
-   **`reasoningMode`**: Controls whether "Thinking" is enabled.
-   **`reasoningTokens`**: Explicit budget for thinking tokens.

## Error Handling
-   **Verification**: `verifyAnthropicApiKey` attempts to list models. If that fails (some keys are restricted), it falls back to a raw `fetch` to the models endpoint to check for auth errors vs network errors.
-   **Timeouts**: Verification has a strict 10s timeout to prevent hanging the UI.

## Usage Example
```typescript
const client = new AnthropicClient({
  apiKey: "sk-ant-...",
  model: "claude-3-5-sonnet-latest",
  reasoningTokens: 4000 // Enable thinking
});

const result = await client.generateHtml([
  { role: "user", content: "Design a dashboard" }
]);

// Result contains both the HTML and the hidden thinking trace
console.log(result.reasoning.raw); // ["Thinking Process: 1. Analyze request..."]
```
