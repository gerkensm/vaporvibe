(() => {
  interface InstructionsPanelConfig {
    adminRoutePrefix: string;
    instructionsField: string;
    branchId?: string | null;
    branchLabel?: string | null;
    forkActive?: boolean;
    forkInstructions?: Array<{ label: string; instructions: string }>;
  }

  const BRANCH_FIELD = "__vaporvibe_branch";

  const globalScope = window as Window & {
    __SERVE_LLM_INSTRUCTIONS_CONFIG__?: Partial<InstructionsPanelConfig>;
  };

  const resolvedConfig: InstructionsPanelConfig = {
    adminRoutePrefix:
      globalScope.__SERVE_LLM_INSTRUCTIONS_CONFIG__?.adminRoutePrefix ??
      "/vaporvibe",
    instructionsField:
      globalScope.__SERVE_LLM_INSTRUCTIONS_CONFIG__?.instructionsField ??
      "instructions",
    branchId:
      globalScope.__SERVE_LLM_INSTRUCTIONS_CONFIG__?.branchId ?? undefined,
    branchLabel:
      globalScope.__SERVE_LLM_INSTRUCTIONS_CONFIG__?.branchLabel ?? undefined,
    forkActive:
      globalScope.__SERVE_LLM_INSTRUCTIONS_CONFIG__?.forkActive ?? undefined,
    forkInstructions:
      globalScope.__SERVE_LLM_INSTRUCTIONS_CONFIG__?.forkInstructions ??
      undefined,
  };

  delete globalScope.__SERVE_LLM_INSTRUCTIONS_CONFIG__;

  const activeBranchId =
    typeof resolvedConfig.branchId === "string" &&
    resolvedConfig.branchId.trim().length > 0
      ? resolvedConfig.branchId.trim()
      : null;
  const activeBranchLabel =
    typeof resolvedConfig.branchLabel === "string" &&
    resolvedConfig.branchLabel.trim().length > 0
      ? resolvedConfig.branchLabel.trim()
      : null;
  const forkActive = resolvedConfig.forkActive === true;
  const forkInstructions = Array.isArray(resolvedConfig.forkInstructions)
    ? resolvedConfig.forkInstructions
    : [];

  const styles = [
  "#vaporvibe-instructions-panel { position: fixed; bottom: 20px; right: 20px; z-index: 2147483600; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #0f172a; }",
  "#vaporvibe-instructions-panel * { box-sizing: border-box; font-family: inherit; }",
  "#vaporvibe-instructions-panel button { cursor: pointer; }",
  "#vaporvibe-instructions-panel textarea { font-family: inherit; }",
  "#vaporvibe-instructions-panel[data-state=collapsed] .vaporvibe-instructions-shell { display: none; }",
  "#vaporvibe-instructions-panel[data-state=expanded] .vaporvibe-instructions-toggle { display: none; }",
  "#vaporvibe-instructions-panel .admin-primary, #vaporvibe-ab-modal .admin-primary, #vaporvibe-instructions-panel .admin-secondary, #vaporvibe-ab-modal .admin-secondary { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; font-weight: 600; font-size: 0.95rem; text-decoration: none; padding: 10px 22px; transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }",
  "#vaporvibe-instructions-panel .admin-primary, #vaporvibe-ab-modal .admin-primary { border: none; color: #fff; background: linear-gradient(135deg, #2563eb, #1d4ed8); box-shadow: 0 20px 40px rgba(37, 99, 235, 0.25); cursor: pointer; }",
  "#vaporvibe-instructions-panel .admin-primary:disabled, #vaporvibe-ab-modal .admin-primary:disabled { cursor: progress; opacity: 0.7; box-shadow: none; }",
  "#vaporvibe-instructions-panel .admin-primary:not(:disabled):hover, #vaporvibe-instructions-panel .admin-primary:not(:disabled):focus-visible, #vaporvibe-ab-modal .admin-primary:not(:disabled):hover, #vaporvibe-ab-modal .admin-primary:not(:disabled):focus-visible { transform: translateY(-1px); box-shadow: 0 24px 44px rgba(37, 99, 235, 0.35); outline: none; }",
  "#vaporvibe-instructions-panel .admin-secondary, #vaporvibe-ab-modal .admin-secondary { border: 1px solid rgba(148, 163, 184, 0.35); color: #1d4ed8; background: rgba(248, 250, 252, 0.94); cursor: pointer; }",
  "#vaporvibe-instructions-panel .admin-secondary:disabled, #vaporvibe-ab-modal .admin-secondary:disabled { cursor: progress; opacity: 0.7; }",
  "#vaporvibe-instructions-panel .admin-secondary:not(:disabled):hover, #vaporvibe-instructions-panel .admin-secondary:not(:disabled):focus-visible, #vaporvibe-ab-modal .admin-secondary:not(:disabled):hover, #vaporvibe-ab-modal .admin-secondary:not(:disabled):focus-visible { transform: translateY(-1px); border-color: rgba(59, 130, 246, 0.45); box-shadow: 0 14px 28px rgba(37, 99, 235, 0.18); outline: none; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-toggle { border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 999px; padding: 12px 18px; background: rgba(15, 23, 42, 0.9); color: #f8fafc; font-weight: 600; font-size: 0.88rem; display: flex; align-items: center; gap: 10px; box-shadow: 0 18px 44px rgba(15, 23, 42, 0.34); backdrop-filter: blur(12px); transition: transform 140ms ease, box-shadow 180ms ease, background 180ms ease; letter-spacing: 0.01em; cursor: pointer; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-toggle:hover { transform: translateY(-1px); box-shadow: 0 22px 52px rgba(15, 23, 42, 0.4); background: rgba(15, 23, 42, 0.82); }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-toggle:focus-visible { outline: 2px solid rgba(148, 163, 184, 0.65); outline-offset: 3px; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-toggle .vaporvibe-token { width: 24px; height: 24px; border-radius: 999px; display: grid; place-items: center; font-size: 0.72rem; font-weight: 700; line-height: 1; background: linear-gradient(135deg, rgba(59, 130, 246, 0.92), rgba(139, 92, 246, 0.88)); box-shadow: 0 6px 16px rgba(79, 70, 229, 0.45); }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-toggle span:last-child { display: inline-block; transform: translateY(1px); }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-shell { width: 320px; padding: 18px; border-radius: 20px; background: rgba(255, 255, 255, 0.94); border: 1px solid rgba(15, 23, 42, 0.12); box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28); backdrop-filter: blur(12px); display: grid; gap: 12px; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-header { display: flex; align-items: center; justify-content: space-between; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-title { font-size: 0.95rem; font-weight: 600; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-close { border: none; background: transparent; color: #475569; padding: 6px; border-radius: 999px; width: 30px; height: 30px; display: grid; place-items: center; font-size: 1rem; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-close:hover { background: rgba(148, 163, 184, 0.18); color: #1e293b; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-description { font-size: 0.83rem; color: #475569; margin: 0; line-height: 1.5; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-form { display: grid; gap: 10px; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-label { font-size: 0.78rem; font-weight: 500; color: #334155; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-textarea { width: 100%; min-height: 100px; border-radius: 14px; padding: 12px 14px; border: 1px solid rgba(15, 23, 42, 0.16); background: rgba(248, 250, 252, 0.94); resize: vertical; font-size: 0.9rem; line-height: 1.45; color: inherit; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-textarea:focus-visible { outline: 2px solid rgba(37, 99, 235, 0.65); outline-offset: 2px; background: #fff; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-actions { display: flex; gap: 10px; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-submit { flex: 1; border: none; border-radius: 12px; padding: 10px 14px; font-weight: 600; font-size: 0.9rem; color: #fff; background: linear-gradient(135deg, #2563eb, #1d4ed8); box-shadow: 0 18px 40px rgba(37, 99, 235, 0.35); }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-submit:hover { box-shadow: 0 20px 44px rgba(37, 99, 235, 0.42); transform: translateY(-1px); }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-cancel { flex: 1; border: none; border-radius: 12px; padding: 10px 14px; font-weight: 600; font-size: 0.9rem; color: #0f172a; background: rgba(148, 163, 184, 0.18); }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-cancel:hover { background: rgba(148, 163, 184, 0.26); }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-ab-launch { display: grid; gap: 8px; padding-top: 4px; border-top: 1px solid rgba(148, 163, 184, 0.18); }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-ab-button { border: 1px solid rgba(59, 130, 246, 0.28); background: rgba(59, 130, 246, 0.08); color: #1d4ed8; border-radius: 12px; font-weight: 600; font-size: 0.85rem; padding: 10px 14px; display: inline-flex; gap: 8px; align-items: center; justify-content: center; transition: background 160ms ease, transform 160ms ease, box-shadow 160ms ease; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-ab-button:hover { background: rgba(59, 130, 246, 0.15); box-shadow: 0 12px 30px rgba(59, 130, 246, 0.22); transform: translateY(-1px); }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-ab-helper { font-size: 0.75rem; color: #475569; margin: 0; text-align: center; }",
  "#vaporvibe-instructions-panel .vaporvibe-instructions-status { font-size: 0.8rem; color: #475569; margin: 0; min-height: 1.5em; }",
  "#vaporvibe-instructions-panel .vaporvibe-admin-link { font-size: 0.78rem; color: #1d4ed8; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }",
  "#vaporvibe-instructions-panel .vaporvibe-admin-link:hover { color: #1e40af; text-decoration: underline; }",
  "#vaporvibe-instructions-panel .vaporvibe-admin-link svg { width: 12px; height: 12px; fill: currentColor; }",
  "#vaporvibe-ab-modal { position: fixed; inset: 0; z-index: 2147483640; background: rgba(15, 23, 42, 0.45); display: grid; place-items: center; padding: 20px; }",
  "#vaporvibe-ab-modal[data-state=hidden] { display: none; }",
  "#vaporvibe-ab-modal .vaporvibe-ab-dialog { max-width: 560px; width: 100%; background: rgba(255, 255, 255, 0.97); border-radius: 24px; box-shadow: 0 32px 120px rgba(15, 23, 42, 0.35); border: 1px solid rgba(15, 23, 42, 0.12); padding: 28px; display: grid; gap: 18px; }",
  "#vaporvibe-ab-modal .vaporvibe-ab-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; }",
  "#vaporvibe-ab-modal .vaporvibe-ab-title { font-size: 1.12rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 10px; }",
  "#vaporvibe-ab-modal .vaporvibe-ab-description { margin: 0; font-size: 0.9rem; color: #475569; line-height: 1.6; }",
  "#vaporvibe-ab-modal .vaporvibe-ab-form { display: grid; gap: 16px; }",
  "#vaporvibe-ab-modal .vaporvibe-ab-field { display: grid; gap: 8px; }",
  "#vaporvibe-ab-modal .vaporvibe-ab-label { font-weight: 600; font-size: 0.88rem; color: #1e293b; }",
  "#vaporvibe-ab-modal .vaporvibe-ab-textarea { min-height: 110px; border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.32); padding: 12px 14px; font-size: 0.9rem; line-height: 1.5; resize: vertical; background: rgba(248, 250, 252, 0.9); color: #0f172a; }",
  "#vaporvibe-ab-modal .vaporvibe-ab-textarea:focus-visible { outline: 2px solid rgba(59, 130, 246, 0.55); background: #fff; }",
  "#vaporvibe-ab-modal .vaporvibe-ab-actions { display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap; }",
  "#vaporvibe-ab-modal .vaporvibe-ab-close { border: none; background: transparent; color: #475569; padding: 8px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 1rem; transition: background 0.2s ease, color 0.2s ease; }",
  "#vaporvibe-ab-modal .vaporvibe-ab-close:hover { background: rgba(148, 163, 184, 0.2); color: #1e293b; }",
  "#vaporvibe-ab-modal .vaporvibe-ab-status { font-size: 0.82rem; color: #dc2626; margin: 0; min-height: 1.4em; }",
  "#vaporvibe-ab-launch-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); z-index: 2147483641; display: grid; place-items: center; color: #f8fafc; font-size: 1rem; font-weight: 600; letter-spacing: 0.01em; }",
  "#vaporvibe-ab-launch-overlay .vaporvibe-ab-launch-card { padding: 26px 32px; border-radius: 24px; background: rgba(15, 23, 42, 0.86); box-shadow: 0 24px 70px rgba(15, 23, 42, 0.35); display: grid; gap: 6px; text-align: center; }",
  "#vaporvibe-ab-launch-overlay .vaporvibe-ab-launch-subtle { font-size: 0.9rem; font-weight: 400; color: rgba(241, 245, 249, 0.88); }",
  "#vaporvibe-instructions-panel[data-mode=ab-disabled] .vaporvibe-instructions-toggle { display: none; }",
  "@media (max-width: 600px) { #vaporvibe-ab-modal .vaporvibe-ab-dialog { padding: 22px; } #vaporvibe-ab-modal .vaporvibe-ab-actions { justify-content: stretch; } #vaporvibe-ab-modal .admin-primary, #vaporvibe-ab-modal .admin-secondary { flex: 1 1 auto; justify-content: center; } }",
  "@media (max-width: 600px) { #vaporvibe-instructions-panel { right: 12px; left: 12px; bottom: 12px; } #vaporvibe-instructions-panel .vaporvibe-instructions-shell { width: auto; } }",
];

  const styleBlock = `\n<style>\n${styles
    .map((line) => `  ${line}`)
    .join("\n")}\n</style>`;

  const markup = [
  '<div class="vaporvibe-instructions-toggle">',
  '  <span class="vaporvibe-token">AI</span>',
  '  <span>Give the model a nudge</span>',
  '</div>',
  '<div class="vaporvibe-instructions-shell">',
  '  <div class="vaporvibe-instructions-header">',
  '    <div class="vaporvibe-instructions-title">Quick instructions</div>',
  '    <button type="button" class="vaporvibe-instructions-close" aria-label="Close instructions panel">',
  '      <svg viewBox="0 0 24 24" aria-hidden="true">',
  '        <path d="M6.225 4.811a1 1 0 0 0-1.414 1.414L9.586 11 4.811 15.775a1 1 0 1 0 1.414 1.414L11 12.414l4.775 4.775a1 1 0 0 0 1.414-1.414L12.414 11l4.775-4.775a1 1 0 0 0-1.414-1.414L11 9.586 6.225 4.811Z" />',
  '      </svg>',
  '    </button>',
  '  </div>',
  '  <p class="vaporvibe-instructions-description">Drop a quick hint or override to steer the next render. These instructions apply to the very next request only.</p>',
  '  <form class="vaporvibe-instructions-form" data-vaporvibe-instructions-form>',
  '    <label class="vaporvibe-instructions-label" for="vaporvibe-instructions-textarea">What should the model change next?</label>',
  `    <textarea id="vaporvibe-instructions-textarea" class="vaporvibe-instructions-textarea" name="${resolvedConfig.instructionsField}" placeholder="e.g. \"Try a dark mode layout with floating cards\"" data-vaporvibe-instructions-input></textarea>`,
  '    <div class="vaporvibe-instructions-actions">',
  '      <button type="submit" class="vaporvibe-instructions-submit">Send to model</button>',
  '      <button type="button" class="vaporvibe-instructions-cancel">Clear</button>',
  '    </div>',
  '    <p class="vaporvibe-instructions-status" aria-live="polite" data-vaporvibe-instructions-status></p>',
  '  </form>',
  '  <div class="vaporvibe-instructions-ab-launch" data-vaporvibe-ab-launch>',
  '    <button type="button" class="vaporvibe-instructions-ab-button" data-vaporvibe-ab-button>Try A/B Variants…</button>',
  '    <p class="vaporvibe-instructions-ab-helper">Draft two different nudges and compare the results before choosing.</p>',
  '  </div>',
  `  <a class="vaporvibe-admin-link" href="${resolvedConfig.adminRoutePrefix}" data-vaporvibe-admin-link>`,
  '    <svg viewBox="0 0 24 24" aria-hidden="true">',
  '      <path d="M12 5v2.586l1.707-1.707a1 1 0 0 1 1.414 1.414L12 10.414l-3.121-3.121a1 1 0 0 1 1.414-1.414L11 7.586V5a1 1 0 1 1 2 0Zm-7 5a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H7v7h10v-7h-1a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8Z" />',
  '    </svg>',
  '    Open admin console',
  '  </a>',
  '</div>',
].join("\n");

  const PANEL_ID = "vaporvibe-instructions-panel";
  const PANEL_STATE_ATTR = "data-state";
  const PANEL_COLLAPSED = "collapsed";
  const PANEL_EXPANDED = "expanded";
  const AB_MODAL_ID = "vaporvibe-ab-modal";
  const AB_MODAL_STATE_ATTR = "data-state";
  const AB_MODAL_VISIBLE = "visible";
  const AB_MODAL_HIDDEN = "hidden";
  const AB_LAUNCH_OVERLAY_ID = "vaporvibe-ab-launch-overlay";

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
      "[data-vaporvibe-instructions-status]"
    );
    if (!status) return;
    status.textContent = message ?? "";
  }

  function setExpanded(expanded: boolean): void {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.setAttribute(
      PANEL_STATE_ATTR,
      expanded ? PANEL_EXPANDED : PANEL_COLLAPSED
    );
    if (expanded) {
      const textarea = panel.querySelector<HTMLTextAreaElement>(
        "[data-vaporvibe-instructions-input]"
      );
      textarea?.focus({ preventScroll: true });
      textarea?.select();
    }
  }

  type AbModalElements = {
    container: HTMLDivElement;
    form: HTMLFormElement;
    textareaA: HTMLTextAreaElement;
    textareaB: HTMLTextAreaElement;
    status: HTMLElement;
    submit: HTMLButtonElement;
    cancel: HTMLButtonElement;
    close: HTMLButtonElement;
  };

  let abModal: AbModalElements | null = null;

  function ensureAbModal(): AbModalElements | null {
    if (!document.body) return null;
    if (abModal) return abModal;

    let container = document.getElementById(AB_MODAL_ID) as
      | HTMLDivElement
      | null;
    if (!container) {
      container = document.createElement("div");
      container.id = AB_MODAL_ID;
      container.setAttribute(AB_MODAL_STATE_ATTR, AB_MODAL_HIDDEN);
      container.innerHTML = [
        '<div class="vaporvibe-ab-dialog" role="dialog" aria-modal="true" aria-labelledby="vaporvibe-ab-title">',
        '  <div class="vaporvibe-ab-header">',
        '    <div class="vaporvibe-ab-title" id="vaporvibe-ab-title">Create A/B Iteration</div>',
        '    <button type="button" class="vaporvibe-ab-close" data-vaporvibe-ab-close aria-label="Close A/B composer">✕</button>',
        '  </div>',
        '  <p class="vaporvibe-ab-description">Enter two different instructions based on the current page. We\'ll generate both versions side-by-side for you to compare and choose.</p>',
        '  <form class="vaporvibe-ab-form" data-vaporvibe-ab-form>',
        '    <div class="vaporvibe-ab-field">',
        '      <label class="vaporvibe-ab-label" for="vaporvibe-ab-input-a">Version A Instructions</label>',
        '      <textarea id="vaporvibe-ab-input-a" class="vaporvibe-ab-textarea" data-vaporvibe-ab-input-a placeholder="e.g., \"Make the primary button larger and blue\""></textarea>',
        '    </div>',
        '    <div class="vaporvibe-ab-field">',
        '      <label class="vaporvibe-ab-label" for="vaporvibe-ab-input-b">Version B Instructions</label>',
        '      <textarea id="vaporvibe-ab-input-b" class="vaporvibe-ab-textarea" data-vaporvibe-ab-input-b placeholder="e.g., \"Try a subtle green button with rounded corners\""></textarea>',
        '    </div>',
        '    <p class="vaporvibe-ab-status" data-vaporvibe-ab-status></p>',
        '    <div class="vaporvibe-ab-actions">',
        '      <button type="button" class="admin-secondary" data-vaporvibe-ab-cancel>Cancel</button>',
        '      <button type="submit" class="admin-primary" data-vaporvibe-ab-submit disabled>Generate A/B Comparison</button>',
        '    </div>',
        '  </form>',
        '</div>',
      ].join("\n");
      document.body.appendChild(container);
    }

    const form = container.querySelector<HTMLFormElement>(
      "[data-vaporvibe-ab-form]"
    );
    const textareaA = container.querySelector<HTMLTextAreaElement>(
      "[data-vaporvibe-ab-input-a]"
    );
    const textareaB = container.querySelector<HTMLTextAreaElement>(
      "[data-vaporvibe-ab-input-b]"
    );
    const status = container.querySelector<HTMLElement>(
      "[data-vaporvibe-ab-status]"
    );
    const submit = container.querySelector<HTMLButtonElement>(
      "[data-vaporvibe-ab-submit]"
    );
    const cancel = container.querySelector<HTMLButtonElement>(
      "[data-vaporvibe-ab-cancel]"
    );
    const close = container.querySelector<HTMLButtonElement>(
      "[data-vaporvibe-ab-close]"
    );

    if (!form || !textareaA || !textareaB || !status || !submit || !cancel) {
      return null;
    }

    const elements: AbModalElements = {
      container,
      form,
      textareaA,
      textareaB,
      status,
      submit,
      cancel,
      close: close ?? cancel,
    };

    const handleInput = () => {
      const hasA = elements.textareaA.value.trim().length > 0;
      const hasB = elements.textareaB.value.trim().length > 0;
      elements.submit.disabled = !(hasA && hasB);
    };

    if (!abModal) {
      container.addEventListener("click", (event) => {
        if (event.target === container) {
          closeAbModal();
        }
      });
      elements.textareaA.addEventListener("input", handleInput);
      elements.textareaB.addEventListener("input", handleInput);
      elements.cancel.addEventListener("click", (event) => {
        event.preventDefault();
        closeAbModal();
      });
      elements.close.addEventListener("click", (event) => {
        event.preventDefault();
        closeAbModal();
      });
      elements.form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (elements.submit.disabled) return;
        void handleAbSubmit(elements);
      });
    }

    abModal = elements;
    return abModal;
  }

  function setAbModalStatus(message?: string): void {
    if (!abModal) return;
    abModal.status.textContent = message ?? "";
  }

  function setAbModalLoading(loading: boolean): void {
    if (!abModal) return;
    abModal.submit.disabled = loading ||
      !(abModal.textareaA.value.trim() && abModal.textareaB.value.trim());
    abModal.submit.setAttribute("aria-busy", loading ? "true" : "false");
    abModal.textareaA.disabled = loading;
    abModal.textareaB.disabled = loading;
    abModal.cancel.disabled = loading;
    abModal.close.disabled = loading;
  }

  function openAbModal(initialA: string, initialB: string): void {
    if (forkActive) return;
    const elements = ensureAbModal();
    if (!elements) return;
    setAbModalStatus();
    elements.textareaA.value = initialA;
    elements.textareaB.value = initialB;
    elements.submit.disabled = !(
      initialA.trim().length > 0 && initialB.trim().length > 0
    );
    elements.container.setAttribute(AB_MODAL_STATE_ATTR, AB_MODAL_VISIBLE);
    window.setTimeout(() => {
      elements.textareaA.focus({ preventScroll: true });
    }, 0);
  }

  function closeAbModal(): void {
    if (!abModal) return;
    setAbModalLoading(false);
    setAbModalStatus();
    abModal.container.setAttribute(AB_MODAL_STATE_ATTR, AB_MODAL_HIDDEN);
  }

  function showAbLaunchOverlay(message: string, hint?: string): void {
    const overlayApi = (
      window as typeof window & {
        vaporvibeOverlayDebug?: { show?: (payload?: { message?: string }) => void };
      }
    ).vaporvibeOverlayDebug;
    const combinedMessage = hint ? `${message} ${hint}` : message;
    if (overlayApi?.show) {
      overlayApi.show({ message: combinedMessage });
      return;
    }
    if (!document.body) return;
    let overlay = document.getElementById(AB_LAUNCH_OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = AB_LAUNCH_OVERLAY_ID;
      overlay.innerHTML = [
        '<div class="vaporvibe-ab-launch-card">',
        `  <div class="vaporvibe-ab-launch-headline" aria-live="polite">${message}</div>`,
        hint
          ? `  <div class="vaporvibe-ab-launch-subtle">${hint}</div>`
          : "",
        "</div>",
      ]
        .filter(Boolean)
        .join("\n");
      document.body.appendChild(overlay);
    } else {
      const headline = overlay.querySelector<HTMLElement>(
        ".vaporvibe-ab-launch-headline"
      );
      if (headline) headline.textContent = message;
      const helper = overlay.querySelector<HTMLElement>(
        ".vaporvibe-ab-launch-subtle"
      );
      if (helper) helper.textContent = hint ?? "";
    }
  }

  async function handleAbSubmit(elements: AbModalElements): Promise<void> {
    const instructionsA = elements.textareaA.value.trim();
    const instructionsB = elements.textareaB.value.trim();
    if (!instructionsA || !instructionsB) {
      setAbModalStatus("Fill in both instruction sets to continue.");
      return;
    }
    setAbModalLoading(true);
    setAbModalStatus();

    try {
      const entryMeta = document.querySelector<HTMLMetaElement>(
        'meta[name="vaporvibe-entry-id"]'
      );
      const baseEntryId = entryMeta?.content?.trim() ?? null;
      const requestPayload: Record<string, unknown> = {
        instructionsA,
        instructionsB,
        baseEntryId,
      };

      const response = await fetch("/api/admin/forks/start", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with ${response.status}`);
      }

      const payload = (await response.json()) as {
        success?: boolean;
        forkId?: string;
        branchIdA?: string;
        branchIdB?: string;
        message?: string;
      };

      if (!payload?.success || !payload.forkId || !payload.branchIdA || !payload.branchIdB) {
        throw new Error(payload?.message || "Unexpected response starting A/B test.");
      }

      closeAbModal();
      const redirectBase = `${resolvedConfig.adminRoutePrefix.replace(/\/$/, "")}/ab-test/${encodeURIComponent(payload.forkId)}`;
      const sourcePath = `${window.location.pathname}${window.location.search}` || "/";
      const nextUrl = `${redirectBase}?branchA=${encodeURIComponent(payload.branchIdA)}&branchB=${encodeURIComponent(payload.branchIdB)}&source=${encodeURIComponent(sourcePath)}`;
      showAbLaunchOverlay(
        "Generating A/B variants…",
        "We\'re asking the model to build both options. This can take a moment."
      );
      window.setTimeout(() => {
        window.location.href = nextUrl;
      }, 500);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown error");
      setAbModalStatus(message);
      setAbModalLoading(false);
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

    if (activeBranchId) {
      const branchMarker = document.createElement("input");
      branchMarker.type = "hidden";
      branchMarker.name = BRANCH_FIELD;
      branchMarker.value = activeBranchId;
      ghostForm.appendChild(branchMarker);
    }

    const hiddenInputs = document.querySelectorAll<HTMLInputElement>(
      "input[type=\"hidden\"]"
    );
    const panel = document.getElementById(PANEL_ID);
    hiddenInputs.forEach((input) => {
      if (!input.name) return;
      if (input.disabled) return;
      if (input.name === resolvedConfig.instructionsField) return;
      if (input.name === BRANCH_FIELD) return;
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

    if (panel.dataset.initialized === "true") {
      updateStatus();
      return;
    }

    panel.dataset.initialized = "true";

    const toggle = panel.querySelector<HTMLButtonElement>(
      ".vaporvibe-instructions-toggle"
    );
    const closeBtn = panel.querySelector<HTMLButtonElement>(
      ".vaporvibe-instructions-close"
    );
    const cancelBtn = panel.querySelector<HTMLButtonElement>(
      ".vaporvibe-instructions-cancel"
    );
    const textarea = panel.querySelector<HTMLTextAreaElement>(
      "[data-vaporvibe-instructions-input]"
    );
    const form = panel.querySelector<HTMLFormElement>(
      "[data-vaporvibe-instructions-form]"
    );
    const submitButton = panel.querySelector<HTMLButtonElement>(
      ".vaporvibe-instructions-submit"
    );
    const abLaunch = panel.querySelector<HTMLElement>(
      "[data-vaporvibe-ab-launch]"
    );
    const abButton = panel.querySelector<HTMLButtonElement>(
      "[data-vaporvibe-ab-button]"
    );

    if (toggle) {
      toggle.addEventListener("click", () => {
        const expanded =
          panel.getAttribute(PANEL_STATE_ATTR) === PANEL_EXPANDED;
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

    if (forkActive) {
      if (textarea) textarea.disabled = true;
      if (submitButton) submitButton.disabled = true;
      const cancelBtn = panel.querySelector<HTMLButtonElement>(
        ".vaporvibe-instructions-cancel"
      );
      if (cancelBtn) cancelBtn.disabled = true;
      if (abLaunch) abLaunch.setAttribute("hidden", "true");
      panel.setAttribute("data-mode", "ab-disabled");
      updateStatus(
        "Resolve the active A/B comparison before sending new instructions."
      );
    } else if (abButton) {
      abButton.addEventListener("click", () => {
        const initial = textarea ? textarea.value.trim() : "";
        openAbModal(initial, "");
      });
      updateStatus();
    } else {
      updateStatus();
    }
  }

  function initInstructionsPanel(): void {
    if (forkActive && activeBranchId) {
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootstrapPanel, {
        once: true,
      });
    } else {
      bootstrapPanel();
    }
  }

  window.addEventListener("vaporvibe:instructions-refresh", () => {
    if (forkActive && activeBranchId) {
      return;
    }
    if (document.getElementById(PANEL_ID)) {
      return;
    }
    bootstrapPanel();
  });

  initInstructionsPanel();
})();
