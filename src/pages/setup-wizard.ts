import { escapeHtml } from "../utils/html.js";
import {
  DEFAULT_REASONING_TOKENS,
  DEFAULT_MAX_OUTPUT_TOKENS,
} from "../constants.js";
import type { ModelProvider, ReasoningMode } from "../types.js";
import {
  PROVIDER_CHOICES,
  PROVIDER_LABELS,
  PROVIDER_PLACEHOLDERS,
  DEFAULT_MAX_TOKENS_BY_PROVIDER,
  REASONING_MODE_CHOICES,
  PROVIDER_REASONING_CAPABILITIES,
  REASONING_TOKEN_MIN_BY_PROVIDER,
} from "../constants/providers.js";
import {
  renderModelSelector,
  MODEL_SELECTOR_STYLES,
  MODEL_SELECTOR_RUNTIME,
  renderModelSelectorDataScript,
  MODEL_INSPECTOR_STYLES,
} from "./components/model-selector.js";
import {
  ATTACHMENT_UPLOADER_STYLES,
  ATTACHMENT_UPLOADER_RUNTIME,
  renderAttachmentUploader,
} from "./components/attachment-uploader.js";

type ProviderKeyStatus = { hasKey: boolean; verified: boolean };

export type SetupWizardStep = "provider" | "brief";

interface SetupWizardPageOptions {
  step: SetupWizardStep;
  providerLabel: string;
  providerName: string;
  verifyAction: string;
  briefAction: string;
  setupPath: string;
  adminPath: string;
  providerReady: boolean;
  canSelectProvider: boolean;
  selectedProvider: ModelProvider;
  selectedModel: string;
  providerSelectionRequired: boolean;
  providerKeyStatuses: Record<ModelProvider, ProviderKeyStatus>;
  maxOutputTokens: number;
  reasoningMode: ReasoningMode;
  reasoningTokens?: number;
  statusMessage?: string;
  errorMessage?: string;
  briefValue?: string;
}

export function renderSetupWizardPage(options: SetupWizardPageOptions): string {
  const {
    step,
    providerLabel,
    providerName,
    verifyAction,
    briefAction,
    setupPath,
    adminPath,
    providerReady,
    canSelectProvider,
    selectedProvider,
    selectedModel,
    providerSelectionRequired,
    providerKeyStatuses,
    maxOutputTokens,
    reasoningMode,
    reasoningTokens,
    statusMessage,
    errorMessage,
    briefValue,
  } = options;

  const heading =
    step === "provider" ? "Welcome to serve-llm" : "Shape the experience";
  const description =
    step === "provider"
      ? "Serve-llm hosts a living web canvas that your chosen model reimagines on every request—pick a provider and supply a secure API key to begin."
      : "Offer a crisp brief so the model understands the product it is bringing to life.";
  const stepIndicator = step === "provider" ? "Step 1 of 2" : "Step 2 of 2";

  const banner = buildBanner(statusMessage, errorMessage);
  const body =
    step === "provider"
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
  const script = renderProviderScript(
    canSelectProvider,
    selectedProvider,
    selectedModel,
    reasoningMode,
    reasoningTokens,
    maxOutputTokens,
    providerKeyStatuses
  );
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

function buildBanner(statusMessage?: string, errorMessage?: string): string {
  if (errorMessage) {
    return `<div role="alert" class="banner error">${escapeHtml(
      errorMessage
    )}</div>`;
  }
  if (statusMessage) {
    return `<div role="status" class="banner status">${escapeHtml(
      statusMessage
    )}</div>`;
  }
  return "";
}

interface ProviderStepOptions {
  providerLabel: string;
  providerName: string;
  verifyAction: string;
  providerReady: boolean;
  canSelectProvider: boolean;
  selectedProvider: ModelProvider;
  selectedModel: string;
  providerSelectionRequired: boolean;
  providerKeyStatuses: Record<ModelProvider, ProviderKeyStatus>;
  maxOutputTokens: number;
  reasoningMode: ReasoningMode;
  reasoningTokens?: number;
}

function renderProviderStep(options: ProviderStepOptions): string {
  const {
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
  } = options;
  const capabilities = PROVIDER_REASONING_CAPABILITIES[selectedProvider] ?? {
    mode: false,
    tokens: false,
  };
  const providerSupportsReasoningMode = capabilities.mode;
  const providerSupportsReasoningTokens = capabilities.tokens;
  const defaultReasoningTokens = DEFAULT_REASONING_TOKENS[selectedProvider];
  const defaultMaxTokens =
    DEFAULT_MAX_TOKENS_BY_PROVIDER[selectedProvider] ??
    DEFAULT_MAX_OUTPUT_TOKENS;
  const effectiveReasoningTokens = reasoningTokens ?? defaultReasoningTokens;
  const reasoningTokenValue =
    effectiveReasoningTokens !== undefined && effectiveReasoningTokens !== null
      ? String(effectiveReasoningTokens)
      : "";
  const maxTokensValue =
    maxOutputTokens !== defaultMaxTokens ? String(maxOutputTokens) : "";
  const advancedOpen =
    (providerSupportsReasoningMode && reasoningMode !== "none") ||
    (providerSupportsReasoningTokens &&
      reasoningTokens !== undefined &&
      reasoningTokens !== defaultReasoningTokens) ||
    maxOutputTokens !== defaultMaxTokens;
  const reasoningTokensDisabled =
    !providerSupportsReasoningTokens ||
    (providerSupportsReasoningMode && reasoningMode === "none");
  const reasoningTokenMinValue =
    REASONING_TOKEN_MIN_BY_PROVIDER[selectedProvider];
  const reasoningInputMinAttr =
    typeof reasoningTokenMinValue === "number" && reasoningTokenMinValue >= 0
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
    ? `<span class="pill" aria-live="polite">Key verified · ${escapeHtml(
        providerLabel
      )}</span>`
    : keyOnFile
    ? `<span class="pill" aria-live="polite">Key detected · ${escapeHtml(
        providerLabel
      )}</span>`
    : canSelectProvider
    ? `<span class="pill">Choose your model partner</span>`
    : `<span class="pill">${escapeHtml(providerLabel)} required</span>`;

  const providerSelection = canSelectProvider
    ? `<div class="provider-grid" role="radiogroup" aria-label="Model provider" data-provider-options>
        ${PROVIDER_CHOICES.map((choice, index) => {
          const active = choice.value === selectedProvider;
          const inputId = `provider-${choice.value}`;
          return `<label class="provider-option" data-active="${active}" for="${inputId}">
              <input id="${inputId}" type="radio" name="provider" value="${escapeHtml(
            choice.value
          )}" ${active ? "checked" : ""} ${
            index === 0 ? "required" : ""
          } data-placeholder="${escapeHtml(
            choice.placeholder
          )}" data-provider-label="${escapeHtml(choice.title)}" />
              <div class="provider-meta">
                <strong>${escapeHtml(choice.title)}</strong>
                <span>${escapeHtml(choice.subtitle)}</span>
                <p>${escapeHtml(choice.description)}</p>
              </div>
            </label>`;
        }).join("\n")}
      </div>`
    : `<p class="provider-fixed">Provider locked to ${escapeHtml(
        providerName
      )} via CLI/env flags.</p>
      <input type="hidden" name="provider" value="${escapeHtml(
        selectedProvider
      )}" />`;

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
    <form method="post" action="${escapeHtml(
      verifyAction
    )}" autocomplete="off" data-key-state="${escapeHtml(
    keyStatusVariant
  )}" data-selection-required="${providerSelectionRequired ? "true" : "false"}">
      ${providerSelection}
      ${modelSelectorMarkup}
      <label for="apiKey">
        <span data-provider-label-text>${escapeHtml(
          providerLabel
        )} API key</span>
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
      <p class="key-status" data-key-status data-key-variant="${escapeHtml(
        keyStatusVariant
      )}">${escapeHtml(keyStatusMessage)}</p>
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
            <div class="field-group" data-reasoning-mode-wrapper ${
              providerSupportsReasoningMode ? "" : "hidden"
            }>
              <label for="reasoningMode">
                <span>Reasoning mode</span>
              </label>
              <select id="reasoningMode" name="reasoningMode" data-reasoning-mode>
                ${REASONING_MODE_CHOICES.map((choice) => {
                  const selectedAttr =
                    choice.value === reasoningMode ? " selected" : "";
                  return `<option value="${escapeHtml(
                    choice.value
                  )}"${selectedAttr}>${escapeHtml(choice.label)}</option>`;
                }).join("\n")}
              </select>
              <p class="field-helper" data-reasoning-helper>${escapeHtml(
                REASONING_MODE_CHOICES.find(
                  (choice) => choice.value === reasoningMode
                )?.description ?? ""
              )}</p>
            </div>
            <div class="field-group" data-reasoning-tokens-wrapper ${
              providerSupportsReasoningTokens ? "" : "hidden"
            } ${reasoningTokensDisabled ? 'data-disabled="true"' : ""}>
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

interface BriefStepOptions {
  briefAction: string;
  setupPath: string;
  adminPath: string;
  briefValue?: string;
}

function renderBriefStep(options: BriefStepOptions): string {
  const { briefAction, setupPath, adminPath, briefValue } = options;
  const value = briefValue ?? "";
  return `<section class="card">
    <div class="pill">Craft the brief</div>
    <p>Describe the product vision in plain language—tone, audience, signature moments. We will use it as the north star for every render.</p>
    <form method="post" action="${escapeHtml(briefAction)}" enctype="multipart/form-data">
      <label for="brief">
        <span>What are we building?</span>
      </label>
      <textarea id="brief" name="brief" placeholder="Example: You are a ritual planning companion. Focus on warm light, generous whitespace, and a sense of calm. Surfaces should feel curated and tactile." required>${escapeHtml(
        value
      )}</textarea>
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
        <a class="secondary-link" href="${escapeHtml(
          `${setupPath}?step=provider`
        )}" rel="nofollow">Back</a>
        <button type="submit" class="primary">Open the studio</button>
      </div>
    </form>
    <p>After launch the admin dashboard will let you adjust the brief, swap providers, and review every generated page.</p>
    <p><a href="${escapeHtml(
      adminPath
    )}">Preview the admin tools</a> (opens once setup completes).</p>
  </section>`;
}


function renderProviderScript(
  _canSelectProvider: boolean,
  selectedProvider: ModelProvider,
  selectedModel: string,
  reasoningMode: ReasoningMode,
  reasoningTokens: number | undefined,
  maxOutputTokens: number,
  providerKeyStatuses: Record<ModelProvider, ProviderKeyStatus>,
): string {
  const providerLabelJson = JSON.stringify(PROVIDER_LABELS).replace(/</g, "\u003c");
  const placeholderJson = JSON.stringify(PROVIDER_PLACEHOLDERS).replace(/</g, "\u003c");
  const maxTokensJson = JSON.stringify(DEFAULT_MAX_TOKENS_BY_PROVIDER).replace(
    /</g,
    "\u003c",
  );
  const reasoningDescriptionsJson = JSON.stringify(
    Object.fromEntries(
      REASONING_MODE_CHOICES.map(
        (choice) => [choice.value, choice.description] as const,
      ),
    ),
  ).replace(/</g, "\u003c");
  const reasoningDefaultsJson = JSON.stringify(DEFAULT_REASONING_TOKENS).replace(
    /</g,
    "\u003c",
  );
  const reasoningCapabilitiesJson = JSON.stringify(
    PROVIDER_REASONING_CAPABILITIES,
  ).replace(/</g, "\u003c");
  const reasoningMinJson = JSON.stringify(REASONING_TOKEN_MIN_BY_PROVIDER).replace(
    /</g,
    "\u003c",
  );
  const keyStatusJson = JSON.stringify(providerKeyStatuses).replace(/</g, "\u003c");
  const initialProviderJson = JSON.stringify(selectedProvider);
  const initialModelJson = JSON.stringify(selectedModel);
  const initialReasoningModeJson = JSON.stringify(reasoningMode);
  const initialReasoningTokensJson = JSON.stringify(reasoningTokens ?? null);
  const initialMaxTokensJson = JSON.stringify(maxOutputTokens);
  const dataScript = renderModelSelectorDataScript();
  const runtimeScript = `<script>${MODEL_SELECTOR_RUNTIME}</script>`;
  const pageScript = `
  <script>
    (() => {
      const providerLabels = ${providerLabelJson};
      const placeholderMap = ${placeholderJson};
      const maxTokenDefaults = ${maxTokensJson};
      const reasoningDescriptions = ${reasoningDescriptionsJson};
      const reasoningDefaults = ${reasoningDefaultsJson};
      const reasoningCapabilities = ${reasoningCapabilitiesJson};
      const reasoningMins = ${reasoningMinJson};
      const providerKeyStatus = ${keyStatusJson};
      const initialProvider = ${initialProviderJson};
      const initialModel = ${initialModelJson} || '';
      const initialReasoningMode = ${initialReasoningModeJson} || 'none';
      const initialReasoningTokens = ${initialReasoningTokensJson};
      const initialMaxTokens = ${initialMaxTokensJson};

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
      const maxTokensInput = document.querySelector('[data-max-tokens]');
      const reasoningModeWrapper = document.querySelector('[data-reasoning-mode-wrapper]');
      const reasoningModeSelect = document.querySelector('[data-reasoning-mode]');
      const reasoningTokensWrapper = document.querySelector('[data-reasoning-tokens-wrapper]');
      const reasoningTokensInput = document.querySelector('[data-reasoning-tokens]');
      const reasoningHelper = document.querySelector('[data-reasoning-helper]');
      const modelRoot = document.querySelector('[data-model-selector]');

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
      const cachedReasoningTokensByProvider = Object.create(null);
      const cachedModelByProvider = Object.create(null);

      let activeProvider = initialProvider;
      let currentReasoningMode = initialReasoningMode;
      let reasoningModeSupported = false;
      let reasoningTokensSupported = false;

      cachedModelByProvider[initialProvider] = modelSelector.getState().input;

      modelSelector.onChange((state) => {
        cachedModelByProvider[state.provider] = state.input;
      });

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
        if (formEl instanceof HTMLElement) {
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

      const updateMaxTokensPlaceholder = (provider) => {
        if (!(maxTokensInput instanceof HTMLInputElement)) {
          return;
        }
        const defaultMax = maxTokenDefaults[provider];
        if (typeof defaultMax === 'number' && !Number.isNaN(defaultMax)) {
          maxTokensInput.placeholder = String(defaultMax);
        }
      };

      const applyReasoningMode = (mode) => {
        const normalized = (mode || 'none').toLowerCase();
        currentReasoningMode = normalized;
        if (reasoningModeSelect instanceof HTMLSelectElement) {
          reasoningModeSelect.value = normalized;
        }
        if (reasoningHelper instanceof HTMLElement) {
          reasoningHelper.textContent = reasoningDescriptions[normalized] || '';
        }
        const tokensDisabled = !reasoningTokensSupported || (reasoningModeSupported && normalized === 'none');
        if (reasoningTokensWrapper instanceof HTMLElement) {
          if (tokensDisabled) {
            reasoningTokensWrapper.setAttribute('data-disabled', 'true');
          } else {
            reasoningTokensWrapper.removeAttribute('data-disabled');
          }
        }
        if (reasoningTokensInput instanceof HTMLInputElement) {
          if (tokensDisabled) {
            reasoningTokensInput.value = '';
            reasoningTokensInput.setAttribute('disabled', 'true');
          } else {
            reasoningTokensInput.removeAttribute('disabled');
            const cachedValue = cachedReasoningTokensByProvider[activeProvider];
            if (typeof cachedValue === 'string') {
              reasoningTokensInput.value = cachedValue;
            } else {
              const defaultTokens = reasoningDefaults[activeProvider];
              reasoningTokensInput.value =
                typeof defaultTokens === 'number' ? String(defaultTokens) : '';
            }
          }
        }
      };

      const updateReasoningSupport = (provider) => {
        const capability = reasoningCapabilities[provider] || { mode: false, tokens: false };
        reasoningModeSupported = Boolean(capability.mode);
        reasoningTokensSupported = Boolean(capability.tokens);
        if (reasoningModeWrapper instanceof HTMLElement) {
          reasoningModeWrapper.hidden = !reasoningModeSupported;
        }
        if (reasoningTokensWrapper instanceof HTMLElement) {
          reasoningTokensWrapper.hidden = !reasoningTokensSupported;
        }
        if (reasoningTokensInput instanceof HTMLInputElement) {
          const min = reasoningMins[provider];
          if (typeof min === 'number' && !Number.isNaN(min)) {
            reasoningTokensInput.min = String(min);
          } else {
            reasoningTokensInput.removeAttribute('min');
          }
        }
        if (cachedReasoningTokensByProvider[provider] === undefined) {
          const defaultTokens = reasoningDefaults[provider];
          cachedReasoningTokensByProvider[provider] =
            typeof defaultTokens === 'number' ? String(defaultTokens) : '';
        }
        const nextMode = reasoningModeSupported ? currentReasoningMode : 'none';
        applyReasoningMode(nextMode);
      };

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
        updateMaxTokensPlaceholder(provider);
        const cachedModel = cachedModelByProvider[provider];
        modelSelector.setProvider(provider, {
          providerLabel,
          model: typeof cachedModel === 'string' ? cachedModel : '',
        });
        updateReasoningSupport(provider);
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
        if (reasoningTokensInput instanceof HTMLInputElement && !reasoningTokensInput.disabled) {
          cachedReasoningTokensByProvider[activeProvider] = reasoningTokensInput.value.trim();
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

      if (reasoningModeSelect instanceof HTMLSelectElement) {
        reasoningModeSelect.addEventListener('change', () => {
          applyReasoningMode(reasoningModeSelect.value);
        });
      }

      if (reasoningTokensInput instanceof HTMLInputElement) {
        if (typeof initialReasoningTokens === 'number') {
          const initialTokens = String(initialReasoningTokens);
          reasoningTokensInput.value = initialTokens;
          cachedReasoningTokensByProvider[initialProvider] = initialTokens;
        } else if (reasoningTokensInput.value) {
          cachedReasoningTokensByProvider[initialProvider] = reasoningTokensInput.value.trim();
        }
        reasoningTokensInput.addEventListener('input', () => {
          cachedReasoningTokensByProvider[activeProvider] = reasoningTokensInput.value.trim();
        });
      }

      if (maxTokensInput instanceof HTMLInputElement) {
        const defaultMax = maxTokenDefaults[activeProvider];
        if (
          typeof defaultMax === 'number' &&
          Number(initialMaxTokens) === defaultMax &&
          maxTokensInput.value
        ) {
          maxTokensInput.value = '';
        }
      }

      if (reasoningModeSelect instanceof HTMLSelectElement) {
        applyReasoningMode(reasoningModeSelect.value);
      } else {
        applyReasoningMode(initialReasoningMode);
      }
    })();
  </script>`;

  return `${dataScript}
${runtimeScript}
${pageScript}`;
}
