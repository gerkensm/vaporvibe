import { ADMIN_ROUTE_PREFIX, INSTRUCTIONS_FIELD } from "../constants.js";
import { resolveScriptSource } from "./frontend-assets.js";

export function getInstructionsPanelScript(): string {
  const config = {
    adminRoutePrefix: ADMIN_ROUTE_PREFIX,
    instructionsField: INSTRUCTIONS_FIELD,
  };

  const configScript = `window.__SERVE_LLM_INSTRUCTIONS_CONFIG__ = ${JSON.stringify(
    config
  )};`;

  const { url, mode } = resolveScriptSource(
    "vaporvibe-instructions-panel.js",
    "/src/instructions-panel.ts"
  );

  const loaderTag =
    mode === "asset"
      ? `<script id="vaporvibe-instructions-panel-script" src="${url}" defer></script>`
      : `<script type="module" id="vaporvibe-instructions-panel-script" src="${url}"></script>`;

  return [`<script>${configScript}</script>`, loaderTag].join("");
}
