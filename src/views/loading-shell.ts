import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { getStatusMessages } from "./loading-shell/status-messages.js";
import { LLM_REASONING_STREAM_ROUTE_PREFIX } from "../constants.js";

interface LoadingShellOptions {
  message?: string;
  accent?: string;
  originalPath?: string;
  resultRoutePrefix?: string;
  reasoningStreamToken?: string | null;
  reasoningStreamRoutePrefix?: string;
}

interface ResolvedLoadingShellOptions {
  message: string;
  accent: string;
  originalPath: string;
  resultRoutePrefix: string;
  reasoningStreamToken: string | null;
  reasoningStreamRoutePrefix: string;
}

const DEFAULT_STATUS_MESSAGE = "Summoning your adaptive canvas…";
const DEFAULT_ACCENT = "#1d4ed8";
const DEFAULT_ORIGINAL_PATH = "/";
const DEFAULT_RESULT_PREFIX = "/__vaporvibe/result";
const DEFAULT_REASONING_PREFIX = LLM_REASONING_STREAM_ROUTE_PREFIX;

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

  const reasoningStreamToken =
    typeof options.reasoningStreamToken === "string" &&
      options.reasoningStreamToken.trim().length > 0
      ? options.reasoningStreamToken.trim()
      : null;

  const reasoningStreamRoutePrefix =
    typeof options.reasoningStreamRoutePrefix === "string" &&
      options.reasoningStreamRoutePrefix.trim().length > 0
      ? options.reasoningStreamRoutePrefix
      : DEFAULT_REASONING_PREFIX;

  return {
    message,
    accent,
    originalPath,
    resultRoutePrefix,
    reasoningStreamToken,
    reasoningStreamRoutePrefix,
  };
}

function escapeForInlineScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003C");
}

function renderStyles(accent: string): string {
  const stylesheet = readAsset("styles.css");
  return stylesheet.replace(/__ACCENT_COLOR__/g, accent);
}

function renderStatusScript(message: string, rotationEnabled: boolean): string {
  const script = readAsset("status-rotation.js");
  const statuses = getStatusMessages().map((entry) => entry.headline);
  return script
    .replace("__DEFAULT_MESSAGE__", escapeForInlineScript(DEFAULT_STATUS_MESSAGE))
    .replace("__PROVIDED_MESSAGE__", escapeForInlineScript(message))
    .replace("__STATUS_MESSAGES__", escapeForInlineScript(statuses))
    .replace("__ROTATION_ENABLED__", rotationEnabled ? "true" : "false");
}

function renderHydrationScript(resultRoutePrefix: string, originalPath: string): string {
  const script = readAsset("hydrate.js");
  return script
    .replace("__RESULT_ROUTE_PREFIX__", escapeForInlineScript(resultRoutePrefix))
    .replace("__ORIGINAL_PATH__", escapeForInlineScript(originalPath));
}

function renderReasoningStreamScript(
  token: string,
  routePrefix: string
): string {
  const script = readAsset("reasoning-stream.js");
  const config = escapeForInlineScript({ token, routePrefix });
  return `window.__vaporVibeReasoningStream = ${config};\n${script}`;
}

export function renderLoadingShell(options: LoadingShellOptions = {}): string {
  const resolved = resolveOptions(options);
  const styles = renderStyles(resolved.accent);
  const rotationEnabled = !resolved.reasoningStreamToken;
  const statusScript = renderStatusScript(resolved.message, rotationEnabled);
  const hydrationScript = renderHydrationScript(
    resolved.resultRoutePrefix,
    resolved.originalPath
  );
  const reasoningScript = resolved.reasoningStreamToken
    ? renderReasoningStreamScript(
      resolved.reasoningStreamToken,
      resolved.reasoningStreamRoutePrefix
    )
    : "";
  const scriptContent = `${statusScript}${reasoningScript}${hydrationScript}`;

  const reasoningSection = resolved.reasoningStreamToken
    ? [
      `    <section class="reasoning-panel" data-reasoning-panel aria-live="polite" aria-label="Model reasoning updates">`,
      `      <div class="reasoning-heading">Model is thinking…</div>`,
      `      <div class="reasoning-log" data-reasoning-log></div>`,
      `    </section>`,
      ``
    ].join("\n")
    : "";

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
      <h1>Generating your next view</h1>
      <p class="status" data-status>${resolved.message}</p>
      <p class="hint">Hold tight—we ask your configured model to compose a fresh canvas. This usually lands within a minute.</p>
${reasoningSection}      <footer>
        <span>vaporvibe keeps the last brief and request context warm.</span>
        <span>We’ll swap in the live page as soon as it arrives.</span>
      </footer>
    </div>
  </main>
  <script>
${scriptContent}
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
