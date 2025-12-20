import type { BriefAttachment, ChatMessage, HistoryEntry } from "../types.js";
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
  } = context;
  const isJsonQuery = mode === "json-query";

  // --- System Prompt Definition ---
  const systemLines = isJsonQuery
    ? [
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
    ]
    : [
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
        ? "2) Self-contained. Inline all CSS and JS via <style> and <script>, OR use the **local** `/libs/*` route (see AVAILABLE LOCAL LIBRARIES below). Use inline SVG/CSS for visuals where possible. Avoid linking to external images or embedding large data-URLs. **No external CDNs** — only `/libs/*` paths are allowed for script/link tags."
        : "2) Self-contained. Inline all CSS and JS via <style> and <script>. Use inline SVG/CSS for visuals where possible. Avoid linking to external images or embedding large data-URLs. **No external CDNs. No local libraries.** Use pure, dependency-free vanilla code only.",
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

  if (!isJsonQuery && imageGenerationEnabled) {
    systemLines.push(
      "",
      "### IMAGE GENERATION",
      "You can request server-rendered images without writing JavaScript.",
      "Use the custom element: <ai-image prompt=\"Describe the image\" ratio=\"16:9\"></ai-image>.",
      "",
      "CRITICAL RULES FOR IMAGES:",
      "1. COST WARNING: Generating images is expensive. Use them SPARINGLY. On subsequent page generations, if you want to use the same image again, the ratio&prompt need to match EXACTLY to the previous image to reuse the same asset (generations are cached by the server).",
      "2. LIMIT: Target 0-5 images per page for standard content. For image-heavy views (galleries, catalogs), you may exceed this if essential to the brief.",
      "3. VALUE: Ensure every generated image serves a specific user goal (e.g., illustrating a product, setting a specific mood defined in the brief). Prefer CSS gradients/patterns for generic backgrounds.",
      "4. RELEVANCE: If the brief doesn't explicitly ask for visuals, prefer CSS styling or SVG icons over generated images.",
      "5. EXCEPTION: If the user explicitly requests more images or specific visuals in the brief or instructions, you may override these limits to satisfy the request.",
      "6. DESCRIPTION: Construct image prompts using with at least the following information: Subject, Action/Context, Art Style/Mood, Lighting, Colors if relevant (e.g. when overlaying with text). Be concrete, detailed and verbose - especially if you overlay with text - to ensure the text is legible.",
      "",
      "Valid ratios: 1:1, 16:9, 9:16, and 4:3.",
      "You may control sizing and layout with standard HTML attributes (width, style, class) on the <ai-image> tag.",
      "Examples:",
      "- Full width landscape: <ai-image prompt=\"A futuristic skyline\" ratio=\"16:9\" width=\"100%\"></ai-image>.",
      "- Small floated square: <ai-image prompt=\"An icon of a robot\" ratio=\"1:1\" style=\"width: 200px; float: right; margin: 12px;\"></ai-image>.",
      "Do NOT use Markdown images or raw <img> tags; the helper will swap in an <img> element automatically."
    );
  }

  if (!isJsonQuery && enableStandardLibrary) {
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
      "  - You CAN use `@apply` in `<style>` tags if combined with the `type=\"text/tailwindcss\"` attribute on the style tag.",
      "  - The `tailwindcss` script tag is **already included** when the standard library is enabled.",
      "  - You CAN use arbitrary values (e.g., `grid-cols-[1fr_200px]`) and all standard v3 features.",
      "  - Do NOT include large CSS resets or external Tailwind CDN links.",
      "- **DaisyUI**: Trust the provided classes for complex components (modals, cards, tabs) instead of building them from scratch with raw Tailwind utility classes."
    );
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
  const rememberLines = isJsonQuery
    ? [
      "- Output raw JSON that the current UI can consume without additional parsing steps.",
      "- Keep field names consistent with prior renders and recorded mutations.",
      "- If the UI likely triggered this query to refresh client-side state, include enough detail for immediate rendering.",
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
