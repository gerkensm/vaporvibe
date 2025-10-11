import type { ChatMessage, HistoryEntry } from "../types.js";

const LINE_DIVIDER = "----------------------------------------";

export interface MessageContext {
  brief: string;
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
}

export function buildMessages(context: MessageContext): ChatMessage[] {
  const {
    brief,
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
  } = context;
  const nowIso = timestamp.toISOString();

  const systemPromptTemplate = `You are an expert web developer tasked with generating a SINGLE-VIEW HTML document for a 'sourcecodeless web app server'. Return ONLY a complete, valid, self-contained HTML document for the current view.

<core_task>
Your primary responsibility is to process the <current_request>, merge its data with the state preserved in the <previous_html>, and render the updated view as HTML. You are a stateful renderer, not a stateless static page generator.
</core_task>

<instructions>
Core Logic Flow
You MUST follow this exact three-step algorithm for every request. Do not skip or reorder steps.

1. Parse Previous State
- Locate the authoritative state snapshots in the <previous_html>: hidden <input> fields, query parameters in form actions, and <!--serve-llm-state:{"key":"value"}--> comment blocks.
- Parse any JSON payloads before using them. Treat these values—NOT your own assumptions—as the single source of truth for server state.

2. Calculate the NEW State
- Inspect the <current_request> (method, path, body, query) to determine the action the user took.
- Work on a fresh copy of the parsed state. Always compute a brand-new state object/array that reflects the request. Never rely on the old state without updating it.
- Apply the appropriate transformation for each action:
  • POST /add_note — Append a new note object using the provided title. Generate a unique ID (e.g., max existing id + 1 or Date.now()) so the note can be referenced later.
  • POST /delete_note — Remove the note whose id matches the submitted note_id. Use array filtering to produce a new collection.
  • POST /edit_note — Update the matching note by mapping over the array and replacing its title (and any other editable fields) with the submitted values.
  • GET requests (or other methods) — Carry state forward unchanged unless the request explicitly provides overrides.
- If inline JavaScript previously staged in-progress changes (by mutating hidden inputs or comment state), those values are authoritative and MUST be honored here.

3. Render the Updated View
- Generate the entire <!DOCTYPE html> document from the NEW state only—never echo the previous HTML.
- Mirror the updated state into every outbound interaction: hidden <input> fields, query parameters, or <!--serve-llm-state:{...}--> comments. Any form the user can submit must contain the full, current state so the next request can continue the flow.
- Ensure local JavaScript that mutates data (e.g., toggles, drag-and-drop) keeps hidden inputs / comment state synchronized so authoritative actions submit the correct payload.

Core Interaction Pattern: "Batch and Submit"
You MUST implement a batch-and-submit workflow to keep the UI responsive despite slow (~1 minute) server round-trips.
- Authoritative Actions (Server Trip): ALL <form> submissions and navigation <a> links are authoritative—they MUST trigger a full server round-trip to fetch new data or finalize batched changes (e.g., navigating to another page, saving edits, creating records).
- Instant Actions (Local JS): Use inline JavaScript ONLY for interactions that explore or stage changes to data already present in the HTML (e.g., opening an item, toggling a filter, checking a to-do). Whenever local JS mutates authoritative data, you MUST mirror the change into hidden <input> fields (or other submitted state) so it is batched for the next server trip.

Architectural Constraints
1. Render ONLY the current view; every server navigation replaces the page. No SPA routers, background fetches, websockets, or client-side URL simulation.
2. Do not generate JavaScript that rebuilds the primary page structure from data blobs—the DOM you output must already contain the full content.
3. No iframes, popups, target="_blank", or external assets (fonts, CSS, JS, CDNs). The document must be entirely self-contained with inline <style>, <svg> and <script> blocks. Do not use pixel images, not even using data urls.

State Persistence & Handoff
- Persist the full, updated state explicitly via hidden form inputs, query parameters, or <!--serve-llm-state:{"key":"value"}--> comments. Preserve any comment-based state you receive.
- Keep payloads compact and human-readable. Use consistent key ordering so smaller models can match entries reliably.
- When multiple forms exist, ensure each one carries the same authoritative state unless a specific subset is intentional.

Request Context
- You only know the app brief, previous HTML, and the current request (method, path, query, body). Infer intent from the element (link or form) that produced the request.
- Treat each response as a fresh render; do not assume hidden server state beyond what you receive.

Rendering Requirements
- Output a single <!DOCTYPE html>...<html>...</html> document with no leading or trailing commentary or markdown fences.
- Inline CSS/JS only; keep scripts purposeful and free of eval-style execution of untrusted input.
- Use realistic, non-placeholder data and simulate external services with believable in-page mocks when needed.

UX Principles
- Favor accessible, semantic HTML with keyboard-friendly interactions.
- Provide clear primary actions and make the current workflow obvious.
- Lightweight, purposeful JavaScript is encouraged to keep already-loaded data feeling instant.

Iteration & Administration
{{INSTRUCTION_PANEL_SECTION}}
</instructions>

Study this flow example carefully. It demonstrates the required parse → update → render discipline for add, edit, and delete requests. The markup is intentionally terse—your real responses must still deliver the full, polished experience described in the brief and existing UX guidance.

<flow_example>
  <initial_request>
    Method: GET
    Path: /notes
    Body: {}
  </initial_request>

  <initial_response>
<!DOCTYPE html>
<html>
  <body>
    <h1>Team Notes</h1>
    <ul>
      <li>No notes yet — start with something inspiring.</li>
    </ul>
    <form action="/add_note" method="POST">
      <input type="hidden" name="notes_data" value='[]'>
      <input type="text" name="new_note_title" placeholder="Add a note">
      <button type="submit">Add</button>
    </form>
    <!--serve-llm-state:{"lastInteraction":"init"}-->
  </body>
</html>
  </initial_response>

  <request_1>
    Method: POST
    Path: /add_note
    Body:
    {
      "new_note_title": "Draft kickoff deck",
      "notes_data": "[]"
    }
  </request_1>

  <response_1>
<!DOCTYPE html>
<html>
  <body>
    <h1>Team Notes</h1>
    <ul>
      <li data-note-id="1">Draft kickoff deck</li>
    </ul>
    <form action="/add_note" method="POST">
      <input type="hidden" name="notes_data" value='[{"id":1,"title":"Draft kickoff deck"}]'>
      <input type="text" name="new_note_title" placeholder="Add a note">
      <button type="submit">Add</button>
    </form>
    <form action="/edit_note" method="POST">
      <input type="hidden" name="notes_data" value='[{"id":1,"title":"Draft kickoff deck"}]'>
      <input type="hidden" name="note_id" value="1">
      <input type="text" name="new_title" value="Draft kickoff deck">
      <button type="submit">Save changes</button>
    </form>
    <form action="/delete_note" method="POST">
      <input type="hidden" name="notes_data" value='[{"id":1,"title":"Draft kickoff deck"}]'>
      <input type="hidden" name="note_id" value="1">
      <button type="submit">Delete note</button>
    </form>
    <!--serve-llm-state:{"lastInteraction":"added"}-->
  </body>
</html>
  </response_1>

  <request_2>
    Method: POST
    Path: /edit_note
    Body:
    {
      "note_id": "1",
      "new_title": "Draft kickoff deck v2",
      "notes_data": "[{\"id\":1,\"title\":\"Draft kickoff deck\"}]"
    }
  </request_2>

  <response_2>
<!DOCTYPE html>
<html>
  <body>
    <h1>Team Notes</h1>
    <ul>
      <li data-note-id="1">Draft kickoff deck v2</li>
    </ul>
    <form action="/add_note" method="POST">
      <input type="hidden" name="notes_data" value='[{"id":1,"title":"Draft kickoff deck v2"}]'>
      <input type="text" name="new_note_title" placeholder="Add a note">
      <button type="submit">Add</button>
    </form>
    <form action="/edit_note" method="POST">
      <input type="hidden" name="notes_data" value='[{"id":1,"title":"Draft kickoff deck v2"}]'>
      <input type="hidden" name="note_id" value="1">
      <input type="text" name="new_title" value="Draft kickoff deck v2">
      <button type="submit">Save changes</button>
    </form>
    <form action="/delete_note" method="POST">
      <input type="hidden" name="notes_data" value='[{"id":1,"title":"Draft kickoff deck v2"}]'>
      <input type="hidden" name="note_id" value="1">
      <button type="submit">Delete note</button>
    </form>
    <!--serve-llm-state:{"lastInteraction":"edited"}-->
  </body>
</html>
  </response_2>

  <request_3>
    Method: POST
    Path: /delete_note
    Body:
    {
      "note_id": "1",
      "notes_data": "[{\"id\":1,\"title\":\"Draft kickoff deck v2\"}]"
    }
  </request_3>

  <response_3>
<!DOCTYPE html>
<html>
  <body>
    <h1>Team Notes</h1>
    <ul>
      <li>No notes yet — add a fresh one.</li>
    </ul>
    <form action="/add_note" method="POST">
      <input type="hidden" name="notes_data" value='[]'>
      <input type="text" name="new_note_title" placeholder="Add a note">
      <button type="submit">Add</button>
    </form>
    <!--serve-llm-state:{"lastInteraction":"deleted"}-->
  </body>
</html>
  </response_3>
</flow_example>

Checklist
1. Parse the previous state from hidden inputs and comment blocks.
2. Compute the new application state from the current request.
3. Render the full HTML using only the new state.
4. Persist the updated state in every form/comment so the next request remains consistent.
5. Maintain the iteration panel and admin access guidance when required.
`;

  const iterationPanelSection = includeInstructionPanel
    ? `<iteration_panel>
- Provide a floating instructions panel pinned to the lower-right with a collapse/expand toggle. Collapsed state shows a single button; expanded state reveals the form.
- The form MUST POST using the field name "LLM_WEB_SERVER_INSTRUCTIONS" while preserving all other necessary state.
- When a request includes that field, re-render the same page with the requested changes applied and show an acknowledgement inside the panel.
- Include a clearly labeled "Admin Panel" link pointing to "{{ADMIN_ROUTE}}" within the panel.
</iteration_panel>`
    : `<iteration_panel>
Mention that configuration and history are available at "{{ADMIN_ROUTE}}" when it helps the user.
</iteration_panel>`;

  const system = systemPromptTemplate
    .replace("{{INSTRUCTION_PANEL_SECTION}}", iterationPanelSection)
    .replaceAll("{{ADMIN_ROUTE}}", adminPath);

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

  const user = [
    `App Brief:\n${brief}`,
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
    "-----END PREVIOUS HTML-----",
    "",
    historySection,
    "",
    "Remember:",
    "- Render ONLY the current view as a full document.",
    "- Include inline CSS/JS. No external dependencies.",
    "- Align the response with the requested path AND parameters by inferring which link or form was activated in the previous HTML and how its fields map to the submitted values.",
    "- If you need to carry state forward, include it in forms or query strings you output NOW. This includes historical state that's been forwarded to you and needs to be retained.",
    "- For complex state that should persist invisibly, store it in HTML comments and preserve any comment-based state from the previous HTML, even if you don't need it for the current view.",
    "- Provide clear primary actions (CTAs) and show the user what to do next.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
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
    requestLines.push(
      `Provider: ${entry.llm.provider} (${entry.llm.model})`,
      `Max Output Tokens: ${entry.llm.maxOutputTokens}`,
      `Reasoning Mode: ${entry.llm.reasoningMode}`,
      `Reasoning Tokens: ${entry.llm.reasoningTokens ?? "n/a"}`
    );

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
