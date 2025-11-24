---
trigger: glob
globs: **/src/server/admin-controller.ts
---

# Content from docs/modules/server/admin-controller.md

# Module Documentation: `server/admin-controller.ts`

> **File**: `src/server/admin-controller.ts`  
> **Last Updated**: Sat Oct 25 16:51:43 2025 +0200  
> **Commit ID**: `eafda53be246e6c62151e15e9b532da876719dce`

> [!WARNING]
> This documentation is manually maintained and may be outdated. Always verify against the source code.

## Overview
The `AdminController` is the central orchestrator for all administrative operations. It handles two distinct routing patterns:
1.  **Form-Based Routes** (`/vaporvibe/*`): Legacy endpoints that redirect with status messages (used by the setup wizard).
2.  **JSON API Routes** (`/api/admin/*`): Modern REST-like endpoints used by the React admin dashboard.

It manages provider configuration, brief updates, runtime settings, session history, and the A/B test fork lifecycle.

## Core Concepts & Implementation Details

### 1. Route Dispatch Architecture
The controller splits traffic in `handle(context)`:
-   **`/vaporvibe/*`**: Dispatched to form handlers (e.g., `handleProviderUpdate`). These return 302 Redirects.
-   **`/api/admin/*`**: Dispatched to `handleApi(context)`. These return JSON responses (`AdminUpdateResponse`, `AdminStateResponse`).

### 2. State Management Interactions
The controller acts as a bridge between the HTTP layer and three state systems:
-   **`MutableServerState`**: Global config (provider settings, brief, runtime config).
-   **`SessionStore`**: Per-session history and active forks.
-   **`CredentialStore`**: Secure OS-native storage for API keys.

### 3. Provider Configuration Flow
Updating a provider is complex due to validation rules:
1.  **Lock Check**: Ensures provider isn't locked by CLI flags.
2.  **Reasoning Check**: Validates if the selected model supports the requested reasoning mode.
3.  **Token Clamping**: Enforces min/max token limits based on provider guidance.
4.  **Key Resolution**: Checks UI input -> CredentialStore -> Env Vars.
5.  **Verification**: Optionally calls `verifyProviderApiKey` to test the key.
6.  **Instantiation**: Creates a new `LlmClient` and updates the global state.

### 4. A/B Testing Lifecycle
The controller exposes endpoints to manage forks:
-   **Start (`POST /forks/start`)**: Creates two isolated branches.
-   **Commit (`POST /forks/:id/commit/:branch`)**: Merges the winner to main history.
-   **Discard (`POST /forks/:id/discard`)**: Reverts to the pre-fork state.

## Key API Endpoints

### JSON API (`/api/admin/*`)

| Endpoint           | Method | Purpose                                                           |
| :----------------- | :----- | :---------------------------------------------------------------- |
| `/state`           | GET    | Returns full dashboard state (config, masked keys, active forks). |
| `/provider`        | POST   | Updates LLM provider/model settings.                              |
| `/provider/verify` | POST   | Tests an API key without saving.                                  |
| `/runtime`         | POST   | Updates history limits and UI toggles.                            |
| `/brief`           | POST   | Updates the system brief and attachments.                         |
| `/history`         | GET    | Returns paginated history entries.                                |
| `/history/import`  | POST   | Imports a session snapshot JSON.                                  |
| `/forks/start`     | POST   | Initiates an A/B test.                                            |

### Form API (`/vaporvibe/*`)

| Endpoint             | Method | Purpose                                 |
| :------------------- | :----- | :-------------------------------------- |
| `/update-provider`   | POST   | Form-based provider update (redirects). |
| `/history.json`      | GET    | Exports history as JSON download.       |
| `/history/prompt.md` | GET    | Exports history as Markdown download.   |

## Data Formats

### `AdminStateResponse`
The massive payload sent to the dashboard.
```typescript
interface AdminStateResponse {
  provider: AdminProviderInfo; // Masked keys
  runtime: AdminRuntimeInfo;
  brief: string | null;
  attachments: AdminBriefAttachment[];
  providerReady: boolean;
  activeForks: AdminActiveForkSummary[];
  // ...
}
```

### `HistorySnapshot`
Used for import/export.
```typescript
interface HistorySnapshot {
  version: number;
  history: HistoryEntry[];
  brief?: string;
  runtime?: Partial<RuntimeConfig>;
  llm?: Partial<ProviderSettings>;
}
```

## Shortcomings & Technical Debt

### Architectural
-   **Controller Bloat**: This class handles routing, validation, business logic, and response formatting. It is a "God Class". **Recommendation**: Split into `AdminRouter`, `AdminService`, and `AdminSerializer`.
-   **Dual APIs**: Maintaining both Form and JSON APIs for similar features (e.g., provider update) is redundant. The Form API should eventually be deprecated in favor of a client-side setup wizard consuming the JSON API.

### Implementation
-   **Manual Validation**: Input validation is repetitive (e.g., `typeof body.data.foo === 'string'`). Should use a schema library like `zod`.
-   **Synchronous Mutations**: State updates are synchronous and unguarded. Race conditions are possible (though unlikely in single-user mode).

