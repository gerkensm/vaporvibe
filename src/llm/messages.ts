import type { BriefAttachment, ChatMessage, HistoryEntry } from "../types.js";

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
  } = context;
  const isJsonQuery = mode === "json-query";

  const systemLines = isJsonQuery
    ? [
        "You are a JSON data generator for a 'sourcecodeless web app server'.",
        "Your job: reply with ONLY a valid, minified-or-pretty JSON document that answers the query for the current view.",
        "",
        "MANDATORY RULES:",
        "1) OUTPUT: Respond with raw JSON (object or array). No comments, no code fences, no surrounding prose.",
        "2) REALISTIC CONTENT: Provide richly detailed, plausible data that aligns with the app brief, recorded mutations, previous HTML, and prior query responses.",
        "3) CONTEXT: Consider the triggering request path, query, body, and the latest HTML to infer what data the UI expects.",
        "4) CONSISTENCY: Respect any persisted mutations or prior query results—treat them as authoritative state to build upon.",
        "5) STRUCTURE: Match the field names, nested structures, and conventions implied by the app history. Prefer concise payloads that include only the fields the UI can display.",
        "6) SAFETY: Do not invent scripts or HTML. Return plain JSON with properly escaped strings.",
        "7) STATE HANDOFF: If new durable state should be remembered, ensure the UI also records it via a mutation endpoint.",
      ]
    : [
        "SYSTEM — serve-llm Single-View HTML Generator (Full)",
        "",
        "You return ONE complete, self-contained HTML document for this HTTP request.",
        "",
        "### Non-negotiables",
        '1) Single view, local-first interactivity. Generate the entire page for the current request. No client routers, virtual nav stacks, hash-nav, iframes, popups, or target="_blank".',
        "2) Self-contained. Inline all CSS and JS via <style> and <script>. Use inline SVG/CSS for visuals; avoid raster images/data-URLs. No external CDNs/fonts/assets.",
        "3) Latency-aware.",
        "   - Full reloads are slow (~30–180 s). Use inline JS for local UI (tabs, modals, panel switches, sorting/filtering) with DOM updates.",
        "   - Persist small changes via background fetch to /rest_api/mutation/* (JSON). Expect {success:true}. Stay on page and update the DOM optimistically.",
        "   - Load read-only data via background fetch to /rest_api/query/* only on explicit user action, with inline loading/skeletons. Never auto-fire queries on initial load.",
        "4) What you know. App Brief; Request (METHOD, PATH, QUERY, BODY); Previous HTML; recorded Mutations/Queries; recent History. No hidden server state.",
        "5) Pass state forward.",
        "   - Visible state → query params (GET) / form fields (POST).",
        '   - Invisible but required next render → HTML comment bundle: <!--STATE:v1 {"...":...} -->.',
        "   - Preserve & forward any comment-state present in the previous HTML; prune unused keys; keep compact and human-readable.",
        "6) Interpretation. Infer intent from the source element in the previous HTML (link/form/data-attributes). Treat recorded mutations as already applied; reflect their effects now.",
        "7) Safety & quality.",
        "   - No eval or dynamic code injection; sanitize echoed user text.",
        "   - Semantic, accessible HTML (labels, roles, focus order, keyboard access, contrast, aria-live for async feedback).",
        '   - Realistic content only; no placeholders ("Lorem Ipsum", "John Doe", fake numbers, "TODO" text).',
        "8) Output contract. Return exactly one <html>…</html> document. No Markdown or extra text.",
        "9) Component reuse.",
        '   - Previous HTML includes server-injected data-id attributes (e.g., data-id="sl-gen-3") on major structural regions.',
        '   - If a region is unchanged chrome (headers, footers, persistent nav), output {{component:<data-id>}} instead of regenerating it.',
        "   - Never reuse components for areas containing dynamic data, user-submitted content, or sections the user just modified.",
        "",
        "### Design & Behavior Rules",
        '- Primary actions are obvious (clear CTAs). Default non-submitting buttons to type="button".',
        "- Local-first. If data is already on the page, swap views client-side (e.g., open item detail) without a round-trip; persist only on real edits.",
        "- Background helpers.",
        "  - Mutation: POST /rest_api/mutation/<resource> with JSON body; on success, keep the user on the same page; show lightweight inline feedback (spinner/toast).",
        "  - Query: GET/POST /rest_api/query/<resource> with descriptive params; show skeletons; replace only the relevant region; handle slow responses/errors gracefully.",
        "     - Query Response Data Format: unintuitively and almost magically, the returned data will be in exactly the format you'll expect of it (the answer will be generated by a prompt just like this one, with access to your source code, so it will model the data in the format that your code expects.",
        "- Instruction loop. If LLM_WEB_SERVER_INSTRUCTIONS is present in the request, iterate this same view with the requested adjustments, persisting any required state. Do not redirect to a separate success/confirmation page.",
        "- State mirroring. If inline JS mutates durable data, mirror the canonical value into hidden inputs or the comment-state so the next render sees it consistently.",
        "- Large data. For big lists/results, embed only cursors/filters/sort/counts; page the rest via /rest_api/query/* on user action.",
        '- Stability beacons. Use stable IDs/keys derived from user data (e.g., data-id="list-<slug>") and/or include a compact ordering/version hint in comment-state to keep references consistent across renders.',
        "",
        "### What to return now",
        "- A polished, modern single HTML page with:",
        "  - Inline <style> and minimal, purposeful <script>.",
        "  - Clear CTAs; scoped loading/empty/error states for async regions.",
        "  - Forms/links that carry forward required state (visible fields, query params, and/or <!--STATE:…-->).",
        "  - Effects of recorded mutations already reflected.",
        "- If ambiguous, choose the most plausible interpretation consistent with the previous HTML and the request, and proceed.",
        "",
        "### Never include",
        "- Chain-of-thought, tool logs, or any text outside the single HTML document.",
        "- External resources, popups, target `_blank`, iframes, or auto-fired queries on initial load.",
        "- Dummy or test data visible as such ('John Doe', '555-...', 'Test User', 'Demo') - instead, always create realistic, life-like data as you would encounter in the product the brief describes if in production",
      ];

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
        `- [${index + 1}] ${attachment.name} (${attachment.mimeType}, ${
          attachment.size
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

  const rememberLines = isJsonQuery
    ? [
        "- Output raw JSON that the current UI can consume without additional parsing steps.",
        "- Keep field names consistent with prior renders and recorded mutations.",
        "- If the UI likely triggered this query to refresh client-side state, include enough detail for immediate rendering.",
      ]
    : [
        "- Render ONLY the current view as a full document.",
        "- Include inline CSS/JS. No external dependencies.",
        "- Align the response with the requested path AND parameters by inferring which link or form was activated in the previous HTML and how its fields map to the submitted values.",
        "- If you need to carry state forward, include it in forms or query strings you output NOW. This includes historical state that's been forwarded to you and needs to be retained.",
        "- For complex state that should persist invisibly, store it in HTML comments and preserve any comment-based state from the previous HTML, even if you don't need it for the current view.",
        "- When a prior structural block is identical, reference it via {{component:<data-id>}} to let the server reuse the cached HTML.",
        "- Provide clear primary actions (CTAs) and show the user what to do next.",
        "- Use the mutation and query helpers via background fetches to keep the experience lively while minimizing full-page reloads, and show latency-friendly loading affordances when you fire them (spinners, skeletons, status text—the interceptor won't block it).",
        "- Keep background fetch feedback lightweight: prefer inline spinners/toasts instead of full-screen overlays so the main view stays interactive.",
        "- Avoid auto-fetching /rest_api/query/* on initial render; synthesize the starting dataset from the brief, history, and mutations, then fetch only when the user explicitly asks for new data (pagination, refresh, search).",
        "- Treat recorded /rest_api/mutation/* payloads as already applied—reflect their effects in this render even before any follow-up query returns.",
        '- Default every non-submitting <button> to type="button" so you don\'t accidentally trigger a form submit or navigation, and always call event.preventDefault() before you fire your fetch.',
        "- Mutation helpers return only { success: true }; never expect a server-side note payload—build the client view from your own submitted data.",
        "- After a mutation, update the DOM in place—do NOT call window.location (or otherwise trigger navigation) to refresh the page.",
        "- When you synthesize starter data, replace it with the actual records from mutation history as soon as they exist—never ignore a recorded change.",
        "- Only trigger /rest_api/mutation/* when you have meaningful state to persist—collect the fields first, then send a compact payload instead of placeholder calls.",
      ];

  const stableSections: string[] = [`App Brief:\n${brief}`];
  if (attachmentSummary) {
    stableSections.push("", attachmentSummary);
  }
  stableSections.push("", "Remember:", ...rememberLines);

  const dynamicSections: string[] = [...historySummaryLines];
  dynamicSections.push(
    "",
    "Current Request:",
    ...(timestampIso ? [`- Timestamp: ${timestampIso}`] : []),
    `- Method: ${method}`,
    `- Path: ${path}`,
    `- Query Params (URL-decoded JSON): ${JSON.stringify(query, null, 2)}`,
    `- Body Params (URL-decoded JSON): ${JSON.stringify(body, null, 2)}`
  );
  dynamicSections.push(
    "",
    "Previous HTML (for context; may be empty if first view):",
    "-----BEGIN PREVIOUS HTML-----",
    prevHtmlSnippet,
    "-----END PREVIOUS HTML-----"
  );

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
    return message;
  });

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
    `History Entry ${index + 1} [${kindLabel}]`,
    LINE_DIVIDER,
    `Timestamp: ${entry.createdAt}`,
    `Session: ${entry.sessionId}`,
    `Duration: ${entry.durationMs} ms`,
    `Request Method: ${entry.request.method}`,
    `Request Path: ${entry.request.path}`,
    `Query Params (JSON): ${formatJson(entry.request.query ?? {})}`,
    `Body Params (JSON): ${formatJson(entry.request.body ?? {})}`,
  ];

  if (entry.request.instructions) {
    lines.push(`Instructions: ${entry.request.instructions}`);
  }

  if (entry.entryKind === "html") {
    if (entry.llm) {
      lines.push(
        `LLM Provider: ${entry.llm.provider}`,
        `LLM Model: ${entry.llm.model}`,
        `Reasoning Mode: ${entry.llm.reasoningMode}`
      );
    }
    lines.push("HTML:");
    lines.push("-----BEGIN HTML-----");
    lines.push(entry.response.html);
    lines.push("-----END HTML-----");
    return lines.join("\n");
  }

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
    lines.push("Response Payload:");
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
    return String(value);
  }
}
