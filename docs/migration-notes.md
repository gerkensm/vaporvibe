# serve-llm Frontend Migration Notes

## Initial Request (from user)
Full verbatim request recorded in [`docs/original-request.md`](original-request.md). Summary:
- Separate the admin/setup UI from server string templates into a standalone Vite + React front-end.
- Build the front-end into static assets (HTML, JS, CSS) that the Node.js server can serve.
- Preserve existing functionality (setup wizard, admin console, navigation interceptor, instructions panel) while improving maintainability.
- Provide a step-by-step, junior-friendly plan covering: Vite scaffold creation, shared build scripts, migration of runtime JavaScript, component rewrites (AttachmentUploader, ModelSelector, TokenBudgetControl, ModelInspector), API refactor, and final server adjustments to serve the compiled SPA.

## Work Completed
1. **Front-end scaffold (Step 1)**
   - Created `frontend/` Vite + React project with multi-entry build for main app, interceptor, and instructions panel.
   - Added TypeScript/Vite configs (`frontend/package.json`, `tsconfig.json`, `vite.config.ts`).

2. **Build tooling integration (Step 2)**
   - Added `build:fe`, `dev:fe`, `dev:be`, and a `scripts/dev.mjs` orchestrator in the root `package.json`.

3. **Runtime script migration (Step 3 partially)**
   - Moved navigation interceptor and instructions panel JS into TypeScript modules, bundling them via Vite.
   - Server now injects `<script src="/assets/...">` tags rather than inline blobs.

4. **Admin API foundation (Step 4/6)**
   - Exposed `/api/admin/state`, `/api/admin/brief`, `/api/admin/provider`, `/api/admin/runtime` JSON endpoints with strongly typed responses.
   - Shared metadata (model catalogs, provider guidance, featured lineups) now returned for the React UI.

5. **React admin experience (Step 5)**
   - Implemented React `AttachmentUploader`, `ModelSelector`, `TokenBudgetControl`, and `HistoryExplorer` components with accompanying styles.
   - New `AdminDashboard` screen drives provider setup, runtime tuning, brief/attachment workflows, and paginated history review against the JSON API.
   - First-run onboarding now lives inside the SPA so the same UI handles both setup and day-to-day admin tasks.

6. **Server SPA + API integration (Step 5/6)**
   - HTTP router now serves `frontend/dist/index.html` for admin routes and proxies static assets under `/assets/` with cache validation.
   - Added a dev fallback when `frontend/dist/index.html` is missing (`SERVE_LLM_DEV_SERVER_URL` overrides the default Vite dev server URL).
   - `/api/admin/*` endpoints short-circuit before the SPA shell so fetches receive JSON instead of HTML.
   - Provider updates validate credentials via `verifyProviderApiKey`, persist verified status, and mark the provider ready for immediate use.
   - Legacy string-template wizard paths POST back to the SPA for compatibility while the old renderers have been deleted.

## Plan Deviations / Notes
- The React migration was staged; only AttachmentUploader, ModelSelector, TokenBudgetControl, and parts of AdminDashboard are in React. ModelInspector/history views are pending.
- Some helper functions (provider selection, reasoning/token parsing) are still inline in `src/server/server.ts` pending refactor, but unused wizard-specific logic was removed.
- Vite build now treats `index.html` as the main entry so the SPA shell is emitted; hashed asset names remain for JS/CSS.
- Navigation interceptor and instructions panel scripts remain in use; they are now emitted via the Vite multi-entry build and injected by the server when LLM HTML is served.
- `/api/admin/*` endpoints now act as the single source of truth for the admin UI (state, brief submissions, provider/runtime updates); legacy endpoints exist only for compatibility redirects.

## Development Guardrails & Environment Setup
- `node`: Use v24.x (`nvm use`) in the repo root. The TypeScript config targets NodeNext and emitted modules assume Node 24 runtime features.
- `typescript`: Strict mode + NodeNext imports. Preserve `.js` extensions in relative imports and keep shared literals in `src/constants.ts` or provider-specific constants.
- Formatting: follow the repo’s 2-space indentation with trailing commas for multiline literals. New files default to ASCII unless existing content justifies otherwise.
- Builds: run `npm run build` before committing so both `frontend/dist` and `dist/` stay in sync. `npm run start` executes the compiled server output for sanity checks.
- Dev loops: `npm run dev` orchestrates Vite + backend watchers; `npm run dev:fe` and `npm run dev:be` run each side independently when debugging. The backend now runs via `tsx --watch` so source edits in `src/` trigger automatic restarts.
- Observability: set `LOG_LEVEL=debug` to inspect prompts/reasoning. Disable pretty logs for scripts with `PINO_PRETTY=false`. CLI flags `--reasoning-mode`, `--reasoning-tokens`, and `--instructions-panel off` help target reasoning and UI regressions.

### Manual QA Expectations
- No automated tests exist. Before shipping, run `npm run dev` and exercise setup/admin flows with each provider by exporting `OPENAI_API_KEY`, `GEMINI_API_KEY`, and `ANTHROPIC_API_KEY`.
- During manual runs verify brief saving, provider verification, runtime clamps, history pagination/export, navigation interception, and the instructions overlay.
- When touching reasoning controls, confirm the slider visibility and payload validation via `/api/admin/provider` responses (e.g., GPT‑5 Mini should hide controls, Anthropic Sonnet should expose a 10k default, Gemini Flash Lite should respect the toggle).

### Reference Commands
- `npm run build:fe` builds the SPA bundles in isolation; the server injects `/assets/*.js` from `frontend/dist` unless `SERVE_LLM_DEV_SERVER_URL` points to the Vite dev server.
- `scripts/dev.mjs` coordinates simultaneous frontend/backend watchers. Pass through reasoning or instructions flags when reproducing provider-specific issues.
- `npm run start` runs the compiled output; pair with `LOG_LEVEL=debug` when validating production bundles.

## Progress Log (2024-XX-XX)
- Admin interface now delivered as a React SPA consuming JSON from `/api/admin/*`; backend serves hashed bundles with dev fallback and caches static assets.
- Added Vite/TypeScript build chain, multi-entry bundles for interceptor and instructions panel, and orchestration scripts (`scripts/dev.mjs`, `npm run build:fe`).
- React dashboard covers provider/runtime panels, brief workflow, and paginated history explorer with the new typed API helpers.
- Backend controller exposes structured responses, reuses credential verification, and injects compiled scripts into LLM HTML replies.
- Known regression: setup styling differs from the original wizard; UI still does not surface API validation errors inline (banner only).
- Known regression: injected instructions panel bundle loads but never renders the floating helper (navigation overlay still operational).
- Observed bug (dev run 2024-XX-XX 14:25): clicking “Save provider” sent `maxOutputTokens: null`, backend (`parsePositiveInt`) threw “Expected a positive integer, received: 0”; request looped with 400 responses and UI showed no inline error — noted for fix.

## Progress Log (2025-10-15)
- Provider panel now clamps max output tokens to provider guidance, defaults to per-provider baselines, and avoids posting `null`/`0` payloads. Reasoning fields mirror capability data so unsupported providers no longer expose toggles.
- Reasoning budget toggle respects provider allow/deny rules and the backend accepts boolean `reasoningTokensEnabled` flags from the SPA JSON payloads.
- Pre-submit sanitization keeps the status banner usable (no more 400 loops); inline field validation still outstanding.
- Ran `npm run build:fe` to confirm the React bundle and navigation script entries compile after the changes (no manual browser smoke test yet).
- Noted regression: instructions panel script is injected but the UI never mounts, even though the click interceptor overlay continues to work; flagged for follow-up.
- Adjusted the provider setup step so status chips only appear in the post-setup admin view; staging chips during onboarding read as mashed text (e.g. “OpenAI…Key stored”).
- Added `autocomplete="new-password"` to the API-key password field to silence the browser console warning (`Input elements should have autocomplete attributes`).
- Follow-up: exercise provider save flows against a running server to verify backend prompts update as expected, then capture screenshots for UX alignment.

## Immediate Next Steps
1. Investigate why the injected instructions panel bundle never renders (overlay works, floating panel missing) and restore the helper UI.
2. Restore legacy setup UX cues (hero copy, success flash/redirect) so the onboarding flow feels consistent with the pre-migration experience.
3. Revisit styling to bring the SPA closer to the original visual treatment and add regression checks around provider transitions and brief submission states.

## Remaining Work
- Remove the legacy history renderer (`renderHistory` and auto-refresh script) now superseded by the SPA view, along with unused provider/status markup.
- Extend `/api/admin/history` with server-side filtering (e.g. by session or path) if needed once we drop the legacy form.
- Remove unused setup constants and handlers (`BRIEF_FORM_ROUTE`, `SETUP_VERIFY_ROUTE`, etc.) once the SPA owns the full onboarding flow.
- Refine provider key status reporting so JSON responses distinguish stored vs. env keys and expose verification timestamps.
- Add automated coverage (component tests + integration smoke) for the new React admin app.
- Document the new build/dev flow in the main README, emphasizing the `npm run build:fe` prerequisite for releases and the `npm run dev` orchestrator.
- Debug `frontend/src/instructions-panel.ts`: the bundle is delivered but the floating assistant never mounts. Audit the DOM bootstrap logic and ensure the Vite-built script attaches the panel after load.
- Implement a React-first setup experience: build `frontend/src/pages/SetupWizard.tsx` to recreate the two-step flow (provider + brief) using `/api/admin/*` endpoints, matching the legacy wizard’s cues and visuals.
- Port the legacy model inspector: introduce `frontend/src/components/ModelInspector.tsx` (+ CSS) that mirrors `renderModelDetailPanel` from `src/pages/components/model-inspector.ts`, wiring it to the model catalog data already in state.
- Collapse server routing once the SPA is complete: update `src/server/server.ts` so `/`, `/__setup`, and `/serve-llm` all serve the compiled `frontend/dist/index.html`, letting the client-side router drive navigation.

## Current Status (2024-XX-XX)
- ✅ SPA shell served for admin routes with React panels for provider/runtime/brief and history explorer.
- ✅ `/api/admin/history` returning paginated results consumed by the React dashboard.
- ⚠️ Legacy server-rendered history HTML still present (tabs, polling script) but unused; scheduled for removal next.
- ⚠️ No auto-refresh on the new history explorer yet; to consider if desired (could poll with `fetchAdminHistory`).
- ⚠️ Detailed provider status panel still pending (currently only badges on main screen).
- ℹ️ All endpoints continue to be accessible under `/api/admin/*`; `ADMIN_ROUTE_PREFIX` requests now rely on the SPA build being available.

## Decisions & Notes
- History pagination defaults to 20 rows with a hard cap of 100 per request; offset/limit validated server-side.
- Reused existing history serialization (`toAdminHistoryItem`) to avoid breaking exports; SPA collapses the server-rendered `renderHistory` soon.
- `HistoryExplorer` opts for manual refresh/load-more controls for clarity; automatic polling can be re-added.
- Build pipeline: `npm run build` now invokes both frontend and backend TypeScript compilers; ensure the CI environment runs `npm run build:fe` before packaging.
- `scripts/dev.mjs` orchestrates concurrent backend/frontend dev servers; SPA fallback points to `SERVE_LLM_DEV_SERVER_URL` when bundles are missing.

## Useful Context
- `frontend/dist/` is generated by Vite and contains `index.html` plus hashed asset bundles in `assets/`.
- Navigation interceptor and instructions panel scripts are bundled assets referenced via `<script src="/assets/...">`.
- Admin API types live in `src/types/admin-api.ts`; the React app mirrors them in `frontend/src/api/types.ts`.
- Running `npm run build` executes both `frontend` and backend TypeScript builds; `npm run dev` launches both dev servers.
- The backend still injects interceptor/instruction scripts into LLM-generated HTML responses.
- We have not committed any of the SPA work yet, so the legacy wizard components can be recovered via `git diff`; avoid destructive commands and keep copies in temp files if you need to reference the old markup.
- Legacy string-rendered modules scheduled for deletion once React equivalents land: `src/pages/components/model-inspector.ts`, `src/pages/admin-dashboard.ts`, and unused constants in `src/constants.ts`. Keep `src/views/loading-shell.ts` intact—it powers the LLM loading experience and is unrelated to the admin migration.

## Workflow Guardrails
- Never run `git reset` or similar destructive history commands during this migration—none of the React/Vite work has been committed, so a reset would drop everything. Use non-destructive edits (temporary files, worktrees) instead.

## Detailed Change Log / Decisions / Trade-offs

### Granular changes
- Added a complete Vite + React scaffold under `frontend/`:
  - `frontend/index.html` (root document with `<div id="root">`).
  - `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts` (multi-entry build for `index.html`, `src/interceptor.ts`, `src/instructions-panel.ts`).
  - `frontend/src/main.tsx` and `frontend/src/App.tsx` bootstrapping the React admin experience.
- Introduced build/dev orchestration:
  - Root `package.json` now has `build:fe`, `dev:fe`, `dev:be`, `dev`, `prepare` scripts.
  - `scripts/dev.mjs` spawns backend (`tsx src/index.ts`) and Vite dev server (`npm run dev` inside `frontend`), propagating signals and aggregating exit codes.
- Migrated runtime scripts to bundled modules:
  - Created `frontend/src/interceptor.ts`, `frontend/src/instructions-panel.ts`, `frontend/src/scripts/navigation-overlay-effects.ts` replacing string literals.
  - Simplified server utilities (`src/utils/navigation-interceptor.ts`, `src/utils/instructions-panel.ts`) to inject `<script src="/assets/...">` tags.
- Exposed JSON admin endpoints and shared typing:
  - `src/server/admin-controller.ts` now responds to `/api/admin/state|brief|provider|runtime` with typed payloads.
  - New type definitions in `src/types/admin-api.ts`, mirrored in `frontend/src/api/types.ts` plus fetch wrappers (`frontend/src/api/admin.ts`).
- Implemented React admin components:
  - `frontend/src/components/AttachmentUploader*` replicates drag/drop/paste behavior with hooks.
  - `frontend/src/components/ModelSelector*` and `TokenBudgetControl*` render curated model lists, composite charts, and token sliders using API metadata.
  - `frontend/src/pages/AdminDashboard.tsx` wires brief/provider/runtime workflows, handles optimistic UI state, and posts to new endpoints.
- Updated server to serve the SPA shell:
  - `src/server/server.ts` loads/caches `frontend/dist/index.html`, injects fallback dev shell when the bundle is missing, and redirects legacy POSTs to `/serve-llm`.
  - Added asset cache for `frontend/dist/assets/*` (`maybeServeFrontendAsset`).
- Removed legacy setup/admin HTML renderers:
  - Deleted `handleSetupFlow`, verification/brief form handlers, and related helper functions/constants.
  - Stripped unused imports (`renderSetupWizardPage`, `renderAdminDashboard`, etc.).
- Retained navigation interceptor / instructions panel injection for LLM responses but now served from compiled assets.
- Documented migration context/status in `docs/migration-notes.md`.

### Design / implementation decisions
- Kept the navigation interceptor and instructions panel as dedicated bundles so existing DOM expectations (script IDs, overlay behavior) remain unchanged while eliminating inline string concatenation.
- Extended `/api/admin/state` to return provider choices, model catalog metadata, featured model lists, token guidance, and reasoning presets so the React client can render advanced controls without server templating.
- Added SPA shell caching and a dev fallback (inserts `<script src="${devUrl}/src/main.tsx">`) to support `npm run dev` flows even when `frontend/dist` is absent; the fallback URL can be overridden with `SERVE_LLM_DEV_SERVER_URL`.
- Kept `AdminController` responsible for business logic (credential handling, history exports, brief processing) so routing changes were minimized; React simply consumes the new JSON endpoints.
- Maintained script injection for LLM replies (adding `/assets/interceptor.js`, `/assets/instructions-panel.js`) to avoid unexpected UX changes for generated applications.
- Treated `index.html` as the primary Rollup entry point (via Vite) ensuring the SPA document is emitted alongside hashed asset bundles for consistent server serving.

### Trade-offs
- React UI currently includes brief/provider/runtime editors but not the history explorer or setup guidance; those remain server-rendered until further migration work.
- Dev fallback assumes `http://localhost:5173` by default; missing bundles in production will still break unless `npm run build:fe` is part of the release process.
- Some helper logic (provider defaults/token parsing) still lives in `src/server/server.ts`; further refactoring will be needed once all legacy templates are retired.
- Hash-based asset filenames aid cache busting but introduce the need for the asset-serving logic and build-state awareness (server/startup must ensure `frontend/dist` exists or rely on the dev fallback).
- Incremental migration means temporary duplication of functionality (legacy admin routes vs. new API-driven React UI) until remaining features are ported.


## Progress Log (2025-10-16)
- Audited legacy server-rendered admin flows (`src/pages/admin-dashboard.ts`, `src/pages/components/model-selector.ts`, `src/pages/setup-wizard.ts`) to map the remaining dependencies before deleting them. Confirmed the React SPA now consumes data exclusively via `/api/admin/*` endpoints.
- Traced every usage of `renderAdminDashboard`, `renderHistory`, and helpers in `src/server/admin-controller.ts`. Only the history export endpoints (`/serve-llm/history/*`) still call those renderers; `/serve-llm` navigation is satisfied by the SPA shell served from `src/server/server.ts`.
- Reviewed the typed payloads (`src/types/admin-api.ts` mirrored at `frontend/src/api/types.ts`) and verified they already supply all data consumed by the React components (`frontend/src/pages/AdminDashboard.tsx`, `frontend/src/components/HistoryExplorer.tsx`, etc.). No additional fields are required before removing the legacy HTML.
- Cross-checked the SPA mutations (`submitBriefUpdate`, `submitProviderUpdate`, `submitRuntimeUpdate` in `frontend/src/api/admin.ts`) to ensure every form now posts JSON to `/api/admin/*`. The legacy POST handlers (`/serve-llm/update-*`) are redundant.
- Outcome: safe to proceed with deleting the unused server-rendered dashboard/history code in a follow-up change. Next action is to retire `renderAdminDashboard`, `renderHistory`, and friends, routing history exports to the stored HTML that already ships with each `HistoryEntry`.

### Findings (2025-10-16)
- `src/server/admin-controller.ts`: `renderDashboard` is effectively dead code—`src/server/server.ts` serves `frontend/dist/index.html` (or the Vite dev shell) for `/serve-llm`, and JSON APIs cover all interactive concerns.
- `src/pages/admin-dashboard.ts`: still bundles `MODEL_SELECTOR_STYLES`, `MODEL_INSPECTOR_STYLES`, attachment/token runtime strings, and the HTML history tab. These are the last references preventing their deletion.
- `src/pages/components/model-selector.ts`: the string-rendered selector remains only to satisfy the legacy HTML; the React component already lives at `frontend/src/components/ModelSelector.tsx`.
- `frontend/src/components/HistoryExplorer.tsx`: verified the new panel renders instructions, summaries, reasoning traces, attachments, and download links using the data supplied by `AdminHistoryResponse`.

### Current Focus
- Prepare to delete the legacy HTML renderers and replace `/serve-llm/history/*` responses with direct HTML exports from the stored history records.
- Once the cleanup lands, rerun `npm run build` to refresh `dist/` outputs and update this log with the resulting changes.

- ✅ Removed the legacy string-rendered admin/setup modules (`src/pages/admin-dashboard.ts`, `src/pages/setup-wizard.ts`, and the `src/pages/components/*` helpers). The server no longer references them; only `src/views/loading-shell.ts` remains for the LLM loading UI.
- ✅ Hoisted admin API data contracts into `src/types/admin-api.ts` so backend code no longer depends on the deleted page module for TypeScript types. React still consumes the mirrored definitions in `frontend/src/api/types.ts`.
- ✅ Moved `CUSTOM_MODEL_DESCRIPTION` into `src/constants/providers.ts` to keep the copy available for the SPA via the `/api/admin/state` payload.
- ✅ Refactored `src/server/admin-controller.ts` to:
  - drop all usage of `renderAdminDashboard` / `renderHistory`;
  - serve `/serve-llm/history/latest` as JSON (`historyHtml` is an empty string for compatibility, `history` carries the paginated payload);
  - rely exclusively on `buildAdminHistoryResponse` + `toAdminHistoryItem` for exports.
- ✅ Nuked the stale `dist/` tree and re-ran `npm run build` so the compiled output matches the new source layout (only `dist/pages/loading-shell.*` remains).
- ⚠️ Note: any scripts that expected `/serve-llm/history/latest` to return HTML will need to switch to `/api/admin/history`; the compatibility field is intentionally blank.

### Next Actions
- Finish the import parity work (replace the placeholder `ImportPanel`, wire drag/drop and status messaging).
- Plan a QA sweep once layout/runtime fixes land to reconfirm the overlay, navigation, and loading shell behaviors end-to-end.
- Run browser QA on the restored setup redirect (confirm the SPA opens `/` in a new tab and falls back to same-tab navigation when pop-ups are blocked).

### QA Findings (2025-10-16)
- Setup wizard regression: saving the brief no longer redirects to `/`, so the LLM never generates the initial app shell after onboarding. ✅ 2025-10-19 fix: the React setup flow now opens `/` in a new tab when setup completes (fallback to same-tab redirect if the pop-up is blocked); re-test across browsers.
- Admin shell layout regressed: the React dashboard renders panels sequentially without the original tabbed chrome (header hero, tab bar, split columns). Need to recreate the tab structure and styling in `frontend/src/pages/AdminDashboard.tsx` / `.css` so the experience mirrors the legacy wizard.
- History runtime validation is off: the memory budget control accepts bizarre min/max bounds (likely missing default clamp logic from the legacy form). Revisit the runtime panel to enforce sane byte limits and surface validation errors.
- History explorer functions (pagination, exports) but is mostly unstyled compared to the old tab—needs visual polish (chip badges, cards, typography) to match the design language.

- Keep the setup shell variant: during onboarding we still show provider/brief steps sequentially, so the React tab implementation needs a conditional that collapses to the setup layout until `providerReady` + `brief` are satisfied.
- Fix runtime validation: clamp history byte limits to the expected range and surface inline errors when users exceed it.
- Style the history explorer to align with the design system (cards, chips, typography) after structural fixes.
- Re-check the instructions overlay after the asset fallback; tackle any remaining UX polish alongside the layout work if issues persist.

### Legacy Layout Reference (for SPA parity)
- **Header & Status Bar:** `<header>` contains the main title and a `.status-bar` of pill chips (`History entries`, `Active sessions tracked`, `Current provider`, `History limit`, `Byte budget`). JS refresh updates these values in-place.
- **Tabbed Card Shell:** `.tabbed-card` wraps `.tabs` (inline-flex buttons with `role="tab"`, arrow-key navigation, `.active` state) and `.tab-panels` (cards toggled via `hidden`).
- **Tab Panels:** Each `.tab-panel` hosts a card-style form; provider panel includes advanced controls in a `<details>` accordion, import tab exposes drag/drop file input, history tab wraps controls + list.
- **History Auto-Refresh:** `history-refresh-now` and `history-toggle-auto` buttons manage polling of `/serve-llm/history/latest`, preserving expanded `<details>` nodes and updating the header pills; React rewrite must provide equivalent behavior against `/api/admin/history`.
- **Visual Language:** Soft gradients, “glass” cards, Inter typography, chip badges, and drop shadows defined inline in the template should guide the translated CSS modules.


## Progress Log (2025-10-17)
- Removed the unused `historyEndpoint` field from the admin API types (`src/types/admin-api.ts`, `frontend/src/api/types.ts`) and from the controller payload, eliminating the legacy `/serve-llm/history/latest` helper reference.
- Updated the React admin dashboard to bootstrap and refresh history exclusively through `/api/admin/history`, with pagination/load-more requests funneled through a shared loader (`frontend/src/pages/AdminDashboard.tsx`).
- Synced history counters from API responses instead of bundled state snapshots so the SPA no longer depends on server-supplied history arrays, paving the way to drop the field from `AdminStateResponse`.
- Removed the redundant `history` array from `AdminStateResponse` (server + frontend) so the admin state payload ships only metadata; history entries now flow solely through `/api/admin/history`.
- Added a dev-aware asset resolver so the navigation interceptor and instructions panel bundles pull from the Vite dev server when `frontend/dist` is missing; production builds continue to load `/assets/*.js`.
- Fixed the instructions overlay runtime error: initialization now waits until after the panel constants are defined, preventing the "Cannot access 'a' before initialization" crash (`frontend/src/instructions-panel.ts`).
- Manual verification: instructions panel now renders on generated pages in the current build.
- Rebuilt the React admin shell to restore the hero header, status-pill metrics, and tabbed navigation structure captured in the legacy template. The new layout renders the brief/provider/runtime/history panels inside `/frontend/src/pages/AdminDashboard.tsx`, with import/export placeholders queued for API parity work.
- Fixed a React hooks ordering bug introduced by the new layout. `useEffect` now executes before the early-return guards, preventing the "rendered more hooks than during the previous render" crash (`frontend/src/pages/AdminDashboard.tsx`).
- Hook parity confirmed in production bundle (`frontend/dist/assets/main-CWM5yBjr.js`); the admin console loads without React error #310. The import tab still surfaces a placeholder message—replace `ImportPanel` once the upload endpoint is wired in.
- Restored the history tab’s auto-refresh controls: the React dashboard now mirrors the legacy “Refresh” + “Auto-refresh” toggle, polls `/api/admin/history` every 8 seconds when enabled, and surfaces status text via `HistoryExplorer` (`frontend/src/pages/AdminDashboard.tsx`, `frontend/src/components/HistoryExplorer.tsx`).
- History explorer styling now mirrors the legacy chrome—method badges, chip rows, stat cards, and attachment grids have been ported to the React components (`frontend/src/components/HistoryExplorer.tsx`, `frontend/src/pages/AdminDashboard.css`).
- Fixed the history export anchors so “Download HTML” delivers a file instead of opening raw markup (`frontend/src/components/HistoryExplorer.tsx`). Bundle refreshed in `frontend/dist/assets/main-CWM5yBjr.js`.
- Manual check (2025-10-17): `npm run dev`, visit `/serve-llm`, History tab shows auto-refresh controls, badges, and the “Download HTML” button prompts a save dialog instead of rendering plain text.
- Runtime validation restored: history limit/byte budget inputs now clamp to 1–100 entries and 10,240–1,000,000 bytes with inline error messaging (`frontend/src/pages/AdminDashboard.tsx`, `frontend/src/pages/AdminDashboard.css`). Server-side clamps mirror the same bounds (`src/constants.ts`, `src/server/admin-controller.ts`).
- Setup wizard card styling revived: background hero, step badge, and card layout now match the legacy onboarding vibe (`frontend/src/pages/AdminDashboard.tsx`, `frontend/src/pages/AdminDashboard.css`). Shared runtime bounds exported via `frontend/src/constants/runtime.ts`.
- ✅ TODO resolved: model-specific reasoning support now lands end-to-end (catalog metadata → admin API → React UI → backend validation). Regression checks moved into the QA notes below.

## Progress Log (2025-10-18)
- Captured repo guardrails (Node 24 runtime, TypeScript NodeNext, formatting rules) and manual QA expectations so this file stands alone for future pickups.
- Verified the remaining workstream is the model-specific reasoning support outlined above; next coding session should start with `src/llm/model-catalog.ts` and the admin API type updates.
- No source changes yet in this session—documentation only. Schedule time to audit the model catalog and ensure storage records already capture provider/model IDs before mutating payload shapes.
- Normalised the catalog build so every `ModelMetadata` exports a concrete `reasoningTokens` block (`supported`, `min`, `max`, `default`, `description`, `helper`). Added Anthropic Sonnet/Opus budgets while leaving Haiku variants marked unsupported for slider gating (`src/llm/model-catalog.ts`).
- Introduced a raw → normalised provider metadata pass so the SPA always receives explicit reasoning support flags; mirrored type updates into the frontend API layer (`src/llm/model-catalog.ts`, `frontend/src/api/types.ts`).
- Hardened `applyProviderUpdate` to clamp reasoning payloads against the selected model, ignore toggles for unsupported entries, and fall back to provider defaults for custom identifiers (`src/server/admin-controller.ts`).
- Updated the React provider panel to source guidance from `state.modelCatalog`, hide toggles for unsupported models, and adjust helper copy when falling back to provider defaults (`frontend/src/pages/AdminDashboard.tsx`).
- Ran `npm run build` to refresh the Vite bundle (`frontend/dist/assets/main-IxmHay05.js`) and confirm TypeScript compilation.
- Export tab now ships the final UI with download anchors wired to `/api/admin/history.json` and `/api/admin/history.md`; parity gap is down to the import workflow (`frontend/src/pages/AdminDashboard.tsx`).
- Re-reviewed onboarding + model inspector flows: `needsProviderSetup` / `needsBriefSetup` branch the AdminDashboard into wizard steps, and `ModelSelector` embeds the model detail view with cost/composite score data, so those items are feature-complete. Frontend HMR continues to come from Vite, and backend hot reload now runs out-of-the-box thanks to the `tsx --watch` update in `package.json`.
- Reasoning controls now respect per-model capability — GPT‑5/GPT‑3.5 variants hide the toggle + slider, while models that require budgets keep the slider without a toggle (`frontend/src/pages/AdminDashboard.tsx`).
- Model selector adds capability badges (multimodal, image/PDF support) and keeps reasoning badges in the same pill layout (`frontend/src/components/ModelSelector.tsx`).
- Rebuilt assets emit `frontend/dist/assets/main-jP41q-Nn.js` and `frontend/dist/assets/main-BMBx5_0i.css`.
- QA additions: (1) OpenAI GPT‑5 Mini and GPT‑3.5 Turbo → reasoning toggle/slider stay hidden; (2) Anthropic Claude Sonnet 4.5 → slider present with default 10k cap, toggle remains enabled; (3) Anthropic Claude 3.5 Haiku → controls hidden; (4) Gemini Flash Lite → toggle off sends `reasoningTokensEnabled=false` and controller persists `undefined`; (5) Custom model value (e.g., `gpt-5-experimental`) → UI marks “provider defaults” and backend clamps to provider range; (6) Model selector badges show “Multimodal/Image/PDF” states for capable models; (7) Import tab still shows the placeholder card—replace once the drag/drop uploader is rebuilt.
- ✅ Follow-up resolved: `ModelSelector` now surfaces reasoning-mode and token badges with provider fallbacks, and Grok/Groq metadata documents the auto-managed thinking budgets (`frontend/src/components/ModelSelector.tsx`, `frontend/src/components/ModelSelector.css`, `src/llm/model-catalog.ts`).
- Normalized `reasoningTokens` helpers so unsupported models can expose explanatory copy without being marked supported (`src/llm/model-catalog.ts`).
- Passed provider-level reasoning guidance/capabilities through the admin state so the selector can show consistent badges for custom models (`frontend/src/api/types.ts`, `frontend/src/pages/AdminDashboard.tsx`).
- Ran `npm run build` to refresh the bundles (`frontend/dist/assets/main-DbWS7jBT.js`, `frontend/dist/assets/main-CukkOikA.css`).
- Manual QA to queue: load `/serve-llm` and confirm Grok/Groq selections render the new badges/tooltips while OpenAI/Anthropic models still surface range summaries.
- Refined the reasoning capability UI: badges now appear only for the capabilities a model actually exposes (tokens-only, modes-only, neither) and helper copy drops into the detail note when sliders are provider-managed (`frontend/src/components/ModelSelector.tsx`).
- Softened the reasoning token control styling to an indigo accent to avoid the prior red warning treatment (`frontend/src/components/TokenBudgetControl.css`).
- Rebuilt the front-end to ship the updated logic (`frontend/dist/assets/main-C3X7IB11.js`, `frontend/dist/assets/main-BMBx5_0i.css`).
- QA follow-up: check a Gemini model (tokens only) shows only the token badge, Anthropic Sonnet shows both, and Grok 4 Fast Non-Reasoning hides both while still displaying the helper note.
- Added a local `vite-env.d.ts` with a `*.css` module declaration so the new side-effect stylesheet imports compile cleanly in IDEs (`frontend/src/vite-env.d.ts`).
- Relocated the loading shell renderer to `src/views/loading-shell.ts` and excluded the old `src/pages` tree from TypeScript builds to silence lingering editor errors from deleted templates (`tsconfig.json`, `src/server/server.ts`).

## Progress Log (2025-10-19)
- Restored the setup wizard launch flow: when `needsProviderSetup`/`needsBriefSetup` transitions to complete, the React dashboard now opens `/` in a new tab and falls back to a same-tab redirect if the browser blocks pop-ups (`frontend/src/pages/AdminDashboard.tsx`).
- Added a guard to avoid SSR issues by checking `typeof window !== "undefined"` before issuing redirects (`frontend/src/pages/AdminDashboard.tsx`).
- Ran `npm run build` to refresh both bundles and type outputs; Vite emitted `frontend/dist/assets/main-Btox1gin.js` alongside the existing stylesheet hashes.
- Manual QA still required: verify the new launch flow across Chrome/Safari/Firefox with pop-up blockers on/off and confirm the admin shell stays loaded in the original tab.
- Corrected GPT-3.5 metadata so reasoning badges stay hidden: explicitly flagged both GPT-3.5 variants as not supporting reasoning modes and added helper copy clarifying the limitation (`src/llm/model-catalog.ts`).
- Rebuilt TypeScript + Vite bundles after the metadata tweak (`npm run build`).
- Updated Groq catalog entries so only GPT-OSS models advertise reasoning modes; Llama, Kimi, and other Groq-hosted weights now surface helper copy explaining the missing controls (`src/llm/model-catalog.ts`).
- Refined the token slider styling to eliminate the dead zones on the range input and keep the thumb inside the panel on Safari/Chrome (`frontend/src/components/TokenBudgetControl.css`).
- Ran `npm run build` to emit the refreshed bundles (`frontend/dist/assets/main-DJdS-eeU.js`, `frontend/dist/assets/main-B8axH3jL.css`).
- QA follow-up: verify Groq’s GPT-OSS models show the “Reasoning modes” badge while Llama/Kimi omit it; confirm the reasoning mode toggle disappears for non-supported models in the provider form and the token slider drags edge-to-edge without overflow.
- Per-model max-token ranges now clamp both UI and backend: the OpenAI selector merges model caps (e.g., GPT-4o at 16,384) so the slider and inputs stop at the model ceiling, and the server enforces the same bounds before persisting (`frontend/src/pages/AdminDashboard.tsx`, `src/server/admin-controller.ts`).
- Added explicit max output limits for GPT-3.5 variants to keep their sliders at 4K/16K and refreshed the catalog metadata to match (`src/llm/model-catalog.ts`).
- Rebuilt bundles after the range fixes (`frontend/dist/assets/main-2zZj1ekq.js`, `frontend/dist/assets/main-B8axH3jL.css`).
- QA follow-up: confirm GPT-4o/ChatGPT-4o default to 16,384/4,096 caps, GPT-3.5 sliders stop at 4K/16K, and backend persists clamped values when submitting via the provider form and JSON API.
- Tweaked the capability pills so they’re compact chips (label + optional value) instead of two-line badges—removed “Supported/Available” copy and dropped the font size/padding for the condensed layout (`frontend/src/components/ModelSelector.tsx`, `frontend/src/components/ModelSelector.css`).
- Rebuilt bundles after the styling change (`frontend/dist/assets/main-Dr_trMaP.js`, `frontend/dist/assets/main-CO54teHh.css`).
- QA follow-up: check the Model Selector pills render as single-line chips on narrow widths, verify tooltips still surface helper copy, and ensure reasoning badges continue to expose token summaries where applicable.
- Further tightened the chip styling (smaller type, reduced padding, forced single-line display) so pills sit side-by-side without wrapping (`frontend/src/components/ModelSelector.css`).
- Rebuilt bundles again after the tweak (`frontend/dist/assets/main-DhdS9JlX.js`, `frontend/dist/assets/main-C4BDecHG.css`).
- QA follow-up: confirm chips stay single-line at common breakpoints (desktop, 1024px, and ~768px), ensuring no badge text wraps and tooltips remain reachable.
- Flagged both GPT-4.5 preview entries as non-reasoning models and added helper copy so the selector hides the reasoning pill/toggle for those SKUs (`src/llm/model-catalog.ts`).
- Rebuilt TypeScript + Vite bundles (no hash changes this round) after updating the catalog (`npm run build`).
- QA follow-up: verify selecting GPT-4.5 previews in the provider panel now hides the reasoning toggle/badge while other GPT-5 models still expose it.
- Shrunk the capability chips further (font-size 0.5rem, padding 3px) to keep long labels on one line and refreshed the built assets (`frontend/dist/assets/main-CjfaIsD-.js`, `frontend/dist/assets/main-DKSdrlZI.css`).
- QA follow-up: re-check chips at desktop/tablet widths to confirm no wrapping and that hit targets remain usable.
- Merged reasoning badges into the same capability row so all chips sit within a single container (`frontend/src/components/ModelSelector.tsx`).
- Rebuilt bundles after the merge (`frontend/dist/assets/main-BtodCeyI.js`, `frontend/dist/assets/main-DKSdrlZI.css`).
- QA follow-up: confirm reasoning pills now appear alongside modality/image badges without dropping to a second row.
- Retired the unused CLI prompter helper (`src/config/prompter.ts`) and removed the compiled artifacts; no runtime references remained.
- Re-ran `npm run build` to keep `dist/` aligned post-deletion.
- Nudged capability chip sizing back up slightly (padding 4px, ~0.6rem type) while keeping the single-line layout (`frontend/src/components/ModelSelector.css`).
- Rebuilt bundles after the tweak (`frontend/dist/assets/main-5csEPTUg.js`, `frontend/dist/assets/main-B9Yb7pRB.css`).
- Added Claude Haiku 4.5 to the Anthropic catalog (with pricing, reasoning tokens, and 64K max output) and retired the legacy Haiku 3 entry (`src/llm/model-catalog.ts`).
- Ran `npm run build` to refresh the type + Vite outputs post-catalog update.
- Introduced Markdown rendering for reasoning summaries/details in the history explorer (`react-markdown` + `remark-gfm`); reasoning steps now render with formatting and collapsible detail blocks (`frontend/src/components/HistoryExplorer.tsx`, `frontend/src/pages/AdminDashboard.css`).
- Added the new dependencies to the frontend package and rebuilt assets to pull in the markdown runtime (`frontend/package.json`, `frontend/dist/assets/main-BeSFFTOu.js`, `frontend/dist/assets/main-DMcw021L.css`).
- QA follow-up: verify reasoning bullets support Markdown (links, lists, bold) and that detail accordions expand/collapse correctly without layout regressions.
- Restored a “launch pad” success overlay in the React admin: once setup finishes, the dashboard now shows a modal with links to open the live app or stay in admin (`frontend/src/pages/AdminDashboard.tsx`, `frontend/src/pages/AdminDashboard.css`).
- Rebuilt assets after the overlay addition (`frontend/dist/assets/main-BeSFFTOu.js`, `frontend/dist/assets/main-DMcw021L.css`).
- QA follow-up: run through setup to confirm the success card appears once, the “Open live app” button opens `/` in a new tab, and dismissing the overlay returns to the dashboard.
- Gemini thinking traces now opt-in when the toggle is enabled even without an explicit budget (and Anthropic/Gemini reasoning summaries flow into history exports via Markdown) (`src/llm/gemini-client.ts`).
- QA follow-up: verify a Gemini request with reasoning enabled surfaces thinking steps in the history panel and exported JSON.
- Anthropic client now uses `messages.create` for thinking responses and emits fallback summaries when only token counts are returned, ensuring Haiku/Sonnet traces appear in history/exports (`src/llm/anthropic-client.ts`).
- QA follow-up: run Claude Sonnet 4.5 & Haiku 4.5 with reasoning on—check that history entries show markdown summaries (or fallback messages) and that `reasoningTokens` propagate in export JSON.
- Reverted Anthropic to the streaming Messages API so thinking deltas arrive in real time; still emits fallback summaries when only token counts are present (`src/llm/anthropic-client.ts`).
- QA follow-up: verify streamed traces populate the history panel and export even when the UI toggle is the only change.
- Note: Keep Anthropic streaming enabled—Claude only emits detailed thinking when the live stream is active and budgets exceed the inline threshold; the non-streaming endpoint drops those traces.
- Provider updates now auto-select a low reasoning mode whenever tokens are enabled but the mode was left at "none" (applies to both runtime defaults and admin updates) so Anthropic/Gemini thinking stays active (`src/server/admin-controller.ts`, `src/config/runtime-config.ts`).
- Providers without a reasoning token slider (OpenAI) no longer reset back to "none" when saving, keeping the selected mode so GPT reasoning traces return as expected (`src/server/admin-controller.ts`).
- QA follow-up: toggle reasoning on without manually changing the mode—ensure the UI shows "Low" and history captures traces for both providers.

### Reasoning Trace Investigation (2025-10-19 late session)
- **Observed gaps:**
  - Claude Sonnet/Haiku exports still show `reasoningTokens` usage but no `reasoningSummaries`/`reasoningDetails` blocks, even after re-enabling streaming; Gemini and GPT models now emit Markdown traces correctly.
  - Provider state returned by `/api/admin/state` reflects `reasoningMode: "none"` whenever the user hasn’t explicitly changed the dropdown (especially on Anthropic, where the UI hides the mode control). Admin updates sometimes persist `reasoningTokensEnabled: undefined`, so downstream logic must treat `undefined` as “inherit default of true”.
- **What we tried:**
  1. Restored Anthropic `messages.stream` + `thinking_delta` handling and added fallback summaries when only token counts are returned.
  2. Ensured Gemini requests enable thinking whenever the toggle is on (even without a manual budget) and add a fallback summary.
  3. Forced reasoning mode to `low` when tokens are enabled so providers don’t revert to `none` silently.
- **Still missing:** Anthropic responses from the latest API snapshot contain neither `thinking_delta` events nor `content` blocks of type `thinking`. Need to confirm whether additional betas/headers (e.g., `thinking: { type: "enabled", quality: "advanced" }`) are required.
- **Next steps for pickup:**
  1. Capture and inspect `result.raw` for Claude Sonnet 4.5 with and without streaming to determine where thinking data lives (if anywhere).
  2. Check Anthropic’s October 2025 docs for updated `thinking` payload requirements; adjust `thinking` request shape accordingly.
  3. Once thinking data is confirmed, update the Markdown renderer to handle any new block structure; keep fallback summaries for the no-text case.
  4. Re-run export/h2 history verification for Anthropic and document exact request settings in this log.
