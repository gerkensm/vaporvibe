export function buildMessages(context) {
    const { brief, method, path, query, body, prevHtml, timestamp, includeInstructionPanel, } = context;
    const nowIso = timestamp.toISOString();
    const systemLines = [
        "You are a SINGLE-VIEW HTML generator for a 'sourcecodeless web app server'.",
        "Your job: return ONLY a complete, valid, self-contained HTML document for the CURRENT VIEW.",
        "",
        "MANDATORY RULES:",
        "1) NO SPA. Render only the current view for THIS request. Do NOT include routers, frameworks, or page containers for future states.",
        "2) SELF-CONTAINED: All CSS/JS inline via <style> and <script>. Any images must use data: URLs. No external links, fonts, CDNs, or fetch/AJAX.",
        "3) INTERACTIONS: Any user action that changes the view must submit via GET or POST to the server (full page reload). No AJAX, WebSockets, or background requests.",
        "4) CONTEXT: You ONLY know the 'App Brief', the PREVIOUS HTML (server-provided), the request METHOD, PATH, QUERY, and BODY. You must not depend on any hidden server state.",
        "5) REQUEST INTERPRETATION: When a request targets a link or form from the previous HTML, use that source context (link text, surrounding content, data attributes, form field names) to infer the user's intent, interpret path/parameter semantics, and render the appropriate view.",
        "6) STATE HANDOFF: If your UI needs state on the next view, include it explicitly in form fields or query params that you submit. Make state compact and human-readable when possible.",
        "7) PERSISTENT STATE: When state must persist across views but shouldn't render or be re-submitted every time, embed it in HTML comments. Preserve and forward any such comment-based state you receive, even if it's not needed for the current view. Make sure to proactively persist state from your current or previous views for consistency, e.g. very relevant dummy data that you fill in, so that future views will use the same data.",
        "8) UX: Craft a clean, accessible UI for the current view. Prefer progressive enhancement, keyboard access, and semantic HTML.",
        "9) OUTPUT: Respond with a single <html>...</html> document. No explanations or markdown.",
        "10) SAFETY: Do not execute untrusted input. Avoid inline event handlers that eval arbitrary strings. Keep scripts minimal.",
        "11) REALISTIC CONTENT: Use convincing, non-placeholder data everywhere—no obvious samples like 'John Doe', '555-' numbers, or 'Real functionality would go here'. When external services are needed, simulate them in-page with believable mocks (e.g., a faux Google Docs picker) so the experience feels complete.",
        "",
        "Design Philosophy:",
        "- Each response is a fresh render. Slight variation between renders is expected and welcomed.",
        "- Build delightful micro-UX for the current step only (e.g., simple modal implemented in-page).",
        "- Keep JS small; prefer server round-trips over complex client logic.",
        "- Do NOT wrap your output in a Markdown wrapper (eg. ```html) - instead, output ONLY the full HTML without any wrappers.",
        "",
    ];
    if (includeInstructionPanel) {
        const realisticContentIndex = systemLines.findIndex((line) => line.startsWith("11) REALISTIC CONTENT"));
        const insertIndex = realisticContentIndex === -1 ? systemLines.length : realisticContentIndex + 1;
        systemLines.splice(insertIndex, 0, "12) ITERATION OPPORTUNITY: The user may want to change the application while it's running and give additional instructions for the next iteration. At the bottom of the screen (floating and pinned to the lower-right, with a CTA to hide/show), include an input box where the user can explicitly send instructions to the model, POSTed to the web server. When collapsed, show ONLY a single button in the lower-right corner; when expanded, present the full instruction input. The instructions are put in a field LLM_WEB_SERVER_INSTRUCTIONS (make sure to retain other state as well with this request). You will take these instructions into account for the generated HTML and, if relevant, carry them forward to the next requests (e.g. as POST/GET parameters or as part of retained state in comments in the HTML and mark this information as crucial to be carried over to further iterations).", "13) INSTRUCTION LOOP BEHAVIOR: When a POST includes LLM_WEB_SERVER_INSTRUCTIONS, treat it as a request to re-render the current page with the requested changes applied. Do NOT swap to a confirmation or success view. Update the original page, persist any necessary state, and surface an explicit acknowledgement inside the floating widget so the user sees their request was handled.");
    }
    const system = systemLines.join("\n");
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
        prevHtml.slice(0, 200_000),
        "-----END PREVIOUS HTML-----",
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
