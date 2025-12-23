# OpenRouter Integration Findings

> **Date**: 2025-12-23  
> **Investigation**: Implementation of OpenRouter as LLM and Image Generation provider  
> **SDK Version**: @openrouter/sdk ^0.3.10

## Summary

OpenRouter provides unified access to 200+ models from multiple providers through a single API. This document captures implementation decisions, quirks discovered, and justifications for non-obvious design choices.

## Key Implementation Decisions

### 1. Why Raw Fetch for Image Generation (Not SDK)

**Decision**: Use raw `fetch` instead of `@openrouter/sdk` for image generation.

**Problem**: The SDK's response parsing strips the `images` array from responses.

```typescript
// SDK returns this structure, but images array is missing:
{
  choices: [{ message: { content: "..." } }]
}

// Raw API actually returns:
{
  choices: [{ message: { content: "...", images: [{ image_url: { url: "..." } }] } }]
}
```

**Solution** (`src/image-gen/providers/openrouter.ts`):
```typescript
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { "Authorization": `Bearer ${apiKey}`, ... },
  body: JSON.stringify({ model, messages, modalities: ["image", "text"], stream: false })
});
```

### 2. Qualitative Reasoning Modes (Not Token Budgets)

**Decision**: Use `reasoning.effort` (low/medium/high) for ALL OpenRouter models, not `reasoning.max_tokens`.

**Rationale**:
- OpenRouter's unified `reasoning` parameter automatically converts to provider-native format:
  - Anthropic: `effort` → `budget_tokens`
  - Gemini: `effort` → `thinking_budget`
  - OpenAI o-series: Uses `reasoning_effort` directly
- Using qualitative modes avoids hardcoding model ID prefixes to determine support
- Simpler for users—no need to know optimal token counts per model

**Code Pattern**:
```typescript
if (settings.reasoningMode && settings.reasoningMode !== "none") {
  requestParams.reasoning = {
    effort: settings.reasoningMode,  // "low" | "medium" | "high"
  };
}
```

### 3. Dynamic Model Catalog (Not Static)

**Decision**: Fetch models dynamically from OpenRouter API at runtime.

**Rationale**:
- OpenRouter adds new models frequently (200+ models, growing)
- Static lists become stale immediately
- Usage-based sorting provides better UX (popular models first)

**Implementation**:
- 5-minute cache TTL for model list
- 1-hour cache TTL for rankings data
- Fallback static models when no API key

### 4. Rankings Scraped from HTML (Not Official API)

**Decision**: Parse rankings from `openrouter.ai/rankings` HTML page.

**Problem**: OpenRouter has no official API endpoint for usage rankings.

**Solution** (`src/llm/openrouter-models.ts`):
```typescript
const html = await fetch("https://openrouter.ai/rankings").then(r => r.text());
const blocks = extractRankingBlocks(html);  // Parse embedded JSON
```

**Quirk**: The HTML embeds `rankingData` as escaped JSON. Parser handles both escaped (`\"`) and unescaped quotes.

**Fallback**: If scraping fails, models are sorted alphabetically.

### 5. Max Output Token Heuristics

**Problem**: Many OpenRouter models report `max_completion_tokens: null` even when they support large outputs.

**Solution**: Apply heuristics based on context window and model family:

```typescript
if (maxOutput === null || maxOutput === undefined) {
  if (model.id.includes("gemini-2.0-flash")) {
    maxOutput = 8192;  // Known Gemini Flash limit
  } else if (contextWindow > 32000) {
    maxOutput = Math.min(contextWindow, 64000);  // Large context = large output
  } else {
    maxOutput = Math.min(contextWindow || 4096, 4096);
  }
}
```

**Safety Caps**:
- Never trust >128k completion tokens
- Claude 3 Opus capped at 4096 (frequently misreported)
- Non-reasoning models capped at 64k

## API Quirks Discovered

### 1. Reasoning Field Variations

**Finding**: Different upstream providers use different field names for reasoning in streamed responses.

```typescript
// Check all possible field names:
const reasoningChunk = delta.reasoning ||         // Most common
                       delta.reasoning_content || // Some providers
                       delta.reasoning_text;      // Others
```

### 2. Image Response Structure (Snake Case vs Camel Case)

**API Response**:
```json
{
  "choices": [{
    "message": {
      "images": [{
        "image_url": {
          "url": "data:image/png;base64,..."
        }
      }]
    }
  }]
}
```

**Note**: Field is `image_url` (snake_case), not `imageUrl` (camelCase).

### 3. Verification Endpoint

**Finding**: `client.apiKeys.getCurrentKeyMetadata()` is the correct verification method.

**Previous Attempt**: `client.models.list()` works but doesn't validate key permissions as thoroughly.

### 4. Featured Model Detection

**Decision**: Top 20 models by token usage marked as "featured".

**Implementation**: Compare model IDs with fuzzy matching (some rankings use variants like `openai/gpt-4o:free`).

```typescript
function checkFeaturedStatus(modelId: string, featuredSlugs: Set<string>): boolean {
  if (featuredSlugs.has(modelId)) return true;
  // Fuzzy match for variants
  for (const slug of featuredSlugs) {
    if (slug.startsWith(modelId + "-") || slug.startsWith(modelId + ":") ||
        modelId.startsWith(slug + "-") || modelId.startsWith(slug + ":")) {
      return true;
    }
  }
  return false;
}
```

## Environment Variables

| Variable             | Description                 |
| -------------------- | --------------------------- |
| `OPENROUTER_API_KEY` | Primary API key (preferred) |
| `OPENROUTER_KEY`     | Alias for API key           |
| `OPENROUTER_MODEL`   | Override default model      |

## Provider Detection Logic

**Image Generation Provider Resolution**:
```typescript
let provider: ImageGenProvider = "openai";

if (modelId.includes("/")) {
  provider = "openrouter";  // OpenRouter model IDs contain "/"
} else if (modelId.startsWith("gemini") || modelId.startsWith("imagen")) {
  provider = "gemini";
}
```

## Known Limitations

### 1. No RSS API for Unlisted Image Models

Some image models (Flux, Riverflow) don't appear in the main `/api/v1/models` endpoint. We fetch them from the RSS feed, but this is fragile.

### 2. Rankings Scraping May Break

If OpenRouter changes their rankings page structure, the scraper will fail silently and fall back to alphabetical sorting.

### 3. Reasoning Token Display Inconsistent

Some OpenRouter models emit reasoning via different field names, causing potential gaps in the reasoning stream display.

## Testing Notes

### Manual Verification Required

- Model catalog fetching (network-dependent)
- Image generation (depends on model availability)
- Reasoning stream display (varies by upstream provider)

### Unit Tests Cover

- Client instantiation and basic generation
- Multimodal message formatting
- Stream processing and reasoning extraction
- API key verification

## Related Files

| File                                       | Purpose                           |
| ------------------------------------------ | --------------------------------- |
| `src/llm/openrouter-client.ts`             | LLM client implementation         |
| `src/llm/openrouter-models.ts`             | Dynamic model fetching & rankings |
| `src/image-gen/providers/openrouter.ts`    | Image generation client           |
| `tests/llm/openrouter-client.test.ts`      | Unit tests                        |
| `docs/modules/llm/providers/openrouter.md` | Module documentation              |
