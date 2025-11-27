---
trigger: glob
globs: **/src/server/rest-api-controller.ts
---

# Content from docs/modules/server/rest-api-controller.md

# Module Documentation: `server/rest-api-controller.ts`

> **File**: `src/server/rest-api-controller.ts`  
> **Last Updated**: Sat Oct 25 16:51:43 2025 +0200  
> **Commit ID**: `eafda53be246e6c62151e15e9b532da876719dce`

> [!WARNING]
> This documentation is manually maintained and may be outdated. Always verify against the source code.

## Overview
The `RestApiController` implements the "Virtual REST API" system. It intercepts requests to `/rest_api/*` and uses the LLM to generate contextual JSON responses on the fly. This allows generated applications to simulate backend interactions (CRUD operations) without a real database, significantly reducing token usage by avoiding full page regenerations for small data updates.

## Core Concepts & Implementation Details

### 1. Virtual Backend
Instead of routing to a database, this controller routes to the LLM.
-   **Query (`/rest_api/query/*`)**: Read-only operations. The LLM generates JSON based on the current context (brief, history).
-   **Mutation (`/rest_api/mutation/*`)**: Write operations. The LLM generates a success response, and the controller *records* this mutation in the session history.

### 2. State Persistence via Context
Since there is no database, "persistence" is achieved by feeding the history of mutations back into the LLM's context window.
-   **Flow**: User POSTs to `/rest_api/mutation/add-todo` -> Controller saves `{ method: "POST", path: "...", body: "..." }` to session -> Next LLM prompt includes "Recent REST Mutations: add-todo..." -> LLM "remembers" the item exists.

### 3. Token Optimization
This is the primary architectural driver.
-   **Traditional**: User clicks "Add" -> Server regenerates full HTML (10k tokens).
-   **Virtual REST**: User clicks "Add" -> Client `fetch` -> Server generates small JSON (200 tokens) -> Client updates DOM.

## Key Functions

### `handle(context, logger)`
The main dispatcher. Checks if the path starts with `/rest_api/` and routes to `handleMutation` or `handleQuery`. Returns `false` if not a REST path, allowing the main server to handle it.

### `handleMutation(context, logger)`
1.  Validates the provider is ready.
2.  Extracts `branchId` (for A/B testing isolation).
3.  Records the mutation in `SessionStore`.
4.  Returns a generic `{ success: true }` JSON response (mutations are currently fire-and-forget from the client's perspective, though the LLM sees them).

### `handleQuery(context, logger)`
1.  Constructs a prompt using `preparePromptContext` (similar to the main page generation but optimized for JSON).
2.  Calls `llmClient.generateHtml` (reused method, but prompt instructs JSON output).
3.  Sanitizes the output (strips Markdown code blocks) and parses JSON.
4.  Returns the JSON to the client.
5.  Records the query in history so the LLM knows what data the user has seen.

## Data Formats

### `RestMutationRecord`
Stored in `SessionStore` to represent a state change.
```typescript
interface RestMutationRecord {
  id: string;
  path: string;
  method: string;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
  createdAt: string;
}
```

## Shortcomings & Technical Debt

### Architectural
-   **Illusion of Persistence**: If the session history gets too long and mutations are truncated from the prompt, the LLM will "forget" data. This makes it unsuitable for long-lived or data-heavy applications.
-   **Latency**: Queries still require an LLM round-trip (seconds), which is much slower than a real DB (milliseconds).

### Implementation
-   **JSON Reliability**: We rely on the LLM to output valid JSON. While we have parsing logic and error handling (`try/catch`), models can still hallucinate malformed data, causing 502 errors.
-   **Prompt Duplication**: `handleQuery` duplicates much of the prompt construction logic from `server.ts`. This logic should be unified.

