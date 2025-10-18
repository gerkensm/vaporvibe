interface InstructionsPanelConfig {
  adminRoutePrefix: string;
  instructionsField: string;
}

const globalScope = window as Window & {
  __SERVE_LLM_INSTRUCTIONS_CONFIG__?: Partial<InstructionsPanelConfig>;
  serveLlmInstructionsPanelAttached?: boolean;
};

const resolvedConfig: InstructionsPanelConfig = {
  adminRoutePrefix:
    globalScope.__SERVE_LLM_INSTRUCTIONS_CONFIG__?.adminRoutePrefix ??
    "/serve-llm",
  instructionsField:
    globalScope.__SERVE_LLM_INSTRUCTIONS_CONFIG__?.instructionsField ??
    "instructions",
};

delete globalScope.__SERVE_LLM_INSTRUCTIONS_CONFIG__;

const styles = [
  "#serve-llm-instructions-panel { position: fixed; bottom: 20px; right: 20px; z-index: 2147483600; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #0f172a; }",
  "#serve-llm-instructions-panel * { box-sizing: border-box; font-family: inherit; }",
  "#serve-llm-instructions-panel button { cursor: pointer; }",
  "#serve-llm-instructions-panel textarea { font-family: inherit; }",
  "#serve-llm-instructions-panel[data-state=collapsed] .serve-llm-instructions-shell { display: none; }",
  "#serve-llm-instructions-panel[data-state=expanded] .serve-llm-instructions-toggle { display: none; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-toggle { border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 999px; padding: 12px 18px; background: rgba(15, 23, 42, 0.9); color: #f8fafc; font-weight: 600; font-size: 0.88rem; display: flex; align-items: center; gap: 10px; box-shadow: 0 18px 44px rgba(15, 23, 42, 0.34); backdrop-filter: blur(12px); transition: transform 140ms ease, box-shadow 180ms ease, background 180ms ease; letter-spacing: 0.01em; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-toggle:hover { transform: translateY(-1px); box-shadow: 0 22px 52px rgba(15, 23, 42, 0.4); background: rgba(15, 23, 42, 0.82); }",
  "#serve-llm-instructions-panel .serve-llm-instructions-toggle:focus-visible { outline: 2px solid rgba(148, 163, 184, 0.65); outline-offset: 3px; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-toggle .serve-llm-token { width: 24px; height: 24px; border-radius: 999px; display: grid; place-items: center; font-size: 0.72rem; font-weight: 700; line-height: 1; background: linear-gradient(135deg, rgba(59, 130, 246, 0.92), rgba(139, 92, 246, 0.88)); box-shadow: 0 6px 16px rgba(79, 70, 229, 0.45); }",
  "#serve-llm-instructions-panel .serve-llm-instructions-toggle span:last-child { display: inline-block; transform: translateY(1px); }",
  "#serve-llm-instructions-panel .serve-llm-instructions-shell { width: 320px; padding: 18px; border-radius: 20px; background: rgba(255, 255, 255, 0.94); border: 1px solid rgba(15, 23, 42, 0.12); box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28); backdrop-filter: blur(12px); display: grid; gap: 12px; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-header { display: flex; align-items: center; justify-content: space-between; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-title { font-size: 0.95rem; font-weight: 600; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-close { border: none; background: transparent; color: #475569; padding: 6px; border-radius: 999px; width: 30px; height: 30px; display: grid; place-items: center; font-size: 1rem; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-close:hover { background: rgba(148, 163, 184, 0.18); color: #1e293b; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-description { font-size: 0.83rem; color: #475569; margin: 0; line-height: 1.5; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-form { display: grid; gap: 10px; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-label { font-size: 0.78rem; font-weight: 500; color: #334155; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-textarea { width: 100%; min-height: 100px; border-radius: 14px; padding: 12px 14px; border: 1px solid rgba(15, 23, 42, 0.16); background: rgba(248, 250, 252, 0.94); resize: vertical; font-size: 0.9rem; line-height: 1.45; color: inherit; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-textarea:focus-visible { outline: 2px solid rgba(37, 99, 235, 0.65); outline-offset: 2px; background: #fff; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-actions { display: flex; gap: 10px; }",
  "#serve-llm-instructions-panel .serve-llm-instructions-submit { flex: 1; border: none; border-radius: 12px; padding: 10px 14px; font-weight: 600; font-size: 0.9rem; color: #fff; background: linear-gradient(135deg, #2563eb, #1d4ed8); box-shadow: 0 18px 40px rgba(37, 99, 235, 0.35); }",
  "#serve-llm-instructions-panel .serve-llm-instructions-submit:hover { box-shadow: 0 20px 44px rgba(37, 99, 235, 0.42); transform: translateY(-1px); }",
  "#serve-llm-instructions-panel .serve-llm-instructions-cancel { flex: 1; border: none; border-radius: 12px; padding: 10px 14px; font-weight: 600; font-size: 0.9rem; color: #0f172a; background: rgba(148, 163, 184, 0.18); }",
  "#serve-llm-instructions-panel .serve-llm-instructions-cancel:hover { background: rgba(148, 163, 184, 0.26); }",
  "#serve-llm-instructions-panel .serve-llm-instructions-status { font-size: 0.8rem; color: #475569; margin: 0; min-height: 1.5em; }",
  "#serve-llm-instructions-panel .serve-llm-admin-link { font-size: 0.78rem; color: #1d4ed8; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }",
  "#serve-llm-instructions-panel .serve-llm-admin-link:hover { color: #1e40af; text-decoration: underline; }",
  "#serve-llm-instructions-panel .serve-llm-admin-link svg { width: 12px; height: 12px; fill: currentColor; }",
  "@media (max-width: 600px) { #serve-llm-instructions-panel { right: 12px; left: 12px; bottom: 12px; } #serve-llm-instructions-panel .serve-llm-instructions-shell { width: auto; } }",
];

const styleBlock = `\n<style>\n${styles.map((line) => `  ${line}`).join("\n")}\n</style>`;

const markup = [
  '<div class="serve-llm-instructions-toggle">',
  '  <span class="serve-llm-token">AI</span>',
  '  <span>Give the model a nudge</span>',
  '</div>',
  '<div class="serve-llm-instructions-shell">',
  '  <div class="serve-llm-instructions-header">',
  '    <div class="serve-llm-instructions-title">Quick instructions</div>',
  '    <button type="button" class="serve-llm-instructions-close" aria-label="Close instructions panel">',
  '      <svg viewBox="0 0 24 24" aria-hidden="true">',
  '        <path d="M6.225 4.811a1 1 0 0 0-1.414 1.414L9.586 11 4.811 15.775a1 1 0 1 0 1.414 1.414L11 12.414l4.775 4.775a1 1 0 0 0 1.414-1.414L12.414 11l4.775-4.775a1 1 0 0 0-1.414-1.414L11 9.586 6.225 4.811Z" />',
  '      </svg>',
  '    </button>',
  '  </div>',
  '  <p class="serve-llm-instructions-description">Drop a quick hint or override to steer the next render. These instructions apply to the very next request only.</p>',
  '  <form class="serve-llm-instructions-form" data-serve-llm-instructions-form>',
  '    <label class="serve-llm-instructions-label" for="serve-llm-instructions-textarea">What should the model change next?</label>',
  `    <textarea id="serve-llm-instructions-textarea" class="serve-llm-instructions-textarea" name="${resolvedConfig.instructionsField}" placeholder="e.g. \"Try a dark mode layout with floating cards\"" data-serve-llm-instructions-input></textarea>`,
  '    <div class="serve-llm-instructions-actions">',
  '      <button type="submit" class="serve-llm-instructions-submit">Send to model</button>',
  '      <button type="button" class="serve-llm-instructions-cancel">Clear</button>',
  '    </div>',
  '    <p class="serve-llm-instructions-status" aria-live="polite" data-serve-llm-instructions-status></p>',
  '  </form>',
  `  <a class="serve-llm-admin-link" href="${resolvedConfig.adminRoutePrefix}" data-serve-llm-admin-link>`,
  '    <svg viewBox="0 0 24 24" aria-hidden="true">',
  '      <path d="M12 5v2.586l1.707-1.707a1 1 0 0 1 1.414 1.414L12 10.414l-3.121-3.121a1 1 0 0 1 1.414-1.414L11 7.586V5a1 1 0 1 1 2 0Zm-7 5a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H7v7h10v-7h-1a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8Z" />',
  '    </svg>',
  '    Open admin console',
  '  </a>',
  '</div>',
].join("\n");

const PANEL_ID = "serve-llm-instructions-panel";
const PANEL_STATE_ATTR = "data-state";
const PANEL_COLLAPSED = "collapsed";
const PANEL_EXPANDED = "expanded";

function ensurePanel(): HTMLElement | null {
  const existing = document.getElementById(PANEL_ID);
  if (existing) return existing;
  if (!document.body) return null;

  const container = document.createElement("div");
  container.id = PANEL_ID;
  container.setAttribute(PANEL_STATE_ATTR, PANEL_COLLAPSED);
  container.innerHTML = `${styleBlock}\n${markup}`;
  document.body.appendChild(container);
  return container;
}

function updateStatus(message?: string): void {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  const status = panel.querySelector<HTMLElement>(
    "[data-serve-llm-instructions-status]"
  );
  if (!status) return;
  status.textContent = message ?? "";
}

function setExpanded(expanded: boolean): void {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  panel.setAttribute(PANEL_STATE_ATTR, expanded ? PANEL_EXPANDED : PANEL_COLLAPSED);
  if (expanded) {
    const textarea = panel.querySelector<HTMLTextAreaElement>(
      "[data-serve-llm-instructions-input]"
    );
    textarea?.focus({ preventScroll: true });
    textarea?.select();
  }
}

function submitInstructions(value: string): void {
  if (!document.body) return;

  updateStatus("Submitting instructions…");
  const ghostForm = document.createElement("form");
  ghostForm.method = "post";
  ghostForm.action = window.location.pathname + window.location.search;
  Object.assign(ghostForm.style, {
    position: "absolute",
    width: "0",
    height: "0",
    overflow: "hidden",
    opacity: "0",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);

  const payload = document.createElement("input");
  payload.type = "hidden";
  payload.name = resolvedConfig.instructionsField;
  payload.value = value;
  ghostForm.appendChild(payload);

  const hiddenInputs = document.querySelectorAll<HTMLInputElement>(
    "input[type=\"hidden\"]"
  );
  const panel = document.getElementById(PANEL_ID);
  hiddenInputs.forEach((input) => {
    if (!input.name) return;
    if (input.disabled) return;
    if (input.name === resolvedConfig.instructionsField) return;
    if (panel && panel.contains(input)) return;
    if (ghostForm.contains(input)) return;

    const clone = document.createElement("input");
    clone.type = "hidden";
    clone.name = input.name;
    clone.value = input.value;
    ghostForm.appendChild(clone);
  });

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.style.display = "none";
  ghostForm.appendChild(submit);

  document.body.appendChild(ghostForm);

  if (typeof ghostForm.requestSubmit === "function") {
    ghostForm.requestSubmit(submit);
  } else {
    const event =
      typeof SubmitEvent === "function"
        ? new SubmitEvent("submit", {
            bubbles: true,
            cancelable: true,
            submitter: submit,
          })
        : new Event("submit", { bubbles: true, cancelable: true });
    const prevented = !ghostForm.dispatchEvent(event);
    if (!prevented) ghostForm.submit();
  }
}

function bootstrapPanel(): void {
  const panel = ensurePanel();
  if (!panel) return;

  const toggle = panel.querySelector<HTMLButtonElement>(
    ".serve-llm-instructions-toggle"
  );
  const closeBtn = panel.querySelector<HTMLButtonElement>(
    ".serve-llm-instructions-close"
  );
  const cancelBtn = panel.querySelector<HTMLButtonElement>(
    ".serve-llm-instructions-cancel"
  );
  const textarea = panel.querySelector<HTMLTextAreaElement>(
    "[data-serve-llm-instructions-input]"
  );
  const form = panel.querySelector<HTMLFormElement>(
    "[data-serve-llm-instructions-form]"
  );

  if (toggle) {
    toggle.addEventListener("click", () => {
      const expanded = panel.getAttribute(PANEL_STATE_ATTR) === PANEL_EXPANDED;
      setExpanded(!expanded);
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      setExpanded(false);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (textarea) textarea.value = "";
      setExpanded(false);
      updateStatus("Cleared pending instructions.");
    });
  }

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!textarea) return;
      const value = textarea.value.trim();
      if (!value) {
        textarea.focus();
        updateStatus("Add a quick instruction before submitting.");
        return;
      }
      submitInstructions(value);
    });
  }

  updateStatus();
}

function initInstructionsPanel(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapPanel, { once: true });
  } else {
    bootstrapPanel();
  }
}

if (!globalScope.serveLlmInstructionsPanelAttached) {
  globalScope.serveLlmInstructionsPanelAttached = true;
  initInstructionsPanel();
}
