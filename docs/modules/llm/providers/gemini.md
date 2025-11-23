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
