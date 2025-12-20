---
trigger: always_on
globs: **/*
---

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
- **Separation of concerns and maintainability**: Always separate concerns, use different modules and proactively reflect on when a functionality needs to be carved out of a file and given its own module, function or service.

### Areas for Caution ⚠️

- **Focused Test Suite**: A Vitest suite now covers config loading, prompt compilation, the session store, and key utilities. It runs fast but doesn't yet exercise every provider path, so keep testing manually when touching network integrations or the SPA.
- **macOS-Centric Builds**: `scripts/` contains complex logic for macOS `.app` and DMG creation/notarization.
- **Inconsistent Reasoning APIs**: OpenAI/Grok use `reasoningMode`, while Anthropic/Gemini use `reasoningTokens`. Backend logic handles normalization.
  
  **Gemini Reasoning Architecture** (critical implementation details):
  
  - **Model Type Split**: Gemini has two distinct reasoning APIs:
    - `gemini-3-pro`: Uses `thinkingLevel` (LOW/HIGH) via `reasoningMode` setting
    - Flash models: Use `thinkingBudget` (token count or -1 for Auto) via `reasoningTokens` setting
  
  - **Auto Mode (`-1`)**: For Flash models, `reasoningTokensEnabled: false` means "Auto mode":
    - Client omits `thinkingBudget` entirely (not `-1`) to let API use defaults
    - Backend must NOT force `reasoningTokensEnabled: true` when toggle isn't user-controllable
    - Frontend must NOT clamp `-1` to `min` value (e.g., `0`) in `TokenBudgetControl`
    - `shouldEnableGeminiThoughts()` ignores `reasoningMode` for Flash (only checks tokens)
  
  - **Stream Observer Creation**: `isReasoningStreamEnabled()` must call `shouldEnableGeminiThoughts()` for Gemini models to ensure the stream observer is created for Auto mode, otherwise reasoning won't display in UI even though it's being generated.
  
  - **State Management**: Frontend's `sanitizeReasoningTokens()` must return `-1` immediately for Gemini without clamping to prevent UI toggle bugs.

- **Embrace the Chaos**: Guide the LLM's creativity, don't force deterministic output. Minor variations are expected.

### TypeScript & Testing Best Practices

To maintain a clean and error-free codebase, follow these TypeScript and testing guidelines:

- **ESM Import Extensions**: Always include the `.js` file extension in relative imports (e.g., `import { foo } from './bar.js';`). This is required for NodeNext module resolution.
- **Node.js Built-ins**: Use the `node:` prefix when importing built-in Node.js modules (e.g., `import fs from 'node:fs';`, `import path from 'node:path';`).
- **Mock Typing**: When creating mock factories for tests (like `getLoggerMock`), return the specialized mock type (e.g., `LoggerMock`) that includes Vitest mock properties (`.mockClear()`, etc.). Cast the mock to its production interface (e.g., `as unknown as Logger`) only at the point of injection into a controller or service.
- **Vitest 4.x Function Mocks**: Use the newer generic syntax for `vi.fn()`: `vi.fn<(arg: Type) => ReturnType>()`. Avoid the deprecated array-based `vi.fn<[Type], ReturnType>()` syntax.
- **Provider Settings**: When creating test fixtures for `ProviderSettings`, ensure the `imageGeneration` property is included.
- **Mandatory Type Checks**: Always run `npm run type-check` before committing. This custom script uses `tsconfig.tests.json` to perform a comprehensive check across both the `src/` and `tests/` directories.

### Contribution Workflow

1.  Make changes in `src/` (backend) or `frontend/src/` (frontend).
2.  Use `npm run dev` for live reloading during development.
3.  **Run tests** to ensure nothing is broken:
    ```bash
    npm test
    ```
4.  **Manually test** thoroughly with relevant providers (`OPENAI_API_KEY`, `GEMINI_API_KEY`, etc. set). Check core flows, admin UI, setup, history, reasoning traces.
5.  Run `npm run build` to ensure both frontend and backend compile successfully and assets are updated.
6.  **Regenerate the codebase map** after making structural changes (new files, imports, exports):
    ```bash
    npm run gen:codebase-map
    ```
    This keeps `docs/CODEBASE_MAP.md` up to date with current import/export relationships for future LLM agents.
7.  **Update Agent Rules**: If you modified documentation, regenerate the agent rules:
    ```bash
    npm run update-rules
    ```
8.  Commit changes, including the updated `dist/`, `frontend/dist/`, `docs/CODEBASE_MAP.md`, and `.agent/rules/` directories.

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

