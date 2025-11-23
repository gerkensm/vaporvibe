---
trigger: glob
globs: src/llm/client.ts, src/llm/*-client.ts, src/server/server.ts
---

When working on `src/llm/client.ts`, any provider client in `src/llm/`, or `src/server/server.ts`, you MUST read the documentation at `docs/modules/llm/client.md` to understand the `LlmClient` interface and the reasoning stream observer pattern.
