# Transition UX & Loading Architecture

> **Context**: When a user submits a prompt, the LLM generation can take 10-60 seconds. To prevent user abandonment, we serve an immediate "Loading Shell" that entertains the user and establishes a "Side-Channel" for real-time reasoning updates.

## 1. The Loading Shell (`src/views/loading-shell.ts`)

The Loading Shell is a lightweight, server-side rendered HTML page served immediately upon a `POST` request to the Virtual REST API.

### Core Responsibilities
1.  **Immediate Feedback**: Responds with 200 OK instantly, replacing the current page.
2.  **Status Rotation**: Runs a client-side script to cycle through "waiting messages" (e.g., "Aligning vectors...", "Consulting the oracle...").
3.  **Reasoning Stream**: Connects to the server's SSE endpoint to display "Thinking..." logs if the model supports it.
4.  **Hydration**: Polls for the final result and swaps the document content when ready.

### The "Hydration" Mechanism
The shell includes a script (`hydrate.js`) that polls `/__vaporvibe/result/{token}`.
-   **Pending State**: The server holds the final HTML in `MutableServerState.pendingHtml` (in-memory).
-   **Completion**: When the LLM finishes, the polling endpoint returns the full HTML.
-   **Swap**: The script uses `document.open()`, `document.write()`, and `document.close()` to replace the entire DOM with the new application, effectively navigating the user without a full page reload.

## 2. Waiting Effects (`status-rotation.js`)

To keep the user engaged, we display a rotating set of status messages.

-   **Source**: `src/views/loading-shell/assets/status-messages.json`
-   **Logic**:
    -   Selects a random starting message.
    -   Updates every ~2.5 seconds.
    -   Uses a "glitch" or "fade" effect (CSS) to smooth transitions.
-   **Reasoning Mode**: If the model streams reasoning (e.g., o1, Claude 3.5), the status rotation is often suppressed or augmented by the real-time log stream.

## 3. The Overlay Playground (`src/views/overlay-debug.ts`)

The Overlay is a visual effect layer (e.g., "Token Rain", "Matrix Code") that runs *on top* of the current page during navigation or loading.

### Debugging Route: `/__overlay-debug`
Developers can test these effects in isolation without triggering an LLM cost.
-   **File**: `src/views/overlay-debug.ts`
-   **Usage**: Go to `http://localhost:3000/__overlay-debug`.
-   **Mechanism**: It dispatches `CustomEvent("vaporvibe:preview-overlay")` which the `vaporvibe-interceptor.js` listens for.

### Implementation Pitfalls

#### ⚠️ Variable Scope in Re-runs
When the Loading Shell swaps the page (Hydration), it nukes the previous `window` context *mostly*, but some browser artifacts might persist if not cleaned up.
-   **Issue**: If `hydrate.js` or `interceptor.js` declares global `const` or `let` variables, re-injecting them might cause "Identifier has already been declared" errors.
-   **Fix**: We wrap these scripts in IIFEs (Immediately Invoked Function Expressions) or check `if (window.__vaporvibeScriptLoaded) return;`.

#### ⚠️ Dev vs. Prod Assets
-   **Dev Mode**: The server proxies requests to the Vite dev server (`http://localhost:5173`). Assets are hot-reloaded.
-   **Prod Mode**: Assets are read from `frontend/dist`.
-   **Risk**: The Loading Shell is *always* server-rendered (it's not part of the React SPA). It must manually resolve asset paths. `loading-shell.ts` has logic to read from `src/views/loading-shell/assets` in dev and `dist/assets` in prod.

#### ⚠️ The "Pending HTML" Race Condition
If the server restarts while a user is on the Loading Shell:
1.  User is polling `/__vaporvibe/result/xyz`.
2.  Server restarts -> `MutableServerState` is cleared.
3.  User's poll returns 404.
4.  **Result**: The user is stuck on "Loading..." forever.
5.  **Mitigation**: The `hydrate.js` script has a timeout/error handler that redirects to history or shows a "Session Lost" error after N retries.
