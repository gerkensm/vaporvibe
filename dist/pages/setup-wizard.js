import { escapeHtml } from "../utils/html.js";
import { DEFAULT_REASONING_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS, } from "../constants.js";
import { PROVIDER_CHOICES, PROVIDER_LABELS, PROVIDER_PLACEHOLDERS, DEFAULT_MODEL_BY_PROVIDER, DEFAULT_MAX_TOKENS_BY_PROVIDER, REASONING_MODE_CHOICES, PROVIDER_REASONING_CAPABILITIES, REASONING_TOKEN_MIN_BY_PROVIDER, } from "../constants/providers.js";
import { renderModelDetailPanel, renderModelLineup, getModelOptionList, serializeModelCatalogForClient, } from "./components/model-inspector.js";
export function renderSetupWizardPage(options) {
    const { step, providerLabel, providerName, verifyAction, briefAction, setupPath, adminPath, providerReady, canSelectProvider, selectedProvider, selectedModel, providerSelectionRequired, providerKeyStatuses, maxOutputTokens, reasoningMode, reasoningTokens, statusMessage, errorMessage, briefValue, } = options;
    const heading = step === "provider" ? "Welcome to serve-llm" : "Shape the experience";
    const description = step === "provider"
        ? "Serve-llm hosts a living web canvas that your chosen model reimagines on every request—pick a provider and supply a secure API key to begin."
        : "Offer a crisp brief so the model understands the product it is bringing to life.";
    const stepIndicator = step === "provider" ? "Step 1 of 2" : "Step 2 of 2";
    const banner = buildBanner(statusMessage, errorMessage);
    const body = step === "provider"
        ? renderProviderStep({
            providerLabel,
            providerName,
            verifyAction,
            providerReady,
            canSelectProvider,
            selectedProvider,
            selectedModel,
            providerSelectionRequired,
            providerKeyStatuses,
            maxOutputTokens,
            reasoningMode,
            reasoningTokens,
        })
        : renderBriefStep({ briefAction, setupPath, adminPath, briefValue });
    const script = renderProviderScript(canSelectProvider, selectedProvider, selectedModel, reasoningMode, reasoningTokens, maxOutputTokens, providerKeyStatuses);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>serve-llm setup</title>
<style>
  :root {
    color-scheme: light;
    --font: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --bg: #f6f8fb;
    --bg-soft: #eef2f8;
    --surface: #ffffff;
    --surface-muted: rgba(255, 255, 255, 0.9);
    --surface-glass: rgba(255, 255, 255, 0.78);
    --border: #e2e8f0;
    --border-strong: #cbd5e1;
    --text: #0f172a;
    --muted: #475569;
    --subtle: #64748b;
    --accent: #1d4ed8;
    --accent-dark: #1e3a8a;
    --accent-soft: rgba(29, 78, 216, 0.08);
    --ring: rgba(29, 78, 216, 0.18);
    --success: #0f766e;
    --error: #b91c1c;
    --shadow-strong: 0 46px 96px rgba(15, 23, 42, 0.18);
    --shadow-soft: 0 28px 70px rgba(15, 23, 42, 0.12);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: clamp(32px, 6vw, 72px);
    background: radial-gradient(130% 120% at 50% 0%, #ffffff 0%, var(--bg) 55%, var(--bg-soft) 100%);
    font-family: var(--font);
    color: var(--text);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  main {
    width: min(760px, 95vw);
    background: linear-gradient(180deg, var(--surface) 0%, var(--surface-muted) 100%);
    border-radius: 28px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow-strong);
    padding: clamp(40px, 5vw, 56px);
    display: grid;
    gap: clamp(28px, 3vw, 40px);
    position: relative;
  }
  header {
    display: grid;
    gap: 12px;
  }
  .step-indicator {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.75rem;
    color: var(--subtle);
  }
  h1 {
    margin: 0;
    font-size: clamp(2rem, 4vw, 2.6rem);
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  p {
    margin: 0;
    color: var(--muted);
    max-width: 46ch;
  }
  .card {
    display: grid;
    gap: 20px;
    padding: clamp(28px, 4vw, 36px);
    border-radius: 22px;
    border: 1px solid var(--border);
    background: linear-gradient(180deg, var(--surface) 0%, var(--surface-glass) 100%);
    box-shadow: var(--shadow-soft);
    backdrop-filter: blur(18px);
  }
  .provider-grid {
    display: grid;
    gap: 16px;
  }
  .provider-option {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 16px;
    padding: 16px 18px;
    border-radius: 18px;
    border: 1px solid var(--border);
    background: var(--surface-glass);
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.2s ease;
  }
  .provider-option:hover {
    transform: translateY(-1px);
    border-color: rgba(29, 78, 216, 0.35);
    box-shadow: 0 18px 34px rgba(15, 23, 42, 0.16);
  }
  .provider-option[data-active="true"] {
    border-color: var(--accent);
    background: linear-gradient(135deg, rgba(29, 78, 216, 0.14), rgba(29, 78, 216, 0.05));
    box-shadow: 0 18px 34px rgba(29, 78, 216, 0.22);
  }
  .provider-option input {
    margin-top: 4px;
  }
  .provider-meta {
    display: grid;
    gap: 6px;
  }
  .provider-meta strong {
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text);
  }
  .provider-meta span {
    font-size: 0.9rem;
    color: var(--muted);
  }
  .provider-meta p {
    margin: 0;
    color: var(--subtle);
    font-size: 0.88rem;
    max-width: 48ch;
  }
  .provider-fixed {
    color: var(--subtle);
    font-size: 0.92rem;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 0.82rem;
    font-weight: 500;
    letter-spacing: 0.015em;
  }
  form {
    display: grid;
    gap: 20px;
  }
  label span {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    color: var(--text);
    font-size: 0.95rem;
  }
  input[type="password"],
  input[type="text"],
  select,
  textarea {
    width: 100%;
    padding: 16px 18px;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: rgba(248, 250, 255, 0.95);
    color: var(--text);
    font: inherit;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  }
  textarea {
    resize: vertical;
    min-height: 200px;
    line-height: 1.7;
  }
  input:not([type="radio"]):focus,
  textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--ring);
    background: #fdfefe;
  }
  select:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--ring);
    background: #fdfefe;
  }
  input::placeholder,
  textarea::placeholder {
    color: var(--subtle);
  }
  input[type="radio"]:focus-visible {
    outline: none;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .model-custom {
    display: grid;
    gap: 12px;
  }
  .model-custom[hidden] {
    display: none;
  }
  .model-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--subtle);
  }
  .model-note {
    margin: -8px 0 0;
    font-size: 0.85rem;
    color: var(--subtle);
  }
  .model-inspector {
    display: grid;
    gap: 16px;
    margin: 4px 0 12px;
  }
  .model-detail {
    border-radius: 18px;
    border: 1px solid var(--border);
    background: var(--surface-glass);
    padding: 18px 20px;
    box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
  }
  .model-detail__header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    column-gap: 16px;
    row-gap: 10px;
  }
  .model-detail__header > div:first-child {
    flex: 1 1 260px;
    min-width: 0;
  }
  .model-detail__header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text);
  }
  .model-detail__tagline {
    margin: 4px 0 0;
    font-size: 0.88rem;
    color: var(--subtle);
  }
  .model-detail__cost {
    font-weight: 600;
    color: var(--accent);
    font-size: 0.9rem;
    margin-left: auto;
    text-align: right;
    line-height: 1.35;
    white-space: normal;
  }
  .model-detail__description {
    margin: 12px 0 14px;
    color: var(--muted);
    line-height: 1.6;
  }
  .model-detail__facts {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
  }
  .model-detail__facts div {
    display: grid;
    gap: 4px;
  }
  .model-detail__facts dt {
    margin: 0;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--subtle);
  }
  .model-detail__facts dd {
    margin: 0;
    font-weight: 500;
    color: var(--text);
  }
  .model-highlight {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-dark);
    font-size: 0.75rem;
    font-weight: 600;
  }
  .model-lineup {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .model-lineup[hidden] {
    display: none;
  }
  .model-lineup__title {
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--subtle);
  }
  .model-lineup__grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
  .model-lineup__button {
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 14px 16px;
    background: var(--surface);
    text-align: left;
    display: grid;
    gap: 4px;
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }
  .model-lineup__button:hover {
    border-color: var(--accent);
    box-shadow: 0 14px 36px rgba(29, 78, 216, 0.14);
    transform: translateY(-1px);
  }
  .model-lineup__button.is-active {
    border-color: var(--accent);
    box-shadow: 0 16px 36px rgba(29, 78, 216, 0.18);
    background: rgba(29, 78, 216, 0.08);
  }
  .model-lineup__name {
    font-weight: 600;
    color: var(--text);
    font-size: 0.95rem;
  }
  .model-lineup__tag {
    font-size: 0.82rem;
    color: var(--muted);
  }
  .key-status {
    margin: 8px 0 0;
    font-size: 0.9rem;
    color: var(--subtle);
  }
  .key-status[data-key-variant="verified"] {
    color: #047857;
    font-weight: 600;
  }
  .key-status[data-key-variant="detected"] {
    color: #2563eb;
    font-weight: 500;
  }
  .advanced {
    border: 1px solid var(--border);
    border-radius: 16px;
    background: rgba(248, 250, 255, 0.72);
    padding: 0;
  }
  .advanced summary {
    list-style: none;
    cursor: pointer;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-weight: 600;
    color: var(--text);
  }
  .advanced summary::-webkit-details-marker {
    display: none;
  }
  .advanced[open] summary {
    border-bottom: 1px solid rgba(148, 163, 184, 0.35);
  }
  .advanced-subtitle {
    font-size: 0.85rem;
    font-weight: 400;
    color: var(--subtle);
  }
  .advanced-body {
    padding: 20px;
    display: grid;
    gap: 16px;
  }
  .advanced-grid {
    display: grid;
    gap: 16px;
  }
  .advanced-grid .field-group {
    display: grid;
    gap: 8px;
  }
  .field-group[data-disabled="true"] {
    opacity: 0.6;
  }
  .field-helper {
    margin: 0;
    font-size: 0.82rem;
    color: var(--subtle);
  }
  button,
  .secondary-link {
    border: none;
    border-radius: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
  }
  button.primary {
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    color: #f8fafc;
    padding: 14px 30px;
    box-shadow: 0 20px 34px rgba(29, 78, 216, 0.24);
  }
  button.primary:hover {
    transform: translateY(-1px);
    filter: brightness(1.02);
  }
  button.primary:focus-visible {
    outline: 3px solid var(--ring);
    outline-offset: 2px;
  }
  .secondary-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(15, 23, 42, 0.04);
    color: var(--text);
    padding: 12px 22px;
    text-decoration: none;
  }
  .secondary-link:hover {
    transform: translateY(-1px);
  }
  ul {
    margin: 0;
    padding-left: 20px;
    color: var(--subtle);
    display: grid;
    gap: 10px;
  }
  li {
    margin: 0;
  }
  .banner {
    padding: 14px 18px;
    border-radius: 16px;
    font-size: 0.95rem;
    border: 1px solid transparent;
  }
  .banner.status {
    background: rgba(4, 120, 87, 0.08);
    border-color: rgba(4, 120, 87, 0.24);
    color: var(--success);
  }
  .banner.error {
    background: rgba(185, 28, 28, 0.08);
    border-color: rgba(185, 28, 28, 0.26);
    color: var(--error);
  }
  @media (max-width: 640px) {
    .actions {
      flex-direction: column;
      align-items: stretch;
    }
    button,
    .secondary-link {
      width: 100%;
      justify-content: center;
    }
    .model-lineup__grid {
      grid-template-columns: 1fr;
    }
  }
  @media (min-width: 880px) {
    .model-inspector {
      grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
      align-items: start;
    }
  }
</style>
</head>
<body>
  <main>
    <header>
      <span class="step-indicator">${escapeHtml(stepIndicator)}</span>
      <h1>${escapeHtml(heading)}</h1>
      <p>${escapeHtml(description)}</p>
    </header>
    ${banner}
    ${body}
  </main>
  ${script}
</body>
</html>`;
}
function buildBanner(statusMessage, errorMessage) {
    if (errorMessage) {
        return `<div role="alert" class="banner error">${escapeHtml(errorMessage)}</div>`;
    }
    if (statusMessage) {
        return `<div role="status" class="banner status">${escapeHtml(statusMessage)}</div>`;
    }
    return "";
}
function renderProviderStep(options) {
    const { providerLabel, providerName, verifyAction, providerReady, canSelectProvider, selectedProvider, selectedModel, providerSelectionRequired, providerKeyStatuses, maxOutputTokens, reasoningMode, reasoningTokens, } = options;
    const capabilities = PROVIDER_REASONING_CAPABILITIES[selectedProvider] ?? {
        mode: false,
        tokens: false,
    };
    const providerSupportsReasoningMode = capabilities.mode;
    const providerSupportsReasoningTokens = capabilities.tokens;
    const defaultReasoningTokens = DEFAULT_REASONING_TOKENS[selectedProvider];
    const defaultMaxTokens = DEFAULT_MAX_TOKENS_BY_PROVIDER[selectedProvider] ??
        DEFAULT_MAX_OUTPUT_TOKENS;
    const effectiveReasoningTokens = reasoningTokens ?? defaultReasoningTokens;
    const reasoningTokenValue = effectiveReasoningTokens !== undefined && effectiveReasoningTokens !== null
        ? String(effectiveReasoningTokens)
        : "";
    const maxTokensValue = maxOutputTokens !== defaultMaxTokens ? String(maxOutputTokens) : "";
    const advancedOpen = (providerSupportsReasoningMode && reasoningMode !== "none") ||
        (providerSupportsReasoningTokens &&
            reasoningTokens !== undefined &&
            reasoningTokens !== defaultReasoningTokens) ||
        maxOutputTokens !== defaultMaxTokens;
    const reasoningTokensDisabled = !providerSupportsReasoningTokens ||
        (providerSupportsReasoningMode && reasoningMode === "none");
    const reasoningTokenMinValue = REASONING_TOKEN_MIN_BY_PROVIDER[selectedProvider];
    const reasoningInputMinAttr = typeof reasoningTokenMinValue === "number" && reasoningTokenMinValue >= 0
        ? `min="${escapeHtml(String(reasoningTokenMinValue))}"`
        : "";
    const selectedStatus = providerKeyStatuses[selectedProvider] ?? {
        hasKey: false,
        verified: false,
    };
    const keyOnFile = Boolean(selectedStatus.hasKey);
    const keyVerified = Boolean(selectedStatus.verified);
    const copyText = keyVerified
        ? `Pick your creative partner. We already have a verified ${providerLabel} key on file—leave the field blank to keep it, or paste a new one to replace it.`
        : keyOnFile
            ? `Pick your creative partner. We detected a ${providerLabel} key from your environment—continue to verify it or paste a different key.`
            : `Pick your creative partner and hand us a fresh API key—we will secure it in your OS keychain and wire ${providerName} into the experience.`;
    const keyStatusMessage = keyVerified
        ? `${providerLabel} key verified and stored in your OS keychain. Leave the field blank to keep using it, or paste a replacement.`
        : keyOnFile
            ? `${providerLabel} key detected from environment variables (not stored). Continue to verify it or paste a different key to store in your OS keychain.`
            : "Paste your API key. Keys entered here are securely stored in your OS keychain (macOS Keychain, Windows Credential Manager, or Linux Secret Service). Keys from environment variables or CLI options are never stored.";
    const keyStatusVariant = keyVerified
        ? "verified"
        : keyOnFile
            ? "detected"
            : "missing";
    const apiInputRequired = !keyOnFile;
    const statusPill = keyVerified
        ? `<span class="pill" aria-live="polite">Key verified · ${escapeHtml(providerLabel)}</span>`
        : keyOnFile
            ? `<span class="pill" aria-live="polite">Key detected · ${escapeHtml(providerLabel)}</span>`
            : canSelectProvider
                ? `<span class="pill">Choose your model partner</span>`
                : `<span class="pill">${escapeHtml(providerLabel)} required</span>`;
    const providerSelection = canSelectProvider
        ? `<div class="provider-grid" role="radiogroup" aria-label="Model provider" data-provider-options>
        ${PROVIDER_CHOICES.map((choice, index) => {
            const active = choice.value === selectedProvider;
            const inputId = `provider-${choice.value}`;
            return `<label class="provider-option" data-active="${active}" for="${inputId}">
              <input id="${inputId}" type="radio" name="provider" value="${escapeHtml(choice.value)}" ${active ? "checked" : ""} ${index === 0 ? "required" : ""} data-placeholder="${escapeHtml(choice.placeholder)}" data-provider-label="${escapeHtml(choice.title)}" />
              <div class="provider-meta">
                <strong>${escapeHtml(choice.title)}</strong>
                <span>${escapeHtml(choice.subtitle)}</span>
                <p>${escapeHtml(choice.description)}</p>
              </div>
            </label>`;
        }).join("\n")}
      </div>`
        : `<p class="provider-fixed">Provider locked to ${escapeHtml(providerName)} via CLI/env flags.</p>
      <input type="hidden" name="provider" value="${escapeHtml(selectedProvider)}" />`;
    const apiPlaceholder = PROVIDER_PLACEHOLDERS[selectedProvider] ?? "sk-...";
    const defaultModel = DEFAULT_MODEL_BY_PROVIDER[selectedProvider] ?? "";
    let initialModel = selectedModel && selectedModel.trim().length > 0
        ? selectedModel.trim()
        : "";
    if (!initialModel) {
        initialModel = defaultModel;
    }
    const suggestionOptions = getModelOptionList(selectedProvider, initialModel);
    const suggestionValues = suggestionOptions.map((option) => option.value);
    const includesInitial = suggestionValues.includes(initialModel);
    const selectValue = includesInitial ? initialModel : "__custom";
    const customValue = includesInitial ? "" : initialModel;
    const modelOptionsId = "model-options";
    const modelOptions = suggestionOptions
        .map((option) => {
        const selectedAttr = option.value === selectValue ? " selected" : "";
        return `<option value="${escapeHtml(option.value)}"${selectedAttr}>${escapeHtml(option.label)}</option>`;
    })
        .join("\n");
    const detailPanel = renderModelDetailPanel(selectedProvider, initialModel);
    const lineupMarkup = renderModelLineup(selectedProvider, initialModel);
    return `<section class="card">
    <div>${statusPill}</div>
    <p data-provider-copy>${escapeHtml(copyText)}</p>
    <form method="post" action="${escapeHtml(verifyAction)}" autocomplete="off" data-key-state="${escapeHtml(keyStatusVariant)}" data-selection-required="${providerSelectionRequired ? "true" : "false"}">
      ${providerSelection}
      <input type="hidden" name="model" value="${escapeHtml(initialModel)}" data-model-value />
      <label for="${modelOptionsId}">
        <span data-model-label>Model · ${escapeHtml(providerLabel)}</span>
      </label>
      <select id="${modelOptionsId}" data-model-select>
        ${modelOptions}
        <option value="__custom" ${selectValue === "__custom" ? "selected" : ""}>Custom…</option>
      </select>
      <p class="model-note">These options are curated defaults. Choose “Custom…” to supply an exact identifier.</p>
      <div class="model-custom" data-model-custom ${selectValue === "__custom" ? "" : "hidden"}>
        <label for="model-custom-input"><span>Custom model identifier</span></label>
        <input
          id="model-custom-input"
          type="text"
          inputmode="text"
          spellcheck="false"
          autocomplete="off"
          data-model-custom-input
          value="${escapeHtml(customValue)}"
          placeholder="Enter the exact model ID"
        />
        <p class="model-hint">Need a specific tier or preview build? Paste the full model identifier here.</p>
      </div>
      <div class="model-inspector" data-model-inspector>
        <div class="model-inspector__detail" data-model-detail-container>${detailPanel}</div>
        <div class="model-inspector__lineup" data-model-lineup-container>${lineupMarkup}</div>
      </div>
      <label for="apiKey">
        <span data-provider-label-text>${escapeHtml(providerLabel)} API key</span>
      </label>
      <input
        id="apiKey"
        name="apiKey"
        type="password"
        inputmode="latin"
        spellcheck="false"
        autocapitalize="none"
        placeholder="${escapeHtml(apiPlaceholder)}"
        autocomplete="new-password"
        ${apiInputRequired ? "required" : ""}
        data-key-input
      />
      <p class="key-status" data-key-status data-key-variant="${escapeHtml(keyStatusVariant)}">${escapeHtml(keyStatusMessage)}</p>
      <details class="advanced" data-advanced ${advancedOpen ? "open" : ""}>
        <summary>
          <span>Advanced controls</span>
          <span class="advanced-subtitle">Tune token budgets and reasoning traces.</span>
        </summary>
        <div class="advanced-body">
          <div class="advanced-grid">
            <div class="field-group">
              <label for="maxOutputTokens">
                <span>Max output tokens</span>
              </label>
              <input
                id="maxOutputTokens"
                name="maxOutputTokens"
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                placeholder="${escapeHtml(String(defaultMaxTokens))}"
                value="${escapeHtml(maxTokensValue)}"
                data-max-tokens
              />
              <p class="field-helper">Cap each response size. Leave blank to stick with the provider default.</p>
            </div>
            <div class="field-group" data-reasoning-mode-wrapper ${providerSupportsReasoningMode ? "" : "hidden"}>
              <label for="reasoningMode">
                <span>Reasoning mode</span>
              </label>
              <select id="reasoningMode" name="reasoningMode" data-reasoning-mode>
                ${REASONING_MODE_CHOICES.map((choice) => {
        const selectedAttr = choice.value === reasoningMode ? " selected" : "";
        return `<option value="${escapeHtml(choice.value)}"${selectedAttr}>${escapeHtml(choice.label)}</option>`;
    }).join("\n")}
              </select>
              <p class="field-helper" data-reasoning-helper>${escapeHtml(REASONING_MODE_CHOICES.find((choice) => choice.value === reasoningMode)?.description ?? "")}</p>
            </div>
            <div class="field-group" data-reasoning-tokens-wrapper ${providerSupportsReasoningTokens ? "" : "hidden"} ${reasoningTokensDisabled ? 'data-disabled="true"' : ""}>
              <label for="reasoningTokens">
                <span>Reasoning max tokens</span>
              </label>
      <input
        id="reasoningTokens"
        name="reasoningTokens"
        type="number"
        ${reasoningInputMinAttr}
        step="1"
        inputmode="numeric"
        value="${escapeHtml(reasoningTokenValue)}"
        ${reasoningTokensDisabled ? "disabled" : ""}
        data-reasoning-tokens
              />
              <p class="field-helper">Reserve a budget for deliberate reasoning. Leave blank for provider defaults.</p>
            </div>
          </div>
        </div>
      </details>
      <div class="actions">
        <button type="submit" class="primary">Verify &amp; continue</button>
      </div>
    </form>
  </section>`;
}
function renderBriefStep(options) {
    const { briefAction, setupPath, adminPath, briefValue } = options;
    const value = briefValue ?? "";
    return `<section class="card">
    <div class="pill">Craft the brief</div>
    <p>Describe the product vision in plain language—tone, audience, signature moments. We will use it as the north star for every render.</p>
    <form method="post" action="${escapeHtml(briefAction)}">
      <label for="brief">
        <span>What are we building?</span>
      </label>
      <textarea id="brief" name="brief" placeholder="Example: You are a ritual planning companion. Focus on warm light, generous whitespace, and a sense of calm. Surfaces should feel curated and tactile." required>${escapeHtml(value)}</textarea>
      <div class="actions">
        <a class="secondary-link" href="${escapeHtml(`${setupPath}?step=provider`)}" rel="nofollow">Back</a>
        <button type="submit" class="primary">Open the studio</button>
      </div>
    </form>
    <p>After launch the admin dashboard will let you adjust the brief, swap providers, and review every generated page.</p>
    <p><a href="${escapeHtml(adminPath)}">Preview the admin tools</a> (opens once setup completes).</p>
  </section>`;
}
function renderProviderScript(_canSelectProvider, selectedProvider, selectedModel, reasoningMode, reasoningTokens, maxOutputTokens, providerKeyStatuses) {
    const modelCatalogJson = serializeModelCatalogForClient();
    const defaultModelJson = JSON.stringify(DEFAULT_MODEL_BY_PROVIDER).replace(/</g, "\\u003c");
    const providerLabelJson = JSON.stringify(PROVIDER_LABELS).replace(/</g, "\\u003c");
    const placeholderJson = JSON.stringify(PROVIDER_PLACEHOLDERS).replace(/</g, "\\u003c");
    const maxTokensJson = JSON.stringify(DEFAULT_MAX_TOKENS_BY_PROVIDER).replace(/</g, "\\u003c");
    const reasoningDescriptionsJson = JSON.stringify(Object.fromEntries(REASONING_MODE_CHOICES.map((choice) => [choice.value, choice.description]))).replace(/</g, "\\u003c");
    const reasoningCapabilitiesJson = JSON.stringify(PROVIDER_REASONING_CAPABILITIES).replace(/</g, "\\u003c");
    const reasoningDefaultsJson = JSON.stringify(DEFAULT_REASONING_TOKENS).replace(/</g, "\\u003c");
    const reasoningMinJson = JSON.stringify(REASONING_TOKEN_MIN_BY_PROVIDER).replace(/</g, "\\u003c");
    const providerStatusJson = JSON.stringify(providerKeyStatuses).replace(/</g, "\\u003c");
    const initialProviderJson = JSON.stringify(selectedProvider);
    const initialModelJson = JSON.stringify(selectedModel);
    const initialReasoningModeJson = JSON.stringify(reasoningMode);
    const initialReasoningTokensJson = JSON.stringify(reasoningTokens ?? null);
    const script = `
  <script>
    (() => {
      const modelCatalog = ${modelCatalogJson};
      const defaultModels = ${defaultModelJson};
      const providerLabels = ${providerLabelJson};
      const placeholderMap = ${placeholderJson};
      const maxTokenDefaults = ${maxTokensJson};
      const reasoningDescriptions = ${reasoningDescriptionsJson};
      const reasoningCapabilities = ${reasoningCapabilitiesJson};
      const reasoningDefaults = ${reasoningDefaultsJson};
      const reasoningMins = ${reasoningMinJson};
      const cachedReasoningTokensByProvider = {};
      const providerKeyStatus = ${providerStatusJson};
      const initialProviderKeyStatus = JSON.parse(JSON.stringify(providerKeyStatus));
      const cachedApiInputs = {};
      const cachedModelByProvider = Object.create(null);
      const copyTemplates = {
        verified: "Pick your creative partner. We already have a verified {provider} key on file—leave the field blank to keep it, or paste a new one to replace it.",
        detected: "Pick your creative partner. We detected a {provider} key from your environment—continue to verify it or paste a different key.",
        missing: "Pick your creative partner and hand us a fresh API key—we will secure it in your OS keychain and wire {provider} into the experience."
      };
      const keyStatusTemplates = {
        verified: "{provider} key verified and stored in your OS keychain. Leave the field blank to keep using it, or paste a replacement.",
        detected: "{provider} key detected from environment variables (not stored). Continue to verify it or paste a different key to store in your OS keychain.",
        missing: "Paste your API key. Keys entered here are securely stored in your OS keychain (macOS Keychain, Windows Credential Manager, or Linux Secret Service). Keys from environment variables or CLI options are never stored."
      };
      let activeProvider = ${initialProviderJson} || 'openai';
      let currentModel = ${initialModelJson} || '';
      let currentReasoningMode = ${initialReasoningModeJson} || 'none';
      const initialReasoningTokens = ${initialReasoningTokensJson};
      let reasoningModeSupported = !!(reasoningCapabilities[activeProvider] && reasoningCapabilities[activeProvider].mode);
      let reasoningTokensSupported = !!(reasoningCapabilities[activeProvider] && reasoningCapabilities[activeProvider].tokens);

      const container = document.querySelector('[data-provider-options]');
      const radios = container ? Array.from(container.querySelectorAll('input[name="provider"]')) : [];
      const optionEls = container ? Array.from(container.querySelectorAll('.provider-option')) : [];
      const labelEl = document.querySelector('[data-provider-label-text]');
      const copyEl = document.querySelector('[data-provider-copy]');
      const modelLabelEl = document.querySelector('[data-model-label]');
      const apiInput = document.getElementById('apiKey');
      const modelValueInput = document.querySelector('[data-model-value]');
      const modelSelect = document.querySelector('[data-model-select]');
      const customWrapper = document.querySelector('[data-model-custom]');
      const customInput = document.querySelector('[data-model-custom-input]');
      const detailContainer = document.querySelector('[data-model-detail-container]');
      const lineupContainer = document.querySelector('[data-model-lineup-container]');
      const maxTokensInput = document.querySelector('[data-max-tokens]');
      const reasoningModeWrapper = document.querySelector('[data-reasoning-mode-wrapper]');
      const reasoningModeSelect = document.querySelector('[data-reasoning-mode]');
      const reasoningTokensWrapper = document.querySelector('[data-reasoning-tokens-wrapper]');
      const reasoningTokensInput = document.querySelector('[data-reasoning-tokens]');
      const reasoningHelper = document.querySelector('[data-reasoning-helper]');
      const keyStatusEl = document.querySelector('[data-key-status]');
      const formEl = document.querySelector('form[data-key-state]');

      const setActiveOption = (radio) => {
        if (!optionEls.length) return;
        optionEls.forEach((option) => {
          const optionRadio = option.querySelector('input[name="provider"]');
          option.dataset.active = optionRadio === radio ? 'true' : 'false';
        });
      };

      const getKeyVariantForProvider = (provider) => {
        const status = providerKeyStatus[provider] || { hasKey: false, verified: false };
        if (status.verified) return 'verified';
        if (status.hasKey) return 'detected';
        return 'missing';
      };

      const applyKeyVariant = (provider, providerLabel, overrideVariant) => {
        const variant = overrideVariant || getKeyVariantForProvider(provider);
        const copyTemplate = copyTemplates[variant] || copyTemplates.missing;
        const statusTemplate = keyStatusTemplates[variant] || keyStatusTemplates.missing;
        if (copyEl) {
          copyEl.textContent = copyTemplate.replace('{provider}', providerLabel);
        }
        if (keyStatusEl) {
          keyStatusEl.textContent = statusTemplate.replace('{provider}', providerLabel);
          keyStatusEl.dataset.keyVariant = variant;
        }
        if (formEl) {
          formEl.dataset.keyState = variant;
        }
        if (apiInput instanceof HTMLInputElement) {
          if (variant === 'missing') {
            apiInput.setAttribute('required', 'true');
          } else {
            apiInput.removeAttribute('required');
          }
        }
        return variant;
      };

      const updateProviderUI = (provider, explicitLabel, overrideVariant) => {
        const providerLabel = explicitLabel || providerLabels[provider] || provider;
        const placeholder = placeholderMap[provider];
        if (labelEl) {
          labelEl.textContent = providerLabel + ' API key';
        }
        if (modelLabelEl) {
          modelLabelEl.textContent = 'Model · ' + providerLabel;
        }
        if (apiInput instanceof HTMLInputElement && placeholder) {
          apiInput.placeholder = placeholder;
        }
        if (maxTokensInput instanceof HTMLInputElement) {
          const defaultMax = maxTokenDefaults[provider];
          if (typeof defaultMax === 'number') {
            maxTokensInput.placeholder = String(defaultMax);
          }
        }
        applyKeyVariant(provider, providerLabel, overrideVariant);
      };

      const getModelList = (provider) => {
        const list = modelCatalog[provider];
        return Array.isArray(list) ? [...list] : [];
      };

      const updateModelDetail = (provider, value) => {
        if (!(detailContainer instanceof HTMLElement)) {
          return;
        }
        const trimmed = value && typeof value === 'string' ? value.trim() : '';
        const list = getModelList(provider);
        const fallback = trimmed || defaultModels[provider] || (list[0] ? list[0].value : '');
        const metadata = list.find((model) => model.value === fallback);
        detailContainer.innerHTML = '';
        const detail = document.createElement('div');
        detail.className = 'model-detail';
        if (metadata) {
          detail.innerHTML = [
            '<div class="model-detail__header">',
            '  <div>',
            '    <h3 data-model-name></h3>',
            '    <p class="model-detail__tagline" data-model-tagline></p>',
            '  </div>',
            '  <div class="model-detail__cost" data-model-cost></div>',
            '</div>',
            '<p class="model-detail__description" data-model-description></p>',
            '<dl class="model-detail__facts">',
            '  <div><dt>Context window</dt><dd data-model-context></dd></div>',
            '  <div><dt>Recommended for</dt><dd data-model-recommended></dd></div>',
            '  <div><dt>Highlights</dt><dd data-model-highlights></dd></div>',
            '  <div><dt>Release</dt><dd data-model-release></dd></div>',
            '</dl>',
          ].join('');
          const name = detail.querySelector('[data-model-name]');
          const tagline = detail.querySelector('[data-model-tagline]');
          const description = detail.querySelector('[data-model-description]');
          const context = detail.querySelector('[data-model-context]');
          const recommended = detail.querySelector('[data-model-recommended]');
          const highlights = detail.querySelector('[data-model-highlights]');
          const release = detail.querySelector('[data-model-release]');
          const costEl = detail.querySelector('[data-model-cost]');
          if (name) name.textContent = metadata.label;
          if (tagline) tagline.textContent = metadata.tagline || '';
          if (description) description.textContent = metadata.description || '';
          if (context) {
            if (typeof metadata.contextWindow === 'number') {
              const unit = metadata.contextWindowUnit || 'tokens';
              context.textContent = metadata.contextWindow.toLocaleString() + ' ' + unit;
            } else {
              context.textContent = '—';
            }
          }
          if (recommended) {
            recommended.textContent = metadata.recommendedFor || 'Versatile creative work';
          }
          if (highlights) {
            highlights.innerHTML = '';
            if (Array.isArray(metadata.highlights) && metadata.highlights.length) {
              metadata.highlights.forEach((item) => {
                const badge = document.createElement('span');
                badge.className = 'model-highlight';
                badge.textContent = item;
                highlights.appendChild(badge);
                highlights.appendChild(document.createTextNode(' '));
              });
            } else {
              highlights.textContent = '—';
            }
          }
          if (release) {
            release.textContent = metadata.release || '—';
          }
          if (costEl) {
            const cost = metadata.cost;
            const parts = [];
            if (cost && typeof cost.input === 'number') {
              parts.push('$' + cost.input.toFixed(cost.input >= 1 ? 2 : 3) + ' in');
            }
            if (cost && typeof cost.output === 'number') {
              parts.push('$' + cost.output.toFixed(cost.output >= 1 ? 2 : 3) + ' out');
            }
            if (cost && typeof cost.reasoning === 'number') {
              parts.push('$' + cost.reasoning.toFixed(cost.reasoning >= 1 ? 2 : 3) + ' reasoning');
            }
            costEl.textContent = parts.length
              ? parts.join(' · ') + ' · ' + cost.currency + '/' + cost.unit
              : 'Cost info coming soon';
          }
        } else {
          detail.innerHTML = [
            '<div class="model-detail__header">',
            '  <div>',
            '    <h3 data-model-name></h3>',
            '    <p class="model-detail__tagline">Custom model</p>',
            '  </div>',
            '</div>',
            '<p class="model-detail__description"></p>',
            '<dl class="model-detail__facts">',
            '  <div><dt>Context window</dt><dd>—</dd></div>',
            '  <div><dt>Recommended for</dt><dd>Define your own sweet spot.</dd></div>',
            '  <div><dt>Highlights</dt><dd>—</dd></div>',
            '  <div><dt>Cost</dt><dd>Cost info coming soon</dd></div>',
            '</dl>',
          ].join('');
          const name = detail.querySelector('[data-model-name]');
          if (name) name.textContent = trimmed || 'Custom model';
          const desc = detail.querySelector('[data-model-description]');
          if (desc) {
            desc.textContent =
              'Provide a custom model identifier supported by the provider. You can adjust token budgets below.';
          }
        }
        detailContainer.appendChild(detail);
      };

      const updateModelLineup = (provider, value) => {
        if (!(lineupContainer instanceof HTMLElement)) {
          return;
        }
        lineupContainer.innerHTML = '';
        const list = getModelList(provider);
        let featured = list.filter((model) => model && model.featured);
        if (featured.length === 0) {
          featured = list.slice(0, 4);
        }
        if (featured.length === 0) {
          lineupContainer.hidden = true;
          return;
        }
        lineupContainer.hidden = false;
        const trimmed = typeof value === 'string' ? value.trim() : '';
        const activeValue = trimmed || defaultModels[provider] || (featured[0] ? featured[0].value : '');
        const title = document.createElement('span');
        title.className = 'model-lineup__title';
        title.textContent = 'Quick swap';
        const grid = document.createElement('div');
        grid.className = 'model-lineup__grid';
        featured.forEach((model) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'model-lineup__button';
          if (model.value === activeValue) {
            button.classList.add('is-active');
          }
          const name = document.createElement('span');
          name.className = 'model-lineup__name';
          name.textContent = model.label;
          const tag = document.createElement('span');
          tag.className = 'model-lineup__tag';
          tag.textContent = model.tagline || '';
          button.appendChild(name);
          button.appendChild(tag);
          button.addEventListener('click', () => {
            selectModel(model.value, { focus: false });
          });
          grid.appendChild(button);
        });
        lineupContainer.appendChild(title);
        lineupContainer.appendChild(grid);
      };

      const updateModelPanels = (provider, value) => {
        updateModelDetail(provider, value);
        updateModelLineup(provider, value);
      };

      const ensureModelValue = (value) => {
        currentModel = value;
        if (modelValueInput) {
          modelValueInput.value = value;
        }
        cachedModelByProvider[activeProvider] = value;
        updateModelPanels(activeProvider, value);
      };

      const showCustom = (value, shouldFocus) => {
        if (customWrapper) {
          customWrapper.hidden = false;
        }
        if (customInput instanceof HTMLInputElement) {
          customInput.value = value || '';
          if (shouldFocus) {
            customInput.focus({ preventScroll: true });
          }
        }
        ensureModelValue((customInput && customInput.value.trim()) || '');
      };

      const hideCustom = () => {
        if (customWrapper) {
          customWrapper.hidden = true;
        }
        if (customInput instanceof HTMLInputElement) {
          customInput.value = '';
        }
      };

      const primeReasoningTokensForProvider = (provider) => {
        const existing = cachedReasoningTokensByProvider[provider];
        if (existing !== undefined && existing !== null && existing !== '') {
          return existing;
        }
        const defaultTokens = reasoningDefaults[provider];
        if (typeof defaultTokens === 'number') {
          const asString = String(defaultTokens);
          cachedReasoningTokensByProvider[provider] = asString;
          return asString;
        }
        return '';
      };

      let cachedReasoningTokens = typeof initialReasoningTokens === 'number' ? String(initialReasoningTokens) : '';
      if (reasoningTokensInput instanceof HTMLInputElement) {
        const existing = reasoningTokensInput.value.trim();
        if (existing) {
          cachedReasoningTokens = existing;
        }
      }
      if (cachedReasoningTokens) {
        cachedReasoningTokensByProvider[activeProvider] = cachedReasoningTokens;
      } else {
        cachedReasoningTokens = primeReasoningTokensForProvider(activeProvider);
        if (reasoningTokensInput instanceof HTMLInputElement && cachedReasoningTokens) {
          reasoningTokensInput.value = cachedReasoningTokens;
        }
      }

      const applyReasoningMode = (mode) => {
        cachedReasoningTokens = cachedReasoningTokensByProvider[activeProvider] || cachedReasoningTokens || primeReasoningTokensForProvider(activeProvider);
        const normalized = (mode || 'none').toLowerCase();
        currentReasoningMode = normalized;
        if (reasoningModeSelect instanceof HTMLSelectElement) {
          reasoningModeSelect.value = normalized;
        }
        if (reasoningHelper) {
          reasoningHelper.textContent = reasoningDescriptions[normalized] || '';
        }
        const disabled = !reasoningTokensSupported || (reasoningModeSupported && normalized === 'none');
        if (reasoningTokensWrapper instanceof HTMLElement) {
          if (disabled) {
            reasoningTokensWrapper.setAttribute('data-disabled', 'true');
          } else {
            reasoningTokensWrapper.removeAttribute('data-disabled');
          }
        }
        if (reasoningTokensInput instanceof HTMLInputElement) {
          if (disabled) {
            const trimmed = reasoningTokensInput.value.trim();
            if (trimmed) {
              cachedReasoningTokens = trimmed;
              cachedReasoningTokensByProvider[activeProvider] = trimmed;
            }
            reasoningTokensInput.value = '';
            reasoningTokensInput.disabled = true;
          } else {
            reasoningTokensInput.disabled = false;
            if (!reasoningTokensInput.value.trim()) {
              cachedReasoningTokens = cachedReasoningTokens || primeReasoningTokensForProvider(activeProvider);
              if (cachedReasoningTokens) {
                reasoningTokensInput.value = cachedReasoningTokens;
              }
            }
            cachedReasoningTokens = reasoningTokensInput.value.trim();
            cachedReasoningTokensByProvider[activeProvider] = cachedReasoningTokens;
          }
        }
      };

      const toggleFieldVisibility = (wrapper, shouldShow) => {
        if (!(wrapper instanceof HTMLElement)) {
          return;
        }
        if (shouldShow) {
          wrapper.hidden = false;
          wrapper.setAttribute('aria-hidden', 'false');
          wrapper.style.display = '';
        } else {
          const active = document.activeElement;
          if (active && wrapper.contains(active) && typeof active.blur === 'function') {
            active.blur();
          }
          wrapper.hidden = true;
          wrapper.setAttribute('aria-hidden', 'true');
          wrapper.style.display = 'none';
        }
      };

      const syncReasoningAvailability = () => {
        const caps = reasoningCapabilities[activeProvider] || { mode: false, tokens: false };
        reasoningModeSupported = !!caps.mode;
        reasoningTokensSupported = !!caps.tokens;

        toggleFieldVisibility(reasoningModeWrapper, reasoningModeSupported);

        if (!reasoningModeSupported) {
          currentReasoningMode = 'none';
          if (reasoningModeSelect instanceof HTMLSelectElement) {
            reasoningModeSelect.value = 'none';
          }
          if (reasoningHelper) {
            reasoningHelper.textContent = '';
          }
        }

        toggleFieldVisibility(reasoningTokensWrapper, reasoningTokensSupported);
        if (reasoningTokensWrapper instanceof HTMLElement && !reasoningTokensSupported) {
          reasoningTokensWrapper.removeAttribute('data-disabled');
        }
        if (reasoningTokensInput instanceof HTMLInputElement) {
          const minValue = reasoningMins[activeProvider];
          if (typeof minValue === 'number' && minValue >= 0) {
            reasoningTokensInput.min = String(minValue);
          } else {
            reasoningTokensInput.removeAttribute('min');
          }
          if (!reasoningTokensSupported) {
            reasoningTokensInput.value = '';
            reasoningTokensInput.disabled = true;
          }
        }

        if (reasoningModeSelect instanceof HTMLSelectElement) {
          reasoningModeSelect.disabled = !reasoningModeSupported;
        }

        if (reasoningTokensSupported) {
          cachedReasoningTokens = cachedReasoningTokensByProvider[activeProvider] || primeReasoningTokensForProvider(activeProvider);
        } else {
          cachedReasoningTokens = '';
        }

        if (reasoningModeSupported) {
          const modeValue = reasoningModeSelect instanceof HTMLSelectElement
            ? reasoningModeSelect.value
            : currentReasoningMode;
          applyReasoningMode(modeValue);
        } else if (reasoningTokensSupported) {
          applyReasoningMode('none');
          if (reasoningTokensInput instanceof HTMLInputElement) {
            if (!reasoningTokensInput.value.trim() && cachedReasoningTokens) {
              reasoningTokensInput.value = cachedReasoningTokens;
            }
            reasoningTokensInput.disabled = false;
            cachedReasoningTokens = reasoningTokensInput.value.trim();
            cachedReasoningTokensByProvider[activeProvider] = cachedReasoningTokens;
          }
        }
      };

      const rebuildModelOptions = (provider, preserveSelection) => {
        if (!(modelSelect instanceof HTMLSelectElement)) {
          return;
        }
        const base = getModelList(provider);
        const trimmedCurrent = (preserveSelection ? currentModel : '').trim();
        if (trimmedCurrent.length > 0 && !base.some((option) => option.value === trimmedCurrent)) {
          base.push({ value: trimmedCurrent, label: trimmedCurrent + ' (current)' });
        }
        const defaultModel = defaultModels[provider] || (base[0] ? base[0].value : '');
        const effective = preserveSelection && trimmedCurrent
          ? trimmedCurrent
          : (currentModel || defaultModel || '');

        modelSelect.innerHTML = '';
        base.forEach((option) => {
          const opt = document.createElement('option');
          opt.value = option.value;
          opt.textContent = option.label;
          modelSelect.appendChild(opt);
        });
        const customOpt = document.createElement('option');
        customOpt.value = '__custom';
        customOpt.textContent = 'Custom…';
        modelSelect.appendChild(customOpt);

        const matchesSuggestion = effective && base.some((option) => option.value === effective);
        if (matchesSuggestion) {
          modelSelect.value = effective;
          hideCustom();
          ensureModelValue(effective);
        } else {
          modelSelect.value = '__custom';
          showCustom(effective, false);
        }

        if (!effective && defaultModel) {
          ensureModelValue(defaultModel);
          modelSelect.value = defaultModel;
          hideCustom();
        }
      };

      function selectModel(value, options = {}) {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        const list = getModelList(activeProvider);
        const hasSuggestion = trimmed && list.some((model) => model.value === trimmed);
        if (modelSelect instanceof HTMLSelectElement) {
          if (hasSuggestion) {
            const exists = Array.from(modelSelect.options).some((opt) => opt.value === trimmed);
            if (!exists) {
              rebuildModelOptions(activeProvider, false);
            }
            modelSelect.value = trimmed;
          } else if (trimmed) {
            modelSelect.value = '__custom';
          }
        }
        if (hasSuggestion) {
          hideCustom();
          ensureModelValue(trimmed);
        } else if (trimmed) {
          showCustom(trimmed, options.focus !== false);
        } else {
          const fallback = defaultModels[activeProvider] || '';
          if (fallback) {
            if (modelSelect instanceof HTMLSelectElement) {
              const exists = Array.from(modelSelect.options).some((opt) => opt.value === fallback);
              if (!exists) {
                rebuildModelOptions(activeProvider, false);
              }
              modelSelect.value = fallback;
            }
            hideCustom();
            ensureModelValue(fallback);
          } else {
            hideCustom();
            ensureModelValue('');
          }
        }
      }

      const applyProvider = (radio, preserveModel) => {
        if (!(radio instanceof HTMLInputElement)) return;
        const previousProvider = activeProvider;
        const previousCaps = reasoningCapabilities[previousProvider] || { tokens: false };
        if (previousCaps.tokens && reasoningTokensInput instanceof HTMLInputElement) {
          cachedReasoningTokensByProvider[previousProvider] = reasoningTokensInput.value.trim();
        }
        if (apiInput instanceof HTMLInputElement) {
          cachedApiInputs[previousProvider] = apiInput.value;
        }
        cachedModelByProvider[previousProvider] = currentModel;
        activeProvider = radio.value;
        cachedReasoningTokens = cachedReasoningTokensByProvider[activeProvider] || '';
        setActiveOption(radio);
        let nextModel = preserveModel ? currentModel : '';
        const cachedModel = cachedModelByProvider[activeProvider];
        if (typeof cachedModel === 'string' && cachedModel.trim().length > 0) {
          nextModel = cachedModel;
        } else if (!preserveModel) {
          nextModel = defaultModels[activeProvider] || '';
        }
        currentModel = nextModel || '';
        rebuildModelOptions(activeProvider, true);
        selectModel(currentModel, { focus: false });
        let overrideVariant;
        const providerLabel = radio.dataset.providerLabel || providerLabels[activeProvider] || activeProvider;
        if (apiInput instanceof HTMLInputElement) {
          const cachedValue = cachedApiInputs[activeProvider] ?? '';
          apiInput.value = cachedValue;
          const trimmed = cachedValue.trim();
          if (trimmed.length > 0) {
            providerKeyStatus[activeProvider] = { hasKey: true, verified: false };
            overrideVariant = 'detected';
          } else {
            const original = initialProviderKeyStatus[activeProvider] || providerKeyStatus[activeProvider] || { hasKey: false, verified: false };
            providerKeyStatus[activeProvider] = { ...original };
          }
        }
        updateProviderUI(activeProvider, providerLabel, overrideVariant);
        const overridePlaceholder = radio.dataset.placeholder;
        if (apiInput instanceof HTMLInputElement && overridePlaceholder) {
          apiInput.placeholder = overridePlaceholder;
        }
        syncReasoningAvailability();
      };

      if (apiInput instanceof HTMLInputElement) {
        cachedApiInputs[activeProvider] = apiInput.value;
        apiInput.addEventListener('input', () => {
          const trimmed = apiInput.value.trim();
          cachedApiInputs[activeProvider] = apiInput.value;
          const label = providerLabels[activeProvider] || activeProvider;
          if (trimmed.length > 0) {
            providerKeyStatus[activeProvider] = { hasKey: true, verified: false };
            applyKeyVariant(activeProvider, label, 'detected');
          } else {
            const original = initialProviderKeyStatus[activeProvider] || providerKeyStatus[activeProvider] || { hasKey: false, verified: false };
            providerKeyStatus[activeProvider] = { ...original };
            applyKeyVariant(activeProvider, label);
          }
        });
      }

      if (modelSelect instanceof HTMLSelectElement) {
        modelSelect.addEventListener('change', () => {
          const value = modelSelect.value;
          if (value === '__custom') {
            showCustom(currentModel, true);
          } else {
            selectModel(value, { focus: false });
          }
        });
      }

      if (reasoningModeSelect instanceof HTMLSelectElement) {
        reasoningModeSelect.addEventListener('change', () => {
          applyReasoningMode(reasoningModeSelect.value);
        });
      }

      if (reasoningTokensInput instanceof HTMLInputElement) {
        reasoningTokensInput.addEventListener('input', () => {
          const trimmed = reasoningTokensInput.value.trim();
          if (trimmed) {
            cachedReasoningTokens = trimmed;
            cachedReasoningTokensByProvider[activeProvider] = trimmed;
          } else {
            cachedReasoningTokens = '';
            cachedReasoningTokensByProvider[activeProvider] = '';
          }
        });
      }

      if (customInput instanceof HTMLInputElement) {
        customInput.addEventListener('input', () => {
          const trimmed = customInput.value.trim();
          ensureModelValue(trimmed);
        });
      }

      if (modelValueInput instanceof HTMLInputElement) {
        const initialValue = modelValueInput.value.trim();
        if (initialValue) {
          currentModel = initialValue;
        }
      }
      if (!currentModel) {
        currentModel = defaultModels[activeProvider] || '';
      }
      ensureModelValue(currentModel);
      syncReasoningAvailability();

      if (radios.length > 0) {
        radios.forEach((radio) => {
          radio.addEventListener('change', () => applyProvider(radio, false));
        });
        const initialRadio = radios.find((radio) => radio.checked) || radios[0];
        if (initialRadio) {
          applyProvider(initialRadio, true);
        } else {
          rebuildModelOptions(activeProvider, true);
          let overrideVariant;
          const label = providerLabels[activeProvider] || activeProvider;
          if (apiInput instanceof HTMLInputElement) {
            const cachedValue = cachedApiInputs[activeProvider] ?? apiInput.value;
            apiInput.value = cachedValue;
            const trimmed = cachedValue.trim();
            if (trimmed.length > 0) {
              providerKeyStatus[activeProvider] = { hasKey: true, verified: false };
              overrideVariant = 'detected';
            }
          }
          updateProviderUI(activeProvider, label, overrideVariant);
          syncReasoningAvailability();
        }
      } else {
        rebuildModelOptions(activeProvider, true);
        let overrideVariant;
        const label = providerLabels[activeProvider] || activeProvider;
        if (apiInput instanceof HTMLInputElement) {
          const cachedValue = cachedApiInputs[activeProvider] ?? apiInput.value;
          apiInput.value = cachedValue;
          const trimmed = cachedValue.trim();
          if (trimmed.length > 0) {
            providerKeyStatus[activeProvider] = { hasKey: true, verified: false };
            overrideVariant = 'detected';
          }
        }
        updateProviderUI(activeProvider, label, overrideVariant);
        syncReasoningAvailability();
      }
    })();
  </script>`;
    return script;
}
