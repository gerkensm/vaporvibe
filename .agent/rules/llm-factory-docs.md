---
trigger: glob
globs: **/src/llm/factory.ts
---

# Content from docs/modules/llm/factory.md

# Module Documentation: `llm/factory.ts`

> **File**: `src/llm/factory.ts`  
> **Last Updated**: Mon Oct 13 23:21:54 2025 +0200  
> **Commit ID**: `35b96340e256afe04c3c6fa684ae5cdae931088a`

> [!WARNING]
> This documentation is manually maintained and may be outdated. Always verify against the source code.

## Overview
`factory.ts` is the centralized instantiation point for all LLM clients in the application. It implements a simple **Factory Pattern** that takes a configuration object (`ProviderSettings`) and returns a concrete implementation of the `LlmClient` interface.

## Core Concepts & Implementation Details

### 1. Centralized Dependency Resolution
Instead of scattering `new OpenAiClient(...)` or `new GeminiClient(...)` calls throughout the codebase, this module centralizes that logic. This means:
-   **Single Point of Change**: Adding a new provider only requires importing the class and adding one `if` statement here.
-   **Uniform Interface**: Consumers (like `server.ts`) never need to know *which* class they are holding, only that it satisfies `LlmClient`.

### 2. Statelessness
The factory function `createLlmClient` is pure (stateless). It doesn't cache instances or manage singletons.
-   **Lifecycle**: The *caller* (usually `server.ts`) is responsible for holding the returned instance and managing its lifecycle (e.g., recreating it when settings change).
-   **Implication**: Calling this function is cheap, but the resulting objects might hold heavy resources (like network connections or large buffers), so they should be reused where possible.

## Key Functions

### `createLlmClient(settings: ProviderSettings): LlmClient`
The sole exported function.
-   **Input**: `settings` - A `ProviderSettings` object containing the `provider` string (enum) and all necessary API keys/model names.
-   **Logic**:
    -   Checks `settings.provider`.
    -   Instantiates the corresponding client class (`OpenAiClient`, `GeminiClient`, etc.), passing the *entire* `settings` object to the constructor.
    -   **Default Fallback**: If the provider string doesn't match a known case (e.g., explicit `anthropic` check is missing in the `if` chain but it falls through), it currently defaults to `AnthropicClient`. **Note**: This implicit fallback is a potential bug source if a new provider is added but not explicitly handled.

## Data Formats

### `ProviderSettings` (Input)
The factory relies on this type (from `types.ts`) to contain all necessary configuration for *any* provider.
```typescript
interface ProviderSettings {
  provider: ModelProvider; // 'openai' | 'gemini' | 'anthropic' | ...
  apiKey?: string;         // The active key for the selected provider
  // ... specific model fields
}
```

## Shortcomings & Technical Debt

### Architectural
-   **Implicit Default**: The function ends with `return new AnthropicClient(settings);`. This means if `settings.provider` is `'unknown_provider'`, it will try to create an Anthropic client, which will likely fail later. It should probably throw an `Error("Unknown provider: " + settings.provider)`.
-   **Hardcoded Mapping**: The mapping is hardcoded. A registry pattern (e.g., `ProviderRegistry.register('openai', OpenAiClient)`) would allow for dynamic plugin registration in the future without modifying this file.

### Implementation
-   **Type Safety**: The `settings` object is a union of all possible provider settings. The factory passes this "bag of options" to the specific client. It relies on the client to pick out what it needs. A more robust design might extract *only* the relevant settings for the specific provider before instantiation.

