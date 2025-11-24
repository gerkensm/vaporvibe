# Test Fixtures Capture Summary

## Overview

This document summarizes the comprehensive test fixture generation completed for the VaporVibe LLM testing suite. We've captured real API responses from multiple providers across all featured models to enable robust testing of reasoning stream processing and LLM client behavior.

## Completed Captures

### ✅ Anthropic (9 fixtures)
All featured Claude models with basic and thinking variants:
- `claude-haiku-4-5` (basic + thinking)
- `claude-opus-4-1-20250805` (thinking only)
- `claude-sonnet-4` (basic + thinking)
- `claude-sonnet-4-20250514` (basic + thinking)
- `claude-sonnet-4-5-20250929` (basic + thinking)

**Reasoning Implementation**: Uses `thinking` blocks with token budgets

### ✅ Gemini (12 fixtures)
All featured Gemini models with appropriate thinking configurations:
- `gemini-2.0-flash-exp` (basic only)
- `gemini-2.0-flash-thinking-exp-1219` (basic + thinking)
- `gemini-2.5-flash` (basic + thinking)
- `gemini-2.5-flash-lite` (basic + thinking)
- `gemini-2.5-pro` (basic + thinking)
- `gemini-3-pro-preview` (basic + thinking-low + thinking-high)

**Reasoning Implementation**: 
- Pro models use `thinkingLevel` (LOW/HIGH)  
- Flash models use `thinkingBudget` (token count)

### ✅ OpenAI (17 fixtures)
All featured GPT models with reasoning effort variants:
- `gpt-4o` (basic only)
- `gpt-5` (basic + low/medium/high reasoning)
- `gpt-5-mini` (basic + low/medium/high reasoning)
- `gpt-5-nano` (basic + low/medium/high reasoning)
- `gpt-5.1` (basic + low/medium/high reasoning)

**Reasoning Implementation**: Uses `reasoning_effort` parameter (low/medium/high)

### ✅ Groq (20 fixtures)
All featured Groq models with reasoning variants where supported:
- `llama-3.3-70b-versatile` (basic only)
- `meta-llama/llama-4-maverick-17b-128e-instruct` (basic only)
- `meta-llama/llama-4-scout-17b-16e-instruct` (basic only)
- `moonshotai/kimi-k2-instruct-0905` (basic only)
- `openai/gpt-oss-120b` (basic + low/medium/high reasoning)
- `openai/gpt-oss-20b` (basic + low/medium/high reasoning)
- `qwen/qwen3-32b` (basic only - API only supports 'none' or 'default' reasoning)

**Reasoning Implementation**: Uses `reasoning_effort` for supported models

### ⏸️ Grok (Pending)
Ready to capture but requires `GROK_API_KEY` environment variable:
- `grok-4-fast-reasoning`
- `grok-3`
- `grok-code-fast-1`

To capture Grok fixtures:
```bash
GROK_API_KEY=xai-... npx tsx capture-grok-responses.ts
```

## Capture Scripts

### Available Scripts
1. **`capture-anthropic-responses.ts`** - Anthropic API capture
2. **`capture-gemini-responses.ts`** - Google Gemini capture
3. **`capture-openai-responses.ts`** - OpenAI API capture
4. **`capture-groq-responses.ts`** - Groq API capture
5. **`capture-grok-responses.ts`** - xAI Grok capture

### Usage Pattern
All scripts follow the same pattern:
```bash
<PROVIDER>_API_KEY=... npx tsx capture-<provider>-responses.ts
```

### What Gets Captured
Each capture includes:
- **Streaming chunks**: Full array of SSE events from the API
- **Timestamps**: Relative timing for each chunk
- **Usage metrics**: Token counts and timing data
- **Reasoning content**: Thinking/summary deltas where applicable

## Fixture Storage Structure

```
tests/fixtures/
├── anthropic/
│   ├── claude-haiku-4-5-basic.json
│   ├── claude-haiku-4-5-thinking.json
│   └── ...
├── gemini/
│   ├── gemini-2.5-flash-basic.json
│   ├── gemini-2.5-flash-thinking.json
│   └── ...
├── openai/
│   ├── gpt-5-basic.json
│   ├── gpt-5-reasoning-high.json
│   └── ...
├── groq/
│   ├── llama-3.3-70b-versatile-basic.json
│   ├── openai-gpt-oss-120b-reasoning-high.json
│   └── ...
└── grok/ (pending)
```

## Notes on Reasoning APIs

### Provider Differences

| Provider     | Reasoning Parameter | Values                   | Token Budget   |
| ------------ | ------------------- | ------------------------ | -------------- |
| Anthropic    | `thinking` block    | boolean + token budget   | Manual         |
| Gemini Pro   | `thinkingLevel`     | LOW, HIGH                | Auto-managed   |
| Gemini Flash | `thinkingBudget`    | token count or -1 (auto) | Manual or Auto |
| OpenAI       | `reasoning_effort`  | low, medium, high        | Auto-managed   |
| Groq         | `reasoning_effort`  | low, medium, high        | Auto-managed   |
| Grok         | `reasoning_effort`  | low, high                | Auto-managed   |

### Qwen Special Case
The Qwen 3 32B model only accepts `reasoning_effort: 'none'` or `reasoning_effort: 'default'`. The `low/medium/high` values are not supported, so only the basic fixture was captured successfully.

## Next Steps

### 1. Create Unit Tests
For each provider, create tests that:
- Mock the API responses using these fixtures
- Verify correct parsing of stream events
- Validate reasoning extraction logic
- Ensure usage metrics are captured correctly

### 2. Create Integration Tests
- Test the full reasoning stream display pipeline
- Verify frontend rendering matches actual API behavior
- Test edge cases (empty reasoning, fragmented streams, errors)

### 3. Capture Grok Fixtures
Once `GROK_API_KEY` is available, run the Grok capture script to complete the fixture set.

## Total Fixtures

**Current Total**: 58 fixtures across 4 providers
- Anthropic: 9
- Gemini: 12  
- OpenAI: 17
- Groq: 20
- Grok: 0 (pending API key)

**Target Total**: ~67 fixtures (including 9 Grok fixtures)
