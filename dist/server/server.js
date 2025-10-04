import http from "node:http";
import { URL } from "node:url";
import { AUTO_IGNORED_PATHS, BRIEF_FORM_ROUTE } from "../constants.js";
import { buildMessages } from "../llm/messages.js";
import { parseCookies } from "../utils/cookies.js";
import { readBody } from "../utils/body.js";
import { ensureHtmlDocument, escapeHtml } from "../utils/html.js";
import { renderPromptRequestPage } from "../pages/prompt-request.js";
import { logger } from "../logger.js";
export function createServer(options) {
    const { runtime, llmClient, sessionStore } = options;
    const state = {
        brief: runtime.brief?.trim() || null,
    };
    return http.createServer(async (req, res) => {
        const requestStart = Date.now();
        const context = buildContext(req, res);
        const reqLogger = logger.child({ method: context.method, path: context.path });
        reqLogger.info(`Incoming request ${context.method} ${context.path} from ${req.socket.remoteAddress ?? "unknown"}`);
        if (shouldEarly404(context)) {
            reqLogger.warn(`Auto-ignored path ${context.url.href}`);
            res.statusCode = 404;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end("Not Found");
            return;
        }
        try {
            if (!state.brief) {
                await handleBriefSetup(context, state, reqLogger);
                reqLogger.info(`Completed with status ${res.statusCode} in ${Date.now() - requestStart} ms`);
                return;
            }
            await handleLlmRequest(context, state.brief, llmClient, sessionStore, runtime.includeInstructionPanel, reqLogger);
            reqLogger.info(`Completed with status ${res.statusCode} in ${Date.now() - requestStart} ms`);
        }
        catch (error) {
            const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
            reqLogger.error(`Request handling failed: ${message}`);
            res.statusCode = 500;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(renderErrorPage(error));
            reqLogger.warn(`Completed with error status ${res.statusCode} in ${Date.now() - requestStart} ms`);
        }
    });
}
function buildContext(req, res) {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const method = (req.method ?? "GET").toUpperCase();
    return {
        req,
        res,
        url,
        method,
        path: url.pathname,
    };
}
function shouldEarly404(context) {
    const { method, path } = context;
    if (method !== "GET" && method !== "HEAD") {
        return false;
    }
    if (AUTO_IGNORED_PATHS.has(path)) {
        return true;
    }
    if (path.endsWith(".ico"))
        return true;
    if (path.endsWith(".png") && path.includes("apple-touch"))
        return true;
    if (path.endsWith(".webmanifest"))
        return true;
    return false;
}
async function handleBriefSetup(context, state, reqLogger) {
    const { method, path, req, res } = context;
    if (method === "POST" && path === BRIEF_FORM_ROUTE) {
        const body = await readBody(req);
        const briefValue = typeof body.data.brief === "string" ? body.data.brief.trim() : "";
        reqLogger.debug(formatJsonForLog(body.data, "Brief submission"));
        if (!briefValue) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(renderPromptRequestPage());
            reqLogger.warn({ status: res.statusCode }, "Rejected brief submission due to empty brief");
            return;
        }
        state.brief = briefValue;
        reqLogger.info("Stored new application brief from prompt page");
        res.statusCode = 302;
        res.setHeader("Location", "/");
        res.end();
        return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(renderPromptRequestPage());
    reqLogger.debug("Served brief configuration page");
}
async function handleLlmRequest(context, brief, llmClient, sessionStore, includeInstructionPanel, reqLogger) {
    const { req, res, url, method, path } = context;
    const cookies = parseCookies(req.headers.cookie);
    const sid = sessionStore.getOrCreateSessionId(cookies, res);
    const query = Object.fromEntries(url.searchParams.entries());
    if (Object.keys(query).length > 0) {
        reqLogger.debug(formatJsonForLog(query, "Query parameters"));
    }
    let bodyData = {};
    if (method === "POST" || method === "PUT" || method === "PATCH") {
        const parsed = await readBody(req);
        bodyData = parsed.data ?? {};
        if (parsed.raw) {
            reqLogger.debug(formatJsonForLog(bodyData, "Request body"));
        }
    }
    const prevHtml = sessionStore.getPrevHtml(sid);
    const messages = buildMessages({
        brief,
        method,
        path,
        query,
        body: bodyData,
        prevHtml,
        timestamp: new Date(),
        includeInstructionPanel,
    });
    reqLogger.debug(`LLM prompt:\n${formatMessagesForLog(messages)}`);
    const html = await llmClient.generateHtml(messages);
    reqLogger.debug(`LLM response preview [${llmClient.settings.provider}]:\n${truncate(html, 500)}`);
    const safeHtml = ensureHtmlDocument(html, { method, path });
    sessionStore.setPrevHtml(sid, safeHtml);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(safeHtml);
}
function renderErrorPage(error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>500 - Server Error</title>
<style>
  body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; }
  main { max-width: 840px; margin: 10vh auto; padding: 32px; background: rgba(15, 23, 42, 0.7); border-radius: 18px; box-shadow: 0 24px 40px rgba(15, 23, 42, 0.45); backdrop-filter: blur(10px); }
  h1 { margin-top: 0; font-size: 1.8rem; }
  pre { background: rgba(8, 47, 73, 0.65); padding: 16px 20px; border-radius: 12px; line-height: 1.45; overflow-x: auto; }
  a { color: #38bdf8; }
</style>
</head>
<body>
  <main>
    <h1>Something went wrong</h1>
    <p>The server failed while generating the latest view. You can retry the last action or reload from the home page.</p>
    <pre>${escapeHtml(message)}</pre>
    <form method="get" action="/">
      <button type="submit">Back to safety</button>
    </form>
  </main>
</body>
</html>`;
}
function truncate(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength)}…`;
}
function formatMessagesForLog(messages) {
    return messages
        .map((message) => {
        const preview = truncate(message.content, 1_000);
        return `[${message.role.toUpperCase()}]\n${preview}`;
    })
        .join("\n\n");
}
function formatJsonForLog(payload, label) {
    const prefix = label ? `${label}:\n` : "";
    try {
        return `${prefix}${JSON.stringify(payload, null, 2)}`;
    }
    catch {
        return `${prefix}${String(payload)}`;
    }
}
