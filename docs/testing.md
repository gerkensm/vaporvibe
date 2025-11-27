# Testing Guide

> **Scope**: Explains the testing infrastructure for VaporVibe, focusing on LLM provider integration and reasoning pipeline verification.

## Overview

VaporVibe uses a robust testing strategy to ensure that all supported LLM providers (OpenAI, Anthropic, Gemini, Groq) work correctly, especially regarding their "Reasoning" (Chain of Thought) capabilities.

## End-to-End Reasoning Pipeline Tests

The core of our verification is `tests/llm/provider-reasoning-pipeline.test.ts`. This test suite runs a parametrized set of tests against **real API response fixtures**.

### How it Works

1.  **Fixtures**: We capture real API responses (raw JSON) from providers and store them in `tests/fixtures/<provider>/<model>.json`.
2.  **Adapters**: The test file defines `ProviderTestAdapter` classes for each provider. These adapters know how to:
    *   Mock the specific `LlmClient` (e.g., `GeminiClient`) to return the fixture data.
    *   Extract raw structure statistics from the fixture for verification.
3.  **Stages**: For each fixture, the test runs through 6 stages:
    *   **Stage 1: Raw API Structure**: Verifies the fixture JSON itself has expected fields.
    *   **Stage 2: Content Extraction**: Checks if `client.generateHtml()` returns the correct HTML.
    *   **Stage 3: Reasoning Trace**: Verifies that `result.reasoning` is correctly populated.
    *   **Stage 4: Stream Observer**: Verifies that the `LlmStreamObserver` receives "thinking" events.
    *   **Stage 5: SSE Format**: Checks that events are correctly formatted for the frontend (Server-Sent Events).
    *   **Stage 6: Usage Metadata**: Verifies token usage counts are propagated.

## Fixture Management

We do not mock the *network* calls in these tests; we mock the *client's internal response handling* using captured data. This ensures we test our parsing logic against real-world data shapes.

### Capturing New Fixtures

We have dedicated scripts to capture fresh responses from providers. These scripts make real API calls and save the raw output to `tests/fixtures/`.

**Location**: `scripts/fixtures/`

**Usage**:

1.  **Anthropic**:
    ```bash
    export ANTHROPIC_API_KEY=sk-...
    npx tsx scripts/fixtures/capture-anthropic-responses.ts
    ```

2.  **Gemini**:
    ```bash
    export GEMINI_API_KEY=AIza...
    npx tsx scripts/fixtures/capture-gemini-responses.ts
    ```

3.  **OpenAI**:
    ```bash
    export OPENAI_API_KEY=sk-...
    npx tsx scripts/fixtures/capture-openai-responses.ts
    ```

4.  **Grok (xAI)**:
    ```bash
    export XAI_API_KEY=xai-...
    npx tsx scripts/fixtures/capture-grok-responses.ts
    ```

### Verifying Fixtures

To ensure that the captured fixtures are valid and contain the expected data (e.g., actually contain reasoning tokens if requested), use the verification script:

```bash
npx tsx scripts/fixtures/verify-all-fixtures.ts
```

This script scans all JSON files in `tests/fixtures/` and performs provider-specific checks (e.g., checking for `thinking_delta` in Anthropic events or `thought: true` in Gemini parts).

## Running Tests

To run the pipeline tests:

```bash
npm test tests/llm/provider-reasoning-pipeline.test.ts
```

To update snapshots (if you captured new fixtures or changed parsing logic):

```bash
npm test tests/llm/provider-reasoning-pipeline.test.ts -- -u
```
