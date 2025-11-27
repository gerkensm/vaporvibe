---
trigger: glob
globs: **/src/server/session-store.ts
---

# Content from docs/modules/server/session-store.md

# Module Documentation: `server/session-store.ts`

> **File**: `src/server/session-store.ts`  
> **Last Updated**: Sat Oct 25 16:51:43 2025 +0200  
> **Commit ID**: `eafda53be246e6c62151e15e9b532da876719dce`

> [!WARNING]
> This documentation is manually maintained and may be outdated. Always verify against the source code.

## Overview
`session-store.ts` is the backbone of state management in VaporVibe. It provides an in-memory, session-based storage system that persists user interactions across HTTP requests. Unlike stateless REST APIs, VaporVibe maintains a rich context for each user, including their conversation history, A/B testing state, and a virtual "database" of REST API mutations.

## Core Concepts & Implementation Details

### 1. Session Data Model
Each session is identified by a secure, random 32-character hex token stored in an HTTP-only cookie (`sid`). The session data (`SessionData`) contains:
-   **`history`**: An ordered array of `HistoryEntry` objects (HTML pages and REST calls).
-   **`prevHtml`**: The most recent HTML generated, used as context for the next LLM prompt.
-   **`rest`**: A record of "virtual" REST API mutations and queries.
-   **`activeFork`**: Optional state for A/B testing (see below).
-   **`updatedAt`**: Timestamp for TTL expiration.

### 2. Lifecycle Management
-   **Creation**: `getOrCreateSessionId` handles cookie generation and validation.
-   **Expiration**: Sessions have a TTL (Time To Live). Accessing an expired session triggers its deletion.
-   **Eviction**: An LRU (Least Recently Used) mechanism (`pruneSessions`) ensures the server doesn't run out of memory by removing old sessions when capacity is exceeded.

### 3. A/B Testing (Forks)
The store implements a sophisticated branching mechanism.
-   **`startFork`**: Creates a divergence point in history.
-   **`BranchState`**: Each branch (A/B) has its own isolated `history`, `prevHtml`, and `rest` state.
-   **Isolation**: When a fork is active, operations like `appendHistoryEntry` are routed to the active branch, ensuring that actions in Branch A don't pollute Branch B.
-   **Resolution**: `resolveFork` merges the winning branch's history back into the main timeline and discards the loser.

### 4. Virtual REST API State
To save tokens, the app simulates a backend. The session store tracks `mutations` (write ops) and `queries` (read ops).
-   **Persistence**: Mutations are stored so they can be fed back into the LLM's context window.
-   **Limits**: `REST_RECORD_LIMIT` (25) prevents the context from growing indefinitely.

## Key Functions

### `getOrCreateSessionId(cookies, res)`
Retrieves the session ID from cookies or creates a new one. Handles setting the `Set-Cookie` header with appropriate security flags (`HttpOnly`, `SameSite=Lax`).

### `getHistoryForPrompt(sid, branchId)`
Constructs the linear history needed for the LLM context.
-   **Normal Mode**: Returns the session's linear history.
-   **Fork Mode**: Returns the *base* history (up to the fork point) + the *branch* history. This "time travel" view allows the LLM to see a consistent timeline even inside a branch.

### `startFork(sid, baseEntryId, instructionsA, instructionsB)`
Initiates an A/B test. It clones the component caches from the base entry so that both branches start with the same "knowledge" of previously generated UI components.

### `resolveFork(sid, forkId, chosenBranchId)`
The complex logic for ending a test.
1.  Identifies the winning branch.
2.  Marks the winner's entries as `status: "chosen"`.
3.  Marks the loser's entries as `status: "discarded"`.
4.  Appends the winner's history to the main session.
5.  Updates the main session's `prevHtml` and REST state to match the winner.

## Data Formats

### `SessionData`
```typescript
interface SessionData {
  updatedAt: number;
  prevHtml: string;
  history: HistoryEntry[];
  rest: {
    mutations: RestMutationRecord[];
    queries: RestQueryRecord[];
  };
  activeFork?: ForkState;
}
```

### `ForkState`
```typescript
interface ForkState {
  forkId: string;
  originEntryId: string;
  status: "active" | "resolved";
  branches: Map<string, BranchState>;
}
```

## Shortcomings & Technical Debt

### Architectural
-   **In-Memory Only**: Sessions are lost on server restart. This is by design for a prototype but limits production use.
-   **Concurrency**: There is no locking. If two requests modify the same session simultaneously (rare in this single-user model), race conditions could occur.

### Implementation
-   **Deep Cloning**: The store relies heavily on `structuredClone` for isolation. As history grows, this could become a performance bottleneck.
-   **Complex Fork Logic**: The `resolveFork` method is very dense and handles many state transitions (history merging, cache merging, REST state merging). It is a high-risk area for bugs.

