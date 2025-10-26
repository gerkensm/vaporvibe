import { ADMIN_ROUTE_PREFIX, INSTRUCTIONS_FIELD } from "../constants.js";
import type { BranchLabel } from "../types.js";
import { resolveScriptSource } from "./frontend-assets.js";

interface InstructionsPanelOptions {
  branchId?: string | null;
  branchLabel?: BranchLabel | null;
  forkActive?: boolean;
  forkInstructions?: Array<{ label: BranchLabel; instructions: string }>;
}

export function getInstructionsPanelScript(
  options: InstructionsPanelOptions = {}
): string {
  const config = {
    adminRoutePrefix: ADMIN_ROUTE_PREFIX,
    instructionsField: INSTRUCTIONS_FIELD,
    branchId: options.branchId ?? null,
    branchLabel: options.branchLabel ?? null,
    forkActive: options.forkActive ?? false,
    forkInstructions: options.forkInstructions ?? [],
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
