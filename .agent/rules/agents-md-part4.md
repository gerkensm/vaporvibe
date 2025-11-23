---
trigger: always_on
globs: **/*
---


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

