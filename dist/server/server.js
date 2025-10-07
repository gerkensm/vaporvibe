import http from "node:http";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";
import { ADMIN_ROUTE_PREFIX, AUTO_IGNORED_PATHS, BRIEF_FORM_ROUTE, INSTRUCTIONS_FIELD, SETUP_ROUTE, SETUP_VERIFY_ROUTE, DEFAULT_OPENAI_MODEL, DEFAULT_GEMINI_MODEL, DEFAULT_ANTHROPIC_MODEL, DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS, DEFAULT_REASONING_TOKENS, LLM_RESULT_ROUTE_PREFIX, } from "../constants.js";
import { buildMessages } from "../llm/messages.js";
import { parseCookies } from "../utils/cookies.js";
import { readBody } from "../utils/body.js";
import { ensureHtmlDocument, escapeHtml } from "../utils/html.js";
import { renderSetupWizardPage } from "../pages/setup-wizard.js";
import { renderLoadingShell, renderResultHydrationScript, renderLoaderErrorScript } from "../pages/loading-shell.js";
import { logger } from "../logger.js";
import { AdminController } from "./admin-controller.js";
import { verifyProviderApiKey } from "../llm/verification.js";
import { createLlmClient } from "../llm/factory.js";
const PENDING_HTML_TTL_MS = 3 * 60 * 1000;
export function createServer(options) {
    const { runtime, provider, providerLocked, llmClient, sessionStore } = options;
    const runtimeState = { ...runtime };
    const providerState = { ...provider };
    const state = {
        brief: runtimeState.brief?.trim() || null,
        runtime: runtimeState,
        provider: providerState,
        llmClient,
        providerReady: Boolean(llmClient && providerState.apiKey && providerState.apiKey.trim().length > 0),
        providerLocked,
        pendingHtml: new Map(),
    };
    const adminController = new AdminController({
        state,
        sessionStore,
    });
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
            if (handlePendingHtmlRequest(context, state, reqLogger)) {
                reqLogger.info(`Pending render delivered with status ${res.statusCode} in ${Date.now() - requestStart} ms`);
                return;
            }
            if (!state.providerReady || !state.brief || isSetupRequest(context.path)) {
                await handleSetupFlow(context, state, reqLogger);
                reqLogger.info(`Setup flow completed with status ${res.statusCode} in ${Date.now() - requestStart} ms`);
                return;
            }
            if (context.path.startsWith(ADMIN_ROUTE_PREFIX)) {
                const handled = await adminController.handle(context, requestStart, reqLogger);
                if (handled) {
                    reqLogger.info(`Admin route completed with status ${res.statusCode} in ${Date.now() - requestStart} ms`);
                    return;
                }
            }
            await handleLlmRequest(context, state, sessionStore, reqLogger, requestStart);
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
function isSetupRequest(path) {
    if (path.startsWith(SETUP_ROUTE)) {
        return true;
    }
    if (path === SETUP_VERIFY_ROUTE) {
        return true;
    }
    if (path === BRIEF_FORM_ROUTE) {
        return true;
    }
    return false;
}
async function handleSetupFlow(context, state, reqLogger) {
    const { method, path, req, res, url } = context;
    let providerLabel = getProviderLabel(state.provider.provider);
    let providerName = providerLabel;
    const verifyAction = SETUP_VERIFY_ROUTE;
    const briefAction = BRIEF_FORM_ROUTE;
    const canSelectProvider = !state.providerLocked;
    let selectedProvider = state.provider.provider;
    if (method === "POST" && path === SETUP_VERIFY_ROUTE) {
        const body = await readBody(req);
        const apiKey = typeof body.data.apiKey === "string" ? body.data.apiKey.trim() : "";
        let submittedModel = typeof body.data.model === "string" ? body.data.model.trim() : "";
        if (canSelectProvider) {
            const submittedProvider = parseProviderValue(body.data.provider);
            if (!submittedProvider) {
                const html = renderSetupWizardPage({
                    step: "provider",
                    providerLabel,
                    providerName,
                    verifyAction,
                    briefAction,
                    setupPath: SETUP_ROUTE,
                    adminPath: ADMIN_ROUTE_PREFIX,
                    providerReady: state.providerReady,
                    canSelectProvider,
                    selectedProvider,
                    selectedModel: submittedModel || state.provider.model || "",
                    maxOutputTokens: state.provider.maxOutputTokens,
                    reasoningMode: state.provider.reasoningMode ?? "none",
                    reasoningTokens: getEffectiveReasoningTokens(state.provider),
                    errorMessage: "Choose a provider before adding an API key.",
                });
                res.statusCode = 400;
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.end(html);
                return;
            }
            if (submittedProvider !== state.provider.provider) {
                updateProviderSelection(state, submittedProvider, reqLogger);
                providerLabel = getProviderLabel(state.provider.provider);
                providerName = providerLabel;
                selectedProvider = state.provider.provider;
            }
            else {
                selectedProvider = submittedProvider;
            }
        }
        if (!submittedModel) {
            submittedModel = state.provider.model || "";
        }
        let submittedMaxTokens;
        try {
            submittedMaxTokens = parsePositiveInt(body.data.maxOutputTokens, state.provider.maxOutputTokens);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Max output tokens must be a positive integer.";
            const html = renderSetupWizardPage({
                step: "provider",
                providerLabel,
                providerName,
                verifyAction,
                briefAction,
                setupPath: SETUP_ROUTE,
                adminPath: ADMIN_ROUTE_PREFIX,
                providerReady: state.providerReady,
                canSelectProvider,
                selectedProvider,
                selectedModel: submittedModel,
                maxOutputTokens: state.provider.maxOutputTokens,
                reasoningMode: state.provider.reasoningMode ?? "none",
                reasoningTokens: getEffectiveReasoningTokens(state.provider),
                errorMessage: message,
            });
            res.statusCode = 400;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
            return;
        }
        const supportsMode = providerSupportsReasoningMode(state.provider.provider);
        const supportsTokens = providerSupportsReasoningTokens(state.provider.provider);
        let submittedReasoningMode = supportsMode
            ? sanitizeReasoningModeValue(body.data.reasoningMode, state.provider.reasoningMode ?? "none")
            : "none";
        let submittedReasoningTokens;
        if (supportsTokens) {
            try {
                submittedReasoningTokens = parseReasoningTokensInput(body.data.reasoningTokens, state.provider.provider);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Reasoning tokens must be valid for the selected provider.";
                const html = renderSetupWizardPage({
                    step: "provider",
                    providerLabel,
                    providerName,
                    verifyAction,
                    briefAction,
                    setupPath: SETUP_ROUTE,
                    adminPath: ADMIN_ROUTE_PREFIX,
                    providerReady: state.providerReady,
                    canSelectProvider,
                    selectedProvider,
                    selectedModel: submittedModel,
                    maxOutputTokens: state.provider.maxOutputTokens,
                    reasoningMode: state.provider.reasoningMode ?? "none",
                    reasoningTokens: getEffectiveReasoningTokens(state.provider),
                    errorMessage: message,
                });
                res.statusCode = 400;
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.end(html);
                return;
            }
        }
        let adjustedReasoningTokens = supportsTokens ? submittedReasoningTokens : undefined;
        if (state.provider.provider === "anthropic") {
            if (typeof adjustedReasoningTokens === "number") {
                adjustedReasoningTokens = Math.min(adjustedReasoningTokens, DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS);
            }
            else {
                adjustedReasoningTokens = DEFAULT_REASONING_TOKENS.anthropic;
            }
        }
        else if (state.provider.provider === "gemini") {
            if (typeof adjustedReasoningTokens !== "number") {
                adjustedReasoningTokens = DEFAULT_REASONING_TOKENS.gemini;
            }
        }
        state.provider.maxOutputTokens = submittedMaxTokens;
        state.provider.reasoningMode = submittedReasoningMode;
        state.provider.reasoningTokens = adjustedReasoningTokens;
        state.provider.model = submittedModel;
        reqLogger.debug({ provider: state.provider.provider }, "Setup wizard verifying API key");
        const verification = await verifyProviderApiKey(state.provider.provider, apiKey);
        if (verification.ok) {
            try {
                state.provider.apiKey = apiKey;
                applyProviderEnv(state.provider);
                state.llmClient = createLlmClient(state.provider);
                state.providerReady = true;
                reqLogger.info({ provider: state.provider.provider }, "API key verified via setup wizard");
                res.statusCode = 303;
                const redirectTarget = state.brief
                    ? `${ADMIN_ROUTE_PREFIX}?status=Setup%20complete`
                    : `${SETUP_ROUTE}?step=brief&status=API%20key%20verified`;
                res.setHeader("Location", redirectTarget);
                res.end();
                return;
            }
            catch (error) {
                reqLogger.error({ err: error }, "Failed to instantiate LLM client after verification");
                state.providerReady = false;
                state.provider.apiKey = "";
                const message = error instanceof Error ? error.message : String(error);
                const html = renderSetupWizardPage({
                    step: "provider",
                    providerLabel,
                    providerName,
                    verifyAction,
                    briefAction,
                    setupPath: SETUP_ROUTE,
                    adminPath: ADMIN_ROUTE_PREFIX,
                    providerReady: false,
                    canSelectProvider,
                    selectedProvider,
                    selectedModel: state.provider.model || "",
                    maxOutputTokens: state.provider.maxOutputTokens,
                    reasoningMode: state.provider.reasoningMode ?? "none",
                    reasoningTokens: getEffectiveReasoningTokens(state.provider),
                    errorMessage: `Unable to configure provider: ${message}`,
                });
                res.statusCode = 500;
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.end(html);
                return;
            }
        }
        reqLogger.warn({ provider: state.provider.provider }, `API key verification failed: ${verification.message ?? "unknown error"}`);
        const html = renderSetupWizardPage({
            step: "provider",
            providerLabel,
            providerName,
            verifyAction,
            briefAction,
            setupPath: SETUP_ROUTE,
            adminPath: ADMIN_ROUTE_PREFIX,
            providerReady: state.providerReady,
            canSelectProvider,
            selectedProvider,
            selectedModel: state.provider.model || "",
            maxOutputTokens: state.provider.maxOutputTokens,
            reasoningMode: state.provider.reasoningMode ?? "none",
            reasoningTokens: getEffectiveReasoningTokens(state.provider),
            errorMessage: verification.message ?? "We could not verify that key. Please try again.",
        });
        res.statusCode = 400;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
        return;
    }
    if (method === "POST" && path === BRIEF_FORM_ROUTE) {
        const body = await readBody(req);
        const briefValue = typeof body.data.brief === "string" ? body.data.brief.trim() : "";
        reqLogger.debug(formatJsonForLog(body.data, "Brief submission"));
        if (!state.providerReady) {
            res.statusCode = 303;
            res.setHeader("Location", `${SETUP_ROUTE}?step=provider`);
            res.end();
            return;
        }
        if (!briefValue) {
            const html = renderSetupWizardPage({
                step: "brief",
                providerLabel,
                providerName,
                verifyAction,
                briefAction,
                setupPath: SETUP_ROUTE,
                adminPath: ADMIN_ROUTE_PREFIX,
                providerReady: state.providerReady,
                canSelectProvider,
                selectedProvider,
                selectedModel: state.provider.model || "",
                maxOutputTokens: state.provider.maxOutputTokens,
                reasoningMode: state.provider.reasoningMode ?? "none",
                reasoningTokens: getEffectiveReasoningTokens(state.provider),
                errorMessage: "Add a short brief so we know where to begin.",
                briefValue: "",
            });
            res.statusCode = 400;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
            reqLogger.warn({ status: res.statusCode }, "Rejected brief submission due to empty brief");
            return;
        }
        state.brief = briefValue;
        state.runtime.brief = briefValue;
        reqLogger.info("Stored new application brief from prompt page");
        const adminUrl = escapeHtml(ADMIN_ROUTE_PREFIX);
        const appUrl = escapeHtml("/");
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Redirecting…</title>
  <style>
    :root {
      color-scheme: light;
      font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f6f8fb;
      color: #0f172a;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 48px 24px;
    }
    main {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 32px;
      max-width: 420px;
      box-shadow: 0 24px 48px rgba(15, 23, 42, 0.12);
      text-align: center;
    }
    h1 {
      margin: 0 0 16px;
      font-size: 1.4rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    p {
      margin: 12px 0 0;
      line-height: 1.6;
      color: #475569;
    }
    .actions {
      margin-top: 24px;
      display: grid;
      gap: 12px;
    }
    a {
      color: #1d4ed8;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .primary {
      display: inline-block;
      padding: 10px 18px;
      border-radius: 12px;
      background: linear-gradient(135deg, #1d4ed8, #1e3a8a);
      color: #f8fafc;
      font-weight: 600;
      box-shadow: 0 16px 28px rgba(29, 78, 216, 0.18);
    }
  </style>
  <script>
    window.addEventListener("load", () => {
      try {
        const opened = window.open("${appUrl}", "_blank", "noopener");
        if (!opened) {
          console.warn("Popup blocked while opening application view");
        }
      } catch (error) {
        console.warn("Failed to open application view", error);
      }
      window.location.replace("${adminUrl}");
    });
  </script>
</head>
<body>
  <main>
    <h1>Setting things up…</h1>
    <p>We are opening your experience in a new tab and guiding this window to the admin console.</p>
    <div class="actions">
      <a class="primary" href="${appUrl}" target="_blank" rel="noopener">Open app manually</a>
      <a href="${adminUrl}">Go to admin dashboard</a>
    </div>
  </main>
</body>
</html>`;
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
        return;
    }
    if (state.providerReady && state.brief && path.startsWith(SETUP_ROUTE)) {
        res.statusCode = 303;
        res.setHeader("Location", ADMIN_ROUTE_PREFIX);
        res.end();
        return;
    }
    const requestedStep = url.searchParams.get("step");
    let step;
    if (!state.providerReady) {
        step = "provider";
    }
    else if (!state.brief) {
        step = requestedStep === "provider" ? "provider" : "brief";
    }
    else {
        step = requestedStep === "provider" ? "provider" : "brief";
    }
    if (state.providerReady && state.brief && !requestedStep && path === SETUP_ROUTE) {
        res.statusCode = 303;
        res.setHeader("Location", ADMIN_ROUTE_PREFIX);
        res.end();
        return;
    }
    const html = renderSetupWizardPage({
        step,
        providerLabel,
        providerName,
        verifyAction,
        briefAction,
        setupPath: SETUP_ROUTE,
        adminPath: ADMIN_ROUTE_PREFIX,
        providerReady: state.providerReady,
        canSelectProvider,
        selectedProvider,
        selectedModel: state.provider.model || "",
        maxOutputTokens: state.provider.maxOutputTokens,
        reasoningMode: state.provider.reasoningMode ?? "none",
        reasoningTokens: getEffectiveReasoningTokens(state.provider),
        statusMessage: url.searchParams.get("status") ?? undefined,
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
    reqLogger.debug({ step }, "Served setup wizard page");
}
function cleanupPendingHtml(state) {
    const now = Date.now();
    for (const [token, entry] of state.pendingHtml.entries()) {
        if (entry.expiresAt <= now) {
            state.pendingHtml.delete(token);
        }
    }
}
async function handleLlmRequest(context, state, sessionStore, reqLogger, requestStart) {
    const { req, res, url, method, path } = context;
    const llmClient = state.llmClient;
    if (!llmClient) {
        throw new Error("LLM client not configured");
    }
    const originalPath = `${url.pathname}${url.search}`;
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
    const fullHistory = sessionStore.getHistory(sid);
    const historyLimit = Math.max(1, state.runtime.historyLimit);
    const limitedHistory = historyLimit >= fullHistory.length ? fullHistory : fullHistory.slice(-historyLimit);
    const limitOmitted = fullHistory.length - limitedHistory.length;
    const selection = selectHistoryForPrompt(limitedHistory, state.runtime.historyMaxBytes);
    const historyForPrompt = selection.entries;
    const byteOmitted = limitedHistory.length - historyForPrompt.length;
    const prevHtml = historyForPrompt.at(-1)?.response.html ?? limitedHistory.at(-1)?.response.html ?? sessionStore.getPrevHtml(sid);
    reqLogger.debug({
        historyTotal: fullHistory.length,
        historyLimit,
        historyIncluded: historyForPrompt.length,
        historyBytesUsed: selection.bytes,
        historyLimitOmitted: limitOmitted,
        historyByteOmitted: byteOmitted,
        historyMaxBytes: state.runtime.historyMaxBytes,
    }, "History context prepared");
    const messages = buildMessages({
        brief: state.brief ?? "",
        method,
        path,
        query,
        body: bodyData,
        prevHtml,
        timestamp: new Date(),
        includeInstructionPanel: state.runtime.includeInstructionPanel,
        history: historyForPrompt,
        historyTotal: fullHistory.length,
        historyLimit,
        historyMaxBytes: state.runtime.historyMaxBytes,
        historyBytesUsed: selection.bytes,
        historyLimitOmitted: limitOmitted,
        historyByteOmitted: byteOmitted,
        adminPath: ADMIN_ROUTE_PREFIX,
    });
    reqLogger.debug(`LLM prompt:\n${formatMessagesForLog(messages)}`);
    const shouldStreamBody = method !== "HEAD";
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (shouldStreamBody) {
        const providerLabel = getProviderLabel(llmClient.settings.provider);
        const loadingMessage = `Asking ${providerLabel} (${llmClient.settings.model}) to refresh this page.`;
        res.write(renderLoadingShell({
            message: loadingMessage,
            originalPath,
            resultRoutePrefix: LLM_RESULT_ROUTE_PREFIX,
        }));
        if (typeof res.flushHeaders === "function") {
            res.flushHeaders();
        }
    }
    try {
        const result = await llmClient.generateHtml(messages);
        const durationMs = Date.now() - requestStart;
        reqLogger.debug(`LLM response preview [${llmClient.settings.provider}]:\n${truncate(result.html, 500)}`);
        const safeHtml = ensureHtmlDocument(result.html, { method, path });
        sessionStore.setPrevHtml(sid, safeHtml);
        const instructions = extractInstructions(bodyData);
        const historyEntry = {
            id: randomUUID(),
            sessionId: sid,
            createdAt: new Date().toISOString(),
            durationMs,
            brief: state.brief ?? "",
            request: {
                method,
                path,
                query,
                body: bodyData,
                instructions,
            },
            response: { html: safeHtml },
            llm: {
                provider: llmClient.settings.provider,
                model: llmClient.settings.model,
                maxOutputTokens: llmClient.settings.maxOutputTokens,
                reasoningMode: llmClient.settings.reasoningMode,
                reasoningTokens: llmClient.settings.reasoningTokens,
            },
            usage: result.usage,
            reasoning: result.reasoning,
        };
        sessionStore.appendHistoryEntry(sid, historyEntry);
        cleanupPendingHtml(state);
        const token = randomUUID();
        state.pendingHtml.set(token, {
            html: safeHtml,
            expiresAt: Date.now() + PENDING_HTML_TTL_MS,
        });
        const pendingPath = `${LLM_RESULT_ROUTE_PREFIX}/${token}`;
        if (shouldStreamBody) {
            res.write(renderResultHydrationScript(token, originalPath));
        }
        else {
            // For HEAD requests we expose the target via header so clients can follow-up with GET.
            res.setHeader("Link", `<${pendingPath}>; rel="render"`);
        }
        res.end();
    }
    catch (error) {
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        reqLogger.error(`LLM generation failed: ${message}`);
        if (shouldStreamBody) {
            res.write(renderLoaderErrorScript("The model response took too long or failed. Please retry in a moment."));
        }
        else if (!res.headersSent) {
            res.statusCode = 500;
        }
        res.end();
    }
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
function extractInstructions(body) {
    const value = body?.[INSTRUCTIONS_FIELD];
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    if (Array.isArray(value)) {
        const first = value.find((item) => typeof item === "string" && item.trim().length > 0);
        return typeof first === "string" ? first.trim() : undefined;
    }
    return undefined;
}
function applyProviderEnv(settings) {
    const key = settings.apiKey?.trim();
    if (!key) {
        return;
    }
    if (settings.provider === "openai") {
        process.env.OPENAI_API_KEY = key;
        return;
    }
    if (settings.provider === "gemini") {
        process.env.GEMINI_API_KEY = key;
        return;
    }
    process.env.ANTHROPIC_API_KEY = key;
}
function getProviderLabel(provider) {
    if (provider === "openai") {
        return "OpenAI";
    }
    if (provider === "gemini") {
        return "Gemini";
    }
    return "Anthropic";
}
function providerSupportsReasoningMode(provider) {
    return provider === "openai";
}
function providerSupportsReasoningTokens(provider) {
    return provider === "gemini" || provider === "anthropic";
}
function updateProviderSelection(state, provider, reqLogger) {
    if (state.provider.provider === provider) {
        return;
    }
    const previous = state.provider.provider;
    let reasoningMode = "none";
    let reasoningTokens;
    if (provider === "openai") {
        reasoningMode = state.provider.provider === "openai"
            ? state.provider.reasoningMode ?? "low"
            : "low";
    }
    else if (provider === "anthropic") {
        reasoningMode = "none";
        if (state.provider.provider === "anthropic" && typeof state.provider.reasoningTokens === "number") {
            reasoningTokens = Math.min(state.provider.reasoningTokens, DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS);
        }
        else {
            reasoningTokens = DEFAULT_REASONING_TOKENS.anthropic;
        }
    }
    else if (provider === "gemini") {
        if (state.provider.provider === "gemini" && typeof state.provider.reasoningTokens === "number") {
            reasoningTokens = state.provider.reasoningTokens;
        }
        else {
            reasoningTokens = DEFAULT_REASONING_TOKENS.gemini;
        }
    }
    state.provider = {
        provider,
        apiKey: "",
        model: getDefaultModelForProvider(provider),
        maxOutputTokens: getDefaultMaxTokensForProvider(provider),
        reasoningMode,
        reasoningTokens,
    };
    state.providerReady = false;
    state.llmClient = null;
    reqLogger.info({ from: previous, to: provider }, "Wizard switched provider selection");
}
function getDefaultModelForProvider(provider) {
    if (provider === "openai") {
        return DEFAULT_OPENAI_MODEL;
    }
    if (provider === "gemini") {
        return DEFAULT_GEMINI_MODEL;
    }
    return DEFAULT_ANTHROPIC_MODEL;
}
function getDefaultMaxTokensForProvider(provider) {
    if (provider === "anthropic") {
        return DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS;
    }
    return DEFAULT_MAX_OUTPUT_TOKENS;
}
function getEffectiveReasoningTokens(provider) {
    const tokens = provider.reasoningTokens;
    if (typeof tokens === "number") {
        return tokens;
    }
    return DEFAULT_REASONING_TOKENS[provider.provider];
}
function parseProviderValue(value) {
    if (!value || typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "openai")
        return "openai";
    if (normalized === "gemini")
        return "gemini";
    if (normalized === "anthropic")
        return "anthropic";
    return undefined;
}
function sanitizeReasoningModeValue(value, fallback) {
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "low" || normalized === "medium" || normalized === "high") {
            return normalized;
        }
        if (normalized === "none") {
            return "none";
        }
    }
    return fallback;
}
function parsePositiveInt(value, fallback) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Expected a positive integer, received: ${String(value)}`);
    }
    return Math.floor(parsed);
}
function parseOptionalPositiveInt(value) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`Expected a non-negative integer, received: ${String(value)}`);
    }
    return Math.floor(parsed);
}
function parseReasoningTokensInput(value, provider) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Expected a numeric value, received: ${String(value)}`);
    }
    const rounded = Math.floor(parsed);
    if (provider === "gemini") {
        if (rounded < -1) {
            throw new Error("Reasoning tokens must be -1 (dynamic) or a non-negative integer.");
        }
        return rounded;
    }
    if (rounded < 0) {
        throw new Error("Reasoning tokens must be zero or a positive integer.");
    }
    return rounded;
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
function selectHistoryForPrompt(history, maxBytes) {
    if (history.length === 0) {
        return { entries: [], bytes: 0 };
    }
    const budget = maxBytes > 0 ? maxBytes : Number.POSITIVE_INFINITY;
    const reversed = [];
    let bytes = 0;
    for (let index = history.length - 1; index >= 0; index -= 1) {
        const entry = history[index];
        const size = estimateHistoryEntrySize(entry);
        if (reversed.length > 0 && bytes + size > budget) {
            break;
        }
        reversed.push(entry);
        bytes += size;
    }
    const entries = reversed.reverse();
    return { entries, bytes };
}
function estimateHistoryEntrySize(entry) {
    const fragments = [
        entry.brief ?? "",
        entry.request.method,
        entry.request.path,
        JSON.stringify(entry.request.query ?? {}, null, 2),
        JSON.stringify(entry.request.body ?? {}, null, 2),
        entry.request.instructions ?? "",
        entry.response.html ?? "",
    ];
    if (entry.usage) {
        fragments.push(JSON.stringify(entry.usage, null, 2));
    }
    if (entry.reasoning?.summaries?.length) {
        fragments.push(entry.reasoning.summaries.join("\n"));
    }
    if (entry.reasoning?.details?.length) {
        fragments.push(entry.reasoning.details.join("\n"));
    }
    let bytes = 0;
    for (const fragment of fragments) {
        bytes += Buffer.byteLength(fragment, "utf8");
    }
    // Add a cushion for labels and formatting noise in prompts.
    return bytes + 1024;
}
function handlePendingHtmlRequest(context, state, reqLogger) {
    const { path, method, res } = context;
    if (!path.startsWith(LLM_RESULT_ROUTE_PREFIX)) {
        return false;
    }
    cleanupPendingHtml(state);
    if (method !== "GET") {
        res.statusCode = 405;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Allow", "GET");
        res.end("Method Not Allowed");
        return true;
    }
    const token = path.slice(LLM_RESULT_ROUTE_PREFIX.length).replace(/^\/+/, "");
    if (!token) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Not Found");
        return true;
    }
    const entry = state.pendingHtml.get(token);
    if (!entry) {
        reqLogger.warn({ token }, "No pending HTML found for token");
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Not Found");
        return true;
    }
    state.pendingHtml.delete(token);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.end(entry.html);
    return true;
}
