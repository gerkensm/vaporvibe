import { resolveScriptSource } from "./frontend-assets.js";

export function getNavigationInterceptorScript(): string {
  const { url, mode } = resolveScriptSource("interceptor.js", "/src/interceptor.ts");
  if (mode === "asset") {
    return `<script id="serve-llm-interceptor-script" src="${url}" defer></script>`;
  }
  return `<script type="module" id="serve-llm-interceptor-script" src="${url}"></script>`;
}
