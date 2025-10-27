# Agent Onboarding Guide: VaporVibe

Welcome! This guide provides the high-level context, architectural details, and philosophical principles needed to understand and contribute to the `VaporVibe` repository. 🤖

---

## 1. Core Concept & Purpose

`VaporVibe` is a "vibe non-coding" experiment where an LLM improvises an entire interactive web application on every request based on a simple, natural language **brief**.

- **Primary Goal**: To function as a "rapid-prototyping cheat code," allowing you to validate a UX flow or interaction idea without writing any frontend or backend code.
- **Core Philosophy**: It's an "intentionally unserious" and "cheeky thought experiment". The joy is in watching the model "make it up as it goes," embracing the creative chaos of generative AI.
- **Key Feature**: It supports multiple LLM providers (OpenAI, Google Gemini, Anthropic, xAI Grok, and Groq), allowing you to see how different models interpret the same brief.

---

## 2. Architecture & Request Flow

The system operates on a request-response cycle involving the backend server, a React SPA for admin/setup, and an external LLM provider for app generation.

### The Vibe-Driven App Request Cycle 🌀

This loop renders the _application_ pages once the server is configured.

```mermaid
graph TD
    subgraph Browser (User App View)
        A[User Clicks Link or Submits Form] --> B;
        H[Page Re-renders with LLM HTML] --> A;
    end

    subgraph "VaporVibe Server (Node.js)"
        B(HTTP Request Receives) --> C[Assembles Prompt<br/>- App Brief<br/>- Request Details<br/>- Session History<br/>- REST API State];
        C --> D{LLM Provider API};
        E --> F[Updates Session History];
        F --> G(Sends HTML Response with Injected Scripts);
    end

    subgraph "LLM Provider"
      D -- Sends Prompt --> LLM[OpenAI / Gemini / Anthropic / Grok / Groq];
      LLM -- Generates Full HTML --> E(Receives HTML);
    end

    G --> H;
```

1.  A user action in the browser sends an HTTP request (`GET` or `POST`) to the `VaporVibe` server.
2.  The server assembles a detailed prompt (`src/llm/messages.ts`) containing the app brief, request details (method, path, query, body), relevant session history, and recent REST API interaction state.
3.  This prompt is sent to the configured LLM provider's API.
4.  The LLM generates a complete, self-contained HTML document for the requested view.
5.  The server receives the HTML, updates the session history (`src/server/session-store.ts`), injects helper scripts (`vaporvibe-interceptor.js`, `vaporvibe-instructions-panel.js`), and sends the final HTML back to the browser.

### The Setup & Configuration Flow ✨ (React SPA)

When first launched, the server guides the user through a browser-based setup wizard served by the React SPA.

1.  The CLI launches the server and opens a browser to `http://localhost:3000/__setup`.
2.  The React SPA (`frontend/src/pages/SetupWizard.tsx`) prompts the user to select a provider and enter an API key.
3.  The SPA sends the key to the backend (`POST /api/admin/provider/verify`) for verification against the provider's API.
4.  Once verified, the SPA prompts for the initial application **brief**.
5.  The SPA submits the brief to the backend (`POST /api/admin/brief`).
6.  On success, the SPA automatically opens the application root (`/`) in a **new browser tab** and displays a "launch pad" overlay. The original tab remains on the Admin Console SPA (`/vaporvibe`).

### The Admin Console Flow 🕹️ (React SPA)

The admin console at `/vaporvibe` is a **React SPA** (built in `frontend/`) serving as the control center.

- **SPA Interaction**: All interactions (viewing state, updating brief/provider/runtime settings, browsing history, importing/exporting) are handled client-side within the React application.
- **API Driven**: The SPA communicates with the backend exclusively through **JSON API endpoints** under `/api/admin/*`. The backend no longer renders any admin HTML directly.
- **Live Controls**: Tweak the global brief, manage attachments, adjust history limits, switch providers/models, and update API keys via API calls without restarting the server.
- **History Explorer**: Inspect every generated page (including REST API interactions), view token usage, raw HTML, and model reasoning traces fetched via `/api/admin/history`.
- **Import/Export**: Download session snapshots (`GET /api/admin/history.json`) or prompt markdown (`GET /api/admin/history.md`). Upload snapshots via drag-drop (`POST /api/admin/history/import`).

---

## 3\. Project Philosophy & Vibe

This is not a traditional software project; it's a creative tool. The "vibe" is crucial.

### Guiding Principles ("Vibe Non-Coding")

- **Improvised & Playful**: Embrace the "chaos" of the LLM's creativity. Slight variations between renders are a feature, not a bug. Focus prompts on guiding the creative process, not enforcing rigid structures. The goal is plausible improvisation.
- **High-Fidelity Prototyping**: The generated output should look and feel like a real application, using convincing, non-placeholder data to make the experience feel complete.
- **Delightful & Modern**: The system prompt explicitly asks the LLM to craft a "gorgeous, modern UX" with "joyful" and "accessible" interactions.
- **Embrace Imperfection**: Minor inconsistencies or creative deviations by the LLM between renders are acceptable and part of the experiment.

### Visual & Interaction Design

- **Aesthetics**: The tool's own admin UI (React SPA) favors a clean, modern look. This aesthetic should inspire the generated output.
- **Latency as an Experience**: Server round-trips for LLM generation are slow (30s to 3m). The project uses entertaining loading animations and status messages (`src/views/loading-shell/`) to manage this wait.
- **Micro-interactions**: Simple in-page interactions (modals, tabs, local data filtering) should be handled with inline client-side JavaScript within the LLM-generated HTML, without server requests.
- **Major Navigations**: Any action requiring a change in core data or view logic **must** trigger a full page reload via a standard `<a>` link or `<form>` submission, which is intercepted to show the loading overlay.

---

## 4\. Style and Brand Guide 🎨

This section defines the desired visual style, UI patterns, and overall user experience for LLM-generated applications. The `VaporVibe` admin UI itself (`frontend/`) serves as a primary inspiration, but the goal is creative interpretation, not rigid replication.

### Overall Philosophy & Vibe

- **Feeling:** Generated apps should feel **modern, clean, intuitive, and slightly playful**. The experience should be engaging and feel "alive," even though it's improvised. Prioritize **clarity and usability** over visual density.
- **Goal:** Create high-fidelity prototypes that _feel_ real enough to validate an idea quickly. Use realistic content, not placeholders.
- **Heuristics:**
  - **Simplicity First:** Start with clear layouts and essential elements. Add complexity only if the brief demands it.
  - **Convention over Configuration:** Use familiar web patterns (buttons, forms, cards) unless the brief suggests otherwise.
  - **Accessibility Matters:** Aim for semantic HTML, keyboard navigability, sufficient contrast, and clear focus states.
  - **Embrace Generative Flair:** Allow for creative interpretations within the bounds of good UX. Slight visual variations between renders are acceptable.

### Visual Language

- **Colors:**
  - **Base:** Use a light, clean background (whites, very light grays). Text should be dark gray or black for readability.
  - **Accent:** Employ a primary accent color (like the admin UI's blue: `#1d4ed8`, `#2563eb`) for interactive elements (buttons, links, active states). Use it purposefully.
  - **Semantic:** Use conventional colors for status: green for success/confirmation, red for errors/danger, yellow/orange for warnings/pending states.
  - **Neutrals:** Use a range of grays for borders, secondary text, and disabled states (`#475569`, `#64748b`, `#94a3b8`, `#e2e8f0`).
  - _Reference:_ `frontend/src/pages/AdminDashboard.css` variables and component styles.
- **Typography:**
  - **Font:** Primarily use **system UI fonts** (`system-ui`, `-apple-system`, `Segoe UI`, `sans-serif`) for broad compatibility and a native feel. `Inter` is used in the admin UI.
  - **Hierarchy:** Establish clear visual hierarchy using font size (e.g., larger for headings) and weight (e.g., `600` or `700` for titles/buttons).
  - **Readability:** Ensure sufficient line height (e.g., `1.5` or `1.6`) and keep text lines reasonably short.
  - _Reference:_ `frontend/src/pages/AdminDashboard.css` body styles.
- **Spacing:** Use generous spacing (padding, margins) to create a breathable, uncluttered layout. Consistent spacing units are preferred.
  - _Reference:_ Padding values in `AdminDashboard.css` (e.g., `clamp(24px, 4vw, 32px)`).
- **Borders & Shadows:**
  - **Borders:** Use light gray borders (`rgba(148, 163, 184, 0.3-0.4)`) sparingly, primarily on containers (cards, inputs) or interactive elements needing definition. Dashed borders can indicate dropzones or placeholders.
  - **Rounding:** Apply consistent, medium-to-large corner rounding (`border-radius`) to containers, buttons, and inputs (e.g., `16px`, `24px`) for a softer, modern look. Use `999px` for pills/fully rounded elements.
  - **Shadows:** Use subtle box shadows (`box-shadow`) to lift elements like cards and buttons off the background, enhancing depth. Hover/active states can intensify shadows slightly.
  - _Reference:_ `admin-card`, `setup-card`, `tabbed-card`, button styles.

### Core UI Patterns

- **Layout:** Use CSS Grid or Flexbox for clean, responsive layouts. Center content within main containers.
  - _Reference:_ `admin-shell`, `model-selector__body`.
- **Containers/Cards:** Group related content within rounded panels/cards with white/light backgrounds, subtle borders, and shadows. Use padding generously inside containers.
  - _Reference:_ `.admin-card`, `.panel`, `.setup-card`.
- **Forms:**
  - **Layout:** Stack labels clearly above their corresponding inputs. Group related fields logically.
  - **Inputs:** Use rounded (`~14px-16px`), lightly bordered inputs, textareas, and selects with clear `:focus` states (e.g., blue outline/shadow).
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

### Navigation Interception

- **Purpose**: Shows a loading overlay during LLM generation instead of a blank screen.
- **Mechanism**: The backend injects `<script src="/vaporvibe/assets/vaporvibe-interceptor.js">` into every LLM-generated HTML response. This script intercepts `<a>` clicks and `<form>` submissions, displays the overlay, and re-initiates the request, adding a marker (`__vaporvibe=interceptor`) so the server knows to send back the final HTML directly (or handle API calls).
- **Source**: The interceptor logic lives in `frontend/src/interceptor.ts` and is bundled by Vite.

### Instructions Panel

- **Purpose**: Allows users to provide quick, iterative feedback ("nudges") to the LLM for the next render without editing the main brief.
- **Mechanism**: If enabled, the backend injects `<script src="/vaporvibe/assets/vaporvibe-instructions-panel.js">`. This script adds a floating panel UI. Submitting instructions adds a special field (`LLM_WEB_SERVER_INSTRUCTIONS`) to the next form submission.
- **Source**: The panel logic lives in `frontend/src/instructions-panel.ts` and is bundled by Vite.

### Key Abstractions

- **Session Store (`src/server/session-store.ts`)**: Manages user history in memory, keyed by a session ID cookie. Prunes old sessions based on TTL and capacity. Provides history context for prompts.
- **History Entries (`src/types.ts`)**: Each entry captures the request (method, path, query, body, instructions), the generated HTML, LLM settings (provider, model), token usage, reasoning traces (if enabled), and any REST API calls made during that step.
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
- `/rest_api/mutation/*` & `/rest_api/query/*`: Endpoints intended to be called via `fetch` from _within the LLM-generated HTML_ for lightweight state persistence or data retrieval without full page reloads. Handled by `RestApiController` (`src/server/rest-api-controller.ts`).
- `/__vaporvibe/result/{token}`: Temporary route used by the loading shell to fetch the asynchronously generated HTML.

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
│   │   ├── components/   # Reusable React UI components
│   │   ├── pages/        # Top-level page components (AdminDashboard, SetupWizard)
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
│   ├── utils/            # Shared utilities (credentials, assets, history export)
│   └── views/            # Server-side view helpers (loading shell)
├── scripts/              # Build/utility scripts (dev server, macOS packaging)
├── docs/                 # Documentation
├── package.json          # Project dependencies & scripts
└── tsconfig.json         # TypeScript config for backend
```

- **`src/index.ts`**: CLI entry point, starts the server.
- **`src/server/server.ts`**: Core HTTP server, SPA serving, LLM request orchestration.
- **`src/server/admin-controller.ts`**: Handles `/api/admin/*` JSON endpoints.
- **`src/llm/messages.ts`**: **Crucial file** for prompt engineering.
- **`src/llm/*-client.ts`**: Provider-specific logic.
- **`src/utils/credential-store.ts`**: Secure API key storage (OS keychain).
- **`frontend/src/App.tsx`**: Defines SPA routes and structure.
- **`frontend/src/pages/AdminDashboard.tsx`**: Main component for the admin UI.
- **`frontend/src/api/admin.ts`**: Frontend functions for calling the backend API.

---

## 7\. Development Workflow & Guidelines

### Environment Setup

- **Node.js**: Requires **v24.x**. Use `nvm use` in the repo root.
- **Dependencies**: Run `npm install` in the root directory.

### Running the Development Server

- **Integrated Dev Harness**: `npm run dev`
  - Spins up `src/dev/backend-dev-server.ts`, which watches backend files with **chokidar**, restarts on change, and snapshots session/provider state so you keep your brief/history during reloads.
  - Boots Vite in **middleware mode** (`VAPORVIBE_PREFER_DEV_FRONTEND=1`) so the admin/setup SPA is served through the Node server—with full HMR and no need to rebuild `frontend/dist/` while iterating.
  - Access everything via `http://localhost:3000/__setup` or `http://localhost:3000/vaporvibe` (no separate Vite port required).
- **Backend Only**: `npm run dev:be` (runs the same harness directly via `tsx src/dev/backend-dev-server.ts`).
- **Frontend Only**: `npm run dev:fe` (launches Vite standalone on `http://localhost:5173` if you want to isolate UI work).

### Building for Production

- **Full Build**: `npm run build`
  - Runs `npm run build:fe` (compiles React SPA into `frontend/dist/`).
  - Compiles backend TypeScript into `dist/`.
  - Copies loading shell assets into `dist/`.
- **Frontend Only**: `npm run build:fe` (runs `vite build` inside `frontend/`)

### Running Compiled Code

- `npm run start` executes the compiled backend from `dist/index.js`, serving the production frontend assets from `frontend/dist/`.

### Testing

- `npm test` (or `npm run test`) executes the Vitest suite once; `npm run test:watch` keeps it running while you iterate.
- Coverage reports live in `coverage/` (text summary + HTML) and are configured via `vitest.config.ts` to focus on `src/**/*.ts`.
- The suite lives in `tests/`, with targeted coverage for config loading, prompt assembly, the session store, and shared utilities. Reuse helpers in `tests/test-utils/` (HTTP mocks, keytar stubs, factories, logger spies) and the global logger stub defined in `tests/vitest.setup.ts`.
- Tests intentionally stop at the Node boundary—browser flows and provider integrations still need manual verification.

### Logging & Debugging

- **Log Level**: Set the `LOG_LEVEL` environment variable (`debug`, `info`, `warn`, `error`) to control backend log verbosity. `debug` is highly recommended during development.
  - `LOG_LEVEL=debug npm run dev`
- **Inspect Prompts**: `LOG_LEVEL=debug` shows the full prompts sent to the LLM and raw responses.
- **Disable Pretty Logs**: For scripting or CI, use `PINO_PRETTY=false npm run ...`.
- **Admin History Explorer**: Use the `/vaporvibe` UI to inspect specific requests, HTML output, and reasoning traces.

### Code Style & Conventions

- **Language**: **TypeScript** (`strict` mode) targeting **NodeNext** modules (use `.js` extensions in relative imports).
- **Formatting**: **2-space indentation**, **trailing commas** for multi-line literals. Follow existing patterns.
- **Constants**: Use `src/constants.ts` and `src/constants/providers.ts` for shared literals.
- **Separation of concerns and maintainability**: Always separate concerns, use different modules and proactively reflect on when a functionality needs to be carved out of a file and given its own module, function or service.

### Areas for Caution ⚠️

- **Focused Test Suite**: A Vitest suite now covers config loading, prompt compilation, the session store, and key utilities. It runs fast but doesn't yet exercise every provider path, so keep testing manually when touching network integrations or the SPA.
- **macOS-Centric Builds**: `scripts/` contains complex logic for macOS `.app` and DMG creation/notarization.
- **Inconsistent Reasoning APIs**: OpenAI/Grok use `reasoningMode`, while Anthropic/Gemini use `reasoningTokens`. Backend logic handles normalization.
- **Embrace the Chaos**: Guide the LLM's creativity, don't force deterministic output. Minor variations are expected.

### Contribution Workflow

1.  Make changes in `src/` (backend) or `frontend/src/` (frontend).
2.  Use `npm run dev` for live reloading during development.
3.  **Manually test** thoroughly with relevant providers (`OPENAI_API_KEY`, `GEMINI_API_KEY`, etc. set). Check core flows, admin UI, setup, history, reasoning traces.
4.  Run `npm run build` to ensure both frontend and backend compile successfully and assets are updated.
5.  Commit changes, including the updated `dist/` and `frontend/dist/` directories.

---

## 8\. How To... (Common Agent Tasks)

### ...Add a New LLM Provider

1.  **Create Client**: Implement `LlmClient` in `src/llm/your-provider-client.ts`.
2.  **Update Factory**: Add to `src/llm/factory.ts`.
3.  **Add Verification**: Implement `verifyYourProviderApiKey` in `src/llm/verification.ts` and add it to the main `verifyProviderApiKey` function.
4.  **Update Types & Constants**: Add provider to `ModelProvider` type (`src/types.ts`), add metadata to `src/llm/model-catalog.ts`, and update constants in `src/constants/providers.ts` (choices, labels, defaults, capabilities).
5.  **Update Config**: Add API key detection logic in `src/config/runtime-config.ts`.
6.  **Update Frontend**: Add provider logo/styling if needed in `frontend/src/components/ModelSelector.tsx` or related CSS.

### ...Adjust the Core Prompt

- Modify `src/llm/messages.ts`:
  - Change rules/philosophy in `systemLines`.
  - Change context structure in the `user` string template assembly.
- Use `LOG_LEVEL=debug` to see the exact prompt being generated.

### ...Modify the Admin/Setup UI

- Work within the `frontend/` directory.
- Key files:
  - `frontend/src/pages/AdminDashboard.tsx`: Main admin layout and logic.
  - `frontend/src/pages/SetupWizard.tsx`: Entry for setup flow.
  - `frontend/src/components/`: Directory for reusable UI parts.
  - `frontend/src/api/admin.ts`: Functions for calling backend APIs.
  - `frontend/src/api/types.ts`: TypeScript types mirroring backend API responses.
- Use `npm run dev:fe` or `npm run dev` for hot reloading.
