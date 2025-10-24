import { getStatusMessages } from "../views/loading-shell/status-messages.js";
import { resolveScriptSource } from "./frontend-assets.js";

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003C");
}

export function getNavigationInterceptorScript(): string {
  const { url, mode } = resolveScriptSource(
    "vaporvibe-interceptor.js",
    "/src/interceptor.ts"
  );
  const statusMessages = getStatusMessages();
  const statusBootstrap = `<script>window.__vaporVibeStatusMessages = ${serializeForInlineScript(
    statusMessages
  )};</script>`;
  if (mode === "asset") {
    return `${statusBootstrap}<script id="vaporvibe-interceptor-script" src="${url}" defer></script>`;
  }
  return `${statusBootstrap}<script type="module" id="vaporvibe-interceptor-script" src="${url}"></script>`;
}
