import { escapeHtml } from "../utils/html.js";
import { DEFAULT_REASONING_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS, } from "../constants.js";
import { PROVIDER_CHOICES, PROVIDER_LABELS, PROVIDER_PLACEHOLDERS, DEFAULT_MAX_TOKENS_BY_PROVIDER, REASONING_MODE_CHOICES, PROVIDER_REASONING_CAPABILITIES, PROVIDER_TOKEN_GUIDANCE, getModelMetadata, } from "../constants/providers.js";
import { renderModelSelector, MODEL_SELECTOR_STYLES, MODEL_SELECTOR_RUNTIME, renderModelSelectorDataScript, MODEL_INSPECTOR_STYLES, } from "./components/model-selector.js";
import { ATTACHMENT_UPLOADER_STYLES, ATTACHMENT_UPLOADER_RUNTIME, renderAttachmentUploader, } from "./components/attachment-uploader.js";
import { renderTokenBudgetControl, TOKEN_BUDGET_STYLES, TOKEN_BUDGET_RUNTIME, } from "./components/token-budget-control.js";
export function renderSetupWizardPage(options) {
    const { step, providerLabel, providerName, verifyAction, briefAction, setupPath, adminPath, providerReady, canSelectProvider, selectedProvider, selectedModel, providerSelectionRequired, providerKeyStatuses, maxOutputTokens, reasoningMode, reasoningTokensEnabled, reasoningTokens, statusMessage, errorMessage, briefValue, } = options;
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
            reasoningTokensEnabled,
            reasoningTokens,
        })
        : renderBriefStep({ briefAction, setupPath, adminPath, briefValue });
    const script = renderProviderScript(canSelectProvider, selectedProvider, selectedModel, reasoningMode, reasoningTokensEnabled, reasoningTokens, maxOutputTokens, providerKeyStatuses);
    const attachmentRuntimeScript = `<script>${ATTACHMENT_UPLOADER_RUNTIME}</script>`;
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
  [hidden] {
    display: none !important;
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
  .token-field {
    display: grid;
    gap: 0;
  }
  .token-field[data-disabled="true"] {
    opacity: 0.7;
  }
  .reasoning-toggle-group {
    display: grid;
    gap: 12px;
  }
  .reasoning-toggle {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(99, 102, 241, 0.28);
    background: linear-gradient(135deg, rgba(238, 242, 255, 0.7), rgba(224, 231, 255, 0.4));
  }
  .reasoning-toggle[data-disabled="true"] {
    opacity: 0.6;
  }
  .reasoning-toggle__control {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    color: var(--text);
  }
  .reasoning-toggle__checkbox {
    appearance: none;
    width: 44px;
    height: 26px;
    border-radius: 999px;
    border: 1px solid rgba(99, 102, 241, 0.5);
    background: rgba(99, 102, 241, 0.18);
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .reasoning-toggle__checkbox::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
    transition: transform 0.2s ease;
  }
  .reasoning-toggle__checkbox:checked {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.88), rgba(79, 70, 229, 0.92));
    border-color: transparent;
  }
  .reasoning-toggle__checkbox:checked::after {
    transform: translateX(18px);
  }
  .reasoning-toggle__checkbox:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .reasoning-toggle__label {
    font-size: 0.9rem;
  }
  .reasoning-toggle__helper {
    flex: 1;
    margin: 0;
    text-align: right;
    font-size: 0.78rem;
    color: var(--subtle);
  }
  .attachment-section {
    display: grid;
    gap: 12px;
    margin-top: 16px;
  }
  .attachment-label {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text);
  }
  .attachment-helper {
    margin: 0;
    color: var(--subtle);
    font-size: 0.85rem;
  }
  ${MODEL_SELECTOR_STYLES}
  ${MODEL_INSPECTOR_STYLES}
  ${ATTACHMENT_UPLOADER_STYLES}
  ${TOKEN_BUDGET_STYLES}
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
  ${attachmentRuntimeScript}
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
    const { providerLabel, providerName, verifyAction, providerReady, canSelectProvider, selectedProvider, selectedModel, providerSelectionRequired, providerKeyStatuses, maxOutputTokens, reasoningMode, reasoningTokensEnabled, reasoningTokens, } = options;
    const capabilities = PROVIDER_REASONING_CAPABILITIES[selectedProvider] ?? {
        mode: false,
        tokens: false,
    };
    const providerSupportsReasoningMode = capabilities.mode;
    const defaultReasoningTokens = DEFAULT_REASONING_TOKENS[selectedProvider];
    const providerGuidance = PROVIDER_TOKEN_GUIDANCE[selectedProvider];
    const modelMetadata = getModelMetadata(selectedProvider, selectedModel);
    const maxOutputRange = (() => {
        const base = providerGuidance?.maxOutputTokens ?? {};
        const override = modelMetadata?.maxOutputTokens ?? {};
        const description = override.description ?? base.description ?? "";
        const defaultValue = override.default ??
            base.default ??
            DEFAULT_MAX_TOKENS_BY_PROVIDER[selectedProvider] ??
            DEFAULT_MAX_OUTPUT_TOKENS;
        return {
            min: override.min ?? base.min,
            max: override.max ?? base.max,
            default: defaultValue,
            description,
        };
    })();
    const maxOutputDefault = typeof maxOutputRange.default === "number"
        ? maxOutputRange.default
        : DEFAULT_MAX_TOKENS_BY_PROVIDER[selectedProvider] ?? DEFAULT_MAX_OUTPUT_TOKENS;
    const hasStoredMaxOutput = typeof maxOutputTokens === "number" && Number.isFinite(maxOutputTokens);
    const sanitizedMaxOutput = hasStoredMaxOutput ? maxOutputTokens : maxOutputDefault;
    const respectStoredMaxOutput = providerReady && hasStoredMaxOutput;
    const explicitMaxOutputValue = respectStoredMaxOutput && sanitizedMaxOutput !== maxOutputDefault
        ? sanitizedMaxOutput
        : null;
    const reasoningGuidance = (() => {
        const base = providerGuidance?.reasoningTokens;
        if (!base) {
            return undefined;
        }
        const override = modelMetadata?.reasoningTokens;
        const overrideRange = override ?? undefined;
        const baseDefault = typeof base.default === "number" ? base.default : defaultReasoningTokens;
        const mergedDefault = typeof overrideRange?.default === "number"
            ? overrideRange.default
            : baseDefault;
        const allowDisable = overrideRange &&
            Object.prototype.hasOwnProperty.call(overrideRange, "allowDisable")
            ? overrideRange.allowDisable
            : base.allowDisable;
        return {
            supported: Boolean(base.supported && override !== null),
            min: overrideRange?.min ?? base.min,
            max: overrideRange?.max ?? base.max,
            default: mergedDefault,
            description: overrideRange?.description ?? base.description ?? "",
            helper: base.helper ?? "",
            allowDisable: allowDisable !== undefined ? allowDisable : true,
        };
    })();
    const modelSupportsReasoningTokens = Boolean(reasoningGuidance?.supported);
    const metadataAllowsReasoningMode = !modelMetadata || modelMetadata.supportsReasoningMode === true;
    const modelSupportsReasoningMode = providerSupportsReasoningMode &&
        !modelSupportsReasoningTokens &&
        metadataAllowsReasoningMode;
    const reasoningToggleAllowed = modelSupportsReasoningTokens && (reasoningGuidance?.allowDisable !== false);
    const reasoningToggleEnabled = modelSupportsReasoningTokens
        ? reasoningToggleAllowed
            ? reasoningTokensEnabled !== false
            : true
        : false;
    const reasoningDefaultValue = reasoningGuidance?.default ?? defaultReasoningTokens ?? undefined;
    const currentReasoningTokens = reasoningToggleEnabled && typeof reasoningTokens === "number"
        ? reasoningTokens
        : null;
    const explicitReasoningValue = reasoningToggleEnabled &&
        currentReasoningTokens !== null &&
        (reasoningDefaultValue === undefined ||
            currentReasoningTokens !== reasoningDefaultValue)
        ? currentReasoningTokens
        : null;
    const reasoningTokensChanged = reasoningToggleEnabled
        ? explicitReasoningValue !== null
        : modelSupportsReasoningTokens && reasoningTokensEnabled === false;
    const advancedOpen = (modelSupportsReasoningMode && reasoningMode !== "none") ||
        reasoningTokensChanged ||
        explicitMaxOutputValue !== null;
    const initialReasoningDisabled = !reasoningToggleEnabled ||
        (modelSupportsReasoningMode && reasoningMode === "none");
    const reasoningSliderHelperParts = [
        "Less reasoning tokens = faster. More tokens unlock complex flows.",
    ];
    if (reasoningGuidance?.helper) {
        reasoningSliderHelperParts.push(reasoningGuidance.helper);
    }
    const reasoningSliderHelper = reasoningSliderHelperParts.join(" ");
    const reasoningSliderDescription = reasoningGuidance?.description?.trim().length
        ? reasoningGuidance.description
        : "Reserve a deliberate thinking budget for this provider.";
    const reasoningSpecialLabels = selectedProvider === "gemini"
        ? { "-1": "Auto-managed", "0": "Disabled" }
        : {};
    const maxTokensControlMarkup = renderTokenBudgetControl({
        id: "maxOutputTokens",
        name: "maxOutputTokens",
        label: "Max output tokens",
        description: maxOutputRange.description?.trim().length
            ? maxOutputRange.description
            : "Let the model know how much it can write in each response.",
        helper: "Higher limits unlock richer layouts; smaller caps return faster.",
        value: explicitMaxOutputValue ?? null,
        defaultValue: typeof maxOutputDefault === "number" ? maxOutputDefault : undefined,
        min: maxOutputRange.min,
        max: maxOutputRange.max,
        units: "tokens",
        allowBlank: true,
        sliderEnabled: true,
        disabled: false,
        accent: "output",
        manualPlaceholder: "Exact token cap or leave blank",
    });
    const reasoningTokensControlMarkup = renderTokenBudgetControl({
        id: "reasoningTokens",
        name: "reasoningTokens",
        label: "Reasoning budget",
        description: reasoningSliderDescription,
        helper: reasoningSliderHelper,
        value: explicitReasoningValue ?? null,
        defaultValue: typeof reasoningDefaultValue === "number"
            ? reasoningDefaultValue
            : undefined,
        min: reasoningGuidance?.min ?? providerGuidance?.reasoningTokens?.min,
        max: reasoningGuidance?.max ?? providerGuidance?.reasoningTokens?.max,
        units: "tokens",
        allowBlank: true,
        sliderEnabled: modelSupportsReasoningTokens,
        disabled: initialReasoningDisabled,
        accent: "reasoning",
        manualPlaceholder: "Leave blank for provider defaults",
        emptyLabel: "Auto (provider default)",
        defaultLabel: "Provider default",
        specialLabels: reasoningSpecialLabels,
    });
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
    const modelOptionsId = "model-options";
    const modelSelectorMarkup = renderModelSelector({
        provider: selectedProvider,
        providerLabel,
        selectedModel,
        selectId: modelOptionsId,
        customInputId: "model-custom-input",
        inputName: "model",
    });
    return `<section class="card">
    <div>${statusPill}</div>
    <p data-provider-copy>${escapeHtml(copyText)}</p>
    <form method="post" action="${escapeHtml(verifyAction)}" autocomplete="off" data-key-state="${escapeHtml(keyStatusVariant)}" data-selection-required="${providerSelectionRequired ? "true" : "false"}" data-initial-reasoning-enabled="${reasoningToggleEnabled ? "true" : "false"}">
      ${providerSelection}
      ${modelSelectorMarkup}
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
            <div class="token-field" data-token-control-wrapper="maxOutputTokens">
              ${maxTokensControlMarkup}
            </div>
            <div class="field-group" data-reasoning-mode-wrapper ${modelSupportsReasoningMode ? "" : "hidden"}>
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
            <div
              class="reasoning-toggle-group"
              data-reasoning-toggle-block
              data-allow-disable="${reasoningToggleAllowed ? "true" : "false"}"
              ${modelSupportsReasoningTokens ? "" : "hidden"}
            >
              <div class="reasoning-toggle" data-reasoning-toggle-wrapper ${reasoningToggleAllowed ? "" : "hidden"}>
                <input
                  type="hidden"
                  name="reasoningTokensEnabled"
                  value="${reasoningToggleEnabled ? "on" : "off"}"
                  data-reasoning-toggle-hidden
                />
                <label class="reasoning-toggle__control">
                  <input
                    type="checkbox"
                    class="reasoning-toggle__checkbox"
                    data-reasoning-toggle-input
                    ${reasoningToggleEnabled ? "checked" : ""}
                  />
                  <span class="reasoning-toggle__label">Enable reasoning</span>
                </label>
                <p class="field-helper reasoning-toggle__helper">
                  Disable to skip deliberate thinking for faster setup.
                </p>
              </div>
              <div
                class="token-field"
                data-reasoning-tokens-wrapper
                data-token-control-wrapper="reasoningTokens"
                ${reasoningToggleEnabled ? "" : "hidden"}
                ${initialReasoningDisabled ? 'data-disabled="true"' : ""}
              >
                ${reasoningTokensControlMarkup}
              </div>
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
    <form method="post" action="${escapeHtml(briefAction)}" enctype="multipart/form-data">
      <label for="brief">
        <span>What are we building?</span>
      </label>
      <textarea id="brief" name="brief" placeholder="Example: You are a ritual planning companion. Focus on warm light, generous whitespace, and a sense of calm. Surfaces should feel curated and tactile." required>${escapeHtml(value)}</textarea>
      <div class="attachment-section">
        <span class="attachment-label">Reference attachments</span>
        <p class="attachment-helper">Drop inspirational images or PDFs so the first render starts grounded in your vision.</p>
        ${renderAttachmentUploader({
        inputName: "briefAttachments",
        label: "Add reference files",
        hint: "Drop files, paste with Ctrl+V, or click browse to upload images and PDFs.",
        browseLabel: "Browse files",
        emptyStatus: "No files selected yet.",
    })}
      </div>
      <div class="actions">
        <a class="secondary-link" href="${escapeHtml(`${setupPath}?step=provider`)}" rel="nofollow">Back</a>
        <button type="submit" class="primary">Open the studio</button>
      </div>
    </form>
    <p>After launch the admin dashboard will let you adjust the brief, swap providers, and review every generated page.</p>
    <p><a href="${escapeHtml(adminPath)}">Preview the admin tools</a> (opens once setup completes).</p>
  </section>`;
}
function renderProviderScript(_canSelectProvider, selectedProvider, selectedModel, reasoningMode, reasoningTokensEnabled, _reasoningTokens, _maxOutputTokens, providerKeyStatuses) {
    const providerLabelJson = JSON.stringify(PROVIDER_LABELS).replace(/</g, "\u003c");
    const placeholderJson = JSON.stringify(PROVIDER_PLACEHOLDERS).replace(/</g, "\u003c");
    const providerDefaultsJson = JSON.stringify(DEFAULT_MAX_TOKENS_BY_PROVIDER).replace(/</g, "\u003c");
    const reasoningDescriptionsJson = JSON.stringify(Object.fromEntries(REASONING_MODE_CHOICES.map((choice) => [choice.value, choice.description]))).replace(/</g, "\u003c");
    const reasoningCapabilitiesJson = JSON.stringify(PROVIDER_REASONING_CAPABILITIES).replace(/</g, "\u003c");
    const tokenGuidanceJson = JSON.stringify(PROVIDER_TOKEN_GUIDANCE).replace(/</g, "\u003c");
    const keyStatusJson = JSON.stringify(providerKeyStatuses).replace(/</g, "\u003c");
    const initialProviderJson = JSON.stringify(selectedProvider);
    const initialModelJson = JSON.stringify(selectedModel);
    const initialReasoningModeJson = JSON.stringify(reasoningMode);
    const dataScript = renderModelSelectorDataScript();
    const runtimeScript = `<script>${MODEL_SELECTOR_RUNTIME}</script>`;
    const tokenBudgetRuntimeScript = `<script>${TOKEN_BUDGET_RUNTIME}</script>`;
    const pageScript = `
  <script>
    (() => {
      const providerLabels = ${providerLabelJson};
      const placeholderMap = ${placeholderJson};
      const reasoningDescriptions = ${reasoningDescriptionsJson};
      const reasoningCapabilities = ${reasoningCapabilitiesJson};
      const providerTokenGuidance = ${tokenGuidanceJson};
      const providerDefaultMaxTokens = ${providerDefaultsJson};
      const providerKeyStatus = ${keyStatusJson};
      const initialProvider = ${initialProviderJson};
      const initialModel = ${initialModelJson} || '';
      const initialReasoningMode = ${initialReasoningModeJson} || 'none';
      const tokenControlApi = window.__SERVE_LLM_TOKEN_CONTROL;
      const modelCatalogData =
        window.__SERVE_LLM_MODEL_SELECTOR_DATA?.catalog || {};

      const formEl = document.querySelector('form[data-key-state]');
      if (!(formEl instanceof HTMLFormElement)) {
        return;
      }

      const providerOptions = formEl.querySelector('[data-provider-options]');
      const providerRadios = providerOptions
        ? Array.from(providerOptions.querySelectorAll('input[name="provider"]'))
        : [];
      const providerOptionEls = providerOptions
        ? Array.from(providerOptions.querySelectorAll('.provider-option'))
        : [];
      const copyEl = document.querySelector('[data-provider-copy]');
      const keyStatusEl = document.querySelector('[data-key-status]');
      const labelEl = document.querySelector('[data-provider-label-text]');
      const apiInput = document.querySelector('[data-key-input]');
      const reasoningModeWrapper = document.querySelector('[data-reasoning-mode-wrapper]');
      const reasoningModeSelect = document.querySelector('[data-reasoning-mode]');
      const reasoningTokensWrapper = document.querySelector('[data-reasoning-tokens-wrapper]');
      const reasoningHelper = document.querySelector('[data-reasoning-helper]');
      const modelRoot = document.querySelector('[data-model-selector]');
      const advancedDetails = formEl.querySelector('[data-advanced]');
      const maxTokensControlRoot = formEl.querySelector(
        '[data-token-control="maxOutputTokens"]'
      );
      const reasoningTokensControlRoot = formEl.querySelector(
        '[data-token-control="reasoningTokens"]'
      );
      const reasoningToggleBlock = formEl.querySelector(
        '[data-reasoning-toggle-block]'
      );
      const reasoningToggleWrapper = formEl.querySelector(
        '[data-reasoning-toggle-wrapper]'
      );
      const reasoningToggleInput = formEl.querySelector(
        '[data-reasoning-toggle-input]'
      );
      const reasoningToggleHidden = formEl.querySelector(
        '[data-reasoning-toggle-hidden]'
      );

      const maxTokensControl =
        tokenControlApi && typeof tokenControlApi.init === 'function'
          ? tokenControlApi.init(maxTokensControlRoot)
          : null;
      const reasoningTokensControl =
        tokenControlApi && typeof tokenControlApi.init === 'function'
          ? tokenControlApi.init(reasoningTokensControlRoot)
          : null;

      const modelSelector = window.__SERVE_LLM_MODEL_SELECTOR?.init(modelRoot, {
        provider: initialProvider,
        providerLabel: providerLabels[initialProvider] || initialProvider,
        model: initialModel,
      });

      if (!modelSelector) {
        console.warn('Model selector failed to initialize.');
        return;
      }

      const copyTemplates = {
        verified:
          'Pick your creative partner. We already have a verified {provider} key on file—leave the field blank to keep it, or paste a new one to replace it.',
        detected:
          'Pick your creative partner. We detected a {provider} key from your environment—continue to verify it or paste a different key.',
        missing:
          'Pick your creative partner and hand us a fresh API key—we will secure it in your OS keychain and wire {provider} into the experience.',
      };
      const keyStatusTemplates = {
        verified:
          '{provider} key verified and stored in your OS keychain. Leave the field blank to keep using it, or paste a replacement.',
        detected:
          '{provider} key detected from environment variables (not stored). Continue to verify it or paste a different key to store in your OS keychain.',
        missing:
          'Paste your API key. Keys entered here are securely stored in your OS keychain (macOS Keychain, Windows Credential Manager, or Linux Secret Service). Keys from environment variables or CLI options are never stored.',
      };

      const cachedApiInputs = Object.create(null);
      const cachedModelByProvider = Object.create(null);

      const buildMaxTokenCacheKey = (provider, modelValue) => {
        const normalizedProvider = (provider || '').trim() || '__default__';
        const normalizedModel = (modelValue || '').trim() || '__default__';
        return normalizedProvider + '::' + normalizedModel;
      };

      const clampNumber = (value, min, max) => {
        let next = value;
        if (typeof min === 'number' && Number.isFinite(min)) {
          next = Math.max(next, min);
        }
        if (typeof max === 'number' && Number.isFinite(max)) {
          next = Math.min(next, max);
        }
        return next;
      };

      const cachedMaxTokensBySelection = Object.create(null);
      const cachedReasoningTokensByProvider = Object.create(null);
      const defaultMaxTokensAppliedBySelection = Object.create(null);

      let activeProvider = initialProvider;
      let currentReasoningMode = initialReasoningMode;
      let providerSupportsMode = false;
      let providerSupportsTokens = false;
      let reasoningModeSupported = false;
      let reasoningTokensSupported = false;
      let reasoningToggleAllowed = true;
      const reasoningEnabledByProvider = Object.create(null);

      const ensureProviderCaches = (provider) => {
        if (cachedReasoningTokensByProvider[provider] === undefined) {
          cachedReasoningTokensByProvider[provider] = '';
        }
        if (reasoningEnabledByProvider[provider] === undefined) {
          reasoningEnabledByProvider[provider] = true;
        }
      };

      const ensureMaxTokenCache = (cacheKey) => {
        if (cachedMaxTokensBySelection[cacheKey] === undefined) {
          cachedMaxTokensBySelection[cacheKey] = '';
        }
        if (defaultMaxTokensAppliedBySelection[cacheKey] === undefined) {
          defaultMaxTokensAppliedBySelection[cacheKey] = false;
        }
      };

      const initialReasoningEnabled =
        formEl.dataset.initialReasoningEnabled !== 'false';
      reasoningEnabledByProvider[activeProvider] = initialReasoningEnabled;
      let reasoningTokensEnabledState = initialReasoningEnabled;

      if (apiInput instanceof HTMLInputElement && apiInput.value) {
        cachedApiInputs[activeProvider] = apiInput.value;
      }

      const initialModelState = modelSelector.getState();
      cachedModelByProvider[initialModelState.provider] = initialModelState.input;

      if (maxTokensControl) {
        const maxState = maxTokensControl.getState();
        const initialCacheKey = buildMaxTokenCacheKey(
          initialModelState.provider,
          initialModelState.value || initialModelState.input,
        );
        cachedMaxTokensBySelection[initialCacheKey] = maxState.raw || '';
        if (defaultMaxTokensAppliedBySelection[initialCacheKey] === undefined) {
          defaultMaxTokensAppliedBySelection[initialCacheKey] = false;
        }
      }

      if (reasoningTokensControl) {
        const reasoningState = reasoningTokensControl.getState();
        cachedReasoningTokensByProvider[activeProvider] = reasoningState.raw || '';
      }

      let activeMaxRange = null;
      let activeReasoningRange = null;
      let isApplyingConstraint = false;

      const setActiveOption = (radio) => {
        if (!providerOptionEls.length) return;
        providerOptionEls.forEach((option) => {
          const optionRadio = option.querySelector('input[name="provider"]');
          option.dataset.active = optionRadio === radio ? 'true' : 'false';
        });
      };

      const getKeyVariant = (provider) => {
        const status = providerKeyStatus[provider] || { hasKey: false, verified: false };
        if (status.verified) return 'verified';
        if (status.hasKey) return 'detected';
        return 'missing';
      };

      const applyKeyVariant = (provider, providerLabel, overrideVariant) => {
        const variant = overrideVariant || getKeyVariant(provider);
        const copyTemplate = copyTemplates[variant] || copyTemplates.missing;
        const statusTemplate = keyStatusTemplates[variant] || keyStatusTemplates.missing;
        if (copyEl instanceof HTMLElement) {
          copyEl.textContent = copyTemplate.replace('{provider}', providerLabel);
        }
        if (keyStatusEl instanceof HTMLElement) {
          keyStatusEl.textContent = statusTemplate.replace('{provider}', providerLabel);
          keyStatusEl.dataset.keyVariant = variant;
        }
        formEl.dataset.keyState = variant;
        if (apiInput instanceof HTMLInputElement) {
          if (variant === 'missing') {
            apiInput.setAttribute('required', 'true');
          } else {
            apiInput.removeAttribute('required');
          }
        }
        return variant;
      };

      const updateReasoningHelper = (mode) => {
        if (reasoningHelper instanceof HTMLElement) {
          reasoningHelper.textContent = reasoningDescriptions[mode] || '';
        }
      };

      const getProviderGuidance = (provider) =>
        providerTokenGuidance?.[provider] || {};

      const getModelList = (provider) => {
        const list = modelCatalogData?.[provider];
        return Array.isArray(list) ? list : [];
      };

      const findModelMetadata = (provider, value) => {
        if (!value) {
          return null;
        }
        const normalized = value.trim();
        if (!normalized) {
          return null;
        }
        return (
          getModelList(provider).find((item) => item.value === normalized) || null
        );
      };

      const isCustomModel = (provider, value) => {
        if (!value) {
          return false;
        }
        return !findModelMetadata(provider, value);
      };

      const reasoningSpecialLabelsByProvider = {
        gemini: { '-1': 'Auto-managed', '0': 'Disabled' },
      };

      const getReasoningSpecialLabels = (provider) =>
        reasoningSpecialLabelsByProvider[provider] || {};

      const getCurrentModelState = () => {
        if (modelSelector) {
          return modelSelector.getState();
        }
        return {
          provider: activeProvider,
          value: '',
          input: '',
          providerLabel: providerLabels[activeProvider] || activeProvider,
        };
      };

      const getActiveMaxTokenCacheKey = () => {
        const modelState = getCurrentModelState();
        const modelValue = modelState?.value || modelState?.input || '';
        return buildMaxTokenCacheKey(activeProvider, modelValue);
      };

      const enforceTokenConstraint = () => {
        if (!maxTokensControl || isApplyingConstraint) {
          return;
        }
        isApplyingConstraint = true;
        try {
          const providerMin =
            typeof activeMaxRange?.min === 'number'
              ? activeMaxRange.min
              : undefined;
          let requiredOutput =
            typeof providerMin === 'number' ? providerMin : undefined;
          let statusMessage = '';
          const reasoningModeActive =
            reasoningModeSupported && !reasoningTokensSupported;
          if (
            reasoningTokensControl &&
            activeReasoningRange &&
            activeReasoningRange.supported &&
            reasoningTokensEnabledState &&
            !(reasoningModeActive && currentReasoningMode === 'none')
          ) {
            const reasoningState = reasoningTokensControl.getState();
            let effectiveReasoning = null;
            if (reasoningState.isBlank) {
              if (typeof activeReasoningRange.default === 'number') {
                effectiveReasoning = activeReasoningRange.default;
              }
            } else if (typeof reasoningState.numeric === 'number') {
              effectiveReasoning = reasoningState.numeric;
            }
            if (
              typeof effectiveReasoning === 'number' &&
              Number.isFinite(effectiveReasoning) &&
              effectiveReasoning >= 0
            ) {
              const baseConstraint =
                effectiveReasoning === -1
                  ? typeof activeReasoningRange.min === 'number'
                    ? activeReasoningRange.min ?? 0
                    : 0
                  : effectiveReasoning;
              const candidate = baseConstraint + 1;
              requiredOutput =
                typeof requiredOutput === 'number'
                  ? Math.max(requiredOutput, candidate)
                  : candidate;
              if (
                typeof requiredOutput === 'number' &&
                (typeof providerMin !== 'number' || requiredOutput > providerMin)
              ) {
                statusMessage = 'Raised to stay aligned with the reasoning budget.';
              }
            }
          }

          const minFloor =
            typeof providerMin === 'number'
              ? providerMin
              : typeof activeMaxRange?.min === 'number'
              ? activeMaxRange.min
              : undefined;

          if (typeof minFloor === 'number') {
            if (activeMaxRange) {
              activeMaxRange.min = minFloor;
              if (
                typeof activeMaxRange.default === 'number' &&
                activeMaxRange.default < minFloor
              ) {
                activeMaxRange.default = minFloor;
              }
            }
            const defaultFloor =
              typeof activeMaxRange?.default === 'number'
                ? Math.max(activeMaxRange.default, minFloor)
                : minFloor;
            maxTokensControl.configure({
              min: minFloor,
              autoStep: true,
              defaultValue: defaultFloor,
            });
          }

          const constraintActive =
            typeof requiredOutput === 'number' &&
            Number.isFinite(requiredOutput) &&
            statusMessage !== '';
          if (constraintActive) {
            const maxState = maxTokensControl.getState();
            const needsAdjustment =
              !maxState ||
              typeof maxState.numeric !== 'number' ||
              maxState.numeric < requiredOutput;
            if (needsAdjustment) {
              const adjusted = Math.max(requiredOutput, Math.ceil(requiredOutput));
              const adjustedValue = String(adjusted);
              maxTokensControl.setValue(adjustedValue);
              const cacheKey = getActiveMaxTokenCacheKey();
              ensureMaxTokenCache(cacheKey);
              cachedMaxTokensBySelection[cacheKey] = adjustedValue;
            }
          }

          if (statusMessage) {
            maxTokensControl.configure({ status: statusMessage });
          } else {
            maxTokensControl.configure({ status: '' });
          }
        } finally {
          isApplyingConstraint = false;
        }
      };

      const updateTokenControls = () => {
        ensureProviderCaches(activeProvider);
        const modelState = getCurrentModelState();
        const modelValue = modelState?.value || modelState?.input || '';
        const maxTokenCacheKey = buildMaxTokenCacheKey(
          activeProvider,
          modelValue,
        );
        ensureMaxTokenCache(maxTokenCacheKey);
        const metadata = findModelMetadata(activeProvider, modelValue || '');
        const customModel = isCustomModel(activeProvider, modelValue || '');
        const guidance = getProviderGuidance(activeProvider);
        const maxGuidance = guidance.maxOutputTokens || {};
        const reasoningGuidance = guidance.reasoningTokens;

        const providerDefaultMax = (() => {
          const mapped = providerDefaultMaxTokens?.[activeProvider];
          return typeof mapped === 'number' && Number.isFinite(mapped)
            ? mapped
            : null;
        })();

        const mergedMaxRange = {
          min:
            typeof metadata?.maxOutputTokens?.min === 'number'
              ? metadata.maxOutputTokens.min
              : maxGuidance.min,
          max:
            typeof metadata?.maxOutputTokens?.max === 'number'
              ? metadata.maxOutputTokens.max
              : maxGuidance.max,
          default:
            typeof metadata?.maxOutputTokens?.default === 'number'
              ? metadata.maxOutputTokens.default
              : maxGuidance.default,
          description:
            (metadata?.maxOutputTokens?.description || maxGuidance.description || '').trim(),
        };
        const minBound =
          typeof mergedMaxRange.min === 'number' && Number.isFinite(mergedMaxRange.min)
            ? mergedMaxRange.min
            : null;
        const normalizedDefault =
          typeof mergedMaxRange.default === 'number' &&
          Number.isFinite(mergedMaxRange.default)
            ? mergedMaxRange.default
            : providerDefaultMax;
        const finalDefault =
          normalizedDefault !== null
            ? minBound !== null
              ? Math.max(normalizedDefault, minBound)
              : normalizedDefault
            : minBound ?? providerDefaultMax;
        if (typeof finalDefault === 'number' && Number.isFinite(finalDefault)) {
          mergedMaxRange.default = finalDefault;
        } else {
          mergedMaxRange.default = undefined;
        }
        activeMaxRange = mergedMaxRange;

        if (maxTokensControl) {
          const cachedValue = cachedMaxTokensBySelection[maxTokenCacheKey];
          const maxConfig = {
            min: mergedMaxRange.min,
            max: mergedMaxRange.max,
            defaultValue: mergedMaxRange.default,
            description:
              mergedMaxRange.description || 'Give the model a ceiling for each response.',
            helper: 'Higher limits unlock richer layouts; smaller caps return faster.',
            autoStep: true,
          };
          if (
            typeof cachedValue === 'string' &&
            cachedValue.trim().length > 0
          ) {
            const numeric = Number(cachedValue);
            if (Number.isFinite(numeric)) {
              const clamped = clampNumber(
                numeric,
                mergedMaxRange.min,
                mergedMaxRange.max,
              );
              const clampedValue = String(Math.floor(clamped));
              maxConfig.value = clampedValue;
              if (clampedValue !== cachedValue) {
                cachedMaxTokensBySelection[maxTokenCacheKey] = clampedValue;
              }
            } else {
              maxConfig.value = cachedValue;
            }
          }
          maxTokensControl.configure(maxConfig);
          const shouldApplyDefault =
            (!cachedValue || cachedValue.trim().length === 0) &&
            typeof mergedMaxRange.default === 'number' &&
            Number.isFinite(mergedMaxRange.default) &&
            !defaultMaxTokensAppliedBySelection[maxTokenCacheKey];
          if (shouldApplyDefault) {
            const currentState = maxTokensControl.getState();
            if (!currentState || currentState.isBlank || currentState.numeric === null) {
              const defaultNumeric = Math.floor(mergedMaxRange.default);
              const defaultValueString = String(defaultNumeric);
              maxTokensControl.setValue(defaultValueString);
              cachedMaxTokensBySelection[maxTokenCacheKey] = defaultValueString;
            }
            defaultMaxTokensAppliedBySelection[maxTokenCacheKey] = true;
          }
        }

        let mergedReasoningRange = null;
        let allowDisable = true;
        if (reasoningGuidance) {
          const override = metadata?.reasoningTokens;
          const providerSupports = Boolean(reasoningGuidance.supported);
          const hasOverride =
            metadata &&
            Object.prototype.hasOwnProperty.call(metadata, 'reasoningTokens');
          const supported =
            providerSupports &&
            (customModel || !metadata || !hasOverride || override !== null);
          const overrideAllows =
            override &&
            Object.prototype.hasOwnProperty.call(override, 'allowDisable')
              ? override.allowDisable
              : undefined;
          const guidanceAllows = reasoningGuidance.allowDisable;
          const normalizedAllow =
            overrideAllows !== undefined ? overrideAllows : guidanceAllows;
          allowDisable =
            normalizedAllow === undefined ? true : normalizedAllow !== false;
          mergedReasoningRange = {
            supported,
            min:
              typeof override?.min === 'number'
                ? override.min
                : reasoningGuidance.min,
            max:
              typeof override?.max === 'number'
                ? override.max
                : reasoningGuidance.max,
            default:
              typeof override?.default === 'number'
                ? override.default
                : reasoningGuidance.default,
            description:
              (override?.description || reasoningGuidance.description || '').trim(),
            helper: reasoningGuidance.helper || '',
            allowDisable: normalizedAllow,
          };
        }
        activeReasoningRange = mergedReasoningRange;
        const tokensSupported =
          providerSupportsTokens && Boolean(mergedReasoningRange?.supported);
        reasoningTokensSupported = tokensSupported;
        const metadataAllowsMode =
          providerSupportsMode &&
          (customModel || !metadata || metadata.supportsReasoningMode === true);
        const showReasoningMode = metadataAllowsMode && !tokensSupported;
        reasoningModeSupported = showReasoningMode;
        if (reasoningModeWrapper instanceof HTMLElement) {
          reasoningModeWrapper.hidden = !showReasoningMode;
        }
        if (reasoningModeSelect instanceof HTMLSelectElement) {
          reasoningModeSelect.disabled = !showReasoningMode;
          if (!showReasoningMode) {
            currentReasoningMode = 'none';
          }
          reasoningModeSelect.value = currentReasoningMode;
        } else if (!showReasoningMode) {
          currentReasoningMode = 'none';
        }
        updateReasoningHelper(currentReasoningMode);
        if (tokensSupported) {
          if (reasoningEnabledByProvider[activeProvider] === undefined) {
            reasoningEnabledByProvider[activeProvider] = true;
          }
          const storedToggle = reasoningEnabledByProvider[activeProvider];
          reasoningTokensEnabledState = allowDisable
            ? storedToggle !== false
            : true;
        } else {
          reasoningTokensEnabledState = false;
        }

        const helperPieces = [
          'Less reasoning tokens = faster. More tokens unlock complex flows.',
        ];
        if (mergedReasoningRange?.helper) {
          helperPieces.push(mergedReasoningRange.helper);
        }
        const sliderHelper = helperPieces.join(' ');
        const sliderDescription =
          mergedReasoningRange?.description ||
          'Reserve a deliberate thinking budget for models that support it.';

        const modeDisablesTokens =
          showReasoningMode && currentReasoningMode === 'none';
        reasoningToggleAllowed =
          tokensSupported && allowDisable && !modeDisablesTokens;
        const showReasoningBudget =
          tokensSupported &&
          reasoningTokensEnabledState &&
          !modeDisablesTokens;
        const tokensDisabled = !showReasoningBudget;

        if (reasoningToggleBlock instanceof HTMLElement) {
          reasoningToggleBlock.hidden = !tokensSupported;
          reasoningToggleBlock.setAttribute(
            'data-allow-disable',
            tokensSupported && allowDisable ? 'true' : 'false',
          );
        }
        if (reasoningToggleWrapper instanceof HTMLElement) {
          reasoningToggleWrapper.hidden = !reasoningToggleAllowed;
          if (!reasoningToggleAllowed && tokensSupported && modeDisablesTokens) {
            reasoningToggleWrapper.setAttribute('data-disabled', 'true');
          } else {
            reasoningToggleWrapper.removeAttribute('data-disabled');
          }
        }
        if (reasoningToggleInput instanceof HTMLInputElement) {
          reasoningToggleInput.checked = reasoningTokensEnabledState;
          reasoningToggleInput.disabled =
            !tokensSupported || !allowDisable || modeDisablesTokens;
        }
        if (reasoningToggleHidden instanceof HTMLInputElement) {
          reasoningToggleHidden.value = reasoningTokensEnabledState ? 'on' : 'off';
        }

        if (reasoningTokensWrapper instanceof HTMLElement) {
          reasoningTokensWrapper.hidden = !showReasoningBudget;
          if (!showReasoningBudget) {
            reasoningTokensWrapper.setAttribute('data-disabled', 'true');
          } else {
            reasoningTokensWrapper.removeAttribute('data-disabled');
          }
        }

        if (reasoningTokensControl) {
          const cachedReason = cachedReasoningTokensByProvider[activeProvider];
          const reasoningConfig = {
            helper: sliderHelper,
            description: sliderDescription,
            sliderEnabled: showReasoningBudget,
            disabled: tokensDisabled,
            min: mergedReasoningRange?.min,
            max: mergedReasoningRange?.max,
            defaultValue:
              typeof mergedReasoningRange?.default === 'number'
                ? mergedReasoningRange.default
                : undefined,
            specialLabels: getReasoningSpecialLabels(activeProvider),
            emptyLabel: 'Auto (provider default)',
            defaultLabel: 'Provider default',
            autoStep: true,
          };
          if (cachedReason !== undefined) {
            reasoningConfig.value = cachedReason;
          }
          reasoningTokensControl.configure(reasoningConfig);
        }

        enforceTokenConstraint();
      };

      if (maxTokensControl) {
        maxTokensControl.onChange((state) => {
          if (!state || state.source === 'configure' || isApplyingConstraint) {
            return;
          }
          const cacheKey = getActiveMaxTokenCacheKey();
          ensureMaxTokenCache(cacheKey);
          cachedMaxTokensBySelection[cacheKey] = state.raw || '';
          enforceTokenConstraint();
        });
      }

      if (reasoningTokensControl) {
        reasoningTokensControl.onChange((state) => {
          if (!state || state.source === 'configure' || isApplyingConstraint) {
            return;
          }
          cachedReasoningTokensByProvider[activeProvider] = state.raw || '';
          enforceTokenConstraint();
        });
      }

      const updateReasoningSupport = (provider) => {
        const capability = reasoningCapabilities[provider] || { mode: false, tokens: false };
        providerSupportsMode = Boolean(capability.mode);
        providerSupportsTokens = Boolean(capability.tokens);
        reasoningModeSupported = false;
        reasoningTokensSupported = false;
        reasoningToggleAllowed = providerSupportsTokens;
        if (!providerSupportsMode) {
          currentReasoningMode = 'none';
        }
        if (reasoningModeWrapper instanceof HTMLElement) {
          reasoningModeWrapper.hidden = true;
        }
        if (reasoningModeSelect instanceof HTMLSelectElement) {
          reasoningModeSelect.disabled = true;
          reasoningModeSelect.value = currentReasoningMode;
        }
        if (reasoningToggleBlock instanceof HTMLElement) {
          reasoningToggleBlock.hidden = !providerSupportsTokens;
          reasoningToggleBlock.setAttribute(
            'data-allow-disable',
            providerSupportsTokens ? 'true' : 'false',
          );
        }
        if (reasoningToggleWrapper instanceof HTMLElement) {
          reasoningToggleWrapper.hidden = true;
          reasoningToggleWrapper.removeAttribute('data-disabled');
        }
        if (reasoningToggleInput instanceof HTMLInputElement) {
          reasoningToggleInput.checked = true;
          reasoningToggleInput.disabled = !providerSupportsTokens;
        }
        if (reasoningToggleHidden instanceof HTMLInputElement) {
          reasoningToggleHidden.value = 'on';
        }
        updateReasoningHelper(currentReasoningMode);
      };

      const applyReasoningMode = (mode) => {
        const normalized = (mode || 'none').toLowerCase();
        currentReasoningMode = normalized;
        if (reasoningModeSelect instanceof HTMLSelectElement) {
          reasoningModeSelect.value = normalized;
        }
        updateReasoningHelper(normalized);
        updateTokenControls();
      };

      const applyReasoningToggle = (enabled) => {
        const effective = reasoningToggleAllowed ? enabled : true;
        if (reasoningToggleAllowed) {
          reasoningEnabledByProvider[activeProvider] = effective;
        }
        reasoningTokensEnabledState = effective;
        if (reasoningToggleHidden instanceof HTMLInputElement) {
          reasoningToggleHidden.value = effective ? 'on' : 'off';
        }
        updateTokenControls();
      };

      modelSelector.onChange((state) => {
        cachedModelByProvider[state.provider] = state.input;
        if (state.provider === activeProvider) {
          updateTokenControls();
        }
      });

      const applyProvider = (provider, explicitLabel, overrideVariant) => {
        const providerLabel = explicitLabel || providerLabels[provider] || provider;
        if (labelEl instanceof HTMLElement) {
          labelEl.textContent = providerLabel + ' API key';
        }
        const variant = applyKeyVariant(provider, providerLabel, overrideVariant);
        if (apiInput instanceof HTMLInputElement) {
          const placeholder = placeholderMap[provider];
          if (placeholder) {
            apiInput.placeholder = placeholder;
          }
          const cachedValue = cachedApiInputs[provider];
          apiInput.value = typeof cachedValue === 'string' ? cachedValue : '';
          if (variant === 'missing' && !apiInput.value) {
            apiInput.focus({ preventScroll: true });
          }
        }
        ensureProviderCaches(provider);
        const cachedModel = cachedModelByProvider[provider];
        modelSelector.setProvider(provider, {
          providerLabel,
          model: typeof cachedModel === 'string' ? cachedModel : '',
        });
        const providerState = modelSelector.getState();
        const providerModelValue =
          providerState.provider === provider
            ? providerState.value || providerState.input
            : cachedModel || '';
        const providerCacheKey = buildMaxTokenCacheKey(
          provider,
          providerModelValue,
        );
        ensureMaxTokenCache(providerCacheKey);
        updateReasoningSupport(provider);
        const storedToggle = reasoningEnabledByProvider[provider];
        reasoningTokensEnabledState = storedToggle !== false;
        const nextMode = reasoningModeSupported ? currentReasoningMode : 'none';
        applyReasoningMode(nextMode);
        if (
          advancedDetails instanceof HTMLDetailsElement &&
          !advancedDetails.open &&
          (reasoningModeSupported || reasoningTokensSupported)
        ) {
          advancedDetails.open = true;
        }
      };

      const handleProviderChange = (radio) => {
        if (!(radio instanceof HTMLInputElement) || !radio.checked) {
          return;
        }
        const nextProvider = radio.value;
        if (nextProvider === activeProvider) {
          return;
        }
        if (apiInput instanceof HTMLInputElement) {
          cachedApiInputs[activeProvider] = apiInput.value;
        }
        if (maxTokensControl) {
          const maxState = maxTokensControl.getState();
          const cacheKey = getActiveMaxTokenCacheKey();
          ensureMaxTokenCache(cacheKey);
          cachedMaxTokensBySelection[cacheKey] = maxState.raw || '';
        }
        if (reasoningTokensControl) {
          const reasoningState = reasoningTokensControl.getState();
          cachedReasoningTokensByProvider[activeProvider] = reasoningState.raw || '';
        }
        const providerLabel =
          radio.getAttribute('data-provider-label') || providerLabels[nextProvider] || nextProvider;
        activeProvider = nextProvider;
        setActiveOption(radio);
        applyProvider(nextProvider, providerLabel);
      };

      providerRadios.forEach((radio) => {
        radio.addEventListener('change', () => handleProviderChange(radio));
      });

      const initialRadio = providerRadios.find((radio) => radio.value === activeProvider);
      if (initialRadio) {
        setActiveOption(initialRadio);
      }

      applyProvider(
        activeProvider,
        providerLabels[activeProvider] || activeProvider,
        getKeyVariant(activeProvider),
      );

      if (apiInput instanceof HTMLInputElement) {
        apiInput.addEventListener('input', () => {
          cachedApiInputs[activeProvider] = apiInput.value;
        });
      }

      if (reasoningModeSelect instanceof HTMLSelectElement) {
        reasoningModeSelect.addEventListener('change', () => {
          applyReasoningMode(reasoningModeSelect.value);
        });
      }

      if (reasoningToggleInput instanceof HTMLInputElement) {
        reasoningToggleInput.addEventListener('change', () => {
          applyReasoningToggle(Boolean(reasoningToggleInput.checked));
        });
      }

      updateTokenControls();
    })();
  </script>`;
    return `${dataScript}` + `${runtimeScript}` + `${tokenBudgetRuntimeScript}` + `${pageScript}`;
}
