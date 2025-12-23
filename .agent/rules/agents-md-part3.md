---
trigger: always_on
globs: **/*
---

**Purpose**: Enable seamless client-side navigation without full page reload.

**Implementation** (`frontend/public/vaporvibe-interceptor-sw.js`):
- Intercepts navigation requests in service worker
- Caches HTML responses in memory (90s TTL)
- MessageChannel communication between interceptor and worker
- Navigates via `window.location.replace()` after caching

**Lifecycle**:
1. Interceptor calls `ensureNavigationServiceWorker()` on load
2. Waits for service worker controller activation
3. On navigation: sends HTML via `postMessage({ type: "vaporvibe-cache-html", targetUrl, html })`
4. Service worker caches payload and acknowledges
5. Interceptor navigates to target URL
6. Service worker intercepts fetch, serves cached HTML
7. Browser renders instantly without server round-trip

**Fallback**: If service worker fails, falls back to `document.open()` / `document.write()` for in-place replacement.

### Instructions Panel

- **Purpose**: Allows users to provide quick, iterative feedback ("nudges") to the LLM for the next render without editing the main brief.
- **Mechanism**: If enabled, the backend injects `<script src="/vaporvibe/assets/vaporvibe-instructions-panel.js">`. This script adds a floating panel UI. Submitting instructions adds a special field (`LLM_WEB_SERVER_INSTRUCTIONS`) to the next form submission.
- **Source**: The panel logic lives in `frontend/src/instructions-panel.ts` and is bundled by Vite.

### Key Abstractions

- **Session Store (`src/server/session-store.ts`)**: Manages user history in memory, keyed by a session ID cookie. Tracks active forks (A/B comparisons), maintains per-branch history/REST snapshots, prunes old sessions based on TTL and capacity, and provides prompt context.
- **History Entries (`src/types.ts`)**: Each entry captures the request (method, path, query, body, instructions), the generated HTML, LLM settings (provider, model), token usage, reasoning traces (if enabled), any REST API calls made during that step, and optional fork metadata (e.g., branch ID, status, resolution details).
- **The Brief (`state.brief`)**: The central user-provided text guiding the LLM's behavior for the entire session. Can be updated via the Admin Console (`POST /api/admin/brief`).

### State Management Patterns

- **Volatile State:** Handled client-side within LLM-generated HTML using inline JS for micro-interactions (e.g., toggling UI elements).
- **View-to-View State:** Passed explicitly between LLM renders via URL query parameters (`GET`) or form submissions (`POST`).
- **Persistent State (Invisible):** Stored within HTML comments in the LLM-generated HTML. The LLM is instructed to find, preserve, and forward these comments across requests.

### Special Server Routes & API

- `/` & `/__setup` & `/vaporvibe`: Serve the React SPA shell (`frontend/dist/index.html`).
- `/assets/*`: Serve static assets (JS, CSS, etc.) from `frontend/dist/assets/`. Handled by `maybeServeFrontendAsset` in `src/server/server.ts`.
- `/api/admin/*`: JSON API endpoints for the Admin SPA. Handled by `AdminController` (`src/server/admin-controller.ts`).
  - `GET /api/admin/state`: Get current app config, provider status, model catalogs.
  - `POST /api/admin/brief`: Update brief and attachments.
  - `POST /api/admin/provider`: Update provider settings (model, tokens, etc.).
  - `POST /api/admin/provider/verify`: Verify an API key.
  - `POST /api/admin/runtime`: Update history limits, etc.
  - `GET /api/admin/history`: Get paginated history entries.
  - `POST /api/admin/history/import`: Import history snapshot.
  - `DELETE /api/admin/history/:id`: Delete a history entry.
  - `GET /api/admin/history.json` / `history.md`: Export history.
- `/api/admin/forks/*`: Endpoints for A/B comparison lifecycle (handled within `AdminController` in `src/server/admin-controller.ts`).
  - `POST /api/admin/forks/start`: Initiate an A/B test fork from a history entry.
  - `POST /api/admin/forks/:forkId/commit/:branchId`: Resolve a fork by promoting the selected branch back into the main timeline.
  - `POST /api/admin/forks/:forkId/discard`: Discard an active fork and all of its branches.
- `/rest_api/mutation/*` & `/rest_api/query/*`: Endpoints intended to be called via `fetch` from _within the LLM-generated HTML_ for lightweight state persistence or data retrieval without full page reloads. Handled by `RestApiController` (`src/server/rest-api-controller.ts`).
- `/__vaporvibe/result/{token}`: Temporary route used by the loading shell to fetch the asynchronously generated HTML.
- `/rest_api/image/generate`: Endpoint for generating images via the configured provider. Handled by `RestApiController`.

### A/B Testing (Forking)

- **Concept**: From any history entry, the admin can start a fork that creates two divergent branches (A and B) with their own instruction nudges. Each branch evolves independently while sharing the original session up to the fork point.
- **Branch Context**: Requests issued inside a fork include a hidden `__vaporvibe_branch` identifier (managed by the interceptor and instructions panel). The server uses it to load the correct branch’s history, `prevHtml`, and virtual REST state before calling the LLM.
- **Workspace UI**: The `/vaporvibe/ab-test/:forkId` route renders `ABWorkspaceShell`, which loads both branches in synchronized iframes, supports draggable split view, and provides actions to keep or discard outcomes.
- **Resolution**: Choosing a winning branch merges its accumulated history back into the primary timeline and clears fork metadata. Discarding abandons both branches and restores the pre-fork session state. While a fork is active, destructive history operations (export, purge, delete) are temporarily disabled.

### Download Tour (Clickthrough Prototypes)

**Purpose**: Export a session as a shareable, self-contained HTML prototype that replays the user's journey with an animated walkthrough.

**Architecture** (`src/llm/messages.ts` → `tourMode` branch):

1.  **Consolidation**: The LLM receives a special "tour mode" system prompt that instructs it to:
    - Audit the entire conversation history
    - Merge all distinct views/screens into a **single-page application** (SPA)
    - Implement a `switchView(viewId)` function for client-side navigation
    - **Prevent all browser reloads** — forms and links call JavaScript handlers instead

2.  **Driver.js Tour**: The LLM generates a `steps` array that:
    - Follows the user's **exact click path** from history (same order, same screens)
    - Uses `onHighlightStarted` hooks to trigger `switchView()` before highlighting
    - Preserves **exact user data** (form inputs, search queries, created content) from history
    - Auto-starts immediately on page load via `driverObj.drive()`

3.  **Simulated Interactions**:
    - **Typing animations**: Uses `setInterval` to type character-by-character into form fields
    - **Button clicks**: Uses `setTimeout` to trigger `element.click()` after a brief delay
    - **No auto-advance**: User manually clicks "Next" in the popover to proceed (not automated skipping)

4.  **Visual Fidelity**:
    - Copies exact Tailwind/CSS classes from history HTML
    - Reuses exact `<ai-image>` prompts and ratios
    - Highlights active element with `.driver-active-element` CSS (box-shadow, high z-index)

**Libraries Used**:
- **Driver.js** (`driver.js@1.4.0`): Step-by-step tour overlay with popover descriptions
- **Standard Library**: Tour output uses the same `/libs/*` assets available to normal generation

**Prompt Location**: `src/llm/messages.ts` lines 77-145 (the `tourMode` conditional branch)

**Key Design Decisions**:
- No `driverObj.moveNext()` calls — user controls tour pace via Next button
- No Rough Notation library — difficult to clean up annotations between steps
- Simple `setInterval` typing preferred over Typewriter.js for reliability
- Framework internals avoided (no `__x.$data`) — plain JS or public APIs only

### Token & Latency Tricks

Hallucinating UI on every request is fun, but we still like responses under a lunar cycle. Here are the shortcuts that keep things snappy:

- **Virtual REST API (aka "Of course that data exists")** – Pages call `/rest_api/query/...` or `/rest_api/mutation/...` just like they would a real backend. The cheeky twist is that the server already knows what shape the UI expects, so it replies with JSON in exactly that format—no schema drift, no "oops I forgot a field". Mutations get recorded and fed back in the next prompt so state feels persistent.
- **Component Placeholder Cache** – Every response gets annotated with stable `data-id`s on `<html>`, `<head>`, `<body>`, structural sections, helper scripts, and `<style>` blocks. Next render, the LLM can toss in `{{component:sl-gen-12}}` / `{{style:sl-style-3}}` and the server drops the cached markup back in. Chrome stays consistent, tokens stay low.
- **History Time Travel** – Because those caches live with each history entry, the model can resurrect a prior page wholesale when nothing changed. Sometimes the whole response is one `<html>` placeholder—it still feels like sorcery when it works.

### Navigation Interception & Loading Shell

- **Interceptor script** – Every LLM-rendered document receives `vaporvibe-interceptor.js`, which hijacks `<a>` clicks, `<form>` submits, and `popstate` to insert the `__vaporvibe=interceptor` marker. This keeps admin/setup routes inside the SPA while forcing full navigations for the generated experience.
- **Asynchronous result delivery** – When a non-interceptor request hits `/`, the server immediately streams the animated loading shell plus a hydration script. The real HTML is stored under a UUID token at `/__vaporvibe/result/{token}` (TTL: 15 minutes to accommodate \>10 minute generations) and is never regenerated for retries.
- **Hydration fetch** – The loader script performs a long-lived fetch for that token (no artificial timeout) and swaps in the HTML once it lands; transient network errors trigger lightweight retries without triggering a fresh LLM call because the fetch only reads the cached `/__vaporvibe/result` payload.
- **User feedback** – While the fetch is pending, status messages rotate and the overlay mini-experiences continue to run, so the user always sees progress even during extremely slow model responses.

---

## 6\. Repository Structure & Key Files

```
gerkensm-vaporvibe/
├── frontend/             # React SPA (Admin/Setup UI)
│   ├── index.html        # SPA entry point
│   ├── vite.config.ts    # Vite build config (multi-entry)
│   ├── src/
│   │   ├── App.tsx       # Root React component w/ Router
│   │   ├── main.tsx      # React DOM bootstrap
│   │   ├── api/          # Frontend API client (fetches from /api/admin/*)
│   │   ├── components/   # Reusable React UI components (ABWorkspaceShell, ConfirmationModal, Notifications, etc.) + styles (ABTesting.css)
│   │   ├── pages/        # Top-level page components (AdminDashboard, SetupWizard, AbTestWorkspacePage)
│   │   ├── interceptor.ts # Navigation interceptor logic (bundled)
│   │   └── instructions-panel.ts # Instructions panel logic (bundled)
│   └── dist/             # Compiled SPA assets (served by backend)
├── src/                  # Backend Node.js source
│   ├── index.ts          # Main CLI entry point
│   ├── server/
│   │   ├── server.ts     # Core HTTP server, routing, LLM request handling
│   │   ├── admin-controller.ts # Handles /api/admin/* endpoints
│   │   ├── rest-api-controller.ts # Handles /rest_api/* endpoints
│   │   └── session-store.ts # Manages session history
│   ├── llm/
│   │   ├── messages.ts   # **CRUCIAL: Prompt engineering logic**
│   │   ├── factory.ts    # Creates LLM client instances
│   │   └── *-client.ts   # Provider-specific API clients
│   ├── config/           # Configuration loading