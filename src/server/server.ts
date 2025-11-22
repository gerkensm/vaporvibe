import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve as resolvePath } from "node:path";
import { URL, fileURLToPath } from "node:url";
import type { Duplex } from "node:stream";
import type { Logger } from "pino";
import {
  ADMIN_ROUTE_PREFIX,
  AUTO_IGNORED_PATHS,
  BRIEF_FORM_ROUTE,
  INSTRUCTIONS_FIELD,
  SETUP_ROUTE,
  OVERLAY_DEBUG_ROUTE,
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
  LLM_REASONING_STREAM_ROUTE_PREFIX,
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
  applyReusablePlaceholders,
  prepareReusableCaches,
} from "./component-cache.js";
import { getNavigationInterceptorScript } from "../utils/navigation-interceptor.js";
import { getInstructionsPanelScript } from "../utils/instructions-panel.js";
import {
  renderLoadingShell,
  renderResultHydrationScript,
  renderLoaderErrorScript,
} from "../views/loading-shell.js";
import { renderOverlayDebugPage } from "../views/overlay-debug.js";
import { logger } from "../logger.js";
import { AdminController } from "./admin-controller.js";
import { createLlmClient } from "../llm/factory.js";
import { shouldEnableGeminiThoughts } from "../llm/gemini-client.js";
import { getCredentialStore } from "../utils/credential-store.js";
import { RestApiController } from "./rest-api-controller.js";
import { selectHistoryForPrompt } from "./history-utils.js";

type RequestLogger = Logger;

export interface DevFrontendServer {
  middlewares(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ): void;
  transformIndexHtml(url: string, html: string): Promise<string>;
  close(): Promise<void>;
  ws: {
    handleUpgrade(
      req: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      callback: (ws: unknown) => void
    ): void;
    emit(event: string, ...args: unknown[]): void;
  };
  ssrFixStacktrace?(error: Error): void;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT_DIR = resolvePath(__dirname, "../../");
const FRONTEND_DIST_DIR = resolvePath(PROJECT_ROOT_DIR, "frontend/dist");
const FRONTEND_ASSETS_DIR = resolvePath(FRONTEND_DIST_DIR, "assets");
const SPA_INDEX_PATH = resolvePath(FRONTEND_DIST_DIR, "index.html");
const FRONTEND_SOURCE_DIR = resolvePath(PROJECT_ROOT_DIR, "frontend");
const SPA_SOURCE_INDEX_PATH = resolvePath(FRONTEND_SOURCE_DIR, "index.html");
const ADMIN_ASSET_ROUTE_PREFIX = `${ADMIN_ROUTE_PREFIX}/assets`;
const ADMIN_ASSET_ROUTE_PREFIX_WITH_SLASH = `${ADMIN_ASSET_ROUTE_PREFIX}/`;
const INTERCEPTOR_SW_FILENAME = "vaporvibe-interceptor-sw.js";
const INTERCEPTOR_SW_ROUTE = `/${INTERCEPTOR_SW_FILENAME}`;
const INTERCEPTOR_SW_DIST_PATH = resolvePath(
  FRONTEND_DIST_DIR,
  INTERCEPTOR_SW_FILENAME
);
const INTERCEPTOR_SW_SOURCE_PATH = resolvePath(
  FRONTEND_SOURCE_DIR,
  "public",
  INTERCEPTOR_SW_FILENAME
);

const BRANCH_FIELD = "__vaporvibe_branch";

const DEV_SERVER_ASSET_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".json",
]);

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
  if (process.env.VAPORVIBE_PREFER_DEV_FRONTEND === "1") {
    frontendAssetsEnsured = true;
    logger.info(
      "Development mode: skipping admin UI build and deferring to the Vite dev server."
    );
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

function getDevFrontendUrl(): string {
  return (
    process.env.SERVE_LLM_DEV_SERVER_URL?.replace(/\/$/, "") ||
    "http://localhost:5173"
  );
}

function renderDevSpaFallback(devUrl: string): string {
  return String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>vaporvibe Admin (dev)</title>
    <style>body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;margin:0;background:#f8fafc;color:#0f172a;}
    #root{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:48px;}
    .fallback{max-width:720px;width:100%;padding:32px;border-radius:24px;background:#fff;box-shadow:0 20px 50px rgba(15,23,42,0.08);}
    h1{margin-top:0;font-size:1.6rem;}
    p{line-height:1.5;}
    code{background:#e2e8f0;padding:2px 6px;border-radius:6px;}
    a{color:#2563eb;}
    </style>
  </head>
  <body>
    <div id="root">
      <div class="fallback">
        <h1>vaporvibe Admin (dev)</h1>
        <p>The compiled admin UI is not available. The Vite dev server is expected at <strong>${devUrl}</strong>.</p>
        <p>If you are developing the frontend, open <a href="${devUrl}" target="_blank">${devUrl}</a> in a new tab.</p>
        <p>To build the production assets instead, run <code>npm run build:fe</code>.</p>
      </div>
    </div>
    <script type="module" src="${devUrl}/@vite/client"></script>
    <script type="module" src="${devUrl}/src/main.tsx"></script>
  </body>
</html>`;
}

function stripAdminBasePath(path: string): string {
  if (path === ADMIN_ROUTE_PREFIX) {
    return "/";
  }
  if (path.startsWith(ADMIN_ROUTE_PREFIX) && path.length > ADMIN_ROUTE_PREFIX.length) {
    const remainder = path.slice(ADMIN_ROUTE_PREFIX.length);
    return remainder.startsWith("/") ? remainder : `/${remainder}`;
  }
  return path;
}

function isDevServerAssetPath(path: string): boolean {
  if (
    path.startsWith("/@vite") ||
    path.startsWith("/@react-refresh") ||
    path.startsWith("/@fs/") ||
    path.startsWith("/.vite/") ||
    path.startsWith("/node_modules/") ||
    path.startsWith("/src/")
  ) {
    return true;
  }

  const extension = extname(path);
  return DEV_SERVER_ASSET_EXTENSIONS.has(extension);
}

function shouldDelegateToDevServer(path: string): boolean {
  if (path === INTERCEPTOR_SW_ROUTE) {
    return false;
  }
  if (
    path.startsWith("/api/") ||
    path.startsWith("/rest_api/") ||
    path.startsWith("/__vaporvibe/") ||
    path.startsWith("/__set-brief")
  ) {
    return false;
  }

  if (path.startsWith(ADMIN_ROUTE_PREFIX)) {
    return path.startsWith(ADMIN_ASSET_ROUTE_PREFIX_WITH_SLASH);
  }

  const normalized = stripAdminBasePath(path);
  return isDevServerAssetPath(normalized);
}

function selectAssetPrefix(path: string): string | null {
  if (path.startsWith("/__vaporvibe/assets/")) {
    return "/__vaporvibe/assets/";
  }
  if (path.startsWith(ADMIN_ASSET_ROUTE_PREFIX_WITH_SLASH)) {
    return ADMIN_ASSET_ROUTE_PREFIX_WITH_SLASH;
  }
  return null;
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

function buildMasterReusableCaches(
  history: HistoryEntry[]
): {
  componentCache: Record<string, string>;
  styleCache: Record<string, string>;
} {
  const componentCache: Record<string, string> = {};
  const styleCache: Record<string, string> = {};

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry.entryKind !== "html") {
      continue;
    }

    const entryComponentCache = entry.componentCache;
    if (entryComponentCache) {
      for (const [componentId, markup] of Object.entries(entryComponentCache)) {
        if (!(componentId in componentCache)) {
          componentCache[componentId] = markup;
        }
      }
    }

    const entryStyleCache = entry.styleCache;
    if (entryStyleCache) {
      for (const [styleId, markup] of Object.entries(entryStyleCache)) {
        if (!(styleId in styleCache)) {
          styleCache[styleId] = markup;
        }
      }
    }
  }

  return { componentCache, styleCache };
}

function deriveNextNumericId(
  cache: Record<string, string>,
  html: string,
  attributeName: string,
  prefix: string
): number {
  let maxId = 0;

  const considerId = (value: string | undefined): void => {
    if (!value || !value.startsWith(prefix)) {
      return;
    }
    const numericPortion = value.slice(prefix.length);
    const parsed = Number.parseInt(numericPortion, 10);
    if (!Number.isNaN(parsed) && parsed > maxId) {
      maxId = parsed;
    }
  };

  for (const key of Object.keys(cache)) {
    considerId(key);
  }

  const attributePattern = new RegExp(
    `${attributeName}="${prefix}(\\d+)"`,
    "gi"
  );
  let match: RegExpExecArray | null;
  while ((match = attributePattern.exec(html)) !== null) {
    const numericValue = Number.parseInt(match[1], 10);
    if (!Number.isNaN(numericValue) && numericValue > maxId) {
      maxId = numericValue;
    }
  }

  return maxId + 1;
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
  const assetPrefix = selectAssetPrefix(context.path);
  if (!assetPrefix) {
    return false;
  }

  if (context.method !== "GET" && context.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method Not Allowed");
    return true;
  }

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
  const lastSegment = segments[segments.length - 1];
  const isVolatileAsset =
    lastSegment === "vaporvibe-interceptor.js" ||
    lastSegment === "vaporvibe-instructions-panel.js";

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
    if (!isVolatileAsset && ifModifiedSince) {
      const headerDate = new Date(ifModifiedSince);
      if (!Number.isNaN(headerDate.getTime()) && headerDate.getTime() >= stats.mtimeMs) {
        res.statusCode = 304;
        res.setHeader("Last-Modified", lastModified);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.end();
        return true;
      }
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
    res.setHeader(
      "Cache-Control",
      isVolatileAsset ? "no-store, no-cache, must-revalidate" : "public, max-age=31536000, immutable"
    );
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

function serveNavigationServiceWorker(
  context: RequestContext,
  res: ServerResponse,
  reqLogger: RequestLogger
): boolean {
  if (context.method !== "GET" && context.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method Not Allowed");
    return true;
  }

  const candidatePaths = [
    INTERCEPTOR_SW_DIST_PATH,
    INTERCEPTOR_SW_SOURCE_PATH,
  ];
  const filePath = candidatePaths.find((candidate) => existsSync(candidate));
  if (!filePath) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return true;
  }

  try {
    const content = readFileSync(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Service-Worker-Allowed", "/");
    res.setHeader("Content-Length", String(content.length));
    if (context.method === "HEAD") {
      res.end();
    } else {
      res.end(content);
    }
    reqLogger.debug("Served navigation service worker bundle");
    return true;
  } catch (error) {
    reqLogger.error({ err: error }, "Failed to serve navigation service worker");
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
  reqLogger: RequestLogger,
  devServer?: DevFrontendServer | null
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

  if (devServer) {
    try {
      const template = await readFile(SPA_SOURCE_INDEX_PATH, "utf8");
      const requestUrl = `${context.url.pathname}${context.url.search}`;
      const html = await devServer.transformIndexHtml(requestUrl, template);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      if (method === "HEAD") {
        res.end();
      } else {
        res.end(html);
      }
      reqLogger.debug({ path }, "Served admin SPA via Vite middleware");
      return;
    } catch (error) {
      devServer.ssrFixStacktrace?.(error as Error);
      reqLogger.error(
        { err: error },
        "Failed to transform admin SPA via Vite middleware"
      );
      const devUrl = getDevFrontendUrl();
      const fallbackHtml = renderDevSpaFallback(devUrl);
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      if (method === "HEAD") {
        res.end();
      } else {
        res.end(fallbackHtml);
      }
      return;
    }
  }

  if (process.env.VAPORVIBE_PREFER_DEV_FRONTEND === "1") {
    const devUrl = getDevFrontendUrl();
    const fallbackHtml = renderDevSpaFallback(devUrl);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    if (method === "HEAD") {
      res.end();
    } else {
      res.end(fallbackHtml);
    }
    reqLogger.warn({ path, devUrl }, "Dev frontend not available; served fallback");
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
      const devUrl = getDevFrontendUrl();
      const fallbackHtml = renderDevSpaFallback(devUrl);
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

export interface ServerStateConfig {
  runtime: RuntimeConfig;
  provider: ProviderSettings;
  providerLocked: boolean;
  providerSelectionRequired: boolean;
  providersWithKeys: ModelProvider[];
  llmClient: LlmClient | null;
}

export interface ServerStateSnapshot {
  brief: string | null;
  briefAttachments: BriefAttachment[];
  providersWithKeys: ModelProvider[];
  verifiedProviders: [ModelProvider, boolean][];
  pendingHtml: Array<[string, PendingHtmlEntry]>;
}

export interface ServerOptions {
  sessionStore: SessionStore;
  state: MutableServerState;
  devServer?: DevFrontendServer | null;
}

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  method: string;
  path: string;
  branchId?: string;
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
  reasoningStreams: Map<string, ReasoningStreamEntry>;
}

export interface PendingHtmlEntry {
  html: string;
  expiresAt: number;
}

export interface ReasoningStreamEntry {
  createdAt: number;
  events: string[];
  closed: boolean;
  subscriber?: ServerResponse | null;
}

// LLM renders can easily exceed 10 minutes, so keep pending HTML around long enough
// for the loader fetch to succeed even if the client is briefly stalled.
const PENDING_HTML_TTL_MS = 15 * 60 * 1000;
const REASONING_STREAM_TTL_MS = 10 * 60 * 1000;
const REASONING_STREAM_EVENT_LIMIT = 200;

function formatSseEvent(event: string, data: unknown): string {
  const payload = JSON.stringify(data ?? null);
  return `event: ${event}\ndata: ${payload}\n\n`;
}

function isReasoningStreamEnabled(settings: ProviderSettings): boolean {
  if (!settings) {
    return false;
  }

  // For Gemini, check if thoughts should be enabled (handles Auto mode)
  if (settings.provider === "gemini") {
    return shouldEnableGeminiThoughts(settings);
  }

  // For other providers, check reasoningMode or manual reasoning tokens
  if (settings.reasoningMode && settings.reasoningMode !== "none") {
    return true;
  }
  if (
    settings.reasoningTokensEnabled !== false &&
    typeof settings.reasoningTokens === "number" &&
    settings.reasoningTokens > 0
  ) {
    return true;
  }
  return false;
}

function cleanupReasoningStreams(state: MutableServerState): void {
  const now = Date.now();
  for (const [token, entry] of state.reasoningStreams.entries()) {
    const expired = now - entry.createdAt > REASONING_STREAM_TTL_MS;
    const finished = entry.closed && (!entry.subscriber || entry.subscriber.writableEnded);
    if (expired || finished) {
      try {
        entry.subscriber?.end();
      } catch {
        // ignore cleanup errors
      }
      state.reasoningStreams.delete(token);
    }
  }
}

function registerReasoningStream(state: MutableServerState): {
  token: string;
  emit: (event: string, data: unknown) => void;
  close: (finalData?: unknown) => void;
  error: (message: string) => void;
} {
  const token = randomUUID();
  const entry: ReasoningStreamEntry = {
    createdAt: Date.now(),
    events: [],
    closed: false,
    subscriber: null,
  };
  state.reasoningStreams.set(token, entry);

  const emit = (event: string, data: unknown) => {
    const current = state.reasoningStreams.get(token);
    if (!current || current.closed) {
      return;
    }
    const formatted = formatSseEvent(event, data);
    current.events.push(formatted);
    if (current.events.length > REASONING_STREAM_EVENT_LIMIT) {
      current.events.shift();
    }
    if (current.subscriber && !current.subscriber.writableEnded) {
      try {
        current.subscriber.write(formatted);
      } catch (error) {
        current.subscriber = null;
      }
    }
  };

  return {
    token,
    emit,
    close: (finalData?: unknown) => {
      const current = state.reasoningStreams.get(token);
      if (!current) {
        return;
      }
      if (!current.closed) {
        if (finalData !== undefined) {
          emit("final", finalData);
        }
        emit("complete", { ok: true });
        current.closed = true;
      }
      if (current.subscriber && !current.subscriber.writableEnded) {
        try {
          current.subscriber.end();
        } catch {
          // ignore errors closing subscriber
        }
      }
      cleanupReasoningStreams(state);
    },
    error: (message: string) => {
      const current = state.reasoningStreams.get(token);
      if (!current || current.closed) {
        return;
      }
      emit("error", { message });
      current.closed = true;
      if (current.subscriber && !current.subscriber.writableEnded) {
        try {
          current.subscriber.end();
        } catch {
          // ignore errors closing subscriber
        }
      }
      cleanupReasoningStreams(state);
    },
  };
}

function attachReasoningStream(
  state: MutableServerState,
  token: string,
  context: RequestContext
): boolean {
  const entry = state.reasoningStreams.get(token);
  if (!entry) {
    return false;
  }

  const { res, req } = context;
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Connection", "keep-alive");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  if (entry.subscriber && entry.subscriber !== res && !entry.subscriber.writableEnded) {
    try {
      entry.subscriber.end();
    } catch {
      // ignore errors closing previous subscriber
    }
  }

  entry.subscriber = res;
  entry.events.forEach((event) => {
    if (!res.writableEnded) {
      res.write(event);
    }
  });
  if (entry.closed && !res.writableEnded) {
    res.end();
  }

  req.on("close", () => {
    if (entry.subscriber === res) {
      entry.subscriber = null;
      cleanupReasoningStreams(state);
    }
  });
  return true;
}

function cloneAttachment(attachment: BriefAttachment): BriefAttachment {
  return { ...attachment };
}

function computeProviderReady(
  llmClient: LlmClient | null,
  provider: ProviderSettings
): boolean {
  return Boolean(
    llmClient && provider.apiKey && provider.apiKey.trim().length > 0
  );
}

export function createServerState(
  config: ServerStateConfig,
  snapshot?: ServerStateSnapshot
): MutableServerState {
  const runtimeState: RuntimeConfig = { ...config.runtime };
  const providerState: ProviderSettings = { ...config.provider };
  const providersWithKeys = new Set<ModelProvider>(
    config.providersWithKeys
  );
  const rawBrief = runtimeState.brief?.trim() ?? "";
  const initialBrief = rawBrief.length > 0 ? rawBrief : null;

  if (snapshot) {
    for (const provider of snapshot.providersWithKeys) {
      providersWithKeys.add(provider);
    }
  }

  const verifiedProviders: Partial<Record<ModelProvider, boolean>> = snapshot
    ? (Object.fromEntries(snapshot.verifiedProviders) as Partial<
      Record<ModelProvider, boolean>
    >)
    : providerState.apiKey && providerState.apiKey.trim().length > 0
      ? { [providerState.provider]: Boolean(config.llmClient) }
      : {};

  if (
    providerState.apiKey &&
    providerState.apiKey.trim().length > 0
  ) {
    verifiedProviders[providerState.provider] = Boolean(config.llmClient);
  }

  return {
    brief: snapshot?.brief ?? initialBrief,
    briefAttachments: snapshot
      ? snapshot.briefAttachments.map(cloneAttachment)
      : [],
    runtime: runtimeState,
    provider: providerState,
    llmClient: config.llmClient,
    providerReady: computeProviderReady(config.llmClient, providerState),
    providerLocked: config.providerLocked,
    providerSelectionRequired: config.providerSelectionRequired,
    providersWithKeys,
    verifiedProviders,
    pendingHtml: snapshot
      ? new Map(
        snapshot.pendingHtml.map(([id, entry]) => [
          id,
          { html: entry.html, expiresAt: entry.expiresAt },
        ])
      )
      : new Map(),
    reasoningStreams: new Map(),
  };
}

export function snapshotServerState(
  state: MutableServerState
): ServerStateSnapshot {
  return {
    brief: state.brief,
    briefAttachments: state.briefAttachments.map(cloneAttachment),
    providersWithKeys: Array.from(state.providersWithKeys),
    verifiedProviders: Object.entries(state.verifiedProviders).map(
      ([provider, verified]) => [provider as ModelProvider, Boolean(verified)]
    ),
    pendingHtml: Array.from(state.pendingHtml.entries()).map(
      ([id, entry]) => [id, { html: entry.html, expiresAt: entry.expiresAt }]
    ),
  };
}

export function createServer(options: ServerOptions): http.Server {
  const { sessionStore, state, devServer } = options;
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

  const server = http.createServer(async (req, res) => {
    const requestStart = Date.now();
    const context = buildContext(req, res);
    const reqLogger = logger.child({
      method: context.method,
      path: context.path,
    });

    const cookies = parseCookies(req.headers.cookie);
    const sid = sessionStore.getOrCreateSessionId(cookies, res);

    const routedByDevServer = Boolean(
      devServer && shouldDelegateToDevServer(context.path)
    );
    const logMessage = `Incoming request ${context.method} ${context.path} from ${req.socket.remoteAddress ?? "unknown"
      }`;
    if (routedByDevServer) {
      reqLogger.debug(logMessage);
    } else {
      reqLogger.info(logMessage);
    }

    if (
      devServer &&
      (context.method === "GET" || context.method === "HEAD") &&
      shouldDelegateToDevServer(context.path)
    ) {
      const handledByVite = await maybeHandleWithDevServer(
        devServer,
        req,
        res
      );
      if (handledByVite) {
        reqLogger.debug({ path: context.path }, "Request served by Vite middleware");
        return;
      }
    }

    if (shouldEarly404(context)) {
      reqLogger.warn(`Auto-ignored path ${context.url.href}`);
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
      return;
    }

    if (context.path === INTERCEPTOR_SW_ROUTE) {
      serveNavigationServiceWorker(context, res, reqLogger);
      return;
    }

    if (!devServer && maybeServeFrontendAsset(context, res, reqLogger)) {
      return;
    }

    if (context.path === OVERLAY_DEBUG_ROUTE && context.method === "GET") {
      const html = renderOverlayDebugPage({
        selectedEffectId: context.url.searchParams.get("effect"),
        seedMessage: context.url.searchParams.get("message"),
      });
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
      reqLogger.info(
        `Overlay debug page served with status ${res.statusCode} in ${Date.now() - requestStart
        } ms`
      );
      return;
    }

    if (
      context.path.startsWith(SETUP_ROUTE) ||
      context.path === SETUP_VERIFY_ROUTE ||
      context.path === BRIEF_FORM_ROUTE
    ) {
      await serveSpaShell(context, reqLogger, devServer);
      return;
    }

    try {
      if (handleReasoningStreamRequest(context, state, reqLogger)) {
        return;
      }

      if (handlePendingHtmlRequest(context, state, reqLogger)) {
        reqLogger.info(
          `Pending render delivered with status ${res.statusCode} in ${Date.now() - requestStart
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
          `Admin handler completed with status ${res.statusCode} in ${Date.now() - requestStart
          } ms`
        );
        return;
      }

      const handledByRest = await restApiController.handle(context, reqLogger);
      if (handledByRest) {
        reqLogger.info(
          `REST handler completed with status ${res.statusCode} in ${Date.now() - requestStart
          } ms`
        );
        return;
      }

      if (sessionStore.isForkActive(sid) && !context.branchId) {
        const forkSummary = sessionStore.getActiveForkSummary(sid);
        if (forkSummary) {
          const isAbWorkspaceRequest = context.path.startsWith(
            `${ADMIN_ROUTE_PREFIX}/ab-test/${forkSummary.forkId}`
          );
          const isAdminRoute = context.path.startsWith(ADMIN_ROUTE_PREFIX);
          const isSetupRoute = context.path.startsWith(SETUP_ROUTE);
          const isResultRoute = context.path.startsWith(LLM_RESULT_ROUTE_PREFIX);
          const acceptHeader = req.headers["accept"] ?? "";
          const wantsHtml =
            typeof acceptHeader === "string" &&
            acceptHeader
              .split(",")
              .some((value) => value.includes("text/html"));

          if (
            wantsHtml &&
            !isAbWorkspaceRequest &&
            !isAdminRoute &&
            !isSetupRoute &&
            !isResultRoute
          ) {
            reqLogger.info(
              { path: context.path, forkId: forkSummary.forkId },
              "Active A/B test detected, redirecting top-level navigation to workspace"
            );
            const redirectBase = `${ADMIN_ROUTE_PREFIX}/ab-test/${forkSummary.forkId}`;
            const search = context.url.search ?? "";
            const sourcePath = `${context.path}${search}` || "/";
            const redirectUrl = `${redirectBase}?source=${encodeURIComponent(
              sourcePath
            )}`;
            res.statusCode = 307;
            res.setHeader("Location", redirectUrl);
            res.end();
            return;
          }
        }
      }

      if (
        !state.providerReady ||
        state.providerSelectionRequired ||
        !state.brief
      ) {
        await serveSpaShell(context, reqLogger, devServer);
        reqLogger.info(
          `SPA shell served with status ${res.statusCode} in ${Date.now() - requestStart
          } ms`
        );
        return;
      }

      if (context.path.startsWith(ADMIN_ROUTE_PREFIX)) {
        await serveSpaShell(context, reqLogger, devServer);
        reqLogger.info(
          `SPA shell served with status ${res.statusCode} in ${Date.now() - requestStart
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
        `Completed with status ${res.statusCode} in ${Date.now() - requestStart
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
        `Completed with error status ${res.statusCode} in ${Date.now() - requestStart
        } ms`
      );
    }
  });

  if (devServer) {
    server.on("upgrade", (req, socket, head) => {
      if (req.headers["upgrade"] !== "websocket") {
        return;
      }
      const url = req.url || "";
      if (!url.startsWith("/@vite")) {
        return;
      }
      devServer.ws.handleUpgrade(req, socket, head, (ws) => {
        devServer.ws.emit("connection", ws, req);
      });
    });
  }

  return server;
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
  const branchId = url.searchParams.get(BRANCH_FIELD) ?? undefined;
  return {
    req,
    res,
    url,
    method,
    path: url.pathname,
    branchId: branchId && branchId.trim().length > 0 ? branchId : undefined,
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

async function maybeHandleWithDevServer(
  devServer: DevFrontendServer,
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const originalUrl = req.url;
  let modified = false;
  if (originalUrl && originalUrl.startsWith(ADMIN_ROUTE_PREFIX)) {
    req.url = stripAdminBasePath(originalUrl);
    modified = true;
  }

  if (res.headersSent || res.writableEnded) {
    if (modified && originalUrl) {
      req.url = originalUrl;
    }
    return true;
  }

  await new Promise<void>((resolve) => {
    devServer.middlewares(req, res, () => {
      resolve();
    });
  });

  if (modified && originalUrl) {
    req.url = originalUrl;
  }

  return res.headersSent || res.writableEnded;
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
  let branchId = context.branchId;
  let isInterceptorQuery = false;
  const filteredQueryEntries: Array<[string, string]> = [];
  for (const [key, value] of rawQueryEntries) {
    if (key === "__vaporvibe") {
      if (value === "interceptor") {
        isInterceptorQuery = true;
      }
      continue;
    }
    if (key === BRANCH_FIELD) {
      if (!branchId && typeof value === "string" && value.trim().length > 0) {
        branchId = value.trim();
      }
      continue;
    }
    filteredQueryEntries.push([key, value]);
  }
  const query = Object.fromEntries(filteredQueryEntries);
  if (Object.keys(query).length > 0) {
    reqLogger.debug(formatJsonForLog(query, "Query parameters"));
  }

  let bodyData: Record<string, unknown> = {};
  let isInterceptorBody = false;
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const parsed = await readBody(req);
    bodyData = parsed.data ?? {};
    const interceptorMarker = bodyData["__vaporvibe"];
    const hasInterceptorMarker =
      interceptorMarker === "interceptor" ||
      (Array.isArray(interceptorMarker) &&
        interceptorMarker.includes("interceptor"));
    if (hasInterceptorMarker) {
      isInterceptorBody = true;
      delete bodyData["__vaporvibe"];
    }
    const branchMarker = bodyData[BRANCH_FIELD];
    if (typeof branchMarker === "string") {
      const trimmed = branchMarker.trim();
      if (trimmed.length > 0) {
        branchId = trimmed;
      }
      delete bodyData[BRANCH_FIELD];
    } else if (Array.isArray(branchMarker)) {
      const firstValue = branchMarker.find(
        (item) => typeof item === "string" && item.trim().length > 0
      );
      if (typeof firstValue === "string") {
        branchId = firstValue.trim();
      }
      delete bodyData[BRANCH_FIELD];
    } else if (branchMarker !== undefined) {
      delete bodyData[BRANCH_FIELD];
    }
    if (parsed.raw) {
      reqLogger.debug(formatJsonForLog(bodyData, "Request body"));
    }
  }

  branchId = branchId && branchId.trim().length > 0 ? branchId.trim() : undefined;

  const baseHistory = sessionStore.getHistory(sid);
  const activeForkSummary = sessionStore.getActiveForkSummary(sid);
  const activeBranchSummary =
    branchId && activeForkSummary
      ? activeForkSummary.branches.find((branch) => branch.branchId === branchId)
      : undefined;

  if (branchId && activeBranchSummary) {
    const branchHasEntries = activeBranchSummary.entryCount > 0;
    const branchInstructions = activeBranchSummary.instructions?.trim();
    if (!branchHasEntries && branchInstructions) {
      const existing = bodyData[INSTRUCTIONS_FIELD];
      const hasInstructions =
        (typeof existing === "string" && existing.trim().length > 0) ||
        (Array.isArray(existing) &&
          existing.some(
            (item) => typeof item === "string" && item.trim().length > 0
          ));
      if (!hasInstructions) {
        bodyData[INSTRUCTIONS_FIELD] = branchInstructions;
      }
    }
  }

  const fullHistory = branchId
    ? sessionStore.getHistoryForPrompt(sid, branchId)
    : baseHistory;
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
    prevHtmlEntry?.response.html ?? sessionStore.getPrevHtml(sid, branchId);

  const restState = sessionStore.getRestState(sid, undefined, branchId);
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
    branchId,
  });
  reqLogger.debug(`LLM prompt:\n${formatMessagesForLog(messages)}`);

  const interceptorHeader = req.headers["x-vaporvibe-request"];
  const isInterceptorHeader = Array.isArray(interceptorHeader)
    ? interceptorHeader.includes("interceptor")
    : interceptorHeader === "interceptor";
  const isInterceptorRequest =
    isInterceptorHeader || isInterceptorQuery || isInterceptorBody;
  const isInitialBranchLoad =
    branchId !== undefined ? sessionStore.isBranchEmpty(sid, branchId) : false;
  const shouldStreamBody =
    method !== "HEAD" && (!isInterceptorRequest || isInitialBranchLoad);
  const respondImmediately = isInterceptorRequest && !isInitialBranchLoad;

  const reasoningStreamEnabled = isReasoningStreamEnabled(llmClient.settings);
  if (reasoningStreamEnabled) {
    cleanupReasoningStreams(state);
  }
  const reasoningStreamController = reasoningStreamEnabled
    ? registerReasoningStream(state)
    : null;

  cleanupPendingHtml(state);
  const pendingHtmlToken = randomUUID();
  const pendingPath = `${LLM_RESULT_ROUTE_PREFIX}/${pendingHtmlToken}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Link", `<${pendingPath}>; rel="render"`);
  if (reasoningStreamController) {
    res.setHeader("X-VaporVibe-Reasoning", reasoningStreamController.token);
  }

  if (respondImmediately) {
    res.statusCode = 202;
    if (typeof res.flushHeaders === "function") {
      try {
        res.flushHeaders();
      } catch {
        // ignore flush failures
      }
    }
    res.end();
  } else {
    res.statusCode = 200;
    if (shouldStreamBody) {
      const providerLabel = getProviderLabel(llmClient.settings.provider);
      const loadingMessage = `Asking ${providerLabel} (${llmClient.settings.model}) to refresh this page.`;
      res.write(
        renderLoadingShell({
          message: loadingMessage,
          originalPath,
          resultRoutePrefix: LLM_RESULT_ROUTE_PREFIX,
          reasoningStreamToken: reasoningStreamController?.token,
          reasoningStreamRoutePrefix: LLM_REASONING_STREAM_ROUTE_PREFIX,
        })
      );
    }
    if (typeof res.flushHeaders === "function") {
      try {
        res.flushHeaders();
      } catch {
        // ignore flush failures
      }
    }
  }

  try {
    const result = await llmClient.generateHtml(
      messages,
      reasoningStreamController
        ? {
          streamObserver: {
            onReasoningEvent: (event) => {
              reasoningStreamController.emit("reasoning", {
                kind: event.kind,
                text: event.text,
              });
            },
          },
        }
        : undefined
    );
    const durationMs = Date.now() - requestStart;
    reqLogger.debug(
      `LLM response preview [${llmClient.settings.provider}]:\n${truncate(
        result.html,
        500
      )}`
    );
    const historyForCache = fullHistory;
    const {
      componentCache: historicalComponentCache,
      styleCache: historicalStyleCache,
    } = buildMasterReusableCaches(historyForCache);

    const placeholderResult = applyReusablePlaceholders(result.html, {
      componentCache: historicalComponentCache,
      styleCache: historicalStyleCache,
    });

    placeholderResult.replacedComponentIds.forEach((componentId) => {
      reqLogger.info(
        {
          placeholderType: "component",
          placeholderId: componentId,
        },
        "Reused cached HTML component"
      );
    });

    placeholderResult.replacedStyleIds.forEach((styleId) => {
      reqLogger.info(
        {
          placeholderType: "style",
          placeholderId: styleId,
        },
        "Reused cached <style> block"
      );
    });

    if (
      placeholderResult.missingComponentIds.length > 0 ||
      placeholderResult.missingStyleIds.length > 0
    ) {
      reqLogger.warn(
        {
          missingComponentIds: placeholderResult.missingComponentIds,
          missingStyleIds: placeholderResult.missingStyleIds,
        },
        "Reusable placeholders could not be resolved"
      );
    }

    const ensuredHtml = ensureHtmlDocument(placeholderResult.html, {
      method,
      path,
    });

    const strippedHtml = stripScriptById(
      stripScriptById(ensuredHtml, "vaporvibe-interceptor-script"),
      "vaporvibe-instructions-panel-script"
    );

    const nextComponentId = deriveNextNumericId(
      historicalComponentCache,
      strippedHtml,
      "data-id",
      "sl-gen-"
    );
    const nextStyleId = deriveNextNumericId(
      historicalStyleCache,
      strippedHtml,
      "data-style-id",
      "sl-style-"
    );

    const cacheResult = prepareReusableCaches(strippedHtml, {
      nextComponentId,
      nextStyleId,
    });
    const entryId = randomUUID();
    const entryMetaTag = `<meta name="vaporvibe-entry-id" content="${entryId}">`;
    const injectEntryMeta = (html: string): string => {
      if (/<head[^>]*>/i.test(html)) {
        return html.replace(/(<head[^>]*>)/i, `$1${entryMetaTag}`);
      }
      if (/<body[^>]*>/i.test(html)) {
        return html.replace(/(<body[^>]*>)/i, `$1${entryMetaTag}`);
      }
      return `${entryMetaTag}${html}`;
    };

    let promptHtml = injectEntryMeta(cacheResult.html);
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
      const instructionsScripts = getInstructionsPanelScript({
        branchId,
        branchLabel: activeBranchSummary?.label,
        forkActive: Boolean(activeForkSummary),
        forkInstructions: activeForkSummary
          ? activeForkSummary.branches.map((branch) => ({
            label: branch.label,
            instructions: branch.instructions,
          }))
          : [],
      });
      if (/<\/body\s*>/i.test(renderedHtml)) {
        renderedHtml = renderedHtml.replace(
          /(<\/body\s*>)/i,
          `${instructionsScripts}$1`
        );
      } else {
        renderedHtml = `${renderedHtml}${instructionsScripts}`;
      }
    }

    sessionStore.setPrevHtml(sid, promptHtml, branchId);

    const instructions = extractInstructions(bodyData);
    const historyEntry: HistoryEntry = {
      id: entryId,
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
      componentCache: cacheResult.componentCache,
      styleCache: cacheResult.styleCache,
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

    if (branchId) {
      sessionStore.appendToBranchHistory(sid, branchId, historyEntry, {
        preservePrevHtml: true,
      });
    } else {
      sessionStore.appendHistoryEntry(sid, historyEntry, {
        preservePrevHtml: true,
      });
    }

    const expiresAt = Date.now() + PENDING_HTML_TTL_MS;
    state.pendingHtml.set(pendingHtmlToken, {
      html: renderedHtml,
      expiresAt,
    });

    if (!respondImmediately) {
      if (shouldStreamBody) {
        if (!res.writableEnded) {
          res.write(
            renderResultHydrationScript(pendingHtmlToken, originalPath)
          );
          res.end();
        }
      } else if (!res.writableEnded) {
        res.end();
      }
    }

    if (reasoningStreamController) {
      const finalPayload = result.reasoning
        ? {
          summaries: result.reasoning.summaries,
          details: result.reasoning.details,
        }
        : undefined;
      reasoningStreamController.close(finalPayload);
    }
  } catch (error) {
    const errorDetail =
      error instanceof Error ? error.stack ?? error.message : String(error);
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    reqLogger.error(
      { err: error, stack: errorDetail },
      `LLM generation failed: ${message}`
    );

    if (reasoningStreamController) {
      const streamMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "LLM generation failed";
      reasoningStreamController.error(streamMessage);
    }

    const failureHtml = ensureHtmlDocument(renderErrorPage(error), {
      method,
      path,
    });
    state.pendingHtml.set(pendingHtmlToken, {
      html: failureHtml,
      expiresAt: Date.now() + PENDING_HTML_TTL_MS,
    });

    if (respondImmediately) {
      return;
    }

    if (shouldStreamBody) {
      try {
        res.write(
          renderLoaderErrorScript(
            "The model response took too long or failed. Please retry in a moment.",
            errorDetail
          )
        );
      } catch (writeError) {
        reqLogger.error(
          { err: writeError },
          "Failed to stream loader error script"
        );
      }
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(renderErrorPage(error));
      return;
    }

    if (!res.writableEnded) {
      res.end();
    }
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
  cleanupPendingHtml(state);
  if (!entry) {
    reqLogger.warn({ token }, "No pending HTML found for token");
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return true;
  }

  if (Date.now() > entry.expiresAt) {
    state.pendingHtml.delete(token);
    reqLogger.warn({ token }, "Pending HTML token expired");
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

function handleReasoningStreamRequest(
  context: RequestContext,
  state: MutableServerState,
  reqLogger: RequestLogger
): boolean {
  const { path, method } = context;
  if (!path.startsWith(LLM_REASONING_STREAM_ROUTE_PREFIX)) {
    return false;
  }

  cleanupReasoningStreams(state);

  if (method !== "GET") {
    context.res.statusCode = 405;
    context.res.setHeader("Allow", "GET");
    context.res.setHeader("Content-Type", "text/plain; charset=utf-8");
    context.res.end("Method Not Allowed");
    return true;
  }

  const token = path.slice(LLM_REASONING_STREAM_ROUTE_PREFIX.length).replace(/^\/+/, "");
  if (!token) {
    context.res.statusCode = 404;
    context.res.setHeader("Content-Type", "text/plain; charset=utf-8");
    context.res.end("Not Found");
    return true;
  }

  const attached = attachReasoningStream(state, token, context);
  if (!attached) {
    reqLogger.warn({ token }, "No reasoning stream found for token");
    context.res.statusCode = 404;
    context.res.setHeader("Content-Type", "text/plain; charset=utf-8");
    context.res.end("Not Found");
    return true;
  }

  reqLogger.debug({ token }, "Reasoning stream connected");
  return true;
}
