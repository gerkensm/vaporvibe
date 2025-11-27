# LLM Reasoning Capabilities & Behaviors

> **Scope**: Reference documentation for how different LLM providers handle "Reasoning" (Chain of Thought) and how VaporVibe normalizes these behaviors.

## Overview

VaporVibe supports two distinct modes of operation for LLMs:
1.  **Basic Mode**: Standard generation. The model outputs the final response directly.
2.  **Thinking Mode**: The model generates a hidden "Chain of Thought" before the final answer. This is displayed in the UI as a streaming "Thinking process".

However, not all providers implement this cleanly. This document details the specific behaviors and quirks of each provider.

## Provider Behaviors

### 1. Google Gemini

Gemini has the most complex configuration matrix due to evolving API standards between model versions.

| Model Family      | Control Mechanism          | Basic Mode Behavior                                               | Thinking Mode Behavior |
| :---------------- | :------------------------- | :---------------------------------------------------------------- | :--------------------- |
| **Flash (2.x)**   | `thinkingBudget` (Tokens)  | **Clean**. Set `thinkingBudget: 0` to disable.                    | Respects budget.       |
| **Pro (2.x/3.x)** | `thinkingLevel` (Low/High) | **Impossible**. These models *always* think.                      | Respects level.        |
| **Experimental**  | `thinkingBudget`           | **Leaky**. Even with budget 0, may generate small thought traces. | Respects budget.       |

**Implementation Strategy**:
-   For Flash models, we explicitly send `thinkingBudget: 0` when reasoning is disabled.
-   For Pro models, we accept that they will always generate reasoning and the UI handles it gracefully.

### 2. OpenAI

OpenAI splits its models into two distinct classes.

| Model Class   | Examples                | Basic Mode Behavior                       | Thinking Mode Behavior                            |
| :------------ | :---------------------- | :---------------------------------------- | :------------------------------------------------ |
| **Standard**  | `gpt-4o`, `gpt-4-turbo` | **Clean**. No reasoning tokens generated. | Not supported.                                    |
| **Reasoning** | `o1`, `gpt-5`           | **Always On**. Cannot be disabled.        | `reasoning_effort` controls depth (Low/Med/High). |

**Implementation Strategy**:
-   We detect if a model is a "Reasoning Model" based on its ID.
-   If a user selects "Basic Mode" for an `o1` model, we treat it as "Default Effort" rather than disabling reasoning (which is impossible).

### 3. Anthropic (Claude)

Anthropic uses a "Thinking Block" system.

| Model              | Control Mechanism                  | Basic Mode Behavior                     | Thinking Mode Behavior                         |
| :----------------- | :--------------------------------- | :-------------------------------------- | :--------------------------------------------- |
| **Claude 3.5/3.7** | `thinking` block + `budget_tokens` | **Clean**. No thinking block generated. | Generates `thinking` block, then `text` block. |

**Implementation Strategy**:
-   This is the cleanest implementation. We simply omit the `thinking` parameter in the API request to disable it.

### 4. Groq (OSS Models)

Groq serves open-weights models which vary wildly in their training.

| Model Type          | Examples                  | Basic Mode Behavior                                                       | Thinking Mode Behavior            |
| :------------------ | :------------------------ | :------------------------------------------------------------------------ | :-------------------------------- |
| **Standard**        | `llama-3.3`, `mixtral`    | **Clean**.                                                                | Not supported.                    |
| **Reasoning-Tuned** | `deepseek-r1`, `qwen-2.5` | **Leaky**. Some models output `<think>` tags even without specific flags. | Supported via `reasoning_format`. |

**Implementation Strategy**:
-   The UI is resilient to "Leaky" reasoning. If we detect `<think>` tags or `reasoning_content` in a basic response, we display it properly instead of hiding it or breaking.

## Verification

We maintain a suite of **Live Fixtures** to verify these behaviors don't drift over time.

-   **Script**: `scripts/fixtures/verify-all-fixtures.ts`
-   **Data**: `tests/fixtures/<provider>/*.json`

Run the verification script to confirm that "Basic" fixtures actually contain 0 reasoning tokens (where possible) and "Thinking" fixtures contain valid traces.
