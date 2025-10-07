import { escapeHtml } from "../utils/html.js";
import { DEFAULT_OPENAI_MODEL, DEFAULT_GEMINI_MODEL, DEFAULT_ANTHROPIC_MODEL } from "../constants.js";
export function renderAdminDashboard(props) {
    const { brief, provider, runtime, history, totalHistoryCount, sessionCount, statusMessage, errorMessage, exportJsonUrl, exportMarkdownUrl, historyEndpoint, } = props;
    const briefText = brief && brief.trim().length > 0 ? brief : "(brief not set yet)";
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>serve-llm Admin</title>
  <style>
    :root {
      color-scheme: light;
      --font: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --bg: #f6f8fb;
      --bg-soft: #eef2f8;
      --surface: #ffffff;
      --surface-muted: #f9fafc;
      --border: #e2e8f0;
      --border-strong: #cbd5e1;
      --shadow-soft: 0 24px 48px rgba(15, 23, 42, 0.08);
      --shadow-subtle: 0 12px 24px rgba(15, 23, 42, 0.05);
      --text: #0f172a;
      --muted: #475569;
      --subtle: #64748b;
      --accent: #1d4ed8;
      --accent-soft: rgba(29, 78, 216, 0.08);
      --accent-ring: rgba(29, 78, 216, 0.18);
      --success: #0f766e;
      --error: #b91c1c;
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(120% 120% at 50% 0%, #ffffff 0%, var(--bg) 55%, var(--bg-soft) 100%);
      color: var(--text);
      font-family: var(--font);
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 18px clamp(24px, 5vw, 52px) clamp(48px, 6vw, 96px);
    }
    a {
      color: var(--accent);
      text-decoration: none;
    }
    a:hover,
    a:focus-visible {
      text-decoration: underline;
      outline: none;
    }
    main {
      width: min(1180px, 100%);
      display: grid;
      gap: 32px;
      align-content: start;
    }
    header {
      padding: clamp(32px, 5vw, 44px);
      border-radius: 28px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 253, 0.96) 100%);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-soft);
      display: grid;
      gap: 20px;
    }
    header h1 {
      margin: 0;
      font-size: clamp(1.9rem, 3vw, 2.4rem);
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .status-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .status-pill {
      padding: 6px 14px;
      border-radius: 999px;
      background: var(--surface-muted);
      color: var(--muted);
      font-size: 0.72rem;
      letter-spacing: 0.02em;
      border: 1px solid var(--border);
      box-shadow: 0 6px 12px rgba(15, 23, 42, 0.04);
    }
    .status-pill.success {
      color: var(--success);
      background: rgba(15, 118, 110, 0.08);
      border-color: rgba(15, 118, 110, 0.18);
    }
    .status-pill.error {
      color: var(--error);
      background: rgba(185, 28, 28, 0.08);
      border-color: rgba(185, 28, 28, 0.18);
    }
    .tabbed-card {
      border-radius: 26px;
      border: 1px solid var(--border);
      background: var(--surface);
      padding: clamp(24px, 4vw, 32px);
      box-shadow: var(--shadow-soft);
      display: grid;
      gap: 18px;
    }
    .tabs {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 6px;
      border-radius: 16px;
      background: var(--surface-muted);
      border: 1px solid var(--border);
      align-items: center;
      justify-content: flex-start;
    }
    .tab-button {
      border-radius: 12px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-weight: 500;
      padding: 0 16px;
      height: 38px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
    }
    .tab-button:hover {
      background: var(--surface);
      color: var(--text);
    }
    .tab-button:focus-visible {
      outline: 3px solid var(--accent-ring);
      outline-offset: 2px;
    }
    .tab-button.active {
      background: var(--accent);
      color: #f8fafc;
      border-color: var(--accent);
      box-shadow: 0 8px 16px rgba(29, 78, 216, 0.18);
    }
    .tab-panel {
      border-radius: 20px;
      border: 1px solid var(--border);
      background: var(--surface);
      padding: clamp(24px, 4vw, 32px);
      box-shadow: var(--shadow-subtle);
      display: grid;
      gap: 20px;
    }
    .tab-panel[hidden] {
      display: none;
    }
    .panel-body {
      display: grid;
      gap: 20px;
    }
    .panel-note {
      margin: 0;
      color: var(--subtle);
      font-size: 0.95rem;
      max-width: 68ch;
    }
    label {
      display: grid;
      gap: 8px;
      color: var(--muted);
      font-size: 0.9rem;
      letter-spacing: 0.01em;
    }
    .panel-body form {
      display: grid;
      gap: 20px;
    }
    .field-label {
      font-weight: 600;
      color: var(--text);
      font-size: 0.92rem;
    }
    .api-key-control {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .api-key-control input[disabled] {
      background: var(--surface-muted);
      color: var(--subtle);
      cursor: not-allowed;
    }
    .api-key-edit {
      border: none;
      background: transparent;
      color: var(--accent);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 0;
    }
    .api-key-edit:hover,
    .api-key-edit:focus-visible {
      text-decoration: underline;
      outline: none;
    }
    .api-key-hint {
      margin: 0;
      font-size: 0.82rem;
      color: var(--subtle);
      line-height: 1.5;
    }
    .file-drop {
      border: 1px dashed var(--border);
      border-radius: 14px;
      background: var(--surface-muted);
      padding: 20px;
      text-align: center;
      transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
      display: grid;
      gap: 8px;
      justify-items: center;
    }
    .file-drop strong {
      font-size: 0.95rem;
      color: var(--text);
    }
    .file-drop p {
      margin: 0;
      font-size: 0.85rem;
      color: var(--subtle);
    }
    .file-drop code {
      background: #ffffff;
      border-radius: 6px;
      padding: 0 6px;
      border: 1px solid rgba(148, 163, 184, 0.2);
    }
    .file-drop-status {
      font-size: 0.82rem;
      color: var(--muted);
    }
    .file-drop button {
      margin-top: 8px;
      border: none;
      background: transparent;
      color: var(--accent);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
    }
    .file-drop button:hover,
    .file-drop button:focus-visible {
      text-decoration: underline;
      outline: none;
    }
    .file-drop.is-active {
      border-color: var(--accent);
      background: rgba(29, 78, 216, 0.06);
      box-shadow: 0 0 0 3px var(--accent-ring);
    }
    .file-drop input[type="file"] {
      display: none;
    }
    input, select, textarea {
      font: inherit;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: #ffffff;
      color: var(--text);
      padding: 14px 16px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-ring);
      background: #fdfefe;
    }
    textarea {
      min-height: 150px;
      resize: vertical;
    }
    input::placeholder,
    textarea::placeholder {
      color: var(--subtle);
      opacity: 0.8;
    }
    .inline-inputs + label {
      margin-top: 4px;
    }
    .inline-inputs {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    button {
      font: inherit;
    }
    .action-button {
      border-radius: 12px;
      border: 1px solid var(--accent);
      padding: 10px 20px;
      font-weight: 600;
      letter-spacing: 0.01em;
      background: linear-gradient(135deg, #1d4ed8, #1e3a8a);
      color: #f8fafc;
      cursor: pointer;
      transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 0;
      white-space: nowrap;
      flex: 0 0 auto;
      box-shadow: 0 18px 30px rgba(29, 78, 216, 0.22);
    }
    .action-button:hover {
      transform: translateY(-1px);
      filter: brightness(1.05);
    }
    .action-button:focus-visible {
      outline: 3px solid var(--accent-ring);
      outline-offset: 2px;
    }
    .panel-body form .action-button {
      margin-top: 4px;
      justify-self: start;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .actions .action-button {
      padding: 11px 22px;
    }
    .history-controls {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .history-list {
      display: grid;
      gap: 16px;
    }
    details.history-item {
      border-radius: 22px;
      border: 1px solid var(--border);
      background: var(--surface);
      padding: 20px 22px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
      box-shadow: var(--shadow-subtle);
    }
    details.history-item[open] {
      border-color: var(--border-strong);
      box-shadow: 0 24px 40px rgba(15, 23, 42, 0.12);
      transform: translateY(-2px);
    }
    summary.history-title {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      color: var(--text);
      font-weight: 600;
    }
    summary.history-title::-webkit-details-marker { display: none; }
    summary.history-title::after {
      content: "⌄";
      font-size: 0.75rem;
      color: var(--subtle);
      transition: transform 0.2s ease;
    }
    details.history-item[open] summary.history-title::after { transform: rotate(-180deg); }
    .chip-set {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 0.78rem;
      color: var(--subtle);
      margin-left: auto;
      justify-content: flex-end;
      text-align: right;
    }
    .chip {
      padding: 6px 12px;
      border-radius: 999px;
      background: var(--surface-muted);
      border: 1px solid var(--border);
      box-shadow: 0 4px 8px rgba(15, 23, 42, 0.04);
    }
    .history-content {
      display: grid;
      gap: 16px;
      margin-top: 18px;
      font-size: 0.9rem;
      color: var(--muted);
    }
    .history-content > p {
      margin: 0;
      color: inherit;
    }
    .history-content > p + p {
      margin-top: 12px;
    }
    .history-meta {
      display: grid;
      gap: 12px;
    }
    .history-meta-row {
      display: grid;
      gap: 6px;
    }
    .history-meta-row span {
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--subtle);
    }
    .history-meta-row strong {
      font-size: 0.94rem;
      color: var(--text);
      font-weight: 600;
    }
    pre {
      margin: 0;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: var(--surface-muted);
      padding: 16px;
      font-size: 0.82rem;
      line-height: 1.6;
      color: var(--text);
      overflow-x: auto;
      max-height: 360px;
      max-width: 100%;
      white-space: pre-wrap;
      word-break: break-word;
    }
    details.reason-block {
      border-radius: 16px;
      border: 1px solid var(--border);
      background: #f4f6fb;
      padding: 14px 16px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
      display: grid;
      gap: 12px;
      overflow: visible;
    }
    details.reason-block[open] {
      border-color: var(--border-strong);
      background: #edf1f9;
      box-shadow: 0 16px 28px rgba(15, 23, 42, 0.08);
    }
    details.reason-block summary {
      list-style: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      color: var(--muted);
      font-size: 0.88rem;
      font-weight: 500;
    }
    details.reason-block summary::-webkit-details-marker { display: none; }
    details.reason-block summary::after {
      content: "⌄";
      font-size: 0.7rem;
      color: var(--subtle);
      transition: transform 0.2s ease;
    }
    details.reason-block[open] summary::after { transform: rotate(-180deg); }
    details.reason-block > p {
      margin: 0;
      color: var(--muted);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    details.reason-block > p + p {
      margin-top: 8px;
    }
    .reasoning {
      color: var(--subtle);
      font-size: 0.88rem;
    }
    @media (max-width: 960px) {
      body { padding: 24px; }
      header { padding: 28px; }
      .tabbed-card { padding: 24px; }
      .tab-panel { padding: 24px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>serve-llm Admin Console</h1>
      <div class="status-bar">
        <div class="status-pill" data-status="historyTotal">History entries: ${totalHistoryCount}</div>
        <div class="status-pill" data-status="sessions">Active sessions tracked: ${sessionCount}</div>
        <div class="status-pill" data-status="provider">Current provider: ${escapeHtml(provider.provider)} · ${escapeHtml(provider.model)}</div>
        <div class="status-pill" data-status="historyLimit">History limit: ${escapeHtml(String(runtime.historyLimit))}</div>
        <div class="status-pill" data-status="historyBytes">Byte budget: ${escapeHtml(String(runtime.historyMaxBytes))}</div>
      </div>
      ${renderStatus(statusMessage, errorMessage)}
    </header>

    <section class="tabbed-card">
      <nav class="tabs" role="tablist">
        <button type="button" class="tab-button active" role="tab" aria-selected="true" aria-controls="tab-brief" data-tab="tab-brief">Brief</button>
        <button type="button" class="tab-button" role="tab" aria-selected="false" aria-controls="tab-provider" data-tab="tab-provider">Provider</button>
        <button type="button" class="tab-button" role="tab" aria-selected="false" aria-controls="tab-runtime" data-tab="tab-runtime">Runtime</button>
        <button type="button" class="tab-button" role="tab" aria-selected="false" aria-controls="tab-import" data-tab="tab-import">Import</button>
        <button type="button" class="tab-button" role="tab" aria-selected="false" aria-controls="tab-export" data-tab="tab-export">Exports</button>
        <button type="button" class="tab-button" role="tab" aria-selected="false" aria-controls="tab-history" data-tab="tab-history">History</button>
      </nav>
      <div class="tab-panels">
        <section class="tab-panel" id="tab-brief" role="tabpanel">
          <div class="panel-body">
            <p class="panel-note">The brief shapes every render. Adjust it to steer the experience mid-session.</p>
            <form method="post" action="${escapeHtml(`/serve-llm/update-brief`)}">
              <label>
                Current brief
                <textarea name="brief" placeholder="Describe the product vision">${escapeHtml(briefText)}</textarea>
              </label>
              <button type="submit" class="action-button">Save brief</button>
            </form>
          </div>
        </section>

        <section class="tab-panel" id="tab-provider" role="tabpanel" hidden>
      <div class="panel-body">
        <p class="panel-note">Switch providers or tune models without restarting. Keys remain masked.</p>
        <form
          method="post"
          action="${escapeHtml(`/serve-llm/update-provider`)}"
          data-provider-form
          data-default-openai="${escapeHtml(DEFAULT_OPENAI_MODEL)}"
          data-default-gemini="${escapeHtml(DEFAULT_GEMINI_MODEL)}"
          data-default-anthropic="${escapeHtml(DEFAULT_ANTHROPIC_MODEL)}"
        >
          <label>
            Provider
            <select name="provider">
              ${renderProviderOption("openai", provider.provider)}
              ${renderProviderOption("gemini", provider.provider)}
              ${renderProviderOption("anthropic", provider.provider)}
            </select>
          </label>
          <div class="inline-inputs">
            <label>
              Model name
              <input type="text" name="model" value="${escapeHtml(provider.model)}" autocomplete="off" />
            </label>
            <label>
              Max output tokens
              <input type="number" min="1" name="maxOutputTokens" value="${provider.maxOutputTokens}" />
            </label>
            <label>
              Reasoning mode
              <select name="reasoningMode">
                ${renderReasoningOption("none", provider.reasoningMode)}
                ${renderReasoningOption("low", provider.reasoningMode)}
                ${renderReasoningOption("medium", provider.reasoningMode)}
                ${renderReasoningOption("high", provider.reasoningMode)}
              </select>
            </label>
            <label>
              Reasoning tokens budget
              <input type="number" min="0" name="reasoningTokens" value="${provider.reasoningTokens ?? ""}" />
            </label>
          </div>
          <label>
            <span class="field-label">API key</span>
            <div class="api-key-control">
              <input
                type="password"
                name="apiKey"
                placeholder="Paste new API key"
                autocomplete="new-password"
                data-api-key-input
                ${provider.apiKeyMask !== "not set" ? "disabled" : ""}
              />
              ${provider.apiKeyMask !== "not set"
        ? `<button type="button" class="api-key-edit" data-api-key-toggle>Replace key</button>`
        : ""}
            </div>
            <p class="api-key-hint">
              Stored value: <strong>${escapeHtml(provider.apiKeyMask)}</strong>.
              ${provider.apiKeyMask !== "not set"
        ? "View-only for safety. Choose “Replace key” to provide a new secret; otherwise the existing key (including values from environment variables) stays active."
        : "Provide the API key for this provider. Values from environment variables will appear here on restart."}
            </p>
          </label>
          <button type="submit" class="action-button">Apply provider settings</button>
        </form>
      </div>
    </section>

    <section class="tab-panel" id="tab-runtime" role="tabpanel" hidden>
      <div class="panel-body">
        <p class="panel-note">Balance context depth with responsiveness. Adjust these controls in-flight.</p>
        <form method="post" action="${escapeHtml(`/serve-llm/update-runtime`)}">
          <div class="inline-inputs">
            <label>
              Prompt history limit
              <input type="number" min="1" name="historyLimit" value="${escapeHtml(String(runtime.historyLimit))}" />
            </label>
            <label>
              Prompt history byte budget
              <input type="number" min="1" name="historyMaxBytes" value="${escapeHtml(String(runtime.historyMaxBytes))}" />
            </label>
            <label>
              Instruction panel
              <select name="instructionPanel">
                <option value="on" ${runtime.includeInstructionPanel ? "selected" : ""}>On</option>
                <option value="off" ${runtime.includeInstructionPanel ? "" : "selected"}>Off</option>
              </select>
            </label>
          </div>
          <button type="submit" class="action-button">Update runtime</button>
        </form>
      </div>
    </section>

    <section class="tab-panel" id="tab-import" role="tabpanel" hidden>
      <div class="panel-body">
        <p class="panel-note">Restore a previous run. Existing history and settings will be replaced.</p>
        <form method="post" action="${escapeHtml(`/serve-llm/history/import`)}" data-import-form>
          <label>
            History JSON
            <textarea name="historyJson" placeholder="Paste the JSON snapshot here"></textarea>
          </label>
          <div class="file-drop" data-dropzone tabindex="0">
            <input type="file" accept="application/json,.json" data-import-file />
            <strong>Drop your history snapshot</strong>
            <p>Drag a <code>.json</code> export here or</p>
            <button type="button" class="file-drop-browse">Browse files</button>
            <p class="file-drop-status" data-drop-status>Snapshot contents will appear above.</p>
          </div>
          <button type="submit" class="action-button">Import snapshot</button>
        </form>
      </div>
    </section>

    <section class="tab-panel" id="tab-export" role="tabpanel" hidden>
      <div class="panel-body">
        <p class="panel-note">Download the current state for safekeeping or to resume elsewhere.</p>
        <div class="actions">
          <a class="action-button" href="${escapeHtml(exportJsonUrl)}" download>Download JSON snapshot</a>
          <a class="action-button" href="${escapeHtml(exportMarkdownUrl)}" download>Download prompt.md</a>
        </div>
      </div>
    </section>

    <section class="tab-panel" id="tab-history" role="tabpanel" hidden>
      <div class="panel-body">
        <div class="history-controls">
          <div class="actions">
            <button type="button" id="history-refresh-now" class="action-button">Refresh now</button>
            <button type="button" id="history-toggle-auto" class="action-button" data-enabled="true">Auto-refresh: on</button>
          </div>
          <span id="history-update-status" class="reasoning">Last updated just now</span>
        </div>
        <div id="history-container">
          ${renderHistory(history)}
        </div>
      </div>
    </section>
      </div>
    </section>
  </main>
  <script>
    (() => {
      const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
      const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

      const activateTab = (id) => {
        tabButtons.forEach((button) => {
          const isActive = button.dataset.tab === id;
          button.classList.toggle("active", isActive);
          button.setAttribute("aria-selected", isActive ? "true" : "false");
          button.setAttribute("tabindex", isActive ? "0" : "-1");
        });
        tabPanels.forEach((panel) => {
          const isActive = panel.id === id;
          panel.hidden = !isActive;
          panel.setAttribute("aria-hidden", isActive ? "false" : "true");
        });
      };

      tabButtons.forEach((button, index) => {
        const handleActivate = () => {
          const target = button.dataset.tab;
          if (target) {
            activateTab(target);
            button.focus();
          }
        };
        button.addEventListener("click", (event) => {
          event.preventDefault();
          handleActivate();
        });
        button.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleActivate();
            return;
          }
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            const delta = event.key === "ArrowRight" ? 1 : -1;
            const nextIndex = (index + delta + tabButtons.length) % tabButtons.length;
            const nextButton = tabButtons[nextIndex];
            if (nextButton) {
              nextButton.focus();
            }
          }
        });
      });

      if (tabButtons.length > 0) {
        let preset = null;
        for (const button of tabButtons) {
          if (button.classList.contains("active")) {
            preset = button;
            break;
          }
        }
        const fallback = tabButtons[0];
        const initial = (preset && preset.dataset.tab) || (fallback && fallback.dataset.tab) || "tab-brief";
        activateTab(initial);
      }

      const refreshButton = document.getElementById("history-refresh-now");
      const toggleButton = document.getElementById("history-toggle-auto");
      const statusEl = document.getElementById("history-update-status");
      const container = document.getElementById("history-container");
      const briefInput = document.querySelector("textarea[name='brief']");
      const statusHistoryEntries = document.querySelector("[data-status='historyTotal']");
      const statusSessions = document.querySelector("[data-status='sessions']");
      const statusProvider = document.querySelector("[data-status='provider']");
      const statusLimit = document.querySelector("[data-status='historyLimit']");
      const statusBytes = document.querySelector("[data-status='historyBytes']");

      const providerForm = document.querySelector("[data-provider-form]");
      if (providerForm instanceof HTMLFormElement) {
        const apiInput = providerForm.querySelector("[data-api-key-input]");
        const toggleKeyButton = providerForm.querySelector("[data-api-key-toggle]");
        const hint = providerForm.querySelector(".api-key-hint");
        const providerSelect = providerForm.querySelector("select[name='provider']");
        const modelInput = providerForm.querySelector("input[name='model']");

        if (toggleKeyButton instanceof HTMLButtonElement && apiInput instanceof HTMLInputElement) {
          toggleKeyButton.addEventListener("click", (event) => {
            event.preventDefault();
            apiInput.disabled = false;
            apiInput.value = "";
            apiInput.focus();
            apiInput.setAttribute("required", "required");
            toggleKeyButton.remove();
            if (hint instanceof HTMLElement) {
              hint.textContent = "Enter the replacement API key. Leaving this blank will keep the existing one.";
            }
          });
        }

        if (providerSelect instanceof HTMLSelectElement && modelInput instanceof HTMLInputElement) {
          const defaults = {
            openai: providerForm.dataset.defaultOpenai || "",
            gemini: providerForm.dataset.defaultGemini || "",
            anthropic: providerForm.dataset.defaultAnthropic || "",
          };
          providerSelect.addEventListener("change", () => {
            const selected = providerSelect.value;
            if (Object.prototype.hasOwnProperty.call(defaults, selected)) {
              const fallback = defaults[selected];
              if (fallback && fallback.length > 0) {
                modelInput.value = fallback;
              }
            }
          });
        }
      }

      const importForm = document.querySelector("[data-import-form]");
      if (importForm instanceof HTMLFormElement) {
        const textarea = importForm.querySelector("textarea[name='historyJson']");
        const dropzone = importForm.querySelector("[data-dropzone]");
        const fileInput = importForm.querySelector("[data-import-file]");
        const status = importForm.querySelector("[data-drop-status]");
        const browseButton = importForm.querySelector(".file-drop-browse");
        const setStatus = (message) => {
          if (status) {
            status.textContent = message;
          }
        };
        const deactivate = () => {
          if (dropzone) {
            dropzone.classList.remove("is-active");
          }
        };
        const readFile = (file) => {
          if (!(file instanceof File) || !(textarea instanceof HTMLTextAreaElement)) {
            return;
          }
          if (!file.type || file.type === "application/json" || file.name.toLowerCase().endsWith(".json")) {
            setStatus("Loading " + file.name + "…");
          } else {
            setStatus("Loading " + file.name + " (treated as text)…");
          }
          const reader = new FileReader();
          reader.addEventListener("load", () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            textarea.value = result;
            setStatus("Loaded " + file.name + " (" + result.length.toLocaleString() + " characters)");
            textarea.focus();
          });
          reader.addEventListener("error", () => {
            console.error("Failed to read file", reader.error);
            setStatus("Could not read file. Please try again or paste the JSON manually.");
          });
          reader.readAsText(file);
        };
        if (browseButton instanceof HTMLButtonElement && fileInput instanceof HTMLInputElement) {
          browseButton.addEventListener("click", (event) => {
            event.preventDefault();
            fileInput.click();
          });
        }
        if (fileInput instanceof HTMLInputElement) {
          fileInput.addEventListener("change", () => {
            const file = fileInput.files && fileInput.files[0];
            if (file) {
              readFile(file);
            }
          });
        }
        if (dropzone instanceof HTMLElement) {
          dropzone.addEventListener("dragover", (event) => {
            event.preventDefault();
            dropzone.classList.add("is-active");
          });
          dropzone.addEventListener("dragleave", () => deactivate());
          dropzone.addEventListener("dragend", () => deactivate());
          dropzone.addEventListener("drop", (event) => {
            event.preventDefault();
            const files = event.dataTransfer?.files;
            if (files && files.length > 0) {
              readFile(files[0]);
            }
            deactivate();
          });
          dropzone.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (fileInput instanceof HTMLInputElement) {
                fileInput.click();
              }
            }
          });
        }
      }

      if (!refreshButton || !toggleButton || !statusEl || !container) {
        return;
      }

      const endpoint = ${JSON.stringify(historyEndpoint)};
      const intervalMs = 8000;
      let auto = true;
      let timer = window.setInterval(tick, intervalMs);
      let refreshing = false;

      refreshButton.addEventListener("click", () => {
        refresh();
      });

      toggleButton.addEventListener("click", () => {
        auto = !auto;
        toggleButton.dataset.enabled = String(auto);
        toggleButton.textContent = auto ? "Auto-refresh: on" : "Auto-refresh: off";
        if (auto) {
          statusEl.textContent = "Auto-refresh resumed";
          refresh();
          window.clearInterval(timer);
          timer = window.setInterval(tick, intervalMs);
        } else {
          statusEl.textContent = "Auto-refresh paused";
          window.clearInterval(timer);
        }
      });

      async function tick() {
        if (!auto) return;
        await refresh();
      }

      async function refresh() {
        if (refreshing) {
          return;
        }
        refreshing = true;
        try {
          statusEl.textContent = "Refreshing…";
          const response = await fetch(endpoint + '?t=' + Date.now(), {
            headers: { Accept: "application/json" },
            cache: "no-store",
          });
          if (!response.ok) {
            throw new Error('Request failed with status ' + response.status);
          }
          const payload = await response.json();
          if (typeof payload.historyHtml === "string") {
            const openHistoryIds = new Set(
              Array.from(container.querySelectorAll("details.history-item[open]"))
                .map((element) => element.getAttribute("data-history-id"))
                .filter(Boolean),
            );
            const openBlockIds = new Set(
              Array.from(container.querySelectorAll("details.reason-block[open]"))
                .map((element) => element.getAttribute("data-block-id"))
                .filter(Boolean),
            );

            container.innerHTML = payload.historyHtml;

            for (const element of Array.from(container.querySelectorAll("details.history-item"))) {
              const identifier = element.getAttribute("data-history-id");
              if (identifier && openHistoryIds.has(identifier)) {
                element.setAttribute("open", "open");
              }
            }
            for (const element of Array.from(container.querySelectorAll("details.reason-block"))) {
              const identifier = element.getAttribute("data-block-id");
              if (identifier && openBlockIds.has(identifier)) {
                element.setAttribute("open", "open");
              }
            }
          }
          if (briefInput instanceof HTMLTextAreaElement && typeof payload.brief === "string" && document.activeElement !== briefInput) {
            briefInput.value = payload.brief;
          }
          if (statusHistoryEntries && typeof payload.totalHistoryCount === "number") {
            statusHistoryEntries.textContent = "History entries: " + payload.totalHistoryCount;
          }
          if (statusSessions && typeof payload.sessionCount === "number") {
            statusSessions.textContent = "Active sessions tracked: " + payload.sessionCount;
          }
          if (statusProvider && payload.provider && typeof payload.provider.label === "string") {
            statusProvider.textContent = "Current provider: " + payload.provider.label;
          }
          if (statusLimit && payload.runtime && typeof payload.runtime.historyLimit === "number") {
            statusLimit.textContent = "History limit: " + payload.runtime.historyLimit;
          }
          if (statusBytes && payload.runtime && typeof payload.runtime.historyMaxBytes === "number") {
            statusBytes.textContent = "Byte budget: " + payload.runtime.historyMaxBytes;
          }
          statusEl.textContent = 'Last updated ' + new Date().toLocaleTimeString();
        } catch (error) {
          console.error("Failed to refresh history", error);
          statusEl.textContent = "Refresh failed — will retry";
        } finally {
          refreshing = false;
        }
      }

      refresh().catch((error) => {
        console.error("Failed to bootstrap history", error);
      });

      window.addEventListener("beforeunload", () => {
        window.clearInterval(timer);
      });
    })();
  </script>
</body>
</html>`;
}
function renderStatus(status, error) {
    if (error) {
        return `<div class="status-pill error">${escapeHtml(error)}</div>`;
    }
    if (status) {
        return `<div class="status-pill success">${escapeHtml(status)}</div>`;
    }
    return "";
}
function renderProviderOption(value, current) {
    const label = value === "openai" ? "OpenAI" : value === "gemini" ? "Gemini" : "Anthropic";
    const selected = value === current ? "selected" : "";
    return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(label)}</option>`;
}
function renderReasoningOption(value, current) {
    const label = value === "none" ? "None" : value === "low" ? "Low" : value === "medium" ? "Medium" : "High";
    const selected = value === current ? "selected" : "";
    return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(label)}</option>`;
}
export function renderHistory(history) {
    if (history.length === 0) {
        return `<p class="reasoning">No pages generated yet — once the LLM responds this list will populate automatically.</p>`;
    }
    const items = history
        .map((item, index) => {
        const idx = index + 1;
        const chips = [
            `<span class="chip">${escapeHtml(item.createdAt)}</span>`,
            `<span class="chip">${item.durationMs} ms</span>`,
        ];
        if (item.instructions) {
            chips.push(`<span class="chip">Instructions</span>`);
        }
        const metaRows = [
            `<div class="history-meta-row"><span>Query</span><strong>${escapeHtml(item.querySummary)}</strong></div>`,
            `<div class="history-meta-row"><span>Body</span><strong>${escapeHtml(item.bodySummary)}</strong></div>`,
        ];
        if (item.usageSummary) {
            metaRows.push(`<div class="history-meta-row"><span>Usage</span><strong>${escapeHtml(item.usageSummary)}</strong></div>`);
        }
        const blockKey = (suffix) => `${item.id}:${suffix}`;
        const blocks = [`<div class="history-meta">${metaRows.join("\n")}</div>`];
        if (item.instructions) {
            blocks.push(renderExpandable("Instructions", `<pre>${escapeHtml(item.instructions)}</pre>`, blockKey("instructions")));
        }
        if (item.reasoningSummaries?.length) {
            const content = item.reasoningSummaries
                .map((value) => `<p>${escapeHtml(value)}</p>`)
                .join("\n");
            blocks.push(renderExpandable("Reasoning summary", content, blockKey("reasoning-summary")));
        }
        if (item.reasoningDetails?.length) {
            const content = item.reasoningDetails
                .map((value) => `<p>${escapeHtml(value)}</p>`)
                .join("\n");
            blocks.push(renderExpandable("Reasoning detail", content, blockKey("reasoning-detail")));
        }
        blocks.push(renderExpandable("Rendered HTML", `<pre>${escapeHtml(item.html)}</pre>`, blockKey("rendered-html")));
        blocks.push(`<div class="actions"><a class="action-button" href="${escapeHtml(item.viewUrl)}" target="_blank" rel="noopener">View HTML</a><a class="action-button" href="${escapeHtml(item.downloadUrl)}" download>Download HTML</a></div>`);
        return `<details class="history-item" data-history-id="${escapeHtml(item.id)}">
  <summary class="history-title">
    <span>#${idx.toString().padStart(2, "0")} · ${escapeHtml(item.method)} ${escapeHtml(item.path)}</span>
    <span class="chip-set">${chips.join("\n")}</span>
  </summary>
  <div class="history-content">
    ${blocks.join("\n")}
  </div>
</details>`;
    })
        .join("\n");
    return `<div class="history-list">${items}</div>`;
}
function renderExpandable(title, innerHtml, blockId) {
    const idAttr = blockId ? ` data-block-id="${escapeHtml(blockId)}"` : "";
    return `<details class="reason-block"${idAttr}><summary>${escapeHtml(title)}</summary>${innerHtml}</details>`;
}
