---
trigger: always_on
globs: **/*
---

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

### macOS Build & Notarization
The project includes a comprehensive suite of scripts for building, signing, and notarizing the macOS application.

- **Full Release Build**: `npm run build:macos`
  - Runs the entire pipeline: SEA build -> App Bundle -> Signing -> Notarization -> DMG creation -> DMG Notarization.
- **Individual Steps**:
  - `npm run build:macos:sea`: Build the Single Executable Application (SEA).
  - `npm run build:macos:sea:signed`: Build and sign the SEA.
  - `npm run build:macos:app`: Create the `.app` bundle.
  - `npm run build:macos:sign`: Sign the `.app` bundle.
  - `npm run build:macos:dmg`: Create the `.dmg` disk image.
  - `npm run build:macos:verify`: Verify the notarization status of the built app.

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