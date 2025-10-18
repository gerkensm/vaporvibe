import type {
  BriefAttachment,
  ChatMessage,
  HistoryEntry,
  RestMutationRecord,
  RestQueryRecord,
} from "../types.js";

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
  timestamp: Date;
  includeInstructionPanel: boolean;
  history: HistoryEntry[];
  historyTotal: number;
  historyLimit: number;
  historyMaxBytes: number;
  historyBytesUsed: number;
  historyLimitOmitted: number;
  historyByteOmitted: number;
  adminPath: string;
  restMutations: RestMutationRecord[];
  restQueries: RestQueryRecord[];
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
    restMutations,
    restQueries,
    mode = "page",
  } = context;
  const nowIso = timestamp.toISOString();

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
        "You are a SINGLE-VIEW HTML generator for a 'sourcecodeless web app server'.",
        "Your job: return ONLY a complete, valid, self-contained HTML document for the CURRENT VIEW.",
        "",
        "MANDATORY RULES:",
        "1) NO SPA ROUTING. Each server round-trip takes ~1-2 minutes, so respond with a full document tuned to THIS request. Inline JS can drive multi-step flows (modals, wizards, side panels) within this page, but do NOT include routers, virtual page stacks, background fetches outside the /rest_api helpers, or generic SPA shells.",
        '2) SELF-CONTAINED: All CSS/JS inline via <style> and <script>. No external links, fonts, CDNs, or network calls EXCEPT background fetches to /rest_api/mutation/* and /rest_api/query/*. No iframes, popups, or target="_blank" links. Avoid pixel images entirely (even via data URLs); use inline SVG or CSS for visuals.',
        "3) INTERACTIONS: Any user action that changes the view—including clicking a link to another page—must submit via GET or POST to the server (full page reload). Every navigation inherits the ~1-2 minute server round-trip latency, so reserve it for changes that truly need the server. Outside of the /rest_api helpers, avoid AJAX, WebSockets, or background requests.",
        "3a) LOCAL INTERACTIONS: When the user is just exploring or rearranging data already delivered in THIS HTML (e.g., opening a note from the current list, showing a modal, switching tabs, toggling filters), handle it with inline JS and DOM updates without sending another request. Keep these enhancements scoped to the current document—do not simulate future routes, page shells, or virtual navigation stacks.",
        "3b) STATE HELPERS: To persist edits without a full reload, fire a background fetch (GET or POST) to /rest_api/mutation/* with compact fields that describe the change. Only call these endpoints when you actually have durable data to save—collect it via forms, modals, or inline editors first, then send the payload (never an empty body). Treat the routes as JSON APIs: the navigation interceptor blocks full-page visits to them, so rely on fetch/XHR (or listen for the serve-llm:rest-api-request event if you need a hook). Responses are always { success: true } and recorded for future views. Always send JSON with the correct Content-Type header, check the success flag, and synthesize any additional fields you need client-side. Never follow a mutation with a full navigation—stay on the current view and update the DOM in place.",
        "3c) DATA HELPERS: When you need read-only data (or want to simulate a fetch for the next render), call /rest_api/query/* via background fetch with descriptive params. These calls beat a full reload but can still take up to ~30 seconds, so always show an inline loading state (spinners, skeletons, status text) and keep the user oriented. Do NOT auto-fire these on initial load—lean on the brief, history, and recorded mutations for initial content, and reserve /rest_api/query/* for explicit user actions such as pagination, filtering, or manual refresh. The interceptor also prevents full navigations to these endpoints; fetch the JSON yourself (or respond to the serve-llm:rest-api-request event) and update the DOM without redirecting.",
        "4) CONTEXT: You ONLY know the 'App Brief', the PREVIOUS HTML (server-provided), the request METHOD, PATH, QUERY, and BODY. You must not depend on any hidden server state.",
        "5) REQUEST INTERPRETATION: When a request targets a link or form from the previous HTML, use that source context (link text, surrounding content, data attributes, form field names) to infer the user's intent, interpret path/parameter semantics, and render the appropriate view.",
        "6) STATE HANDOFF: If your UI needs state on the next view, include it explicitly in form fields or query params that you submit. Make state compact and human-readable when possible.",
        "7) PERSISTENT STATE: When state must persist across views but shouldn't render or be re-submitted every time, embed it in HTML comments. Preserve and forward any such comment-based state you receive, even if it's not needed for the current view. Make sure to proactively persist state from your current or previous views for consistency, e.g. very relevant dummy data that you fill in, so that future views will use the same data. If inline JS mutates durable data, mirror the authoritative value into forms, query params, or comment-based state so the server sees it without bloated hidden payloads.",
        "8) UX: Craft a clean, accessible UI for the current view. Prefer progressive enhancement, keyboard access, and semantic HTML.",
        "9) OUTPUT: Respond with a single <html>...</html> document. No explanations or markdown.",
        "10) SAFETY: Do not execute untrusted input. Avoid inline event handlers that eval arbitrary strings. Keep scripts minimal.",
        "11) REALISTIC CONTENT: Use convincing, non-placeholder data everywhere—no obvious samples like 'John Doe', '555-' numbers, or 'Real functionality would go here'. When external services are needed, simulate them in-page with believable mocks (e.g., a faux Google Docs picker) so the experience feels complete.",
        "",
        "Design Philosophy:",
        "- Each response is a fresh render. Slight variation between renders is expected and welcomed.",
        "- Server round-trips can take ~1-2 minutes, so use inline JS to smooth the current view while keeping authoritative state on the server and avoiding large hidden client stores.",
        "- Build delightful micro-UX for the current step only (e.g., simple modal implemented in-page).",
        "- When the user requests a new item (e.g., “New Note”), present the editor UI locally first; persist via /rest_api/mutation/* only after the user submits real data.",
        "- Treat the initial render as fully self-contained—derive starting data from prior HTML, history, and mutations instead of firing immediate /rest_api/query/* calls.",
        "- Shorter markup trims transfer time a bit, but prioritize a high-quality, comprehensible result over hyper-minifying the HTML.",
        "- Keep JS purposeful and lightweight—let inline scripts handle in-view exploration of known data, and only trigger a server round-trip when you need fresh authoritative state or to persist changes.",
        "- If multiple items are visible (like a list of notes), make them feel instant: swap the primary view client-side and reserve form submissions for saving edits or loading unseen data.",
        "- Do NOT wrap your output in a Markdown wrapper (eg. ```html) - instead, output ONLY the full HTML without any wrappers.",
        "",
      ];

  const realisticContentIndex = systemLines.findIndex((line) =>
    line.startsWith("11) REALISTIC CONTENT")
  );
  const insertIndex =
    realisticContentIndex === -1
      ? systemLines.length
      : realisticContentIndex + 1;

  if (!isJsonQuery) {
    const iterationLines = [
      "12) INSTRUCTION LOOP: When a request includes the field LLM_WEB_SERVER_INSTRUCTIONS, treat it as an iteration cue for THIS view. Re-render the same page with the requested adjustments applied, persist any required state, and avoid swapping to standalone success/confirmation screens.",
    ];

    if (includeInstructionPanel) {
      iterationLines.push(
        "13) RUNTIME PANEL: The server injects the floating instructions widget—do not render your own version or duplicate its controls."
      );
    }

    systemLines.splice(insertIndex, 0, ...iterationLines);
  }

  const system = systemLines.join("\n");

  const historySection = buildHistorySection({
    history,
    historyTotal,
    historyLimit,
    historyMaxBytes,
    historyBytesUsed,
    historyLimitOmitted,
    historyByteOmitted,
  });

  const prevHtmlSnippet =
    historyMaxBytes > 0 ? prevHtml.slice(0, historyMaxBytes) : prevHtml;

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

  const userSections: string[] = [`App Brief:\n${brief}`];
  if (attachmentSummary) {
    userSections.push("", attachmentSummary);
  }
  userSections.push(
    "",
    "Current Request:",
    `- Timestamp: ${nowIso}`,
    `- Method: ${method}`,
    `- Path: ${path}`,
    `- Query Params (URL-decoded JSON): ${JSON.stringify(query, null, 2)}`,
    `- Body Params (URL-decoded JSON): ${JSON.stringify(body, null, 2)}`,
    "",
    "Previous HTML (for context; may be empty if first view):",
    "-----BEGIN PREVIOUS HTML-----",
    prevHtmlSnippet,
    "-----END PREVIOUS HTML-----"
  );

  if (restMutations.length > 0) {
    userSections.push(
      "",
      "Recorded Mutations (latest first):",
      ...summarizeRestRecords(restMutations)
    );
  }

  if (restQueries.length > 0) {
    userSections.push(
      "",
      "Recorded Query Results (latest first):",
      ...summarizeRestQueries(restQueries)
    );
  }

  userSections.push(
    "",
    historySection,
    "",
    "Remember:",
    ...(isJsonQuery
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
          "- Provide clear primary actions (CTAs) and show the user what to do next.",
          "- Use the mutation and query helpers via background fetches to keep the experience lively while minimizing full-page reloads, and show latency-friendly loading affordances when you fire them (spinners, skeletons, status text—the interceptor won't block it).",
          "- Keep background fetch feedback lightweight: prefer inline spinners/toasts instead of full-screen overlays so the main view stays interactive.",
          "- Avoid auto-fetching /rest_api/query/* on initial render; synthesize the starting dataset from the brief, history, and mutations, then fetch only when the user explicitly asks for new data (pagination, refresh, search).",
          "- Treat recorded /rest_api/mutation/* payloads as already applied—reflect their effects in this render even before any follow-up query returns.",
          "- Default every non-submitting <button> to type=\"button\" so you don't accidentally trigger a form submit or navigation, and always call event.preventDefault() before you fire your fetch.",
          "- Mutation helpers return only { success: true }; never expect a server-side note payload—build the client view from your own submitted data.",
          "- After a mutation, update the DOM in place—do NOT call window.location (or otherwise trigger navigation) to refresh the page.",
          "- When you synthesize starter data, replace it with the actual records from mutation history as soon as they exist—never ignore a recorded change.",
          "- Only trigger /rest_api/mutation/* when you have meaningful state to persist—collect the fields first, then send a compact payload instead of placeholder calls.",
        ])
  );

  const user = userSections.join("\n");

  const userMessage: ChatMessage = { role: "user", content: user };
  if (briefAttachments.length > 0) {
    userMessage.attachments = briefAttachments.map((attachment) => ({
      ...attachment,
    }));
  }

  return [
    { role: "system", content: system },
    userMessage,
  ];
}

function summarizeRestRecords(records: RestMutationRecord[]): string[] {
  return records
    .slice()
    .reverse()
    .flatMap((record) => {
      return [
        `- ${record.createdAt} :: ${record.method} ${record.path}`,
        `  Query: ${safeStringify(record.query)}`,
        `  Body: ${safeStringify(record.body)}`,
      ];
    });
}

function summarizeRestQueries(records: RestQueryRecord[]): string[] {
  return records
    .slice()
    .reverse()
    .flatMap((record) => {
      const header = `- ${record.createdAt} :: ${record.method} ${record.path} :: ${record.ok ? "ok" : "error"}`;
      const requestLines = [
        `  Query: ${safeStringify(record.query)}`,
        `  Body: ${safeStringify(record.body)}`,
      ];
      const responseLines = record.ok
        ? [`  Response: ${safeStringify(record.response)}`]
        : [
            `  Error: ${record.error ?? "Model returned invalid JSON"}`,
            `  Raw Response: ${truncateMultiline(record.rawResponse)}`,
          ];
      return [header, ...requestLines, ...responseLines];
    });
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}

function truncateMultiline(value: string, maxLength = 400): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
}

interface HistorySectionOptions {
  history: HistoryEntry[];
  historyTotal: number;
  historyLimit: number;
  historyMaxBytes: number;
  historyBytesUsed: number;
  historyLimitOmitted: number;
  historyByteOmitted: number;
}

function buildHistorySection(options: HistorySectionOptions): string {
  const {
    history,
    historyTotal,
    historyLimit,
    historyMaxBytes,
    historyBytesUsed,
    historyLimitOmitted,
    historyByteOmitted,
  } = options;

  if (history.length === 0) {
    return "History: No previous pages for this session yet.";
  }

  const budgetLabel =
    historyMaxBytes > 0 ? `${historyMaxBytes} bytes` : "unbounded";
  const omittedTotal = historyLimitOmitted + historyByteOmitted;

  const introParts = [
    "History (oldest first)",
    `showing ${history.length} of ${historyTotal} entries`,
    `configured limit ${historyLimit}`,
    `byte budget ${budgetLabel}`,
    `~${historyBytesUsed} bytes included`,
  ];

  if (omittedTotal > 0) {
    const omissionDetails: string[] = [];
    if (historyLimitOmitted > 0) {
      omissionDetails.push(`${historyLimitOmitted} via entry limit`);
    }
    if (historyByteOmitted > 0) {
      omissionDetails.push(`${historyByteOmitted} via byte budget`);
    }
    introParts.push(`omitted ${omissionDetails.join(", ")}`);
  }

  const intro = [`${introParts.join(" / ")}:`, LINE_DIVIDER];

  const entries = history.map((entry, index) => {
    const indexLabel = `Entry ${index + 1} — ${entry.request.method} ${
      entry.request.path
    }`;
    const requestLines = [
      `Timestamp: ${entry.createdAt}`,
      `Session: ${entry.sessionId}`,
      `Duration: ${entry.durationMs} ms`,
      `Query Params (JSON): ${JSON.stringify(
        entry.request.query ?? {},
        null,
        2
      )}`,
      `Body Params (JSON): ${JSON.stringify(
        entry.request.body ?? {},
        null,
        2
      )}`,
    ];
    if (entry.request.instructions) {
      requestLines.push(`Instructions: ${entry.request.instructions}`);
    }
    if (entry.llm) {
      requestLines.push(
        `Provider: ${entry.llm.provider} (${entry.llm.model})`,
        `Max Output Tokens: ${entry.llm.maxOutputTokens}`,
        `Reasoning Mode: ${entry.llm.reasoningMode}`,
        `Reasoning Tokens: ${entry.llm.reasoningTokens ?? "n/a"}`
      );
    } else {
      requestLines.push("Provider: rest-api", "Max Output Tokens: n/a", "Reasoning Mode: n/a", "Reasoning Tokens: n/a");
    }

    if (entry.usage) {
      requestLines.push(
        `Usage Metrics: ${JSON.stringify(entry.usage, null, 2)}`
      );
    }

    if (entry.reasoning?.summaries || entry.reasoning?.details) {
      const reasoningLines: string[] = [];
      if (entry.reasoning.summaries?.length) {
        reasoningLines.push(
          `Reasoning Summaries:\n${entry.reasoning.summaries.join("\n\n")}`
        );
      }
      if (entry.reasoning.details?.length) {
        reasoningLines.push(
          `Reasoning Details:\n${entry.reasoning.details.join("\n\n")}`
        );
      }
      if (reasoningLines.length > 0) {
        requestLines.push(reasoningLines.join("\n"));
      }
    }

    requestLines.push("HTML:");
    requestLines.push("-----BEGIN HTML-----");
    requestLines.push(entry.response.html);
    requestLines.push("-----END HTML-----");
    requestLines.push(LINE_DIVIDER);

    return [indexLabel, ...requestLines].join("\n");
  });

  return [...intro, ...entries].join("\n");
}
