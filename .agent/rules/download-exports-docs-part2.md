---
trigger: glob
globs: **/src/llm/messages.ts, **/src/server/admin-controller.ts, **/src/utils/html-export-transform.ts, **/src/utils/extract-ai-images.ts, **/src/utils/image-reencoder.ts, **/frontend/src/components/HistorySnapshotControls.tsx, **/scripts/verify-cdn-urls.ts, **/scripts/verify-cdn-content.ts
---

The reencoder uses Sharp to detect if transparency is actually **used**:

```typescript
// Check if alpha channel has values < 255 (actual transparency)
const stats = await sharp(buffer).stats();
if (stats.channels[3].min < 255) {
    // Has real transparency - keep as PNG
}
```

This prevents converting images with unused alpha channels to bloated PNGs.

#### Logging

The reencoder logs compression results:

```
Re-encoded 5 images, saved 847KB (62%)
```

### Image Tag Attributes

```html
<!-- Input (from LLM) -->
<ai-image 
    data-image-id="abc123"
    prompt="A futuristic cityscape at sunset"
    ratio="16:9"
    width="100%">
</ai-image>

<!-- Output (after processing) -->
<img 
    src="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    data-image-id="abc123"
    alt="A futuristic cityscape at sunset"
    width="100%">
```

### Manifest Matching

The LLM receives a manifest of available images and should reference them by ID:
- ✅ `data-image-id="abc123"` — Uses existing image
- ❌ New prompts — Will generate new images (slow, costly)

---

## CDN Transformation

Local `/libs/*` paths are transformed to CDN URLs for offline portability.

### Transformation Logic

Located in `src/utils/html-export-transform.ts`:

```typescript
// Input
<script src="/libs/alpinejs/3.14.9/alpine.js"></script>

// Output
<script src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.9/dist/cdn.min.js"></script>
```

### CDN Providers

| Library Type     | CDN Provider                  |
| ---------------- | ----------------------------- |
| Most libraries   | jsDelivr (`cdn.jsdelivr.net`) |
| Tailwind CSS     | tailwindcss.com CDN           |
| Fontsource fonts | jsDelivr (`@fontsource/*`)    |

### Verification Scripts

Two scripts validate CDN mappings:

```bash
# Check all CDN URLs are reachable
npx tsx scripts/verify-cdn-urls.ts

# Compare local files with CDN content
npx tsx scripts/verify-cdn-content.ts
```

---

## Key Design Decisions

| Decision                        | Rationale                                            |
| ------------------------------- | ---------------------------------------------------- |
| **No `driverObj.moveNext()`**   | User controls pace; prevents accidental skipping     |
| **No Rough Notation library**   | Annotations are difficult to clean up between steps  |
| **Simple `setInterval` typing** | More reliable than Typewriter.js across frameworks   |
| **No framework internals**      | Avoid `__x.$data` etc. — use plain JS or public APIs |
| **Base64 image embedding**      | Ensures true offline capability                      |
| **CDN transformation**          | Removes dependency on VaporVibe server               |
| **onDeselected for actions**    | Execute actions after user clicks "Next"             |

---

## Quirks & Pitfalls

### Element Selectors

**Use ONLY static HTML attributes** for tour step selectors:

| ✅ Valid Selectors      | ❌ Invalid Selectors     |
| ---------------------- | ----------------------- |
| `#my-button`           | `[x-text='title']`      |
| `.submit-btn`          | `[@click='submit()']`   |
| `[data-tour-step="1"]` | `[x-model='form.name']` |

Framework directives are not valid CSS selectors!

### Defensive Callbacks

**ALWAYS null-check** parameters:

```javascript
onHighlighted: (element) => {
    if (!element) return;  // Element might not exist
    const card = element.closest('.card');
    if (!card) return;  // Parent might not exist
    const btn = card.querySelector('button');
    if (btn) setTimeout(() => btn.click(), 800);
}
```

### Offline Execution

The exported tour runs from `file://` protocol:

- ❌ `fetch('/rest_api/...')` — CORS errors
- ❌ `XMLHttpRequest` — Network errors
- ✅ Local state updates with `setTimeout` feedback

### Alpine.js State Sync

When updating form values, dispatch events to sync Alpine.js:

```javascript
element.value = 'new value';
element.dispatchEvent(new Event('input', { bubbles: true }));
```

---

## Troubleshooting

### "Cannot access 'driver' before initialization"

**Cause**: Variable named `driver` shadows global.  
**Fix**: Rename to `driverObj`.

### Tour doesn't start automatically

**Cause**: Missing `driverObj.drive()` call.  
**Fix**: Ensure the LLM prompt includes auto-start instruction.

### Images missing in exported file

**Cause**: New prompts not in manifest, or image generation failed.  
**Fix**: Check server logs for generation errors.

### Styles broken in offline file

**Cause**: CDN URL transformation failed for some library.  
**Fix**: Run `npx tsx scripts/verify-cdn-urls.ts` to identify broken mappings.

### Forms don't work

**Cause**: Form still submitting to server instead of JS handler.  
**Fix**: Ensure LLM converts forms to `onsubmit="handleSubmit(event)"`.

### Tour steps highlight wrong elements

**Cause**: Using framework directives as selectors.  
**Fix**: Add explicit `id` or `data-tour-step` attributes.

---

## File Locations

| Purpose              | File                                    |
| -------------------- | --------------------------------------- |
| Tour mode prompt     | `src/llm/messages.ts` (lines 77-250)    |
| API endpoint handler | `src/server/admin-controller.ts`        |
| CDN transformation   | `src/utils/html-export-transform.ts`    |
| Image extraction     | `src/utils/extract-ai-images.ts`        |
| Image recompression  | `src/utils/image-reencoder.ts`          |
| CDN verification     | `scripts/verify-cdn-urls.ts`            |
| Content verification | `scripts/verify-cdn-content.ts`         |
| Frontend handler     | `frontend/src/pages/AdminDashboard.tsx` |
| Frontend API         | `frontend/src/api/admin.ts`             |

---

## Future Improvements

- [ ] **Video export** — WebM/MP4 recording for truly offline sharing
- [ ] **Customizable tour speed** — User-controlled animation timing
- [ ] **Tour narration** — Text-to-speech for accessibility
- [ ] **Step editor** — UI to customize tour steps post-generation
- [ ] **Template library** — Pre-built tour templates for common flows
- [ ] **Analytics** — Track tour completion rates when shared

