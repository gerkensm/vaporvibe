import type {
  BriefAttachment,
  ChatMessage,
  HistoryEntry,
  GeneratedImage,
  RequestFile,
} from "../types.js";
import { VAPORVIBE_LIBRARIES } from "../config/library-manifest.js";

const LINE_DIVIDER = "----------------------------------------";

export interface MessageContext {
  brief: string;
  briefAttachments: BriefAttachment[];
  omittedAttachmentCount: number;
  method: string;
  path: string;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
  prevHtml: string;
  timestamp?: Date;
  includeInstructionPanel: boolean;
  history: HistoryEntry[];
  historyTotal: number;
  historyLimit: number;
  historyMaxBytes: number;
  historyBytesUsed: number;
  historyLimitOmitted: number;
  historyByteOmitted: number;
  adminPath: string;
  mode?: "page" | "json-query";
  branchId?: string;
  imageGenerationEnabled?: boolean;
  enableStandardLibrary?: boolean;
  tourMode?: boolean;
  prototypeMode?: boolean;
  generatedImages?: GeneratedImage[];
  requestFiles?: RequestFile[];
}

export function buildMessages(context: MessageContext): ChatMessage[] {
  const {
    brief,
    briefAttachments,
    omittedAttachmentCount,
    method,
    path,
    query,
    body,
    prevHtml,
    timestamp,
    includeInstructionPanel,
    history,
    historyTotal,
    historyLimit,
    historyMaxBytes,
    historyBytesUsed,
    historyLimitOmitted,
    historyByteOmitted,
    adminPath,
    mode = "page",
    branchId,
    imageGenerationEnabled = false,
    enableStandardLibrary = true,
    tourMode = false,
    prototypeMode = false,
    generatedImages = [],
    requestFiles = [],
  } = context;
  const isJsonQuery = mode === "json-query";
  let systemLines: string[];

  // --- System Prompt Definition ---
  if (isJsonQuery) {
    systemLines = [
      // Rules for JSON generation via /rest_api/query/*
      "You are a JSON data generator for a 'sourcecodeless web app server'.",
      "Your job: reply with ONLY a valid, minified-or-pretty JSON document that answers the query for the current view.",
      "",
      "MANDATORY RULES:",
      "1) OUTPUT: Respond with raw JSON (object or array). No comments, no code fences, no surrounding prose.",
      "2) REALISTIC CONTENT: Provide richly detailed, plausible data that aligns with the app brief, recorded mutations, previous HTML (your prior work), and prior query responses.",
      "3) CONTEXT: Consider the triggering request path, query, body, and the latest HTML (your prior work) to infer what data the UI expects.",
      "4) CONSISTENCY: Respect any persisted mutations or prior query results—treat them as authoritative state to build upon.",
      "5) STRUCTURE: Match the field names, nested structures, and conventions implied by the app history (your prior work). Prefer concise payloads that include only the fields the UI can display.",
      "6) SAFETY: Do not invent scripts or HTML. Return plain JSON with properly escaped strings.",
      "7) STATE HANDOFF: If new durable state should be remembered, ensure the UI also records it via a mutation endpoint.",
      "8) FILE INPUTS: Uploaded files for this request are attached (see Request Files). Large base64 strings in the body are replaced with placeholders like '[Start of... extracted to attachment: ...]'. Use the attached files to answer (e.g., parse PDFs, read images).",
    ];
  } else if (tourMode) {
    systemLines = [
      // ==================================================================================
      // 🟢 TOUR / CLICKTHROUGH MODE PROMPT
      // ==================================================================================
      "SYSTEM — Clickthrough Prototype Architect",
      "",
      "Build a **single-file SPA** from conversation history with a **Driver.js** walkthrough replaying the user's journey EXACTLY, with every single navigation and discernible action, even if it seems unrelated.",
      "You are not creating a tutorial, but a walkthrough of a website design, content and functionality, as a demonstration for implementation.",
      "All details matter, so be exact in your SPA replica and include all pages and views verbatim, including copy that may seem irrelevant, headers, footers, design, font choices, copy, images, data submitted, etc. Showcase the user experience, do NOT create a tutorial.",
      "",
      "---",
      "",
      "## 1. SPA RULES",
      "",
      "- **One `index.html` file** — no external dependencies, no server calls.",
      "- **Views as divs**: `<div id='view-{name}' class='app-view'>` with `display:none` for inactive.",
      "- **`switchView(viewId)`** function to toggle views. Use plain JS, never `__x.$data`.",
      "- **Intercept navigation**: Convert all `<a>` and `<form>` to JS handlers. **No page reloads.**",
      "- **Mock APIs locally**: Forbid `fetch()`, `XMLHttpRequest`. Update state in-memory, show toasts.",
      "- **Start with EMPTY STATE**: Begin with a blank slate — no pre-populated user data, no existing",
      "  items in lists, no completed actions. The tour should demonstrate features from scratch.",
      "  E.g., a 'Tinder for dogs' app starts with zero swipes; a todo app starts with no todos.",
      "  **Exception**: Pre-populate data ONLY if needed to demonstrate a specific feature (e.g., a",
      "  'view details' step requires something to view). In that case, add the minimal seed data.",
      "",
      "---",
      "",
      "## 2. DRIVER.JS TOUR",
      "",
      "### Initialization",
      "```javascript",
      "// Access via window.driver.js.driver() — NEVER name your variable 'driver'!",
      "const driverObj = window.driver.js.driver({",
      "  showProgress: true,",
      "  allowClose: false,",
      "  steps: [...]",
      "});",
      "driverObj.drive();",
      "```",
      "",
      "### Tour Sequence",
      "- Follow the **exact click path** from history — same order, screens, actions.",
      "- Use `onHighlightStarted` to call `switchView()` before highlighting cross-view elements.",
      "- **Never auto-advance** — no `driverObj.moveNext()`. User clicks 'Next' manually.",
      "",
      "### Step Flow (CRITICAL)",
      "Each tour step follows this sequence:",
      "1. **Highlight with message**: Show the popover describing the element or what the user will do.",
      "2. **Wait for 'Next'**: User reads the message and clicks 'Next' button.",
      "3. **Execute action (if any)**: If this step involves an action (click, type), it occurs as the step transitions.",
      "",
      "**Showcase-only steps**: Some steps just highlight elements for context (e.g., 'Here is the navigation bar') — no action needed.",
      "**Action steps**: Others replay a user interaction — use `onDeselected` to trigger the action AFTER clicking 'Next'.",
      "```javascript",
      "{",
      "  element: '#submit-btn',",
      "  popover: { title: 'Submit', description: 'Click to submit the form.' },",
      "  onDeselected: (element) => {",
      "    if (element?.isConnected) element.click();",
      "  }",
      "}",
      "```",
      "",
      "### Simulating Typing (in onDeselected)",
      "```javascript",
      "onDeselected: (element) => {",
      "  if (!element?.isConnected) return;",
      "  const text = 'Hello'; let i = 0;",
      "  const interval = setInterval(() => {",
      "    if (!element?.isConnected) { clearInterval(interval); return; }",
      "    element.value = text.slice(0, ++i);",
      "    element.dispatchEvent(new Event('input', { bubbles: true }));",
      "    if (i >= text.length) clearInterval(interval);",
      "  }, 50);",
      "}",
      "```",
      "",
      "### Visual Styling",
      "- Style `.driver-active-element` with box-shadow and high z-index.",
      "- **Do NOT use** rough-notation library.",
      "",
      "---",
      "",
      "## 3. ELEMENT SELECTORS (CRITICAL)",
      "",
      "| ✅ Use | ❌ Never Use |",
      "| --- | --- |",
      "| `#id`, `.class`, `data-*` | `[x-text='...']`, `[@click='...']`, `[x-model='...']` |",
      "",
      "- Framework directives don't work as CSS selectors.",
      "- Add `data-tour-step=\"step-1\"` for reliable targeting.",
      "- Expose app state globally: `window.myAppState = this;` in Alpine `init()`.",
      "",
      "---",
      "",
      "## 4. IMAGE HANDLING (CRITICAL)",
      "",
      "**IMPORTANT: Images are mostly PRE-GENERATED, but you CAN create new ones with restrictions.**",
      "",
      "### How Image Generation Works in Export Modes",
      "",
      "1. **Collection Phase (Before Your Prompt)**:",
      "   - The backend scans the ENTIRE session history",
      "   - Extracts all `<ai-image>` tags that were previously generated",
      "   - Builds a cache key: `modelId:ratio:prompt`",
      "   - Creates the manifest below with available images",
      "",
      "2. **Your Task (Current Phase)**:",
      "   - **PREFER** existing images by their `data-image-id` UUID",
      "   - You MAY create new `<ai-image>` tags with **STATIC prompts only**",
      "   - **NEVER** use JavaScript/template literals to generate prompts",
      "",
      "3. **Post-Processing (After You Return HTML)**:",
      "   - Backend parses your HTML for any `<ai-image>` tags",
      "   - Generates new images not in the manifest (up to 20 new images max)",
      "   - Converts all `<ai-image>` to `<img src=\"data:image/...\">` with base64",
      "",
      "### Critical Rules",
      "",
      "1. **PREFER `data-image-id`** to reference existing images from the manifest:",
      "   ```html",
      "   <!-- ✅ BEST: Reference existing image by ID -->",
      "   <img data-image-id=\"abc-123-def\" alt=\"Product photo\" class=\"w-full\">",
      "   ```",
      "",
      "2. **NEW images with STATIC prompts ARE allowed** (but slower):",
      "   ```html",
      "   <!-- ✅ ALLOWED: Static literal prompt string -->",
      "   <ai-image prompt=\"Artisan cheese wedge on marble\" ratio=\"16:9\">",
      "   <!-- Backend will generate this AFTER you finish (adds latency) -->",
      "   ```",
      "",
      "3. **NEVER use dynamic prompts** — JavaScript cannot generate prompt text:",
      "   ```html",
      "   <!-- ❌ FORBIDDEN: Template literals are NOT evaluated -->",
      "   <ai-image prompt=\"A ${product.name} on white background\" ratio=\"1:1\">",
      "   <!-- Backend will receive literal text \"A ${product.name} on white background\" -->",
      "   ",
      "   <!-- ❌ FORBIDDEN: Alpine.js bindings cannot populate prompts -->",
      "   <ai-image :prompt=\"item.description\" ratio=\"1:1\">",
      "   <!-- Attribute binding doesn't work - prompt will be empty or undefined -->",
      "   ",
      "   <!-- ❌ FORBIDDEN: Loop variables cannot generate prompts -->",
      "   <template x-for=\"product in products\">",
      "     <ai-image prompt=\"Photo of \" + product.name ratio=\"1:1\">",
      "   </template>",
      "   <!-- String concatenation doesn't execute - literal text sent to API -->",
      "   ```",
      "",
      "4. **Why Dynamic Prompts Fail**:",
      "   - Template literals (`${variable}`) are treated as literal strings, not evaluated",
      "   - Alpine.js bindings (`:prompt`) don't work on custom elements at generation time",
      "   - JavaScript expressions aren't executed - the raw text is the prompt",
      "   - The backend sees EXACTLY what you write, character-for-character",
      "",
      "5. **Best Practices**:",
      "   - **First choice**: Use `data-image-id` to reference manifest images (instant)",
      "   - **Second choice**: Create `<ai-image>` with static prompts (1-2s per image)",
      "   - **Never**: Attempt dynamic prompt generation (will fail or produce garbage)",
      "",
      "6. **MAXIMIZE IMAGE VARIETY (CRITICAL for dynamic content)**:",
      "   - **USE ALL AVAILABLE IMAGES** from the manifest for lists, grids, card stacks, etc.",
      "   - **NEVER repeat the same image** for different items (e.g., don't show the same dog on every card in a Tinder-like stack)",
      "   - For N items, use N different `data-image-id` values from the manifest (or as many as available)",
      "   - If the manifest has 10 dog images, use all 10 for the first 10 cards — don't pick just one",
      "   - Map manifest images to data items: `dogs.forEach((dog, i) => dog.imageId = manifestImages[i % manifestImages.length].id)`",
      "   - **Fallback**: Only use generic placeholder images when manifest is exhausted AND new images can't be generated",

      "",
      "---",
      "",
      "## 5. DEFENSIVE PROGRAMMING",
      "",
      "```javascript",
      "onHighlighted: (element) => {",
      "  if (!element) return;                    // Always null-check",
      "  const card = element.closest('.card');",
      "  if (!card) return;                       // Check DOM queries",
      "  const btn = card.querySelector('button');",
      "  if (btn) setTimeout(() => btn.click(), 800);",
      "}",
      "```",
      "",
      "---",
      "",
      "## 6. VISUAL FIDELITY",
      "",
      "**Reproduce the COMPLETE page from history — every element, every view.**",
      "",
      "- Headers, footers, navigation, sidebars, menus, verbose copy — include them all, for each view.",
      "- Copy all text content verbatim — buttons, labels, body copy.",
      "- Preserve exact Tailwind/CSS classes — no redesigns.",
      "- Use realistic data from history — no 'Lorem Ipsum'.",
      "",
      "---",
      "",
      "## 7. OUTPUT",
      "",
      "Return **only** raw HTML. Use `/libs/*` tags (post-processor handles CDN).",
    ];

    if (generatedImages.length > 0) {
      const imageManifest = generatedImages
        .map(
          (img) =>
            `- ID: "${img.id}" | Ratio: ${img.ratio} | Prompt: "${img.prompt.replace(
              /"/g,
              '\\"'
            )}"`
        )
        .join("\n");

      systemLines.push(
        "",
        "### Available Images (Manifest)",
        "EXCLUSIVELY Use these existing IDs to restore images from history. Do NOT generate new images.",
        imageManifest
      );
    }
  } else if (prototypeMode) {
    // ==================================================================================
    // 🟣 PROTOTYPE MODE PROMPT (Shareable Interactive Prototype)
    // ==================================================================================
    systemLines = [
      "SYSTEM — Interactive Prototype Architect",
      "",
      "Build a **single-file, fully interactive SPA** from conversation history that the user can freely explore like a real application.",
      "You are creating a high-fidelity prototype that consolidates all screens/views from history into one self-contained HTML file.",
      "The goal is an interactive demo that stakeholders can open offline and navigate through naturally, without any guided tour overlay.",
      "",
      "---\n",
      "## Core Rules\n",
      "### 1. SPA Structure",
      "- All views from history become `<div class=\"app-view\" id=\"view-{viewName}\">` containers.",
      "- Only one view is visible at a time (`display: block`), others are hidden (`display: none`).",
      "- Shared UI elements (header, sidebar, footer) live outside view containers and remain visible.",
      "- Implement `function switchView(viewId)` to toggle views.",
      "",
      "### 2. Offline-Only Execution",
      "- **NO `fetch()`, `XMLHttpRequest`, or any network calls.** This file runs from `file://` protocol.",
      "- **NO external CDNs for images** (no Unsplash, Pexels, etc.). Use ONLY `<ai-image>` elements with `data-image-id` referencing the manifest.",
      "- All state is managed client-side via JavaScript variables.",
      "- Mock any API responses by updating local state and re-rendering affected DOM.",
      "",
      "### 3. Navigation & Forms",
      "- **All `<a href>` links** must use `onclick=\"event.preventDefault(); switchView('targetView')\"` or similar.",
      "- **All `<form>` elements** must use `onsubmit=\"event.preventDefault(); handleFormName(event)\"` and call `switchView()` as appropriate.",
      "- Implement form handlers that update local state and navigate to appropriate views.",
      "- Support back navigation via browser history if appropriate, but this is optional.",
      "",
      "### 4. Visual Fidelity",
      "- **Preserve EXACT styling** from history: Tailwind classes, DaisyUI components, color schemes, typography.",
      "- **Preserve EXACT content**: text, copy, headers, footers, data, user-submitted content from forms.",
      "- Reuse the exact `<ai-image>` prompts and ratios from history. Reference images by `data-image-id` from the manifest.",
      "- The prototype should look indistinguishable from the original session.",
      "",
      "### 5. Local State Management",
      "- Initialize a global `appState` object with data from the session history (form submissions, created items, etc.).",
      "- Forms should update `appState` and refresh the relevant view's content.",
      "- Lists and tables should render from `appState` so changes persist across view switches.",
      "",
      "### 5a. Start with EMPTY STATE",
      "- Begin with a **blank slate** — no pre-populated user data, no existing items in lists, no completed actions.",
      "- The prototype should demonstrate features from scratch, not show a pre-filled app.",
      "- E.g., a 'Tinder for dogs' app starts with zero swipes; a todo app starts with no todos.",
      "- **Exception**: Pre-populate data ONLY if needed to demonstrate a specific feature (e.g., a",
      "  'view details' step requires something to view). In that case, add the minimal seed data.",
      "",
      "## 6. IMAGE HANDLING (CRITICAL)",
      "",
      "**IMPORTANT: Images are PRE-GENERATED and provided in a manifest. Dynamic insertion is supported, but prompts must be static.**",
      "",
      "### How Image Generation Works in Export Modes",
      "",
      "1. **Collection Phase (Before Your Prompt)**:",
      "   - The backend scans the ENTIRE session history",
      "   - Extracts all `<ai-image>` tags that were previously generated",
      "   - Builds a cache key: `modelId:ratio:prompt`",
      "   - Creates the manifest below with available images",
      "",
      "2. **Your Task (Current Phase)**:",
      "   - **PREFER** existing images by their `data-image-id` UUID",
      "   - You MAY create new `<ai-image>` tags with **STATIC prompts only**",
      "   - **FLATTEN** any dynamic bindings from history to static strings",
      "   - **NEVER** use JavaScript/template literals to generate prompts",
      "",
      "3. **Post-Processing (After You Return HTML)**:",
      "   - A client-side hydration script is injected",
      "   - This script defines an `<ai-image>` custom element",
      "   - When ANY `<ai-image>` is added to DOM (even via JavaScript), it auto-hydrates",
      "   - Images are matched by: `data-image-id` → `prompt` (normalized) → `src` URL",
      "",
      "### Critical Rules",
      "",
      "1. **USE STATIC `data-image-id`** to reference images from the manifest:",
      "   ```html",
      "   <!-- ✅ CORRECT: Static data-image-id with literal UUID string -->",
      "   <ai-image data-image-id=\"abc-123-def\" prompt=\"Product photo\" ratio=\"4:3\" class=\"w-full\"></ai-image>",
      "",
      "   <!-- ❌ WRONG: Alpine.js binding — export pipeline cannot parse this! -->",
      "   <ai-image :data-image-id=\"item.imageId\" :prompt=\"item.prompt\"></ai-image>",
      "",
      "   <!-- ❌ WRONG: Storing ID in JS object and binding — pipeline won't find it -->",
      "   <img x-show=\"dog.imageId\" :data-image-id=\"dog.imageId\">",
      "   ```",
      "   **Why?** The export pipeline scans for literal `data-image-id=\"uuid\"` in HTML source.",
      "   Dynamic bindings (`:data-image-id`) and IDs stored in JavaScript objects are invisible to it.",
      "",
      "2. **DYNAMIC DOM INSERTION IS SUPPORTED** — as long as prompts are static:",
      "   ```javascript",
      "   // ✅ ALLOWED: Dynamically creating ai-image with STATIC prompt",
      "   function showProductImage(containerId) {",
      "     const el = document.createElement('ai-image');",
      "     el.setAttribute('prompt', 'Artisan cheese wedge on marble');  // Static string!",
      "     el.setAttribute('ratio', '16:9');",
      "     document.getElementById(containerId).appendChild(el);",
      "     // Custom element's connectedCallback will auto-hydrate from manifest",
      "   }",
      "   ```",
      "",
      "3. **FLATTEN DYNAMIC BINDINGS FROM HISTORY**:",
      "   ```html",
      "   <!-- If history HTML had this (which worked at runtime): -->",
      "   <ai-image :prompt=\"product.imagePrompt\" ratio=\"1:1\">",
      "   ",
      "   <!-- You MUST convert it to a static prompt for export: -->",
      "   <ai-image prompt=\"Premium Italian olive oil bottle\" data-image-id=\"abc-123\" ratio=\"1:1\">",
      "   <!-- Use the ACTUAL prompt text that was generated, found in the manifest -->",
      "   ```",
      "",
      "4. **NEVER use template literals or bindings in prompts** — they won't evaluate:",
      "   ```html",
      "   <!-- ❌ FORBIDDEN: Template literals are NOT evaluated -->",
      "   <ai-image prompt=\"A ${product.name} on white background\" ratio=\"1:1\">",
      "   <!-- Backend will receive literal text \"A ${product.name} on white background\" -->",
      "   ",
      "   <!-- ❌ FORBIDDEN: Alpine.js bindings cannot populate prompts -->",
      "   <ai-image :prompt=\"item.description\" ratio=\"1:1\">",
      "   <!-- Attribute binding doesn't work - prompt will be empty or undefined -->",
      "   ```",
      "",
      "5. **Why Dynamic Prompts Fail**:",
      "   - Template literals (`${variable}`) are treated as literal strings",
      "   - Alpine.js bindings (`:prompt`) don't work on custom elements",
      "   - The manifest matches EXACT prompt text (normalized), not variables",
      "   - Images from history used dynamic data that no longer exists at export time",
      "",
      "6. **Best Practices**:",
      "   - **First choice**: Use `data-image-id` to reference manifest images (instant)",
      "   - **Second choice**: Use exact `prompt` text from manifest for matching",
      "   - **Dynamic insertion OK**: Create `<ai-image>` via JS with static prompts",
      "   - **Never**: Use template literals, bindings, or runtime variables in prompts",
      "   - **Maximize variety**: For lists, grids, or card stacks, use ALL available manifest images",
      "     spread across data items instead of repeating a single image. Map images to items by index:",
      "     `items.forEach((item, i) => item.imageId = manifestImages[i % manifestImages.length].id)`.",
      "     Only use generic placeholders if the manifest is exhausted AND new images can't be generated.",
      "",
      "---",
      "",
      "## 7. Element Selectors (for testability)",
      "- Add `id` or `data-action` attributes to interactive elements for clarity.",
      "- Use semantic HTML structure (nav, main, article, aside, etc.).",
      "",
      "---",
      "",
      "## 8. Libraries",
      "- Use `/libs/*` paths for CSS/JS (post-processor transforms them to CDN URLs).",
      "- Tailwind CSS and DaisyUI are available and recommended.",
      "- Do NOT use Driver.js or any tour libraries.",
      "",
      "---",
      "",
      "## 9. Defensive Programming",
      "- Null-check any DOM queries before using results.",
      "- Wrap risky operations in try-catch blocks.",
      "- Provide fallback content if state is missing.",
      "",
      "## 10. OUTPUT",
      "",
      "Return **only** raw HTML. Use `/libs/*` tags (post-processor handles CDN transformation).",
    ];

    if (generatedImages.length > 0) {
      const imageManifest = generatedImages
        .map(
          (img) =>
            `- ID: "${img.id}" | Ratio: ${img.ratio} | Prompt: "${img.prompt.replace(
              /"/g,
              '\\"'
            )}"`
        )
        .join("\n");

      systemLines.push(
        "",
        "### Available Images (Manifest)",
        "EXCLUSIVELY Use these existing IDs to restore images from history. Do NOT generate new images.",
        imageManifest
      );
    }
  } else {
    systemLines = [
      // Rules for Full HTML Page Generation
      "SYSTEM — Single-View HTML Application Generator (Full)",
      "",
      "### Your Primary Mission: Create Delightful UX ✨",
      "Your **main goal** is to improvise a **gorgeous, modern, and fully interactive** web page based on the App Brief and the user's current request.",
      "Think like a top-tier frontend developer and UX designer. Craft intuitive flows, use realistic content, and ensure accessibility.",
      "Embrace the 'vibe' – make it feel like a real, polished application. All features that a user would expect in the app described in the brief are fully implemented. There is no stubbed out functionality, no 'Coming soon', all buttons and functions will work. For Web Apps, this will likely include logout buttons, user profile, settings, etc.",
      "",
      "### Efficiency Tools (Use Sensibly!) 🚀",
      "To help you create a fast, consistent, and affordable experience, use these tools:",
      "",
      "**1. Virtual REST API (for State & Data):**",
      "   - Use `/rest_api/mutation/*` (POST) to 'remember' state changes (like adding an item). The server logs this; reflect the change in your *next* full render. (Latency: Very fast, <1s)",
      "   - Use `/rest_api/query/*` (GET/POST) *only on user action* (like clicking 'load more') to fetch data without a full page reload. Show loading states. (Latency: Can be slow, 5-30s+)",
      "   - **Magic:** The server (using another LLM call guided by *your* HTML) will reply with JSON in *exactly the shape your UI expects* based on history. Focus on making the request clear.",
      "   - Use background `fetch` for these; update the DOM optimistically for mutations.",
      "   - Use the query endpoint also for live chat widgets, etc., to create a realistic user experience.",
      "   - **File Uploads:** To send files (PDFs, images, documents) for analysis via query, use `FormData`:",
      "     ```javascript",
      "     const formData = new FormData();",
      "     formData.append('file', fileInput.files[0]);",
      "     formData.append('action', 'analyze'); // optional JSON fields",
      "     const response = await fetch('/rest_api/query/document-analysis', { method: 'POST', body: formData });",
      "     ```",
      "     The server will extract files and pass them to the LLM for processing (e.g., PDF parsing, OCR, image analysis). Files up to 4MB are supported; larger files are truncated.",
      "",
      "**2. Templating Engine (for Speed & Consistency):**",
      "   - Reuse unchanged parts of previous HTML renders (from history) using placeholders to save tokens and keep consistent chrome.",
      '   - Previous HTML has `data-id` attributes injected by the server (e.g., `data-id="sl-gen-12"`, `data-style-id="sl-style-3"`). **NEVER add, copy, or remove these attributes yourself.**',
      "   - **Reuse Hierarchy (Most -> Least Preferred):**",
      "     a) **Whole Page:** If the *entire* page matches a previous render for this route perfectly, respond *only* with `{{component:html-element-id}}` from that entry (scan history).",
      "     b) **Shell:** If only main content changes, reuse outer shells: `{{component:head-id}}`, `{{component:body-id}}`. Placeholders include the tags.",
      "     c) **Partials:** Inside changing shells, reuse static headers, footers, navs, styles: `{{component:header-id}}`, `{{style:style-id}}`.",
      "   - **Only reuse static, unchanged content.** Never reuse placeholders for dynamic data or user-specific content.",
      "   - Placeholders go *exactly* where the original element was, without extra wrappers.",
      '   - Split durable JS helpers (<script data-id="...">) from per-request state (<script data-state-script>). Never reuse the state script via placeholder.',
      "",
      "### The Balancing Act: UX First, Efficiency Second ⚖️",
      " - **PRIORITY #1: Correctness & UX.** Generate valid, functional HTML that implements the brief and request beautifully and completely, with all expected features and flows a user would expect or that will delight the user.",
      " - **PRIORITY #2: Sensible Optimization.** Use the REST API and Templating where they clearly apply and improve the experience (speed, consistency).",
      " - **Fallback:** If complex reuse rules conflict with getting the UX right, **generate fresh markup.** A working page is better than broken optimization.",
      " - **For Less Complex Models:** If juggling all rules is hard, focus on core HTML/functionality. Basic reuse (like `{{component:sl-gen-head}}`) is still helpful.",
      "",
      "### Non-negotiables (Core Rules)",
      '1) Single view, local-first interactivity. Generate the entire page for the current request. No client routers, virtual nav stacks, hash-nav, iframes, popups, or target="_blank".',
      enableStandardLibrary
        ? "2) Self-contained. Inline all CSS and JS via <style> and <script>, OR use the **local** `/libs/*` route (see AVAILABLE LOCAL LIBRARIES below). Use inline SVG/CSS for visuals where possible. **NEVER use external image URLs** (no Unsplash, Pexels, Pixabay, placeholder.com, or any https:// image sources). For raster images, use ONLY <ai-image> elements. **No external CDNs** — only `/libs/*` paths are allowed for script/link tags."
        : "2) Self-contained. Inline all CSS and JS via <style> and <script>. Use inline SVG/CSS for visuals where possible. **NEVER use external image URLs** (no Unsplash, Pexels, Pixabay, placeholder.com, or any https:// image sources). For raster images, use ONLY <ai-image> elements. **No external CDNs. No local libraries.** Use pure, dependency-free vanilla code only.",
      "3) Latency-aware.",
      "   - Full page reloads (links/forms) are **slow** (~30s to 3m). Use inline JS for local UI changes (tabs, modals, sorting/filtering existing data).",
      "   - Use the Virtual REST API (see Efficiency Tools) for background state changes or data loading.",
      "4) State Awareness. **You must derive all application state** from the App Brief, Current Request, Previous HTML, and recorded REST Mutations/Queries provided in this prompt. Do not assume the server maintains any hidden application logic or databases outside of what is presented here.",
      "5) Pass state forward.",
      "   - Visible state needed next render → query params (GET links) / form fields (POST forms).",
      "   - Invisible state needed next render → Use HTML comment bundle: <!-- app-state: { ... } -->. Find, preserve, update, and forward these comments from the Previous HTML.",
      "6) Interpretation. Infer user intent from the source element in the previous HTML (link/form/data-attributes). Treat recorded mutations as *already applied*; reflect their effects now.",
      "7) Safety & quality.",
      "   - No eval or dynamic code injection; sanitize echoed user text.",
      "   - Semantic, accessible HTML (labels, roles, focus order, keyboard access, contrast, aria-live for async feedback).",
      '   - Realistic content only; no placeholders ("Lorem Ipsum", "John Doe", fake numbers, "TODO" text).',
      "8) Output contract. Return exactly one `<html>…</html>` document. No Markdown, explanations, or extra text.",
      "9) User uploads.",
      "   - Request files (images, PDFs, etc.) for this request are provided below and attached; use them for parsing, summaries, or conditioning visual output. Large files may be truncated to ~4MB; acknowledge if fidelity might be impacted.",
      "   - To feed a user-selected image into generation, set `input-base64` on `<ai-image>` (plus optional `input-mime-type` like `image/png` and `input-field` for the originating form field). The runtime will forward it to image providers that support image inputs (Gemini/OpenRouter).",
      "   - Convert uploads to base64 via FileReader in client-side JS before setting the attribute, and keep payloads tight (resize or compress if needed).",
      "",
      "### Design & Behavior Rules",
      '- Primary actions are obvious (clear CTAs). Default non-submitting buttons to type="button".',
      "- Local-first. If data is already on the page, handle UI updates (e.g., open item detail) client-side without a server round-trip; persist only on real edits via mutation API.",
      "- Distinguish navigation vs. local interaction.",
      '  - **Full Page Reload (Slow):** For distinctly new views use standard `<a href="/route?params">` or `<form action="/route">`. The browser interceptor will show a loading screen.',
      "  - **Local/Background (Fast):** Use `onclick` handlers (with `event.preventDefault()`) ONLY for in-page UI updates (tabs, modals) OR for background `fetch` calls to the Virtual REST API.",
      "- Background helpers.",
      "  - Mutation: POST `/rest_api/mutation/<resource>` with JSON body; stay on page; show lightweight feedback (spinner/toast).",
      "  - Query: GET/POST `/rest_api/query/<resource>` on user action; show skeletons; replace relevant region; handle errors.",
      "- Instruction loop. If `LLM_WEB_SERVER_INSTRUCTIONS` is in the request body, iterate this *same view* with the requested adjustments.",
      "- State mirroring. If inline JS mutates durable data client-side, also mirror the change into hidden inputs or the comment-state so the *next* full render sees it.",
      "- Large data. Embed only essential filters/counts; fetch details/pages via `/rest_api/query/*` on user action.",
      '- Stability beacons. Use stable IDs/keys derived from user data (e.g., `data-item-id="product-123"`) and/or hints in comment-state to keep references consistent across renders.',
      "",
      "### What to return now",
      "- A polished, modern single HTML page reflecting the current request and state:",
      "  - Inline `<style>` and minimal, purposeful `<script>`.",
      "  - Clear CTAs; scoped loading/empty/error states for async regions.",
      "  - Forms/links/comments that carry forward required state.",
      "  - Effects of recorded mutations already reflected.",
      "  - `{{placeholders}}` referencing `data-id`s for reused, unchanged elements from history.",
      "- If ambiguous, choose the most plausible interpretation consistent with the brief, history, and request, and proceed.",
      "",
      "### Never include",
      "- Chain-of-thought, tool logs, or any text outside the single `<html>...</html>` document.",
      "- External resources, popups, target `_blank`, iframes, or auto-fired queries on initial load.",
      "- Dummy/placeholder data visible as such ('John Doe', '555-...', 'Test User', 'Demo') - always create realistic, life-like data.",
      "- Your own `data-id` attributes added to any element.",
      "- `data-id` attributes copied verbatim from previous HTML. Use `{{component:data-id}}` syntax instead for reuse.",
    ];
  }

  if (!isJsonQuery && imageGenerationEnabled) {
    if (!tourMode && !prototypeMode) {
      systemLines.push(
        "",
        "### IMAGE GENERATION",
        "You can request server-rendered images without writing JavaScript.",
        "Use the custom element: <ai-image prompt=\"Describe the image\" ratio=\"16:9\"></ai-image>.",
        "- If you have a user-provided image (e.g., from <input type=\"file\">), set `input-base64` on the `<ai-image>` with the Base64 string and optional `input-mime-type` (e.g., image/png). The runtime forwards it to providers that support image inputs (Gemini/OpenRouter) so you can do image-to-image prompts.",
        "",
        "**MODEL CAPABILITIES**: The image models (Google Gemini Nano Banana Pro, OpenAI GPT Image) are state-of-the-art with exceptional prompt adherence, text rendering, camera control, and compositional understanding. Write detailed, multi-paragraph prompts with precise technical instructions — these models thrive on specificity.",
        "",
        "CRITICAL RULES FOR IMAGES:",
        "1. COST WARNING: Generating images is expensive. Use them SPARINGLY. Reuse cached images by matching ratio & prompt EXACTLY.",
        "2. LIMIT: Target 0-5 images per page. For galleries/catalogs, you may exceed if essential.",
        "3. VALUE: Every image must serve a specific user goal. Prefer CSS gradients/patterns for generic backgrounds.",
        "4. RELEVANCE: If the brief doesn't require visuals, use CSS styling or SVG icons instead.",
        "5. EXCEPTION: If user explicitly requests more images, you may override limits.",
        "",
        "**PROMPT COMPOSITION FRAMEWORK** (include ALL 6 factors):",
        "1. **Subject**: Who/what is in the image with precise detail (e.g., 'a bartender in a crisp white shirt', 'a wedge of aged Comté cheese')",
        "2. **Composition**: Camera angle, framing, and spatial layout (e.g., 'low-angle shot', 'close-up', 'wide shot', 'the left third of the frame', 'centered composition')",
        "3. **Action/Context**: What is happening, the setting/location (e.g., 'arranging artisanal cheeses on a dark slate board', 'futuristic cafe interior')",
        "4. **Style**: Art type and visual treatment (e.g., 'cinematic food photography', 'Apple product photography style', 'Pixar character design', 'oil painting')",
        "5. **Camera & Lighting**: Lens, shadows, and light details (e.g., 'shot at f/1.8 with shallow depth of field', 'soft key light from upper-right', 'long shadows', 'golden hour warm tones')",
        "6. **Color Palette with Hex Values**: Specific colors for key regions, especially for text overlay zones",
        "",
        "**TEXT-SAFE ZONE REQUIREMENTS** (CRITICAL for hero images with overlaid text):",
        "When an image will have text placed on top, you MUST specify:",
        "- **Spatial region**: Which portion of the image (e.g., 'the left third', 'the upper-left quadrant', 'the bottom 25%')",
        "- **Luminance threshold**: How dark that region needs to be (e.g., 'darker than 30% brightness', 'near-black', 'under 20% luminance')",
        "- **Exact hex colors**: The background color AND intended text color (e.g., 'gradient from #0a0a0a to #1a1a2e for white (#ffffff) heading text')",
        "- **Treatment type**: How the dark zone is achieved (e.g., 'soft vignette', 'darkened gradient overlay', 'naturally shadowed area', 'out-of-focus dark background')",
        "",
        "Valid ratios: 1:1, 16:9, 9:16, and 4:3.",
        "You may control sizing and layout with standard HTML attributes (width, style, class) on the <ai-image> tag.",
        "",
        "**EXAMPLE PROMPTS** (notice the technical precision):",
        "",
        "Hero with text overlay:",
        "<ai-image prompt=\"A sweeping aerial view of a coastal Mediterranean city at golden hour. Modern white villas with terracotta roofs cascade down hillsides toward a turquoise harbor filled with luxury yachts. Shot from a drone at 200ft altitude, 24mm wide-angle lens, f/8 for deep focus.",
        "",
        "TEXT-SAFE ZONE: The left 35% of the frame must be a darkened gradient zone, transitioning from near-black (#0d0d0d, under 10% luminance) at the far left edge to semi-transparent by the 35% mark. This creates a text-safe area for white (#ffffff) heading text and light gray (#e2e8f0) subheading text.",
        "",
        "Color grading: Warm golden tones in highlights, deep teal shadows, slightly desaturated midtones for a premium travel magazine aesthetic. 8K resolution, cinematic color science.\" ratio=\"16:9\" width=\"100%\"></ai-image>",
        "",
        "Product photography:",
        "<ai-image prompt=\"Premium wireless over-ear headphones in matte charcoal with brushed copper accents on the hinges and logo. The headphones rest at a 15-degree angle on a black marble surface with subtle gold veining.",
        "",
        "LIGHTING: Single soft key light from upper-right (45-degree angle) creating a gentle highlight arc on the left earcup. Fill light at 20% intensity from lower-left. Background is pure black (#000000) with zero gradient.",
        "",
        "TEXT-SAFE ZONE: The upper 30% of the frame should remain predominantly dark (under 15% luminance, averaging #0a0a0a) with the product positioned in the lower 60%, leaving clean negative space for white text overlay.",
        "",
        "Shot at f/2.8 with subtle depth-of-field blur on the rear earcup. Style: Apple product photography — clean, minimal, perfect edge definition, creamy bokeh on any background elements.\" ratio=\"16:9\" width=\"100%\"></ai-image>",
        "",
        "Food/lifestyle:",
        "<ai-image prompt=\"A curated selection of premium artisanal cheeses arranged on a dark slate board: a wedge of aged Comté with crystalline texture, a creamy Brillat-Savarin with bloomy rind, and a crumbly blue Roquefort. Accompanied by dried Mission figs, candied walnuts, and a small honeycomb glistening with golden honey.",
        "",
        "COMPOSITION: Overhead flat-lay shot. The slate board is positioned in the right two-thirds of the frame.",
        "",
        "TEXT-SAFE ZONE: The left third of the frame (from x=0% to x=33%) must be a darkened extension of the slate/background, with luminance under 25% (colors ranging from #1a1a1a to #2d2d2d) to ensure white (#ffffff) and cream (#fef3c7) text remains legible with WCAG AAA contrast.",
        "",
        "LIGHTING: Moody and sophisticated — soft directional light from upper-left creating long shadows extending toward bottom-right. Highlights on cheese surfaces and honey should be soft, not blown out. Muted warm color temperature around 3200K.",
        "",
        "STYLE: High-end editorial food photography for a Condé Nast publication. Shot at f/4 with medium depth of field, focus plane on the Comté wedge.\" ratio=\"16:9\" width=\"100%\"></ai-image>",
        "",
        "Do NOT use Markdown images or raw <img> tags; the helper will swap in an <img> element automatically."
      );
    }
    else {
      systemLines.push(
        "",
        "### IMAGE GENERATION",
        "Image generation is disabled in tour mode. The history contains <ai-image> tags with prompts. These indicate what the image should show. You may only use images contained in the image manifest below and reference it with its ID as instructed.",
        "",
        "CRITICAL RULES FOR IMAGES:",
        "1. COST WARNING: Generating images is expensive. Prefer using images that are in the image manifest, reference them using their `data-image-id` and use the same `prompt`. These have already been generated; you can use as many of these as you like.",
        "2. Generate new images VERY SPARINGLY. On subsequent page generations, if you want to use the same image again, the ratio&prompt need to match EXACTLY to the previous image to reuse the same asset (generations are cached).",
        "3. LIMIT: Target 0-2 new images per page for standard content. For image-heavy views (galleries, catalogs), you may exceed this if essential to the brief.",
        "4. VALUE: Ensure every generated image serves a specific user goal (e.g., illustrating a product, setting a specific mood defined in the brief). Prefer CSS gradients/patterns for generic backgrounds.",
        "5. RELEVANCE: If the brief doesn't explicitly ask for visuals, prefer CSS styling or SVG icons over generated images.",
        "6. DESCRIPTION: Construct image prompts using at least the following information: Subject, Action/Context, Art Style/Mood, Lighting, Colors or color palette (e.g. when overlaying with text). Be concrete, detailed and verbose - especially if you overlay with text - to ensure the text is legible.",
        "",
        "Valid ratios: 1:1, 16:9, 9:16, and 4:3.",
        "You may control sizing and layout with standard HTML attributes (width, style, class) on the <ai-image> tag.",
        "Examples:",
        "- Full width landscape: <ai-image prompt=\"A futuristic skyline\" ratio=\"16:9\" width=\"100%\"></ai-image>.",
        "- Small floated square: <ai-image prompt=\"An icon of a robot\" ratio=\"1:1\" style=\"width: 200px; float: right; margin: 12px;\"></ai-image>.",
        "Do NOT use Markdown images or raw <img> tags; the helper will swap in an <img> element automatically."

      );

    }
  }

  if (!isJsonQuery && (enableStandardLibrary || tourMode || prototypeMode)) {
    const librariesText = VAPORVIBE_LIBRARIES.map(
      (lib) =>
        `- **${lib.id}** (v${lib.version}): ${lib.description}. Usage: ${lib.tags}`
    ).join("\n");

    systemLines.push(
      "",
      "# AVAILABLE LOCAL LIBRARIES",
      "Use these libraries to generate concise Markup and implement high-quality functionality. Deliberately choose which libraries to use.",
      "The following libraries are INSTALLED locally.",
      "You MUST include the exact <script> or <link> tag shown below if you use them.",
      librariesText,
      "",
      "IMPORTANT LIBRARY RULES:",
      "- **Tailwind CSS**: The provided runtime is **Tailwind CSS v3.4.1** (running in the browser via JIT).",
      "  - Use utility classes directly in HTML elements (e.g., class=\"p-4 flex\").",
      "  - You CAN use the `.container` class as it exists in this version.",
      "  - You CAN use `@apply` for standard Tailwind utilities in `<style type=\"text/tailwindcss\">` blocks.",
      "  - **CRITICAL EXCEPTION**: Do NOT use `@apply` with DaisyUI classes (e.g., `@apply btn`). The JIT runtime cannot see them. Use classes directly in HTML.",
      "  - The `tailwindcss` script tag is **already included** when the standard library is enabled.",
      "  - You CAN use arbitrary values (e.g., `grid-cols-[1fr_200px]`) and all standard v3 features.",
      "  - Do NOT include large CSS resets or external Tailwind CDN links.",
      "- **DaisyUI**: Trust the provided classes for complex components (modals, cards, tabs). Use them directly in HTML (e.g., `<button class=\"btn btn-primary\">`) to avoid runtime errors."
    );

    if (tourMode) {
      systemLines.push(
        "",
        "### TOUR SPECIFIC LIBRARY REQUIREMENT",
        "- **Driver.js**: You **MUST** use the `driver.js` library listed above to implement the tour functionality, regardless of previous library choices.",
        "",
        "### IMAGE HANDLING (CRITICAL)",
        "- **Prompt Preservation**: When outputting `<ai-image>` tags, YOU MUST include the `prompt` attribute verbatim from the source history. This is used for precise client-side hydration."
      );
    }
  }

  // --- Assemble final messages ---
  const system = systemLines.join("\n");

  const historyMessages = buildHistoryMessages({
    history,
    historyTotal,
    historyLimit,
    historyLimitOmitted,
    historyByteOmitted,
  });
  const historySummaryLines = buildHistorySummary({
    history,
    historyTotal,
    historyLimit,
    historyLimitOmitted,
    historyByteOmitted,
  });

  const prevHtmlSnippet =
    historyMaxBytes > 0 ? prevHtml.slice(0, historyMaxBytes) : prevHtml;
  const timestampIso = timestamp?.toISOString();

  const attachmentSummaryLines: string[] = [];
  if (briefAttachments.length > 0) {
    briefAttachments.forEach((attachment, index) => {
      attachmentSummaryLines.push(
        `- [${index + 1}] ${attachment.name} (${attachment.mimeType}, ${attachment.size
        } bytes) — delivered inline`
      );
    });
  }
  if (omittedAttachmentCount > 0) {
    const noun = omittedAttachmentCount === 1 ? "attachment" : "attachments";
    attachmentSummaryLines.push(
      `- ${omittedAttachmentCount} additional ${noun} are linked to the brief but this model does not accept them.`
    );
  }
  const attachmentSummary =
    attachmentSummaryLines.length > 0
      ? ["Brief Attachments:", ...attachmentSummaryLines].join("\n")
      : undefined;

  // Key takeaways specific to the mode
  const isExportMode = tourMode || prototypeMode;
  const rememberLines = isJsonQuery
    ? [
      "- Output raw JSON that the current UI can consume without additional parsing steps.",
      "- Keep field names consistent with prior renders and recorded mutations.",
      "- If the UI likely triggered this query to refresh client-side state, include enough detail for immediate rendering.",
    ]
    : isExportMode
      ? [
        "- Build a single-file SPA with shared shell elements and distinct view containers shown one at a time via switchView().",
        "- Prevent full reloads entirely; convert links/forms to JS handlers and mock any /rest_api/* behavior with local DOM updates.",
        "- Drive a scripted Driver.js walkthrough that switches views before highlighting targets and types into inputs during relevant steps.",
        "- Keep the tour on-rails: block clicks outside highlights and make active elements visually prominent (pulse/overlay).",
        "- Reuse `{{component:...}}` placeholders from history for unchanged regions before exporting fully expanded HTML.",
      ]
      : [
        "- Render ONLY the current view as a full HTML document.",
        "- Include inline CSS/JS. No external dependencies.",
        "- Align the response with the requested path AND parameters by inferring which link or form was activated in the previous HTML and how its fields map to the submitted values.",
        "- Carry state forward via forms, query strings, or comments. Preserve comment-state from previous HTML.",
        "- Reuse hierarchy: (1) whole page `<html>`, (2) shells `<head>/<body>`, (3) partials `<header>/<style>`, preferring newest history matches. Generate fresh markup if unsure.",
        "- Placeholders `{{ }}` *are* the output for reused parts; don't expand them or add wrappers.",
        "- Split reusable JS helpers from per-request `<script data-state-script>`. Never reuse the state script via placeholder.",
        "- Provide clear CTAs.",
        "- Use background fetch for REST API calls (fast mutations, slower queries on user action). Show loading states.",
        "- Keep background fetch feedback lightweight (inline spinners/toasts).",
        "- Avoid auto-fetching queries on initial render; synthesize start data, fetch only on explicit user action.",
        "- Reflect mutation effects immediately in this render.",
        '- Default non-submitting buttons to `type="button"`. Call `event.preventDefault()` before `fetch`.',
        "- Mutation API returns only `{ success: true }`; update DOM client-side from submitted data.",
        "- After mutation + DOM update, do NOT trigger full navigation/reload.",
        "- Replace synthesized starter data with actual mutation history data once available.",
        "- Only call mutation API with meaningful state changes.",
      ];



  // Stable context (changes less often)
  const stableSections: string[] = [`App Brief:\n${brief}`];
  if (attachmentSummary) {
    stableSections.push("", attachmentSummary);
  }
  stableSections.push("", "Remember:", ...rememberLines);

  // Dynamic context (changes every request)
  const dynamicSections: string[] = [...historySummaryLines];
  dynamicSections.push(
    "",
    "Current Request:",
    ...(timestampIso ? [`- Timestamp: ${timestampIso}`] : []),
    `- Method: ${method}`,
    `- Path: ${path}`,
    ...(branchId ? [`- Branch: ${branchId}`] : []),
    `- Query Params (URL-decoded JSON): ${JSON.stringify(query, null, 2)}`,
    `- Body Params (URL-decoded JSON): ${JSON.stringify(body, null, 2)}`
  );
  if (requestFiles.length > 0) {
    dynamicSections.push(
      "",
      "Request Files:",
      ...requestFiles.map((file, index) =>
        `- [${index + 1}] ${file.name} (${file.mimeType}, ${file.size} bytes${file.truncated ? ", truncated to 4MB" : ""
        }${file.fieldName ? ` from field "${file.fieldName}"` : ""})`
      )
    );
  }
  dynamicSections.push(
    "",
    "Previous HTML (Your last output, including server-injected data-ids for reuse reference. Use history for older states.):",
    "-----BEGIN PREVIOUS HTML-----",
    prevHtmlSnippet,
    "-----END PREVIOUS HTML-----"
  );

  // Assemble ChatMessage array
  const systemMessage: ChatMessage = {
    role: "system",
    content: system,
    cacheControl: { type: "ephemeral" },
  };
  const stableMessage: ChatMessage = {
    role: "user",
    content: stableSections.join("\n"),
  };
  if (briefAttachments.length > 0) {
    stableMessage.attachments = briefAttachments.map((attachment) => ({
      ...attachment,
    }));
  }

  const dynamicMessage: ChatMessage = {
    role: "user",
    content: dynamicSections.join("\n"),
  };
  if (requestFiles.length > 0) {
    dynamicMessage.attachments = requestFiles.map((file) => ({ ...file }));
  }

  return [systemMessage, stableMessage, ...historyMessages, dynamicMessage];
}

// --- Helper Functions ---

interface HistoryMessagesOptions {
  history: HistoryEntry[];
  historyTotal: number;
  historyLimit: number;
  historyLimitOmitted: number;
  historyByteOmitted: number;
}

function buildHistoryMessages(options: HistoryMessagesOptions): ChatMessage[] {
  const { history } = options;
  if (history.length === 0) {
    return [];
  }

  const messages = history.map((entry, index) => {
    const content = formatHistoryEntry(entry, index);
    const message: ChatMessage = { role: "user", content };
    // Potentially add attachments from history entry if needed later
    return message;
  });

  // Mark the most recent history entry as ephemeral for potential caching layers
  if (messages.length > 0) {
    messages[messages.length - 1].cacheControl = { type: "ephemeral" };
  }

  return messages;
}

function buildHistorySummary(options: HistoryMessagesOptions): string[] {
  const {
    history,
    historyTotal,
    historyLimit,
    historyLimitOmitted,
    historyByteOmitted,
  } = options;
  if (history.length === 0) {
    return ["History Summary:", "- No previous pages for this session yet."];
  }

  const summaryLines: string[] = [
    "History Summary:",
    `- Entries included: ${history.length} of ${historyTotal} (limit ${historyLimit})`,
  ];
  const omissionDetails: string[] = [];
  if (historyLimitOmitted > 0) {
    omissionDetails.push(`${historyLimitOmitted} via entry limit`);
  }
  if (historyByteOmitted > 0) {
    omissionDetails.push(`${historyByteOmitted} via byte budget`);
  }
  if (omissionDetails.length > 0) {
    summaryLines.push(`- Omitted entries: ${omissionDetails.join(", ")}`);
  }

  return summaryLines;
}

// Formats a single history entry for inclusion in the prompt
function formatHistoryEntry(entry: HistoryEntry, index: number): string {
  const kindLabel =
    entry.entryKind === "html"
      ? "HTML"
      : entry.entryKind === "rest-mutation"
        ? "REST Mutation"
        : entry.entryKind === "rest-query"
          ? "REST Query"
          : entry.entryKind;

  const lines: string[] = [
    `History Entry ${index + 1} [${kindLabel}] (${entry.id})`,
    LINE_DIVIDER,
    `Timestamp: ${entry.createdAt}`,
    // `Session: ${entry.sessionId}`, // Likely redundant for the model
    `Duration: ${entry.durationMs} ms`,
    `Request Method: ${entry.request.method}`,
    `Request Path: ${entry.request.path}`,
    `Query Params (JSON): ${formatJson(entry.request.query ?? {})}`,
    `Body Params (JSON): ${formatJson(entry.request.body ?? {})}`,
  ];
  if (entry.request.files?.length) {
    lines.push("Request Files:");
    entry.request.files.forEach((file, idx) => {
      lines.push(
        `  - [${idx + 1}] ${file.name} (${file.mimeType}, ${file.size} bytes${file.truncated ? ", truncated to 4MB" : ""
        }${file.fieldName ? ` from field "${file.fieldName}"` : ""})`
      );
    });
  }
  if (entry.request.instructions) {
    lines.push(`Instructions Provided: ${entry.request.instructions}`);
  }

  if (entry.entryKind === "html") {
    if (entry.llm) {
      lines.push(
        `LLM Provider: ${entry.llm.provider}`,
        `LLM Model: ${entry.llm.model}`,
        `Reasoning Mode: ${entry.llm.reasoningMode}`
      );
    }
    // Include brief attachments associated *with this specific history entry* if available
    if (entry.briefAttachments?.length) {
      lines.push("Brief Attachments included in this step:");
      entry.briefAttachments.forEach((att) => {
        lines.push(`- ${att.name} (${att.mimeType})`); // Keep it brief
      });
    }
    // Include REST interactions captured *during this HTML render step*
    if (entry.restMutations?.length) {
      lines.push("REST Mutations Recorded During This Step:");
      entry.restMutations.forEach((m) =>
        lines.push(`  - ${m.method} ${m.path} -> ${formatJsonInline(m.body)}`)
      );
    }
    if (entry.restQueries?.length) {
      lines.push("REST Queries Recorded During This Step:");
      entry.restQueries.forEach((q) =>
        lines.push(
          `  - ${q.method} ${q.path} -> ${q.ok ? "OK" : "Error"
          }: ${formatJsonInline(q.response)}`
        )
      );
    }
    lines.push(
      "Generated HTML (with server-injected data-ids for reuse reference):"
    );
    lines.push("-----BEGIN HTML-----");
    lines.push(entry.response.html); // This HTML *includes* the data-ids
    lines.push("-----END HTML-----");
    return lines.join("\n");
  }

  // Formatting for REST entries
  const rest = entry.rest;
  if (rest?.ok !== undefined) {
    lines.push(`Outcome: ${rest.ok ? "success" : "error"}`);
  }
  if (rest?.error) {
    lines.push(`Error: ${rest.error}`);
  }
  if (entry.usage?.reasoningTokens !== undefined) {
    lines.push(`Reasoning Tokens: ${entry.usage.reasoningTokens}`);
  }

  if (rest?.response !== undefined) {
    lines.push("Response JSON:");
    lines.push(...indentMultiline(formatJson(rest.response)));
  } else if (rest?.rawResponse) {
    lines.push("Raw Response Payload:");
    lines.push(...indentMultiline(rest.rawResponse));
  }

  return lines.join("\n");
}

function indentMultiline(value: string, indent = "  "): string[] {
  return value.split("\n").map((line) => `${indent}${line}`);
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value); // Fallback for non-serializable
  }
}

function formatJsonInline(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}
