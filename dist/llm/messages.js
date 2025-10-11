const LINE_DIVIDER = "----------------------------------------";
export function buildMessages(context) {
    const { brief, method, path, query, body, prevHtml, timestamp, includeInstructionPanel, history, historyTotal, historyLimit, historyMaxBytes, historyBytesUsed, historyLimitOmitted, historyByteOmitted, adminPath, } = context;
    const nowIso = timestamp.toISOString();
    const systemLines = [
        "You are a SINGLE-VIEW HTML generator for a 'sourcecodeless web app server'.",
        "Your job: return ONLY a complete, valid, self-contained HTML document for the CURRENT VIEW.",
        "",
        "MANDATORY RULES:",
        "1) NO SPA ROUTING. Each server round-trip takes ~1-2 minutes, so render only the current view for THIS request. Inline JS may power in-view micro-interactions on already-present data, but do NOT include routers, background fetches, or page containers for future states.",
        "2) SELF-CONTAINED: All CSS/JS inline via <style> and <script>. No external links, fonts, CDNs, fetch/AJAX, iframes, popups, or target=\"_blank\" links. Avoid pixel images entirely (even via data URLs); use inline SVG or CSS for visuals.",
        "3) INTERACTIONS: Any user action that changes the view—including clicking a link to another page—must submit via GET or POST to the server (full page reload). Every navigation inherits the ~1-2 minute server round-trip latency, so reserve it for changes that truly need the server. No AJAX, WebSockets, or background requests.",
        "3a) LOCAL INTERACTIONS: When the user is just exploring or rearranging data already delivered in THIS HTML (e.g., opening a note from the current list, switching tabs, toggling filters), handle it with inline JS and DOM updates without sending another request. Only hit the server when new authoritative data is required or you must persist changes.",
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
        "- Shorter markup trims transfer time a bit, but prioritize a high-quality, comprehensible result over hyper-minifying the HTML.",
        "- Keep JS purposeful and lightweight—let inline scripts handle in-view exploration of known data, and only trigger a server round-trip when you need fresh authoritative state or to persist changes.",
        "- If multiple items are visible (like a list of notes), make them feel instant: swap the primary view client-side and reserve form submissions for saving edits or loading unseen data.",
        "- Do NOT wrap your output in a Markdown wrapper (eg. ```html) - instead, output ONLY the full HTML without any wrappers.",
        "",
    ];
    const realisticContentIndex = systemLines.findIndex((line) => line.startsWith("11) REALISTIC CONTENT"));
    const insertIndex = realisticContentIndex === -1 ? systemLines.length : realisticContentIndex + 1;
    const iterationLines = [
        "12) INSTRUCTION LOOP: When a request includes the field LLM_WEB_SERVER_INSTRUCTIONS, treat it as an iteration cue for THIS view. Re-render the same page with the requested adjustments applied, persist any required state, and avoid swapping to standalone success/confirmation screens.",
    ];
    if (includeInstructionPanel) {
        iterationLines.push("13) RUNTIME PANEL: The server injects the floating instructions widget—do not render your own version or duplicate its controls.", `14) ADMIN ACCESS: If it aids orientation, mention that configuration and history live at "${adminPath}".`);
    }
    else {
        iterationLines.push(`13) ADMIN ACCESS: Mention that configuration and history are available at "${adminPath}" when it helps the user.`);
    }
    systemLines.splice(insertIndex, 0, ...iterationLines);
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
    const prevHtmlSnippet = historyMaxBytes > 0 ? prevHtml.slice(0, historyMaxBytes) : prevHtml;
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
function buildHistorySection(options) {
    const { history, historyTotal, historyLimit, historyMaxBytes, historyBytesUsed, historyLimitOmitted, historyByteOmitted, } = options;
    if (history.length === 0) {
        return "History: No previous pages for this session yet.";
    }
    const budgetLabel = historyMaxBytes > 0 ? `${historyMaxBytes} bytes` : "unbounded";
    const omittedTotal = historyLimitOmitted + historyByteOmitted;
    const introParts = [
        "History (oldest first)",
        `showing ${history.length} of ${historyTotal} entries`,
        `configured limit ${historyLimit}`,
        `byte budget ${budgetLabel}`,
        `~${historyBytesUsed} bytes included`,
    ];
    if (omittedTotal > 0) {
        const omissionDetails = [];
        if (historyLimitOmitted > 0) {
            omissionDetails.push(`${historyLimitOmitted} via entry limit`);
        }
        if (historyByteOmitted > 0) {
            omissionDetails.push(`${historyByteOmitted} via byte budget`);
        }
        introParts.push(`omitted ${omissionDetails.join(", ")}`);
    }
    const intro = [
        `${introParts.join(" / ")}:`,
        LINE_DIVIDER,
    ];
    const entries = history.map((entry, index) => {
        const indexLabel = `Entry ${index + 1} — ${entry.request.method} ${entry.request.path}`;
        const requestLines = [
            `Timestamp: ${entry.createdAt}`,
            `Session: ${entry.sessionId}`,
            `Duration: ${entry.durationMs} ms`,
            `Query Params (JSON): ${JSON.stringify(entry.request.query ?? {}, null, 2)}`,
            `Body Params (JSON): ${JSON.stringify(entry.request.body ?? {}, null, 2)}`,
        ];
        if (entry.request.instructions) {
            requestLines.push(`Instructions: ${entry.request.instructions}`);
        }
        requestLines.push(`Provider: ${entry.llm.provider} (${entry.llm.model})`, `Max Output Tokens: ${entry.llm.maxOutputTokens}`, `Reasoning Mode: ${entry.llm.reasoningMode}`, `Reasoning Tokens: ${entry.llm.reasoningTokens ?? "n/a"}`);
        if (entry.usage) {
            requestLines.push(`Usage Metrics: ${JSON.stringify(entry.usage, null, 2)}`);
        }
        if (entry.reasoning?.summaries || entry.reasoning?.details) {
            const reasoningLines = [];
            if (entry.reasoning.summaries?.length) {
                reasoningLines.push(`Reasoning Summaries:\n${entry.reasoning.summaries.join("\n\n")}`);
            }
            if (entry.reasoning.details?.length) {
                reasoningLines.push(`Reasoning Details:\n${entry.reasoning.details.join("\n\n")}`);
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
