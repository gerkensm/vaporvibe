---
trigger: glob
globs: **/src/server/component-cache.ts, **/src/server/server.ts
---

# Content from docs/modules/server/component-cache.md

# Module Documentation: `server/component-cache.ts`

> **File**: `src/server/component-cache.ts`  
> **Last Updated**: Sat Oct 25 16:51:43 2025 +0200  
> **Commit ID**: `eafda53be246e6c62151e15e9b532da876719dce`

> [!WARNING]
> This documentation is manually maintained and may be outdated. Always verify against the source code.

## Overview
The Component Cache system is a critical optimization that allows the LLM to reuse previously generated HTML fragments (components and styles) instead of regenerating them. This dramatically reduces token usage (by up to 99% for minor updates) and ensures UI consistency.

## Core Concepts & Implementation Details

### 1. Placeholder System
The core mechanism relies on replacing full HTML markup with compact placeholders:
-   **Components**: `{{component:sl-gen-123}}`
-   **Styles**: `{{style:sl-style-45}}`

### 2. Cache Preparation (`prepareReusableCaches`)
Before sending context to the LLM, the server processes the *previous* HTML to build a "menu" of reusable items.
-   **Identification**: It scans for structural tags (`header`, `nav`, `main`, `div`, etc.) and `<style>` blocks.
-   **Annotation**: If an element doesn't have a `data-id`, it assigns one (e.g., `sl-gen-1`).
-   **Extraction**: It extracts the full outer HTML of these elements into a dictionary (`componentCache`).

### 3. Placeholder Application (`applyReusablePlaceholders`)
After the LLM generates a response (which hopefully uses the placeholders we taught it), this function re-inflates the HTML.
-   **Substitution**: It scans for `{{...}}` patterns and looks them up in the cache.
-   **Validation**: It tracks missing IDs (hallucinations) vs. successfully replaced ones.

## Key Functions

### `prepareReusableCaches(html, options)`
Parses the input HTML (using `node-html-parser`) and returns a `ReusableCachePreparationResult`.
-   **Inputs**: Previous HTML, next available ID counters.
-   **Outputs**: Annotated HTML (with `data-id`s added), `componentCache`, `styleCache`, and updated counters.
-   **Logic**: It specifically targets "structural" tags defined in `STRUCTURAL_COMPONENT_TAGS` to avoid caching too granularly (like every `<span>`).

### `applyReusablePlaceholders(html, caches)`
-   **Inputs**: The LLM's raw output (with placeholders), the master cache.
-   **Outputs**: The fully resolved HTML string.
-   **Error Handling**: If the LLM invents a placeholder ID that doesn't exist, it is replaced with an empty string (and logged as missing).

## Data Formats

### `PlaceholderApplyResult`
```typescript
interface PlaceholderApplyResult {
  html: string;
  missingComponentIds: string[]; // IDs the LLM used but we don't have
  missingStyleIds: string[];
  replacedComponentIds: string[]; // IDs successfully restored
  replacedStyleIds: string[];
}
```

## Shortcomings & Technical Debt

### Architectural
-   **Parser Dependency**: Relies on `node-html-parser`. If the parser chokes on malformed HTML, the cache preparation fails.
-   **Granularity**: The `STRUCTURAL_COMPONENT_TAGS` set is hardcoded. It might miss important elements or cache too many trivial `div`s.

### Implementation
-   **Regex Substitution**: `applyReusablePlaceholders` uses a regex (`PLACEHOLDER_PATTERN`). This is fast but can be fragile if the LLM outputs malformed placeholders (e.g., `{{ component: ... }}` with spaces).
-   **Stateful ID Generation**: The system relies on monotonically increasing counters (`nextComponentId`). If these get out of sync with the actual IDs in the HTML, collisions could occur.

