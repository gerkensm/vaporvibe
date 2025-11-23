# Module Documentation: `llm/client.ts`

> **File**: `src/llm/client.ts`  
> **Last Updated**: Sat Oct 12 14:15:22 2025 +0200  
> **Commit ID**: `4a2b1c3d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t`

> [!WARNING]
> This documentation is manually maintained and may be outdated. Always verify against the source code.

## Overview
`client.ts` defines the **Core Contract** (Interface) that all LLM providers must implement. It abstracts away the differences between OpenAI, Gemini, Anthropic, etc., allowing the rest of the application to treat them uniformly.

## Core Concepts & Implementation Details

### 1. The `LlmClient` Interface
This is the primary abstraction. Any class implementing this can plug into the `server.ts` logic.
-   **`settings`**: Read-only access to the configuration used to create this client.
-   **`generateHtml`**: The main method. It takes a chat history and returns a Promise that resolves to the generated HTML.

### 2. The "Reasoning Stream" Observer Pattern
To support "thinking" models where the model emits internal reasoning before the final answer, this interface defines a callback mechanism.
-   **`LlmStreamObserver`**: An interface with `onReasoningEvent(event)`.
-   **Usage**: The server implements this observer and passes it to `generateHtml`. The client implementation is responsible for parsing the provider's specific streaming format (e.g., parsing `<thinking>` tags or special JSON chunks) and calling `onReasoningEvent`.
-   **Decoupling**: This decouples the *source* of reasoning (the LLM API) from the *consumer* (the SSE stream to the frontend).

## Key Interfaces

### `LlmClient`
```typescript
interface LlmClient {
  readonly settings: ProviderSettings;
  generateHtml(
    messages: ChatMessage[], 
    options?: LlmGenerateOptions
  ): Promise<LlmResult>;
}
```

### `LlmResult`
The standardized output from any provider.
```typescript
interface LlmResult {
  html: string;           // The final generated code
  usage?: LlmUsageMetrics;// Token usage stats (input/output)
  raw?: unknown;          // The raw provider response (for debugging)
  reasoning?: LlmReasoningTrace; // The full captured reasoning text
}
```

## Shortcomings & Technical Debt

### Architectural
-   **Single Method Limitation**: The interface only exposes `generateHtml`. If we ever want to support other modes (e.g., "generate JSON", "classify text"), this interface will need to be expanded or split.
-   **Implicit Streaming Contract**: The interface implies that `generateHtml` returns a Promise (request/response), but the `streamObserver` suggests streaming behavior. This hybrid approach (streaming side-channel, buffered final result) is specific to the current "Reasoning Stream" architecture and might be confusing for standard streaming implementations.

### Implementation
-   **No Base Class**: There is no abstract base class sharing common logic (like error handling or retry logic). Each client implementation (OpenAI, Gemini) repeats some boilerplate.
