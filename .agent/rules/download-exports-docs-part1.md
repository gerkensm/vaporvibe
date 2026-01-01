---
trigger: glob
globs: **/src/llm/messages.ts, **/src/server/admin-controller.ts, **/src/utils/html-export-transform.ts, **/src/utils/extract-ai-images.ts, **/src/utils/image-reencoder.ts, **/frontend/src/components/HistorySnapshotControls.tsx, **/scripts/verify-cdn-urls.ts, **/scripts/verify-cdn-content.ts
---

# Content from docs/architecture/download-exports.md

# Download Exports (Offline Prototypes)

> **Feature Overview**: Export your VaporVibe session as self-contained HTML files for offline sharing. Choose between an **animated Clickthrough Tour** with Driver.js walkthrough or a **clean Shareable Prototype** without tour animations.

## Export Types

VaporVibe offers two export formats:

### 📽️ Clickthrough Tour
An **animated walkthrough** that replays the user's exact journey through the application:
- Auto-starts Driver.js tour on page load
- Shows typing animations for form inputs
- Simulates button clicks and view transitions
- Includes popover descriptions for each step
- **Best for**: Stakeholder demos, training materials, feature documentation

### 📄 Shareable Prototype  
A **clean, static prototype** with all features intact but no tour animations:
- Full application functionality preserved
- No auto-start tour or animations
- User has complete control over navigation
- Smaller file size (no Driver.js overhead)
- **Best for**: Designer handoffs, usability testing, clean code samples

## Common Features

Both export types share these characteristics:
- **Fully offline** — Runs entirely in the browser without a server
- **Self-contained** — All AI-generated images embedded as base64
- **CDN libraries** — Uses public CDNs for Tailwind, Alpine.js, etc.
- **Cross-platform** — Works in any modern browser

---

## Table of Contents

- [Export Types](#export-types)
- [Usage](#usage)
  - [Clickthrough Tour](#clickthrough-tour)
  - [Shareable Prototype](#shareable-prototype-1)
- [How It Works](#how-it-works)
- [API Reference](#api-reference)
- [LLM Prompt Architecture](#llm-prompt-architecture)
- [Generated Output Structure](#generated-output-structure)
- [Driver.js Integration](#driverjs-integration)
- [Image Handling](#image-handling)
- [CDN Transformation](#cdn-transformation)
- [Key Design Decisions](#key-design-decisions)
- [Quirks & Pitfalls](#quirks--pitfalls)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)

---

## Usage

### Clickthrough Tour

1. Navigate to the **History** tab in the Admin Console (`/vaporvibe`)
2. Locate the **Export & Share** section
3. Click the **Clickthrough Tour** card (▶️ icon)
4. Wait 1-2 minutes while the LLM generates the consolidated SPA
5. The browser will download `prototype-tour.html`
6. Open the file in any browser — the tour auto-starts!

### Shareable Prototype

1. Navigate to the **History** tab in the Admin Console (`/vaporvibe`)
2. Locate the **Export & Share** section
3. Click the **Shareable Prototype** card (📄 icon)
4. Wait 1-2 minutes while the LLM generates the consolidated SPA
5. The browser will download `prototype.html`
6. Open the file in any browser — explore freely without tour guidance!

### Requirements

- At least one history entry in the session
- A configured LLM provider with valid API key
- Image generation enabled (optional, for AI images)

### Limitations While Active

- The download button is **disabled** while an A/B comparison fork is active
- The button shows a loading state during generation (can take 1-2 minutes)

---

## How It Works

```mermaid
graph LR
    subgraph "Admin Console"
        A[Session History] -->|"Click Download Tour"| B[POST /api/project/:id/generate-tour]
    end
    
    subgraph "Backend Processing"
        B --> C[Build Tour Mode Prompt]
        C --> D[Send to LLM Provider]
        D --> E[Receive HTML Response]
        E --> F[Resolve Component Placeholders]
        F --> G[Extract & Generate Missing Images]
        G --> H[Transform /libs/ to CDN URLs]
        H --> I[Embed Images as Base64]
    end
    
    subgraph "Output"
        I --> J[Self-Contained HTML File]
        J --> K[Download to Browser]
    end
```

### Processing Steps

1. **Prompt Assembly**: The backend builds a special `tourMode=true` prompt that includes all session history
2. **LLM Generation**: The model consolidates all views into a single-page application with Driver.js tour
3. **Placeholder Resolution**: Any `{{component:...}}` placeholders are resolved from the component cache
4. **Image Generation**: Missing AI images are generated and cached
5. **CDN Transformation**: Local `/libs/*` paths are converted to jsDelivr/unpkg CDN URLs
6. **Base64 Embedding**: All images are embedded inline as base64 data URIs
7. **File Download**: The complete HTML is sent as an attachment

---

## API Reference

### Generate Tour

```
POST /api/project/:projectId/generate-tour
```

**Request Body:**
```json
{
  "sessionId": "abc123-session-id"
}
```

**Response (Success):**
- Content-Type: `text/html`
- Content-Disposition: `attachment; filename="prototype-tour.html"`
- Body: Complete HTML document

**Response (Error):**
```json
{
  "success": false,
  "message": "sessionId is required to generate a tour"
}
```

**Response Codes:**
- `200` — Success, HTML file returned
- `400` — Missing sessionId or invalid request
- `500` — LLM generation or processing error

---

## LLM Prompt Architecture

The tour mode prompt lives in `src/llm/messages.ts` and is activated when `tourMode: true` is passed to `buildMessages()`.

### Key Differences from Normal Mode

| Aspect         | Normal Mode        | Tour Mode                  |
| -------------- | ------------------ | -------------------------- |
| **Output**     | Single view HTML   | Multi-view SPA             |
| **Navigation** | Server round-trips | Client-side `switchView()` |
| **Forms**      | Submit to server   | JavaScript handlers        |
| **API calls**  | Real `fetch()`     | Mocked with local state    |
| **Libraries**  | Optional           | Driver.js required         |

### Prompt Structure

The tour mode system prompt instructs the LLM to:

1. **Audit the entire history** — Analyze all requests, form submissions, page transitions
2. **Consolidate into SPA** — Merge all views into `<div class="app-view">` containers
3. **Implement `switchView()`** — Client-side navigation function
4. **Generate Driver.js tour** — Steps array that replays the user's journey
5. **Preserve exact data** — Form inputs, search queries, created content from history
6. **Mock all APIs** — No `fetch()` calls, update local state instead

### Image Manifest

When images are present, the prompt includes an image manifest:

```
### Available Images (Manifest)
- ID: "abc123" | Ratio: 16:9 | Prompt: "A futuristic cityscape..."
- ID: "def456" | Ratio: 1:1 | Prompt: "A friendly robot mascot..."
```

The LLM is instructed to reference images by `data-image-id` attribute.

---

## Generated Output Structure

### HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Prototype Tour</title>
    <!-- CDN links for libraries -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daisyui@4.12.24/dist/full.css">
    <script src="https://cdn.tailwindcss.com/3.4.1"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/driver.js@1.4.0/dist/driver.css">
    <script src="https://cdn.jsdelivr.net/npm/driver.js@1.4.0/dist/driver.js.iife.js"></script>
</head>
<body>
    <!-- Shared Shell (always visible) -->
    <header id="app-header">...</header>
    <nav id="app-sidebar">...</nav>
    
    <!-- View Containers -->
    <div id="view-dashboard" class="app-view">...</div>
    <div id="view-editor" class="app-view" style="display: none">...</div>
    <div id="view-settings" class="app-view" style="display: none">...</div>
    
    <!-- Embedded Images -->
    <img src="data:image/png;base64,iVBORw0KGgo..." data-image-id="abc123">
    
    <script>
        // View switching
        function switchView(viewId) {
            document.querySelectorAll('.app-view').forEach(v => v.style.display = 'none');
            document.getElementById('view-' + viewId).style.display = 'block';
        }
        
        // Driver.js tour initialization
        const driverObj = window.driver.js.driver({
            showProgress: true,
            allowClose: false,
            steps: [...]
        });
        
        // Auto-start on load
        driverObj.drive();
    </script>
</body>
</html>
```

---

## Driver.js Integration

### Version & Initialization

VaporVibe uses **Driver.js v1.4.0**. The v1.x API differs significantly from v0.x:

```javascript
// ✅ CORRECT v1.x initialization
const driverObj = window.driver.js.driver({
    showProgress: true,
    allowClose: false,
    steps: [...]
});
driverObj.drive();

// ❌ WRONG — v0.x syntax, will not work
const driver = new Driver();
driver.defineSteps([...]);
driver.start();
```

### Variable Naming (Critical!)

**NEVER** name your variable `driver` — this shadows the global `window.driver` and causes:
```
Uncaught ReferenceError: Cannot access 'driver' before initialization
```

Always use `driverObj` or another name.

### Tour Step Structure

```javascript
{
    element: '#submit-button',  // CSS selector
    popover: {
        title: 'Submit Your Order',
        description: 'Click here to complete your purchase.'
    },
    onHighlightStarted: () => {
        // Called before highlighting — switch views here
        switchView('checkout');
    },
    onHighlighted: (element) => {
        // Called after highlighting — simulate interactions here
        if (element) {
            setTimeout(() => element.click(), 800);
        }
    },
    onDeselected: (element) => {
        // Called when moving to next step
    }
}
```

### Simulated Interactions

#### Typing Animation
```javascript
onHighlighted: (element) => {
    if (!element) return;
    const text = 'Hello, World!';
    let i = 0;
    const interval = setInterval(() => {
        element.value = text.slice(0, ++i);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        if (i >= text.length) clearInterval(interval);
    }, 50);
}
```

#### Button Clicks
```javascript
onHighlighted: (element) => {
    if (element) {
        setTimeout(() => element.click(), 800);
    }
}
```

**Important**: The tour does NOT auto-advance. Users click "Next" manually.

---

## Image Handling

### Overview

The tour export pipeline includes sophisticated image handling to ensure offline capability while minimizing file size:

1. **Extract Requests**: Parse `<ai-image>` tags from generated HTML
2. **Check Cache**: Look for existing images by `modelId:ratio:prompt` key
3. **Generate Missing**: Call image generation API for uncached images
4. **Filter Referenced**: Only include images actually used in the final HTML
5. **Reencode for Size**: Compress images using Sharp (JPEG for non-alpha, PNG for transparency)
6. **Embed Base64**: Convert to data URIs for offline access

### Image Recompression (Sharp)

To reduce exported file size, images are recompressed before embedding:

**Location**: `src/utils/image-reencoder.ts`

| Image Type    | Strategy              | Target                  |
| ------------- | --------------------- | ----------------------- |
| **No alpha**  | Convert to JPEG       | < 200KB per image       |
| **Has alpha** | Keep as PNG, compress | Best-effort compression |

#### Compression Algorithm

```typescript
// For non-alpha images:
// 1. Start at quality 85
// 2. If > 200KB, estimate required quality from ratio
// 3. Retry up to 2x with progressively lower quality
// 4. Minimum quality: 40 (to maintain visual acceptable)

const { buffer, quality } = await encodeToJpeg(originalBuffer, MAX_JPEG_SIZE);
```

#### Alpha Detection
