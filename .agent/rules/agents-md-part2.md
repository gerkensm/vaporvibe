---
trigger: always_on
globs: **/*
---

  - **Hints/Errors:** Provide helper text below inputs (`.admin-field__helper`) and display validation errors clearly, often below the field (`.admin-field__error`), potentially using red text/borders.
  - _Reference:_ `.admin-field` structure, `TokenBudgetControl.css`, `ModelInspector.css` custom fields.
- **Buttons:**
  - **Styles:** Provide distinct styles for primary (solid accent color, often gradient), secondary (light background, accent border/text), and destructive actions (red). Use fully rounded (`999px`) corners.
  - **States:** Include clear hover and focus-visible states (e.g., slight transform, increased shadow). Disabled states should have reduced opacity.
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

### Standard Library & Offline Assets

- **Concept**: To prevent dependency on external CDNs (which might be blocked or flaky) and ensure consistent LLM outputs, VaporVibe serves a curated "Standard Library" of ~40 popular libraries (DaisyUI, Phaser, Chart.js, etc.) directly from `frontend/public/libs/`.
- **Composition Pipeline**:
  1.  **Build (`scripts/copy-libs.ts`)**: Copies assets from `frontend/node_modules/` to `frontend/public/libs/` and locks generic versions (e.g., `daisyui` -> `daisyui/4.12.24/full.css`).
  2.  **Manifest (`src/config/library-manifest.ts`)**: Defines available libraries, their descriptions, and injection rules (`always` vs `on-request`).
  3.  **Prompt Injection**: `src/llm/messages.ts` reads the manifest and injects the *exact* available versions into the system prompt. This prevents the LLM from hallucinating API methods for wrong versions.
- **Core Stacks**:
  - **CSS**: **DaisyUI** (v4 standalone) and **Tailwind CSS** are the core CSS stack (available on-request). DaisyUI provides component classes (`btn`, `card`) while Tailwind CSS provides the utility classes (`p-4`, `flex`).
  - **Game Engine**: **Phaser** (v3) is the supported engine (replacing Kaboom/Kaplay) due to its API stability and strong LLM training data presence.
- **Documentation**: See `docs/STANDARD_LIBRARY.md` for the full catalog and maintenance instructions.

### Library Special Cases 🛠️

Some libraries require specific handling in `scripts/copy-libs.ts` to ensure LLM compatibility:

- **Tailwind CSS**: We explicitly pin **v3.4.1** (via direct download in `copy-libs.ts`) instead of v4.
  - *Reasoning*: v4 is too new for current LLM training sets, leading to frequent hallucinations of non-existent APIs. v3 is "boring and predictable."
  - *Mechanism*: The script downloads the standalone runtime directly from the CDN to `vendors/` if missing, rather than using the npm package.
- **Anime.js**: We use **v3.2.2** (`lib/anime.min.js`) instead of v4.
  - *Reasoning*: v4 changed the global bundling format, breaking `window.anime` access. v3 is stable and acts as expected.
- **Marked**: We use the UMD build (`lib/marked.umd.js`) to ensure `window.marked` is available globally without build steps.

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