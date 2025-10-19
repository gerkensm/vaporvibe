import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve as resolvePath } from "node:path";
import { URL, fileURLToPath } from "node:url";
import type { Logger } from "pino";
import {
  ADMIN_ROUTE_PREFIX,
  AUTO_IGNORED_PATHS,
  BRIEF_FORM_ROUTE,
  INSTRUCTIONS_FIELD,
  SETUP_ROUTE,
  SETUP_VERIFY_ROUTE,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_GROK_MODEL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS,
  DEFAULT_REASONING_TOKENS,
  LLM_RESULT_ROUTE_PREFIX,
} from "../constants.js";
import {
  DEFAULT_MAX_TOKENS_BY_PROVIDER,
  PROVIDER_REASONING_CAPABILITIES,
} from "../constants/providers.js";
import type {
  BriefAttachment,
  ChatMessage,
  HistoryEntry,
  RuntimeConfig,
  ProviderSettings,
  ReasoningMode,
  ModelProvider,
} from "../types.js";
import type { LlmClient } from "../llm/client.js";
import { buildMessages } from "../llm/messages.js";
import { spawnSync } from "node:child_process";
import { supportsImageInput } from "../llm/capabilities.js";
import { parseCookies } from "../utils/cookies.js";
import { readBody } from "../utils/body.js";
import { ensureHtmlDocument, escapeHtml } from "../utils/html.js";
import { SessionStore } from "./session-store.js";
import {
  applyComponentPlaceholders,
  prepareComponentCache,
} from "./component-cache.js";
import { getNavigationInterceptorScript } from "../utils/navigation-interceptor.js";
import { getInstructionsPanelScript } from "../utils/instructions-panel.js";
import {
  renderLoadingShell,
  renderResultHydrationScript,
  renderLoaderErrorScript,
} from "../views/loading-shell.js";
import { logger } from "../logger.js";
import { AdminController } from "./admin-controller.js";
import { createLlmClient } from "../llm/factory.js";
import { getCredentialStore } from "../utils/credential-store.js";
import { RestApiController } from "./rest-api-controller.js";
import { selectHistoryForPrompt } from "./history-utils.js";

type RequestLogger = Logger;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT_DIR = resolvePath(__dirname, "../../");
const FRONTEND_DIST_DIR = resolvePath(PROJECT_ROOT_DIR, "frontend/dist");
const FRONTEND_ASSETS_DIR = resolvePath(FRONTEND_DIST_DIR, "assets");
const SPA_INDEX_PATH = resolvePath(FRONTEND_DIST_DIR, "index.html");

const frontendAssetCache = new Map<
  string,
  { content: Buffer; contentType: string; mtimeMs: number }
>();

let spaShellCache: { html: string; mtimeMs: number } | null = null;
let frontendAssetsEnsured = false;

export function ensureFrontendAssetsOnce(): void {
  if (frontendAssetsEnsured) {
    return;
  }
  if (existsSync(SPA_INDEX_PATH)) {
    frontendAssetsEnsured = true;
    return;
  }

  logger.info(
    "Compiled admin UI missing — running `npm run build:fe` once to generate assets."
  );

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["run", "build:fe"], {
    cwd: PROJECT_ROOT_DIR,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "production" },
  });

  if (result.status !== 0) {
    throw new Error(
      "Failed to build admin SPA assets automatically. Run `npm run build:fe` manually to inspect the error."
    );
  }

  if (!existsSync(SPA_INDEX_PATH)) {
    throw new Error(
      "Admin SPA build completed but index.html is still missing. Ensure `npm run build:fe` succeeds."
    );
  }

  frontendAssetsEnsured = true;
  logger.info("Admin UI assets generated successfully.");
}

function stripScriptById(html: string, scriptId: string): string {
  if (!html.includes(scriptId)) {
    return html;
  }

  const pattern = new RegExp(
    `<script[^>]*id=["']${scriptId}["'][^>]*>[\\s\\S]*?<\\/script>`,
    "gi"
  );
  return html.replace(pattern, "");
}

function getAssetContentType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  switch (extension) {
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".json":
      return "application/json; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function maybeServeFrontendAsset(
  context: RequestContext,
  res: ServerResponse,
  reqLogger: RequestLogger
): boolean {
  if (
    !context.path.startsWith("/__serve-llm/assets/") &&
    !context.path.startsWith("/assets/")
  ) {
    return false;
  }

  if (context.method !== "GET" && context.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method Not Allowed");
    return true;
  }

  const assetPrefix = context.path.startsWith("/__serve-llm/assets/")
    ? "/__serve-llm/assets/"
    : "/assets/";
  const requestedPath = context.path.slice(assetPrefix.length);
  const segments = requestedPath
    .split(/[\\/]+/)
    .filter((segment) => segment && segment !== ".");

  if (!segments.length || segments.some((segment) => segment === "..")) {
    res.statusCode = 400;
    res.end("Bad Request");
    return true;
  }

  const normalized = segments.join("/");
  const filePath = resolvePath(FRONTEND_ASSETS_DIR, normalized);

  if (!filePath.startsWith(FRONTEND_ASSETS_DIR)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return true;
  }

  if (!existsSync(filePath)) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return true;
  }

  try {
    const stats = statSync(filePath);
    const lastModified = stats.mtime.toUTCString();

    const ifModifiedSince = context.req.headers["if-modified-since"];
    if (
      ifModifiedSince &&
      new Date(ifModifiedSince).getTime() >= stats.mtimeMs
    ) {
      res.statusCode = 304;
      res.setHeader("Last-Modified", lastModified);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.end();
      return true;
    }

    let cached = frontendAssetCache.get(filePath);
    if (!cached || cached.mtimeMs !== stats.mtimeMs) {
      const content = readFileSync(filePath);
      cached = {
        content,
        contentType: getAssetContentType(filePath),
        mtimeMs: stats.mtimeMs,
      };
      frontendAssetCache.set(filePath, cached);
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", cached.contentType);
    res.setHeader("Last-Modified", lastModified);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Length", String(cached.content.length));

    if (context.method === "HEAD") {
      res.end();
    } else {
      res.end(cached.content);
    }

    reqLogger.debug(`Served frontend asset ${context.path}`);
    return true;
  } catch (error) {
    reqLogger.error({ err: error }, "Failed to serve frontend asset");
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Internal Server Error");
    return true;
  }
}

function loadSpaShell(): string {
  if (!existsSync(SPA_INDEX_PATH)) {
    throw new Error("SPA_INDEX_MISSING");
  }
  const stats = statSync(SPA_INDEX_PATH);
  if (!spaShellCache || spaShellCache.mtimeMs !== stats.mtimeMs) {
    const html = readFileSync(SPA_INDEX_PATH, "utf8");
    spaShellCache = { html, mtimeMs: stats.mtimeMs };
  }
  return spaShellCache.html;
}

async function serveSpaShell(
  context: RequestContext,
  reqLogger: RequestLogger
): Promise<void> {
  const { method, res, path } = context;

  if (method === "POST") {
    res.statusCode = 303;
    res.setHeader("Location", ADMIN_ROUTE_PREFIX);
    res.end();
    reqLogger.debug({ path }, "Redirected legacy POST to admin route");
    return;
  }

  if (method !== "GET" && method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD, POST");
    res.end("Method Not Allowed");
    return;
  }

  try {
    const html = loadSpaShell();
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    if (method === "HEAD") {
      res.end();
    } else {
      res.end(html);
    }
    reqLogger.debug({ path }, "Served admin SPA shell");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "SPA_INDEX_MISSING") {
      const devUrl =
        process.env.SERVE_LLM_DEV_SERVER_URL?.replace(/\/$/, "") ||
        "http://localhost:5173";
      const fallbackHtml = `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <title>serve-llm Admin (dev)</title>\n    <style>body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;margin:0;background:#f8fafc;color:#0f172a;}\n    .fallback{max-width:720px;margin:10vh auto;padding:32px;border-radius:24px;background:#fff;box-shadow:0 20px 50px rgba(15,23,42,0.08);}\n    h1{margin-top:0;font-size:1.6rem;}\n    p{line-height:1.5;}\n    code{background:#e2e8f0;padding:2px 6px;border-radius:6px;}\n    a{color:#2563eb;}\n    </style>\n  </head>\n  <body>\n    <div class=\"fallback\">\n      <h1>serve-llm Admin (dev)</h1>\n      <p>The compiled admin UI is not available. The Vite dev server is expected at <strong>${devUrl}</strong>.</p>\n      <p>If you are developing the frontend, open <a href=\"${devUrl}\" target=\"_blank\">${devUrl}</a> in a new tab.</p>\n      <p>To build the production assets instead, run <code>npm run build:fe</code>.</p>\n    </div>\n    <script type=\"module\" src=\"${devUrl}/src/main.tsx\"></script>\n  </body>\n</html>`;
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      if (method === "HEAD") {
        res.end();
      } else {
        res.end(fallbackHtml);
      }
      reqLogger.warn(
        { path, devUrl },
        "SPA assets missing; served dev fallback"
      );
    } else {
      reqLogger.error({ err: error }, "Failed to load admin SPA shell");
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(
        "Admin UI assets missing. Run `npm run build:fe` before starting the server."
      );
    }
  }
}

export interface ServerOptions {
  runtime: RuntimeConfig;
  provider: ProviderSettings;
  providerLocked: boolean;
  providerSelectionRequired: boolean;
  providersWithKeys: ModelProvider[];
  llmClient: LlmClient | null;
  sessionStore: SessionStore;
}

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  method: string;
  path: string;
}

export interface MutableServerState {
  brief: string | null;
  briefAttachments: BriefAttachment[];
  runtime: RuntimeConfig;
  provider: ProviderSettings;
  llmClient: LlmClient | null;
  providerReady: boolean;
  providerLocked: boolean;
  providerSelectionRequired: boolean;
  providersWithKeys: Set<ModelProvider>;
  verifiedProviders: Partial<Record<ModelProvider, boolean>>;
  pendingHtml: Map<string, PendingHtmlEntry>;
}

interface PendingHtmlEntry {
  html: string;
  expiresAt: number;
}

const PENDING_HTML_TTL_MS = 3 * 60 * 1000;

export function createServer(options: ServerOptions): http.Server {
  const {
    runtime,
    provider,
    providerLocked,
    providerSelectionRequired,
    providersWithKeys,
    llmClient,
    sessionStore,
  } = options;
  const runtimeState: RuntimeConfig = { ...runtime };
  const providerState: ProviderSettings = { ...provider };
  const state: MutableServerState = {
    brief: runtimeState.brief?.trim() || null,
    briefAttachments: [],
    runtime: runtimeState,
    provider: providerState,
    llmClient,
    providerReady: Boolean(
      llmClient &&
        providerState.apiKey &&
        providerState.apiKey.trim().length > 0
    ),
    providerLocked,
    providerSelectionRequired,
    providersWithKeys: new Set(providersWithKeys),
    verifiedProviders:
      providerState.apiKey && providerState.apiKey.trim().length > 0
        ? { [providerState.provider]: Boolean(llmClient) }
        : {},
    pendingHtml: new Map(),
  };
  const adminController = new AdminController({
    state,
    sessionStore,
  });
  const restApiController = new RestApiController({
    sessionStore,
    adminPath: ADMIN_ROUTE_PREFIX,
    getEnvironment: () => ({
      brief: state.brief,
      briefAttachments: state.briefAttachments,
      runtime: state.runtime,
      llmClient: state.llmClient,
      providerReady: state.providerReady,
      providerSelectionRequired: state.providerSelectionRequired,
    }),
  });

  return http.createServer(async (req, res) => {
    const requestStart = Date.now();
    const context = buildContext(req, res);
    const reqLogger = logger.child({
      method: context.method,
      path: context.path,
    });
    reqLogger.info(
      `Incoming request ${context.method} ${context.path} from ${
        req.socket.remoteAddress ?? "unknown"
      }`
    );

    if (shouldEarly404(context)) {
      reqLogger.warn(`Auto-ignored path ${context.url.href}`);
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
      return;
    }

    if (maybeServeFrontendAsset(context, res, reqLogger)) {
      return;
    }

    if (
      context.path.startsWith(SETUP_ROUTE) ||
      context.path === SETUP_VERIFY_ROUTE ||
      context.path === BRIEF_FORM_ROUTE
    ) {
      await serveSpaShell(context, reqLogger);
      return;
    }

    try {
      if (handlePendingHtmlRequest(context, state, reqLogger)) {
        reqLogger.info(
          `Pending render delivered with status ${res.statusCode} in ${
            Date.now() - requestStart
          } ms`
        );
        return;
      }

      const handledByAdmin = await adminController.handle(
        context,
        requestStart,
        reqLogger
      );
      if (handledByAdmin) {
        reqLogger.info(
          `Admin handler completed with status ${res.statusCode} in ${
            Date.now() - requestStart
          } ms`
        );
        return;
      }

      const handledByRest = await restApiController.handle(context, reqLogger);
      if (handledByRest) {
        reqLogger.info(
          `REST handler completed with status ${res.statusCode} in ${
            Date.now() - requestStart
          } ms`
        );
        return;
      }

      if (
        !state.providerReady ||
        state.providerSelectionRequired ||
        !state.brief
      ) {
        await serveSpaShell(context, reqLogger);
        reqLogger.info(
          `SPA shell served with status ${res.statusCode} in ${
            Date.now() - requestStart
          } ms`
        );
        return;
      }

      if (context.path.startsWith(ADMIN_ROUTE_PREFIX)) {
        await serveSpaShell(context, reqLogger);
        reqLogger.info(
          `SPA shell served with status ${res.statusCode} in ${
            Date.now() - requestStart
          } ms`
        );
        return;
      }

      await handleLlmRequest(
        context,
        state,
        sessionStore,
        reqLogger,
        requestStart
      );
      reqLogger.info(
        `Completed with status ${res.statusCode} in ${
          Date.now() - requestStart
        } ms`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);
      reqLogger.error(`Request handling failed: ${message}`);
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(renderErrorPage(error));
      reqLogger.warn(
        `Completed with error status ${res.statusCode} in ${
          Date.now() - requestStart
        } ms`
      );
    }
  });
}

function buildContext(
  req: IncomingMessage,
  res: ServerResponse
): RequestContext {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`
  );
  const method = (req.method ?? "GET").toUpperCase();
  return {
    req,
    res,
    url,
    method,
    path: url.pathname,
  };
}

function shouldEarly404(context: RequestContext): boolean {
  const { method, path } = context;
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }
  if (AUTO_IGNORED_PATHS.has(path)) {
    return true;
  }
  if (path.endsWith(".ico")) return true;
  if (path.endsWith(".png") && path.includes("apple-touch")) return true;
  if (path.endsWith(".webmanifest")) return true;
  return false;
}

function cleanupPendingHtml(state: MutableServerState): void {
  const now = Date.now();
  for (const [token, entry] of state.pendingHtml.entries()) {
    if (entry.expiresAt <= now) {
      state.pendingHtml.delete(token);
    }
  }
}

async function handleLlmRequest(
  context: RequestContext,
  state: MutableServerState,
  sessionStore: SessionStore,
  reqLogger: RequestLogger,
  requestStart: number
): Promise<void> {
  const { req, res, url, method, path } = context;
  const llmClient = state.llmClient;
  if (!llmClient) {
    throw new Error("LLM client not configured");
  }
  const originalPath = `${url.pathname}${url.search}`;

  const cookies = parseCookies(req.headers.cookie);
  const sid = sessionStore.getOrCreateSessionId(cookies, res);

  const rawQueryEntries = Array.from(url.searchParams.entries());
  const isInterceptorQuery = rawQueryEntries.some(
    ([key, value]) => key === "__serve-llm" && value === "interceptor"
  );
  const query = Object.fromEntries(
    rawQueryEntries.filter(([key]) => key !== "__serve-llm")
  );
  if (Object.keys(query).length > 0) {
    reqLogger.debug(formatJsonForLog(query, "Query parameters"));
  }

  let bodyData: Record<string, unknown> = {};
  let isInterceptorBody = false;
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const parsed = await readBody(req);
    bodyData = parsed.data ?? {};
    const interceptorMarker = bodyData["__serve-llm"];
    const hasInterceptorMarker =
      interceptorMarker === "interceptor" ||
      (Array.isArray(interceptorMarker) &&
        interceptorMarker.includes("interceptor"));
    if (hasInterceptorMarker) {
      isInterceptorBody = true;
      delete bodyData["__serve-llm"];
    }
    if (parsed.raw) {
      reqLogger.debug(formatJsonForLog(bodyData, "Request body"));
    }
  }

  const fullHistory = sessionStore.getHistory(sid);
  const historyLimit = Math.max(1, state.runtime.historyLimit);
  const limitedHistory =
    historyLimit >= fullHistory.length
      ? fullHistory
      : fullHistory.slice(-historyLimit);
  const limitOmitted = fullHistory.length - limitedHistory.length;
  const selection = selectHistoryForPrompt(
    limitedHistory,
    state.runtime.historyMaxBytes
  );
  const historyForPrompt = selection.entries;
  const byteOmitted = limitedHistory.length - historyForPrompt.length;
  const findLastHtml = (source: HistoryEntry[]): HistoryEntry | undefined =>
    [...source].reverse().find((entry) => entry.entryKind === "html");

  const prevHtmlEntry =
    findLastHtml(historyForPrompt) ?? findLastHtml(limitedHistory) ?? undefined;

  const prevHtml =
    prevHtmlEntry?.response.html ?? sessionStore.getPrevHtml(sid);

  const restState = sessionStore.getRestState(sid);
  const previousEntry = findLastHtml(fullHistory);
  const sinceTimestamp = previousEntry
    ? new Date(previousEntry.createdAt).getTime()
    : Number.NEGATIVE_INFINITY;
  const restMutationsForEntry = restState.mutations.filter((record) => {
    const createdAt = new Date(record.createdAt).getTime();
    return createdAt > sinceTimestamp;
  });
  const restQueriesForEntry = restState.queries.filter((record) => {
    const createdAt = new Date(record.createdAt).getTime();
    return createdAt > sinceTimestamp;
  });

  reqLogger.debug(
    {
      historyTotal: fullHistory.length,
      historyLimit,
      historyIncluded: historyForPrompt.length,
      historyBytesUsed: selection.bytes,
      historyLimitOmitted: limitOmitted,
      historyByteOmitted: byteOmitted,
      historyMaxBytes: state.runtime.historyMaxBytes,
    },
    "History context prepared"
  );

  const totalBriefAttachments = state.briefAttachments ?? [];
  const includeAttachments = supportsImageInput(
    llmClient.settings.provider,
    llmClient.settings.model
  );
  const promptAttachments = includeAttachments
    ? totalBriefAttachments.map((attachment) => ({ ...attachment }))
    : [];
  const omittedAttachmentCount = includeAttachments
    ? 0
    : totalBriefAttachments.length;

  const messages = buildMessages({
    brief: state.brief ?? "",
    briefAttachments: promptAttachments,
    omittedAttachmentCount,
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

  const interceptorHeader = req.headers["x-serve-llm-request"];
  const isInterceptorHeader = Array.isArray(interceptorHeader)
    ? interceptorHeader.includes("interceptor")
    : interceptorHeader === "interceptor";
  const isInterceptorRequest =
    isInterceptorHeader || isInterceptorQuery || isInterceptorBody;
  const shouldStreamBody = method !== "HEAD" && !isInterceptorRequest;
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (shouldStreamBody) {
    const providerLabel = getProviderLabel(llmClient.settings.provider);
    const loadingMessage = `Asking ${providerLabel} (${llmClient.settings.model}) to refresh this page.`;
    res.write(
      renderLoadingShell({
        message: loadingMessage,
        originalPath,
        resultRoutePrefix: LLM_RESULT_ROUTE_PREFIX,
      })
    );
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }
  }

  try {
    const result = await llmClient.generateHtml(messages);
    const durationMs = Date.now() - requestStart;
    reqLogger.debug(
      `LLM response preview [${llmClient.settings.provider}]:\n${truncate(
        result.html,
        500
      )}`
    );
    const rawHtml = ensureHtmlDocument(result.html, { method, path });

    const strippedHtml = stripScriptById(
      stripScriptById(rawHtml, "serve-llm-interceptor-script"),
      "serve-llm-instructions-panel-script"
    );

    const { cache: existingCache, nextComponentId } =
      sessionStore.getComponentState(sid);
    const placeholderResult = applyComponentPlaceholders(
      strippedHtml,
      existingCache
    );

    if (placeholderResult.missing.length > 0) {
      reqLogger.warn(
        {
          missingComponentIds: placeholderResult.missing,
        },
        "Component placeholders could not be resolved"
      );
    }

    const cacheResult = prepareComponentCache(placeholderResult.html, {
      nextComponentId,
    });
    const promptHtml = cacheResult.html;
    let renderedHtml = promptHtml;

    const interceptorScriptTag = getNavigationInterceptorScript();
    if (/<\/body\s*>/i.test(renderedHtml)) {
      renderedHtml = renderedHtml.replace(
        /(<\/body\s*>)/i,
        `${interceptorScriptTag}$1`
      );
    } else {
      renderedHtml = `${renderedHtml}${interceptorScriptTag}`;
    }

    if (state.runtime.includeInstructionPanel) {
      const instructionsScripts = getInstructionsPanelScript();
      if (/<\/body\s*>/i.test(renderedHtml)) {
        renderedHtml = renderedHtml.replace(
          /(<\/body\s*>)/i,
          `${instructionsScripts}$1`
        );
      } else {
        renderedHtml = `${renderedHtml}${instructionsScripts}`;
      }
    }

    sessionStore.setPrevHtml(sid, promptHtml, {
      componentCache: cacheResult.cache,
      nextComponentId: cacheResult.nextComponentId,
    });

    const instructions = extractInstructions(bodyData);
    const historyEntry: HistoryEntry = {
      id: randomUUID(),
      sessionId: sid,
      createdAt: new Date().toISOString(),
      durationMs,
      brief: state.brief ?? "",
      briefAttachments: totalBriefAttachments.map((attachment) => ({
        ...attachment,
      })),
      entryKind: "html",
      request: {
        method,
        path,
        query,
        body: bodyData,
        instructions,
      },
      response: { html: promptHtml },
      llm: {
        provider: llmClient.settings.provider,
        model: llmClient.settings.model,
        maxOutputTokens: llmClient.settings.maxOutputTokens,
        reasoningMode: llmClient.settings.reasoningMode,
        reasoningTokens: llmClient.settings.reasoningTokens,
      },
      usage: result.usage,
      reasoning: result.reasoning,
      restMutations:
        restMutationsForEntry.length > 0 ? restMutationsForEntry : undefined,
      restQueries:
        restQueriesForEntry.length > 0 ? restQueriesForEntry : undefined,
    };

    sessionStore.appendHistoryEntry(sid, historyEntry, {
      preservePrevHtml: true,
    });

    if (isInterceptorRequest) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(renderedHtml);
      return;
    }

    cleanupPendingHtml(state);
    const token = randomUUID();
    state.pendingHtml.set(token, {
      html: renderedHtml,
      expiresAt: Date.now() + PENDING_HTML_TTL_MS,
    });
    const pendingPath = `${LLM_RESULT_ROUTE_PREFIX}/${token}`;

    if (shouldStreamBody) {
      res.write(renderResultHydrationScript(token, originalPath));
    } else {
      // For HEAD requests we expose the target via header so clients can follow-up with GET.
      res.setHeader("Link", `<${pendingPath}>; rel="render"`);
    }
    res.end();
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    reqLogger.error(`LLM generation failed: ${message}`);
    if (isInterceptorRequest && !res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(renderErrorPage(error));
      return;
    }
    if (shouldStreamBody) {
      res.write(
        renderLoaderErrorScript(
          "The model response took too long or failed. Please retry in a moment."
        )
      );
    } else if (!res.headersSent) {
      res.statusCode = 500;
    }
    res.end();
  }
}

function renderErrorPage(error: unknown): string {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ""}`
      : String(error);
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

function extractInstructions(
  body: Record<string, unknown>
): string | undefined {
  const value = body?.[INSTRUCTIONS_FIELD];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    const first = value.find(
      (item) => typeof item === "string" && item.trim().length > 0
    );
    return typeof first === "string" ? first.trim() : undefined;
  }
  return undefined;
}

function applyProviderEnv(settings: ProviderSettings): void {
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
  if (settings.provider === "grok") {
    process.env.XAI_API_KEY = key;
    return;
  }
  if (settings.provider === "groq") {
    process.env.GROQ_API_KEY = key;
    return;
  }
  process.env.ANTHROPIC_API_KEY = key;
}

function getEnvApiKeyForProvider(provider: ModelProvider): string | undefined {
  if (provider === "openai") {
    return (
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_APIKEY ||
      process.env.OPENAI_KEY ||
      undefined
    );
  }
  if (provider === "gemini") {
    return (
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENAI_KEY ||
      undefined
    );
  }
  if (provider === "grok") {
    return (
      process.env.XAI_API_KEY ||
      process.env.GROK_API_KEY ||
      process.env.XAI_KEY ||
      undefined
    );
  }
  if (provider === "groq") {
    return process.env.GROQ_API_KEY || process.env.GROQ_KEY || undefined;
  }
  return (
    process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY || undefined
  );
}

function getProviderLabel(provider: ProviderSettings["provider"]): string {
  if (provider === "openai") {
    return "OpenAI";
  }
  if (provider === "gemini") {
    return "Gemini";
  }
  if (provider === "grok") {
    return "xAI (Grok)";
  }
  if (provider === "groq") {
    return "Groq";
  }
  return "Anthropic";
}

function providerSupportsReasoningMode(
  provider: ProviderSettings["provider"]
): boolean {
  return Boolean(PROVIDER_REASONING_CAPABILITIES[provider]?.mode);
}

function providerSupportsReasoningTokens(
  provider: ProviderSettings["provider"]
): boolean {
  return Boolean(PROVIDER_REASONING_CAPABILITIES[provider]?.tokens);
}

function getDefaultModelForProvider(
  provider: ProviderSettings["provider"]
): string {
  switch (provider) {
    case "openai":
      return DEFAULT_OPENAI_MODEL;
    case "gemini":
      return DEFAULT_GEMINI_MODEL;
    case "anthropic":
      return DEFAULT_ANTHROPIC_MODEL;
    case "grok":
      return DEFAULT_GROK_MODEL;
    case "groq":
      return DEFAULT_GROQ_MODEL;
    default:
      return DEFAULT_OPENAI_MODEL;
  }
}

function getDefaultMaxTokensForProvider(
  provider: ProviderSettings["provider"]
): number {
  const mappedDefault =
    DEFAULT_MAX_TOKENS_BY_PROVIDER[provider as ModelProvider];
  if (typeof mappedDefault === "number") {
    return mappedDefault;
  }
  if (provider === "anthropic") {
    return DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS;
  }
  return DEFAULT_MAX_OUTPUT_TOKENS;
}

function sanitizeReasoningModeValue(
  value: unknown,
  fallback: ReasoningMode
): ReasoningMode {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "low" ||
      normalized === "medium" ||
      normalized === "high"
    ) {
      return normalized;
    }
    if (normalized === "none") {
      return "none";
    }
  }
  return fallback;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${String(value)}`);
  }
  return Math.floor(parsed);
}

function parseOptionalPositiveInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(
      `Expected a non-negative integer, received: ${String(value)}`
    );
  }
  return Math.floor(parsed);
}

function parseReasoningTokensInput(
  value: unknown,
  provider: ProviderSettings["provider"]
): number | undefined {
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
      throw new Error(
        "Reasoning tokens must be -1 (dynamic) or a non-negative integer."
      );
    }
    return rounded;
  }
  if (rounded < 0) {
    throw new Error("Reasoning tokens must be zero or a positive integer.");
  }
  return rounded;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
}

function formatMessagesForLog(messages: ChatMessage[]): string {
  return messages
    .map((message) => {
      const preview = truncate(message.content, 500_000);
      let attachmentNote = "";
      if (message.attachments?.length) {
        const names = message.attachments
          .map((attachment) => `${attachment.name} (${attachment.mimeType})`)
          .join(", ");
        attachmentNote = `\n[ATTACHMENTS: ${names}]`;
      }
      return `[${message.role.toUpperCase()}]\n${preview}${attachmentNote}`;
    })
    .join("\n\n");
}

function formatJsonForLog(payload: unknown, label?: string): string {
  const prefix = label ? `${label}:\n` : "";
  try {
    return `${prefix}${JSON.stringify(payload, null, 2)}`;
  } catch {
    return `${prefix}${String(payload)}`;
  }
}

function handlePendingHtmlRequest(
  context: RequestContext,
  state: MutableServerState,
  reqLogger: RequestLogger
): boolean {
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
