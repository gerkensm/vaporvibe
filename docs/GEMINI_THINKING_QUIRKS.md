# Gemini Thinking Configuration Findings

> **Date**: 2025-11-23  
> **Investigation**: Verified against real Gemini API  
> **Models Tested**: gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.5-pro, gemini-3-pro-preview

## Summary

Gemini models have **quirky thinking behavior** that requires explicit configuration to control. Our investigation revealed critical differences between model families and the correct way to disable thinking.

## Key Findings

### 1. ❌ Omitting `thinkingConfig` Does NOT Disable Thinking

**What we tried:**
```typescript
const stream = await client.models.generateContentStream({
  model: 'gemini-2.5-flash',
  contents: [...],
  config: {
    // NO thinkingConfig at all
  }
});
```

**Result:** ❌ Gemini still generates 836 thinking tokens implicitly!

### 2. ✅ Setting `thinkingBudget: 0` Successfully Disables Thinking

**Correct approach for Flash models:**
```typescript
const stream = await client.models.generateContentStream({
  model: 'gemini-2.5-flash',
  contents: [...],
  config: {
    thinkingConfig: {
      includeThoughts: true,
      thinkingBudget: 0,  // ← Explicitly zero
    }
  }
});
```

**Result:** ✅ No `thoughtsTokenCount` in usage metadata (null/undefined)

### 3. ❌ Setting `includeThoughts: false` Does NOT Work

**What we tried:**
```typescript
config: {
  thinkingConfig: {
    includeThoughts: false,  // ← Trying to disable
  }
}
```

**Result:** ❌ Still generates 755 thinking tokens!

## Model-Specific Behaviors

### Flash Models (2.5-flash, 2.5-flash-lite, 2.0-flash)

- **Thinking Control**: Use `thinkingBudget` (token count)
- **Disable Thinking**: Set `thinkingBudget: 0`
- **Enable Thinking**: Set `thinkingBudget: 2000` (or desired budget)
- **Auto Mode**: When `reasoningTokensEnabled: false`, use `thinkingBudget: -1`

**Code Pattern:**
```typescript
// Thinking enabled
config.thinkingConfig = {
  includeThoughts: true,
  thinkingBudget: 2000,
};

// Thinking disabled
config.thinkingConfig = {
  includeThoughts: true,
  thinkingBudget: 0,
};
```

### Pro Models (gemini-3-pro-preview)

- **Thinking Control**: Use `thinkingLevel` (LOW/HIGH)
- **Cannot Disable**: Pro models ALWAYS generate thinking
- **Modes**:
  - `ThinkingLevel.LOW`: Minimal thinking
  - `ThinkingLevel.HIGH`: Verbose thinking

**Code Pattern:**
```typescript
// Always includes thinking
config.thinkingConfig = {
  includeThoughts: true,
  thinkingLevel: reasoningMode === 'low' ? ThinkingLevel.LOW : ThinkingLevel.HIGH,
};
```

**Note:** There is no "basic" mode for Pro models - they always think!

### Pro 2.5 (gemini-2.5-pro)

- **Special Case**: Rejects `thinkingBudget: 0`
- **Error**: `"Budget 0 is invalid. This model only works in thinking mode."`
- **Behavior**: Similar to gemini-3-pro - always generates thinking
- **No Basic Mode**: Cannot create fixtures without thinking

## Impact on VaporVibe Client

### Bug Fixed in `src/llm/gemini-client.ts`

**Before (buggy):**
```typescript
if (includeThoughts) {
  config.thinkingConfig = {
    includeThoughts: true,
  };
  
  if (clampedBudget > 0) {  // ← BUG: Omits budget when 0
    config.thinkingConfig.thinkingBudget = clampedBudget;
  }
}
// No else clause - omits thinkingConfig entirely when disabled
```

**After (fixed):**
```typescript
if (includeThoughts) {
  config.thinkingConfig = {
    includeThoughts: true,
    thinkingBudget: clampedBudget,  // ← Always set (including 0)
  };
} else {
  // When thinking is disabled, explicitly set budget to 0
  if (!this.settings.model.includes("gemini-3-pro")) {
    config.thinkingConfig = {
      includeThoughts: true,
      thinkingBudget: 0,  // ← Prevent implicit thinking
    };
  }
}
```

## Test Fixture Changes

### Removed Fixtures

These fixtures were removed because the models cannot operate without thinking:

- `gemini-2.5-pro-basic.json` - API rejected (400 error)
- `gemini-3-pro-preview-basic.json` - Generated 994 thinking tokens anyway

### Updated Fixtures

All Flash model "basic" fixtures were regenerated with `thinkingBudget: 0`:

- ✅ `gemini-2.5-flash-basic.json` - Now has NO `thoughtsTokenCount`
- ✅ `gemini-2.5-flash-lite-basic.json` - Now has NO `thoughtsTokenCount`
- ✅ `gemini-2.0-flash-exp-basic.json` - Maintained correct behavior

### Test Expectations

Tests now correctly expect:

```typescript
it('should handle basic (non-thinking) models correctly', async () => {
  const result = await client.generateHtml([...]);
  
  // Flash models with budget:0 should have NO reasoning
  expect(result.reasoning).toBeUndefined();
  expect(result.usage?.reasoningTokens).toBeUndefined();
  
  // No stream events either
  expect(events).toHaveLength(0);
});
```

## Documentation Updates

### Files Updated

1. **`docs/modules/llm/providers/gemini.md`**
   - Added "Thinking Disable Methods" section
   - Documented `thinkingBudget: 0` requirement
   - Noted Pro model quirks

2. **`capture-gemini-responses.ts`**
   - Now explicitly sets `thinkingBudget: 0` for basic mode
   - Skips basic mode for Pro models (`alwaysThinking: true`)

3. **`src/llm/gemini-client.ts`**
   - Fixed to always set `thinkingBudget`
   - Added explicit disable logic for basic mode

## Verification Commands

### Test Basic Mode (Should have NO thinking)
```bash
npx tsx verify-gemini-basic.ts
```

### Test Zero Budget (Should explicitly disable)
```bash
npx tsx verify-gemini-zero-budget.ts
```

### Regenerate All Fixtures
```bash
npx tsx capture-gemini-responses.ts
```

## Recommendations

### For Future Development

1. **Always specify `thinkingConfig`** for Gemini models - don't rely on defaults
2. **Use `thinkingBudget: 0`** to disable thinking on Flash models
3. **Accept that Pro models always think** - don't try to disable it
4. **Update snapshots** after regenerating fixtures

### For Testing

1. **Verify against real API** before trusting fixture generation logic
2. **Check `thoughtsTokenCount`** in usage metadata to confirm behavior
3. **Update test expectations** to match real API quirks

## Related Issues

- Gemini's API documentation doesn't clearly explain the `includeThoughts: false` vs `thinkingBudget: 0` difference
- Pro models lack a true "basic" mode, making them incompatible with certain use cases
- Default behavior (omitting `thinkingConfig`) generates implicit thinking, which is wasteful and surprising
