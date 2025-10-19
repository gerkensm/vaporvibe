import { resolveScriptSource } from "./frontend-assets.js";

export function getNavigationInterceptorScript(): string {
  const { url, mode } = resolveScriptSource("interceptor.js", "/src/interceptor.ts");
  if (mode === "asset") {
    return `<script id="vaporvibe-interceptor-script" src="${url}" defer></script>`;
  }
  return `<script type="module" id="vaporvibe-interceptor-script" src="${url}"></script>`;
}
