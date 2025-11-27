---
trigger: glob
globs: **/tests/llm/**/*.test.ts, **/tests/fixtures/**/*.json, **/scripts/fixtures/**/*.ts
---

# Content from tests/llm/README.md

# LLM Client Testing Architecture

> **Purpose**: This document describes the testing strategy for LLM provider clients (Gemini, Anthropic, OpenAI, Groq, Grok) in VaporVibe, with emphasis on the parametrized reasoning pipeline test suite.

## Overview

VaporVibe's LLM client tests in `tests/llm/` provide **end-to-end verification** of LLM reasoning stream processing pipelines, from raw API responses through to frontend display. Tests are **parametrized** to automatically run against every fixture file in `tests/fixtures/{provider}/`, ensuring comprehensive coverage as we add new test cases.

The primary focus is on the **Gemini reasoning pipeline** (`gemini-reasoning-pipeline.test.ts`), but the architecture extends to all providers that support reasoning/thinking capabilities (Anthropic, OpenAI, Groq, Grok).

## Test Architecture

### Parametrized Testing Strategy

Instead of hardcoding tests for specific fixtures, we:
1. **Auto-discover** all `.json` files in `tests/fixtures/gemini/`
2. **Generate test cases** for each fixture dynamically
3. **Track transformations** through 7 distinct stages

This means adding a new fixture automatically creates 7 new tests!

### Pipeline Stages Tested

Each fixture flows through these transformation stages:

```
Raw API Response
      ↓
[Stage 1: Structure Validation]
      ↓
GeminiClient.generateHtml()
      ↓
[Stage 2: Content Extraction] ← Removes thinking from HTML
      ↓
[Stage 3: Reasoning Trace]    ← Structures thinking for history
      ↓
LlmStreamObserver.onReasoningEvent()
      ↓
[Stage 4: Stream Events]      ← Real-time events emitted
      ↓
SSE Controller (simulated)
      ↓
[Stage 5: SSE Format]         ← Server-Sent Event messages
      ↓
Frontend Display Logic
      ↓
[Stage 6: Display State]      ← Accumulated markdown
      ↓
[Stage 7: Usage Metadata]     ← Token counts propagated

```

## Test Files

### `gemini-reasoning-pipeline.test.ts`

**Parametrized integration tests** covering all fixtures:

- **85 tests generated** (7 stages × 12 fixtures + cross-fixture comparisons)
- **All snapshots capture OUR transformations**, not raw input
- **Verifies end-to-end flow** from API to display

#### Stage Details

| Stage                  | What It Tests                 | Key Assertions                                 |
| ---------------------- | ----------------------------- | ---------------------------------------------- |
| **Stage 1: Raw API**   | Input structure validation    | Chunk count, thinking presence, usage metadata |
| **Stage 2: Content**   | HTML extraction (no thinking) | Output length, code blocks, markdown removal   |
| **Stage 3: Reasoning** | Trace structure for history   | Details array, raw format, preview content     |
| **Stage 4: Observer**  | Stream event emission         | Event count, kind validation, newline handling |
| **Stage 5: SSE**       | Server-Sent Event format      | Message structure, JSON payloads               |
| **Stage 6: Display**   | Frontend accumulation         | Streamed vs final text, markdown presence      |
| **Stage 7: Usage**     | Token metadata propagation    | Input/output/reasoning token counts            |

### `gemini-client.test.ts`

**Unit tests** for low-level transformation logic:

- Raw fixture parsing
- Thinking parts extraction
- Progressive accumulation
- Event emission mechanics
- Edge case handling

### `gemini-client-integration.test.ts`

**Legacy integration tests** (can be deprecated in favor of pipeline tests):

- Manual SDK mocking
- Hardcoded fixture selection
- Less comprehensive than parametrized approach

## Snapshot Strategy

### What Gets Snapshotted

✅ **Transformed outputs** from OUR code:
- Extracted HTML (thinking removed)
- Structured reasoning traces
- Stream observer events
- SSE message formats
- Frontend display state
- Usage metadata transformations

❌ **Not snapshotted** (we load fixtures instead):
- Raw API responses (fixtures themselves)

### Snapshot Naming Convention

```
Gemini Reasoning Pipeline > Fixture: '<name>' > Stage X: <description> > <snapshot-name>
```

Example:
```
Gemini Reasoning Pipeline > Fixture: 'gemini-2.5-flash-thinking' > Stage 3: GeminiClient Reasoning Trace > reasoning-trace 1
```

## Coverage

### Fixtures Tested

All fixture files in `tests/fixtures/gemini/`:

- ✅ `gemini-2.5-flash-basic.json`
- ✅ `gemini-2.5-flash-thinking.json`
- ✅ `gemini-2.5-flash-lite-thinking.json`
- ✅ `gemini-2.0-flash-exp-basic.json`
- ✅ `gemini-2.0-flash-thinking-exp-1219-*.json` (multiple variants)
- ✅ `gemini-3-pro-preview-thinking-high.json`
- ✅ `gemini-3-pro-preview-thinking-low.json`
- ✅ `gemini-3-pro-preview-basic.json`

### Reasoning Modes Covered

- **Flash models**: Budget-based (`reasoningTokens` parameter)
- **Pro models**: Level-based (`reasoningMode`: `high`/`low`)
- **Basic mode**: No reasoning (baseline comparison)

### Modules Tested

- ✅ `GeminiClient.generateHtml()` - Main generation
- ✅ `GeminiClient.collectGeminiThoughtSummaries()` - Event collection
- ✅ `GeminiClient.mergeGeminiThoughtSummary()` - Delta calculation
- ✅ `GeminiClient.extractGeminiThinking()` - Final trace assembly
- ✅ `LlmStreamObserver` interface - Event propagation
- ✅ SSE message formatting - Server integration
- ✅ Frontend accumulation logic - Display state

## Running Tests

### All Tests

```bash
npm test tests/llm/gemini-reasoning-pipeline.test.ts
```

### Watch Mode (Development)

```bash
npm test tests/llm/gemini-reasoning-pipeline.test.ts -- --watch
```

### Update Snapshots After Intentional Changes

```bash
npm test tests/llm/gemini-reasoning-pipeline.test.ts -- -u
```

### Filter by Fixture Name

```bash
npm test tests/llm/gemini-reasoning-pipeline.test.ts -- -t "flash-thinking"
```

### Filter by Stage

```bash
npm test tests/llm/gemini-reasoning-pipeline.test.ts -- -t "Stage 4"
```

## Key Insights from Snapshots

### Content Extraction Verification

**Stage 2 snapshots** prove that thinking is correctly removed from HTML:

```typescript
{
  "containsCodeBlock": true,
  "containsThinking": false,  // ✅ No "**" markdown in output
  "htmlLength": 1234,
  "htmlPreview": "function sayHello()..."
}
```

### Reasoning Trace Structure

**Stage 3 snapshots** show how thinking is structured for history:

```typescript
{
  "detailsCount": 4,  // 4 thinking blocks
  "firstDetailPreview": "**Analyzing the Requirements**...",
  "hasReasoning": true,
  "rawLength": 4,
  "rawType": "array"
}
```

### Stream Events Validation

**Stage 4 snapshots** verify observer receives correct events:

```typescript
{
  "eventCount": 4,
  "allKindThinking": true,  // All events have kind: "thinking"
  "allEndWithNewline": true,  // All events end with "\n"
  "totalChars": 542,
  "firstEventPreview": "**Analyzing the Requirements**..."
}
```

### Usage Metadata Accuracy

**Stage 7 snapshots** confirm token counts are propagated:

```typescript
{
  "inputTokens": 15,
  "outputTokens": 307,
  "reasoningTokens": 710,  // ✅ Thinking tokens captured
  "totalTokens": 1032,
  "hasReasoningTokens": true
}
```

## Adding New Tests

### Add a New Fixture

1. Capture API response: `npx tsx capture-gemini-responses.ts`
2. File is auto-saved: `tests/fixtures/gemini/<model>-<variant>.json`
3. **Tests auto-generate**: Re-run test suite, 7 new tests appear!

### Add a New Pipeline Stage

Edit `gemini-reasoning-pipeline.test.ts` and add:

```typescript
it('Stage 8: My New Transformation', async () => {
  const data = loadFixture(fixture.path);
  // ... test logic
  expect(transformedData).toMatchSnapshot('my-new-stage');
});
```

This test will run for **all fixtures automatically**!

## Verification Checklist

When reviewing snapshot changes, verify:

- [ ] HTML output contains no thinking markers (`**`, reasoning text)
- [ ] Reasoning trace has `details` and `raw` arrays
- [ ] Stream events all have `kind: "thinking"`
- [ ] All stream events end with `\n`
- [ ] SSE messages follow `event: reasoning\ndata: {...}\n\n` format
- [ ] Frontend state shows accumulated text matches final trace
- [ ] Usage metadata includes `reasoningTokens` for thinking models
- [ ] Basic mode has `hasReasoningTokens: false`

## Future Enhancements

### Phase 2: Frontend Integration

- [ ] Test actual `reasoning-stream.js` module
- [ ] Test `interceptor.ts` reasoning display
- [ ] Test markdown rendering output
- [ ] Test sticky scrolling behavior

### Phase 3: Cross-Provider Tests

- [ ] Test Anthropic pipeline with same structure
- [ ] Test OpenAI pipeline
- [ ] Test Groq pipeline
- [ ] Verify consistent event format across providers

### Phase 4: Error Handling

- [ ] Test malformed API responses
- [ ] Test network interruptions (incomplete streams)
- [ ] Test timeout behavior
- [ ] Test retry logic

## Maintenance

### When to Update Snapshots

Update snapshots (`-u`) when:

✅ Intentionally changing transformation logic
✅ Adding new reasoning extraction features  
✅ Improving markdown parsing
✅ Fixing bugs in event emission

❌ **Don't update** if:
- Snapshots changed unexpectedly (investigate regression!)
- Only fixture content changed (that's expected)

### Debugging Failed Tests

1. **Check which stage failed**: Test name shows the stage
2. **View snapshot diff**: `npm test -- -t "<test name>"`
3. **Inspect fixture**: Load the JSON file and trace manually
4. **Add logging**: Insert `console.log` in client code
5. **Update code**: Fix the transformation logic
6. **Verify manually**: Check with real API if needed
7. **Update snapshot**: Run with `-u` flag

## Related Documentation

- [Test Fixtures README](../fixtures/README.md) - How fixtures were captured
- [GeminiClient Module Docs](../../docs/modules/llm/gemini-client.md) - Implementation details
- [Reasoning Stream Architecture](../../docs/architecture/llm-pipeline.md) - System design

