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
