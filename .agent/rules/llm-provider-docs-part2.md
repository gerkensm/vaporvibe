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

