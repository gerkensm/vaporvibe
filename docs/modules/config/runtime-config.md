# Module Documentation: `config/runtime-config.ts`

> **File**: `src/config/runtime-config.ts`  
> **Last Updated**: Sat Oct 25 16:51:43 2025 +0200  
> **Commit ID**: `eafda53be246e6c62151e15e9b532da876719dce`

> [!WARNING]
> This documentation is manually maintained and may be outdated. Always verify against the source code.

## Overview
`runtime-config.ts` is the configuration bootstrapper for the application. Its primary job is to resolve the `AppConfig` object at startup by merging inputs from:
1.  **CLI Arguments** (`options`): Passed from `cli/args.ts`.
2.  **Environment Variables** (`env`): `process.env`.
3.  **Persisted Settings** (`ConfigStore`): User-configured settings saved from previous sessions.
4.  **Persisted Credentials**: Stored API keys from `CredentialStore`.
5.  **Hardcoded Defaults**: Constants from `constants.ts`.

It implements the logic to automatically detect which LLM provider to use based on available keys and enforces a strict precedence order.

## Core Concepts & Implementation Details

### 1. Configuration Precedence
The module follows a "Cascading Configuration" pattern. For almost every setting (e.g., `port`, `model`), the resolution order is:
1.  **CLI Flag**: `--port 3000` (Highest priority)
2.  **Environment Variable**: `PORT=3000`
3.  **Persisted Setting**: Saved from previous run.
4.  **Default**: `DEFAULT_PORT` (Lowest priority)

### 2. Provider Detection Logic (`determineProvider`)
The app tries to be smart about which provider to use if none is explicitly requested.
-   **Explicit Selection**: If `--provider` or `SERVE_LLM_PROVIDER` is set, it respects that (and marks the provider as "locked").
-   **Persisted Preference**: If no explicit override, checks `ConfigStore` for the last used provider.
-   **Auto-Detection**: If neither of the above, it scans for API keys (both in `env` and `CredentialStore`).
    -   If *only* OpenAI keys are found -> defaults to OpenAI.
    -   If *only* Gemini keys are found -> defaults to Gemini.
    -   If *multiple* keys are found -> defaults to OpenAI (arbitrary tie-breaker).
    -   If *no* keys are found -> defaults to OpenAI (and will likely prompt the user later).

### 3. Reasoning Configuration (`resolveReasoningOptions`)
Handling "reasoning" (Chain of Thought) settings is complex because different providers expose it differently.
-   **Mode**: `low`, `medium`, `high` (mapped to provider-specific settings).
-   **Tokens**: Some providers (Anthropic) allow setting an explicit token budget for thinking.
-   **Logic**: The code parses `--reasoning-mode` and `--reasoning-tokens`. If a user sets a token budget but disables the mode, it tries to infer the intent (e.g., setting mode to `medium`).

### 4. Credential Loading
The module attempts to load API keys from the secure store (`getCredentialStore().getApiKey`) if they aren't provided in the environment. This allows for a smooth developer experience where you only login once.

## Key Functions

### `resolveAppConfig(options, env)`
The main entry point.
-   **Returns**: `Promise<AppConfig>`
-   **Logic**:
    1.  Calls `determineProvider` to pick the active provider.
    2.  Calls `resolveProviderSettings` to get keys/models for that provider.
    3.  Calls `resolveRuntime` to get general app settings (port, history limits).
    4.  Merges everything into the final config object.

### `resolveProviderSettings(provider, options, env)`
Builds the `ProviderSettings` object for the *selected* provider.
-   **Provider-Specific Logic**: It has `if (provider === 'openai') ...` blocks to handle provider-specific defaults (e.g., OpenAI defaults to `gpt-4o`, Gemini to `gemini-1.5-pro`).
-   **Key Lookup**: Checks `env` first, then `CredentialStore`.

## Data Formats

### `AppConfig`
The final resolved configuration object used by `server.ts`.
```typescript
interface AppConfig {
  provider: ProviderSettings; // Active provider config
  runtime: RuntimeConfig;     // General app config
  providerReady: boolean;     // Do we have a valid key?
  providerLocked: boolean;    // Was provider explicitly set via CLI/Env?
  providerSelectionRequired: boolean; // Do we need to ask the user?
  providersWithKeys: ModelProvider[]; // List of all providers we found keys for
}
```

## Shortcomings & Technical Debt

### Architectural
-   **Hardcoded Provider Logic**: The `resolveProviderSettings` function has a growing list of `if` statements for each provider. As we add more providers (DeepSeek, Mistral), this function will become unmaintainable. **Recommendation**: Move provider-specific config resolution into the provider classes or a config strategy pattern.
-   **Sync/Async Mixing**: Some parts are async (credential store) while others are sync. This is handled correctly but makes the flow harder to trace.

### Implementation
-   **Environment Variable Explosion**: We check multiple env vars for the same thing (e.g., `GEMINI_API_KEY`, `GEMINI_KEY`, `GOOGLE_API_KEY`). While user-friendly, it makes the code verbose and hard to document definitively.
-   **Side Effects**: `applyProviderEnv` mutates `process.env`. This is done to ensure that underlying SDKs (which might look at env vars directly) work correctly, but mutating global state is generally risky.
