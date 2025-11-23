---
trigger: always_on
globs: **/*
---


  - **Placement:** Group actions logically, often at the bottom of a form or card section.
  - _Reference:_ `.admin-primary`, `.admin-secondary`, `.admin-danger` styles.
- **Navigation/Tabs:** For secondary navigation within a view, use tab patterns with clear active states (e.g., background color change, shadow).
  - _Reference:_ `.tabs`, `.tab-button` styles.
- **Status Communication:**
  - **Loading:** Indicate loading states clearly, potentially using spinners, skeletons, or placeholder text. The main loading overlay (`src/views/loading-shell/`) provides inspiration for full-page waits.
  - **Notifications:** Use temporary notifications/toasts for confirmations or non-critical errors.
    - _Reference:_ `frontend/src/components/Notifications.tsx`.
  - **Inline Status:** Use inline messages (e.g., `.admin-status`) or visual cues (color changes) for context-specific feedback. Badges/pills can convey status concisely.

### Component Inspiration

While the LLM generates raw HTML/CSS/JS, the structure and patterns found in the `VaporVibe` admin UI components can serve as excellent conceptual references:

- **`AttachmentUploader.tsx`**: Demonstrates handling file inputs, drag-and-drop states, previews, and status feedback. The default variant is a good baseline.
- **`ModelSelector.tsx` / `ModelInspector.tsx`**: Showcases card-based selection patterns, using badges for capabilities, and structured display of complex information.
- **`HistoryExplorer.tsx`**: Provides a pattern for displaying lists of items with expandable details (`<details>`), metadata chips (`.history-chip`), and contextual actions.
- **`TokenBudgetControl.tsx`**: Example of a custom input control combining a slider and number input with clear labels and hints.
- **`Notifications.tsx`**: Basic pattern for dismissible toast notifications.

_Code References:_ Primarily `frontend/src/components/` and associated CSS files (`frontend/src/components/*.css`), plus general layout in `frontend/src/pages/AdminDashboard.css`.

### Points of Caution ⚠️ (Admin UI Inconsistencies)

The admin UI is functional but has some minor inconsistencies the LLM should _not_ treat as strict rules for generated apps:

- **Varying `border-radius`:** Values like `12px`, `14px`, `16px`, `18px`, `20px`, `22px`, `24px`, `28px`, `32px` are used. **Guideline:** Aim for a simpler set, e.g., small (`~8px`), medium (`~16px`), large (`~24px`), and pill (`999px`).
- **Varying `box-shadow`:** Shadow styles differ slightly between components. **Guideline:** Use consistent shadow depths for similar element types (e.g., one style for cards, one for primary buttons).
- **Stylized Variants:** Components like `AttachmentUploader` have highly stylized "creative" and "history" variants. **Guideline:** Generated apps should generally stick to simpler, more conventional styles unless the brief specifically requests high visual flair. The default variant is a better reference.

**Instruction:** When generating UI, draw inspiration from the _patterns_ and _general aesthetic_ of the admin UI, but prioritize consistency, clarity, and the specific needs of the app brief over replicating every minor detail or inconsistency found in `frontend/`.

---

## 5\. Core Mechanisms & Technical Details

### The Core Prompt

- **Location**: Logic is centralized in `buildMessages()` within `src/llm/messages.ts`.
- **Compilation**: Assembles `system` (rules) and `user` (context) messages.
- **Content**: Includes the App Brief, current request details, previous HTML, curated session history, and recent REST API state.

### Navigation Interception

- **Purpose**: Shows a loading overlay during LLM generation instead of a blank screen.
- **Mechanism**: The backend injects `<script src="/vaporvibe/assets/vaporvibe-interceptor.js">` into every LLM-generated HTML response. This script intercepts `<a>` clicks and `<form>` submissions, displays the overlay, and re-initiates the request, adding a marker (`__vaporvibe=interceptor`) so the server knows to send back the final HTML directly (or handle API calls).
- **Source**: The interceptor logic lives in `frontend/src/interceptor.ts` and is bundled by Vite.
- **Navigation Methods**:
  - **Fetch-based navigation**: Uses `performRequest()` to fetch HTML, then `replaceDocumentWithHtml()` for in-place document replacement
  - **Form handling**: Supports both GET (URL params) and POST (FormData/URLSearchParams) submissions
  - **History management**: Preserves browser history state across client-side navigations
  - **Poll-for-result**: Handles async rendering via `Link` headers with exponential backoff retry

### Reasoning Stream Display (Live Model Thinking)

VaporVibe displays **live reasoning streams** from LLMs that support extended thinking (Anthropic, Gemini, Groq, OpenAI o-series). The reasoning visualization appears in **two contexts**:

#### A. Navigation Interceptor Overlay (`frontend/src/interceptor.ts`)

**For client-side SPA navigation:**
- Glassmorphism reasoning panel integrated into the loading overlay
- Real-time EventSource connection to `/__vaporvibe/reasoning/{token}`
- Markdown rendering with syntax highlighting, code blocks, lists, links
- Streaming character-by-character animation (~160 chars/sec)
- Sticky scrolling (auto-scroll unless user scrolls up)
- Transparent scrollbars that appear on hover

#### B. Server-Rendered Transition Page (`src/views/loading-shell/`)

**For server-rendered loading pages:**
- **`reasoning-stream.js`**: Handles EventSource connection, delta accumulation, markdown rendering, sticky scrolling
- **`styles.css`**: Reasoning panel styling matching interceptor aesthetic
- **`loading-shell.ts`**: HTML structure with reasoning panel elements

**Shared Features Across Both Implementations:**
- Real-time delta accumulation from `/__vaporvibe/reasoning/{token}` SSE endpoint
- Support for summaries, live thoughts, and final reasoning traces
- Unified "Thinking aloud" (streaming) / "Final reasoning" (complete) headers
- Markdown rendering: headings, lists, code blocks, inline formatting, links
- Sticky scrolling: auto-scroll to bottom unless user manually scrolls up
- Character-by-character streaming animation for smooth reveal

#### Stream Architecture

**Backend (`src/server/server.ts`):**
1. `isReasoningStreamEnabled()` checks if model supports reasoning and creates stream observer
2. Attaches `LlmStreamObserver` to LLM client when generating HTML
3. Observer receives `onReasoningEvent({ kind: "thinking" | "summary", text })` callbacks
4. Stream controller (`src/server/reasoning-stream-controller.ts`) manages SSE connections
5. Emits deltas as `event: reasoning` with JSON payloads: `{ kind, text }`
6. Sends final trace as `event: final` with `{ summaries, details }`
7. Closes stream with `event: complete`

**LLM Client Integration:**
- All clients now accept `LlmGenerateOptions` with optional `streamObserver`
- During streaming, clients call `observer.onReasoningEvent()` for each delta
- **Anthropic**: Emits thinking deltas from stream events
- **Gemini**: Handles Pro (thinkingLevel) vs Flash (thinkingBudget) split, emits thoughts
- **Groq**: Uses string buffers (`summaryBuffer`, `detailBuffer`) to accumulate deltas and prevent fragmentation
- **OpenAI o-series**: Future support placeholder

**Frontend Rendering:**
- `buildSnapshot()`: Constructs reasoning log state from accumulated buffers
- `snapshotToMarkdown()`: Converts state to markdown with headers
- `markdownToHtml()`: Renders markdown to HTML with syntax highlighting
- `scheduleAnimation()`: Queues character-by-character reveal using `requestAnimationFrame`
- `animationStep()`: Progressive rendering at ~160 chars/sec (faster when finalized)

**Sticky Scrolling Pattern:**
- `userScrolled` flag tracks manual scroll-up
- `isNearBottom()` checks if scroll position is within `REASONING_SCROLL_TOLERANCE` (28px)
- Auto-scroll resumes when user scrolls back to bottom
- Respects user intent: no forced scrolling while exploring earlier content

#### Groq-Specific Reasoning Behavior

**Challenge**: Groq's API streams reasoning deltas token-by-token, which would create fragmented "Step 1", "Step 2" entries if treated naively.

**Solution** (`src/llm/groq-client.ts`):
- Uses **string buffers** (`summaryBuffer`, `detailBuffer`) instead of arrays
- `processStreamingReasoningDelta()` appends incoming text to buffers
- `normalizeReasoningEntries()` filters noise using `/^[\s\.]+$/` regex
- `mergeReasoningTraces()` intelligently merges streaming buffers with final response
- Constructs `raw` field from streaming buffers for clean history JSON

**Result**: Reasoning displays as a single coherent block instead of fragmenting into multiple steps.

### Service Worker for Navigation Caching

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