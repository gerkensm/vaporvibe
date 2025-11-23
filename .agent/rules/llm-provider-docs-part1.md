---
trigger: always_on
globs: **/*
---


# Content from docs/modules/llm/providers/anthropic.md

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


# Content from docs/modules/llm/providers/groq.md

# Module: Groq Provider

> **File**: `src/llm/groq-client.ts`
> **Class**: `GroqClient`

## Overview
The `GroqClient` connects to Groq's high-speed inference API using the OpenAI SDK. It is optimized for speed and supports open-source models like Llama 3 and Mixtral, with specific handling for multimodal inputs and reasoning traces.

## Supported Models
-   **Llama 3 / 3.1 / 3.2**: Meta's open weights models.
-   **Mixtral 8x7b**: Mistral AI's MoE model.
-   **Gemma 2**: Google's open model.
-   **Qwen 2.5**: Alibaba's model.

## Features

### 1. Multimodal Constraints
Groq supports vision input but with stricter limits than OpenAI:
-   **Max Images**: 5 per message.
-   **Max Size**: 4MB per image (base64 encoded).
-   **Validation**: The client pre-validates these limits and logs warnings if attachments are skipped, preventing API errors.

### 2. Reasoning Configuration
Groq exposes reasoning knobs for specific models (e.g., `gpt-oss-20b`, `qwen3-32b`).
-   **Effort Levels**: `low`, `medium`, `high` (mapped from `reasoningMode`).
-   **Format**: Some models require `reasoning_format="parsed"`.
-   **Extraction**: The client parses both `<think>` tags in the content and structured `reasoning` fields in the response object.

### 3. Streaming & Merging
Groq's streaming behavior for reasoning can be fragmented. The client implements a robust `mergeReasoningTraces` strategy:
-   **Accumulation**: Buffers streaming `reasoning_content` deltas.
-   **Deduplication**: Normalizes and removes duplicate reasoning fragments (a common issue with some OSS models).
-   **Prioritization**: Prefers streaming details over final response summaries if they conflict, ensuring the most granular trace is preserved.

## Configuration (`ProviderSettings`)
-   **`apiKey`**: Required.
-   **`model`**: Required.
-   **`reasoningMode`**: Maps to `reasoning_effort` for supported models.

## Error Handling
-   **Verification**: `verifyGroqApiKey` performs a standard `models.list` call.
-   **Status Codes**: Maps 401/403 to "Rejected key" messages.

## Usage Example
```typescript
const client = new GroqClient({
  apiKey: "gsk_...",
  model: "llama-3.1-70b-versatile",
  reasoningMode: "low"
});

const result = await client.generateHtml([
  { role: "user", content: "Fastest way to sort a list?" }
]);

console.log(result.html); // Generated content
```


# Content from docs/modules/llm/providers/openai.md

# Module: OpenAI Provider

> **File**: `src/llm/openai-client.ts`
> **Class**: `OpenAiClient`

## Overview
The `OpenAiClient` implements the `LlmClient` interface for OpenAI's API. It handles chat completion requests, supports multimodal input (images), manages streaming responses, and extracts reasoning traces from newer models (e.g., o1-preview).

## Supported Models
The client is agnostic to the specific model string, but is tested with:
-   **GPT-4o** (`gpt-4o`): High intelligence, multimodal, fast.
-   **GPT-4 Turbo** (`gpt-4-turbo`): Previous flagship.
-   **o1-preview / o1-mini**: Reasoning models.

## Features

### 1. Multimodal Input
The client automatically detects base64-encoded images in `ChatMessage.attachments` and formats them for the OpenAI Vision API.
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


# Content from docs/modules/llm/providers/gemini.md

# Module: Gemini Provider

> **File**: `src/llm/gemini-client.ts`
> **Class**: `GeminiClient`

## Overview
The `GeminiClient` integrates with Google's Generative AI SDK (`@google/genai`). It supports the Gemini 1.5 and 2.0 model families, offering robust multimodal capabilities (including PDFs) and a complex "Thinking" configuration system that adapts to different model versions.

## Supported Models
-   **Gemini 1.5 Pro/Flash**: Standard multimodal models.
-   **Gemini 2.0 Flash/Pro**: Next-gen models with enhanced reasoning.
-   **Gemini 3.0 Pro**: Future-facing model with explicit `ThinkingLevel` controls.

## Features

### 1. Advanced Multimodal Input
Gemini supports a wider range of inputs than most providers.
-   **Images**: `image/*` MIME types.
-   **Documents**: `application/pdf` is natively supported via `inlineData`.
-   **Text**: Standard text prompts.

### 2. Adaptive Thinking Configuration
The client implements a sophisticated logic to configure "Thinking" (reasoning) based on the specific model version (`shouldEnableGeminiThoughts`, `clampGeminiBudget`).

| Model Family   | Configuration Strategy                                              |
| :------------- | :------------------------------------------------------------------ |
| **Gemini 3.0** | Uses `thinkingLevel` (Low/High) mapped from `reasoningMode`.        |
| **Gemini 2.x** | Uses `thinkingBudget` (Token Count). Supports dynamic/zero budgets. |
| **Gemini 1.5** | Generally does not support exposed thinking parameters.             |

### 3. Stream Processing
The client handles Gemini's unique stream format, where "thoughts" and "content" can be interleaved or delivered in separate chunks.
-   **Thought Collection**: Aggregates `part.thought` fields from the stream.
-   **Snapshotting**: Maintains a snapshot of thought blocks to detect and merge updates (Gemini sometimes re-sends the whole block).
-   **Observer**: Emits `summary` events for thoughts and `text` events for final content.

## Configuration (`ProviderSettings`)
-   **`apiKey`**: Required.
-   **`model`**: Required.
-   **`reasoningMode`**: Used for Gemini 3.0 (`low` -> `ThinkingLevel.LOW`).
-   **`reasoningTokens`**: Used for Gemini 2.x as the `thinkingBudget`.
-   **`reasoningTokensEnabled`**: If `false`, disables thinking for budget-based models.

## Error Handling
-   **Verification**: `verifyGeminiApiKey` attempts a lightweight `models.list` call.
-   **Status Codes**: Maps 401/403 to "Rejected key" messages.
-   **Text Coercion**: Safely handles cases where the SDK returns a function instead of a string for text content.

## Usage Example
```typescript
const client = new GeminiClient({
  apiKey: "AIza...",
  model: "gemini-2.0-flash-exp",
  reasoningTokens: 8192
});

const result = await client.generateHtml([
  { role: "user", content: "Explain quantum gravity" }
]);

// Result includes the thought trace
console.log(result.reasoning.summaries); 
```


# Content from docs/modules/llm/providers/grok.md

# Module: Grok (xAI) Provider

> **File**: `src/llm/grok-client.ts`
> **Class**: `GrokClient`

## Overview
The `GrokClient` connects to the xAI API using the OpenAI SDK (as xAI is API-compatible). It implements specific logic to handle Grok's reasoning capabilities, which differ slightly from OpenAI's o1 implementation.

## Supported Models
-   **Grok 2**: Standard high-intelligence model.