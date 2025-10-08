# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the TypeScript source, split by concern: `cli/` for argument parsing, `config/` for provider/runtime resolution, `llm/` for OpenAI, Gemini, and Anthropic adapters, `server/` for HTTP orchestration, `utils/` for shared helpers, and `pages/` for the brief-capture HTML.
- `dist/` contains the compiled ESM output that ships via `npx`. Keep the folder in sync by running `npm run build` after edits.
- Environment state (briefs, sessions) is in-memory only; no persistent storage directories exist.

## Build, Test, and Development Commands
- `nvm use` (or `source ~/.nvm/nvm.sh && nvm use`) ensures Node `v24.x` before any other command.
- `npm run dev` starts the TypeScript entry with `tsx` for rapid iteration.
- `npm run build` compiles to `dist/`; this is also triggered automatically by `npm install` via the `prepare` script.
- `npm run start` runs the compiled CLI (`dist/index.js`).
- `npx github:gerkensm/serve-llm "You are a mood journal"` is the expected zero-setup launch path once changes are pushed.
- Reasoning flags: `--reasoning-mode <none|low|medium|high>` and `--reasoning-tokens <number>` flow through to OpenAI (effort) and Anthropic (thinking budgets).
- Set `LOG_LEVEL` to tune the Pino logger (default `debug` locally, `info` in production); use `PINO_PRETTY=false` to opt out of colorized logs when scripting.
- Debug logs surface reasoning summaries and token counts when thinking modes are enabled—keep the level at `debug` to capture them during development.
- Disable the floating instruction panel with `--instructions-panel off` or `INSTRUCTION_PANEL=off` when demos need a cleaner canvas.

## Coding Style & Naming Conventions
- Use TypeScript with `strict` typing and the existing NodeNext module syntax (`import … from "./module.js"`).
- Prefer descriptive function names (`resolveAppConfig`, `createLlmClient`) and keep files focused on a single responsibility.
- Follow 2-space indentation, trailing commas in multi-line literals, and keep helper comments short and purposeful.
- Surface shared literals (paths, env keys) in `src/constants.ts`.

## Testing Guidelines
- No automated tests yet; when adding them, colocate under `src/**/__tests__` or adopt a lightweight runner (e.g., Vitest) that respects ESM.
- Smoke test manually with each provider: set `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY`, then run `npm run dev` and exercise the brief form plus iterative POST flows.
- Aim to cover model-handling utilities (message shaping, HTML guards) with unit tests when a harness is introduced.

## Commit & Pull Request Guidelines
- Craft commits in imperative present tense (`Add Gemini client fallback`, `Refine session pruning`). Squash related tweaks before pushing.
- PRs should describe provider coverage, manual verification steps, and any credential knobs touched. Include screenshots of the brief form if UI changes occur.
- Link tracking issues in the PR body (`Closes #123`) and call out new environment variables or breaking API changes explicitly.

## Provider & Credential Notes
- The CLI auto-detects available keys; if none of `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY` is set it prompts in TTY contexts. Document any new env var usage (including `REASONING_MODE` / `REASONING_TOKENS`) in PRs and prefer `.env.example` updates over hard-coded values.
