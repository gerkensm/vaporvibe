import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { getStatusMessages } from "./loading-shell/status-messages.js";

interface LoadingShellOptions {
  message?: string;
  accent?: string;
  originalPath?: string;
  resultRoutePrefix?: string;
}

interface ResolvedLoadingShellOptions {
  message: string;
  accent: string;
  originalPath: string;
  resultRoutePrefix: string;
}

const DEFAULT_STATUS_MESSAGE = "Summoning your adaptive canvas…";
const DEFAULT_ACCENT = "#1d4ed8";
const DEFAULT_ORIGINAL_PATH = "/";
const DEFAULT_RESULT_PREFIX = "/__vaporvibe/result";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMPILED_ASSET_DIR = resolvePath(__dirname, "loading-shell/assets");
const SOURCE_ASSET_DIR = resolvePath(__dirname, "../../src/views/loading-shell/assets");

const assetCache = new Map<string, string>();

function readAsset(assetName: string): string {
  const cached = assetCache.get(assetName);
  if (cached) {
    return cached;
  }

  const compiledPath = resolvePath(COMPILED_ASSET_DIR, assetName);
  if (existsSync(compiledPath)) {
    const compiledContent = readFileSync(compiledPath, "utf8");
    assetCache.set(assetName, compiledContent);
    return compiledContent;
  }

  const sourcePath = resolvePath(SOURCE_ASSET_DIR, assetName);
  const sourceContent = readFileSync(sourcePath, "utf8");
  assetCache.set(assetName, sourceContent);
  return sourceContent;
}

function resolveOptions(options: LoadingShellOptions = {}): ResolvedLoadingShellOptions {
  const message =
    typeof options.message === "string" && options.message.trim().length > 0
      ? options.message
      : DEFAULT_STATUS_MESSAGE;
  const accent =
    typeof options.accent === "string" && options.accent.trim().length > 0
      ? options.accent
      : DEFAULT_ACCENT;
  const originalPath =
    typeof options.originalPath === "string" && options.originalPath.trim().length > 0
      ? options.originalPath
      : DEFAULT_ORIGINAL_PATH;
  const resultRoutePrefix =
    typeof options.resultRoutePrefix === "string" &&
    options.resultRoutePrefix.trim().length > 0
      ? options.resultRoutePrefix
      : DEFAULT_RESULT_PREFIX;

  return { message, accent, originalPath, resultRoutePrefix };
}

function escapeForInlineScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003C");
}

function renderStyles(accent: string): string {
  const stylesheet = readAsset("styles.css");
  return stylesheet.replace(/__ACCENT_COLOR__/g, accent);
}

function renderStatusScript(message: string): string {
  const script = readAsset("status-rotation.js");
  const statuses = getStatusMessages().map((entry) => entry.headline);
  return script
    .replace("__DEFAULT_MESSAGE__", escapeForInlineScript(DEFAULT_STATUS_MESSAGE))
    .replace("__PROVIDED_MESSAGE__", escapeForInlineScript(message))
    .replace("__STATUS_MESSAGES__", escapeForInlineScript(statuses));
}

function renderHydrationScript(resultRoutePrefix: string, originalPath: string): string {
  const script = readAsset("hydrate.js");
  return script
    .replace("__RESULT_ROUTE_PREFIX__", escapeForInlineScript(resultRoutePrefix))
    .replace("__ORIGINAL_PATH__", escapeForInlineScript(originalPath));
}

export function renderLoadingShell(options: LoadingShellOptions = {}): string {
  const resolved = resolveOptions(options);
  const styles = renderStyles(resolved.accent);
  const statusScript = renderStatusScript(resolved.message);
  const hydrationScript = renderHydrationScript(
    resolved.resultRoutePrefix,
    resolved.originalPath
  );

  // Intentionally omit closing </body>/<html> so later chunks can append hydration scripts before finishing the document.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Loading · vaporvibe</title>
<style>
${styles}
</style>
</head>
<body data-vaporvibe-loading>
  <main>
    <div class="stage">
      <div class="pulse">
        <div class="spinner" role="status" aria-live="polite" aria-label="Generating the next view"></div>
      </div>
    </div>
    <h1>Generating your next view</h1>
    <p class="status" data-status>${resolved.message}</p>
    <p class="hint">Hold tight—we ask your configured model to compose a fresh canvas. This usually lands within a minute.</p>
    <footer>
      <span>vaporvibe keeps the last brief and request context warm.</span>
      <span>We’ll swap in the live page as soon as it arrives.</span>
    </footer>
  </main>
  <script>
${statusScript}
${hydrationScript}
  </script>`;
}

export function renderResultHydrationScript(token: string, path: string): string {
  const tokenPayload = escapeForInlineScript(token);
  const pathPayload = escapeForInlineScript(path);
  return `<script>window.__vaporVibeHydrateFromToken(${tokenPayload}, ${pathPayload});</script></body></html>`;
}

export function renderLoaderErrorScript(
  message: string,
  detail?: string
): string {
  const messagePayload = escapeForInlineScript(message);
  const detailPayload = detail ? escapeForInlineScript(detail) : "null";
  return `<script>window.__vaporVibeHydrateError(${messagePayload}, ${detailPayload});</script></body></html>`;
}
