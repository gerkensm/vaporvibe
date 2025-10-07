import { escapeHtml } from "../utils/html.js";
import { DEFAULT_OPENAI_MODEL, DEFAULT_GEMINI_MODEL, DEFAULT_ANTHROPIC_MODEL, DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS, DEFAULT_REASONING_TOKENS, } from "../constants.js";
const PROVIDER_CHOICES = [
    {
        value: "openai",
        title: "OpenAI",
        subtitle: "GPT-5 Pro · o3 · GPT-4.1",
        description: "Flagship frontier models with rich reasoning and polished UX—ideal when you want maximum quality and ecosystem reach.",
        placeholder: "sk-...",
    },
    {
        value: "gemini",
        title: "Google Gemini",
        subtitle: "1M context · Flash & Pro",
        description: "Flash is blisteringly fast for iteration; Pro delivers frontier depth with the same expansive context window.",
        placeholder: "AIza...",
    },
    {
        value: "anthropic",
        title: "Anthropic",
        subtitle: "Claude Sonnet · Claude Opus",
        description: "Sonnet balances quality and speed for product and code; Opus is the premium deep-thinker when you need Anthropic's top shelf.",
        placeholder: "sk-ant-...",
    },
];
const PROVIDER_LABELS = Object.fromEntries(PROVIDER_CHOICES.map((choice) => [choice.value, choice.title]));
const PROVIDER_PLACEHOLDERS = Object.fromEntries(PROVIDER_CHOICES.map((choice) => [choice.value, choice.placeholder]));
const DEFAULT_MODEL_BY_PROVIDER = {
    openai: DEFAULT_OPENAI_MODEL,
    gemini: DEFAULT_GEMINI_MODEL,
    anthropic: DEFAULT_ANTHROPIC_MODEL,
};
const DEFAULT_MAX_TOKENS_BY_PROVIDER = {
    openai: DEFAULT_MAX_OUTPUT_TOKENS,
    gemini: DEFAULT_MAX_OUTPUT_TOKENS,
    anthropic: DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS,
};
const REASONING_TOKEN_MIN_BY_PROVIDER = {
    openai: 0,
    gemini: -1,
    anthropic: 0,
};
const REASONING_MODE_CHOICES = [
    { value: "none", label: "None", description: "Disable the provider’s structured reasoning traces." },
    { value: "low", label: "Low", description: "Allow short reasoning bursts for tricky prompts." },
    { value: "medium", label: "Medium", description: "Balance latency and introspection for complex flows." },
    { value: "high", label: "High", description: "Maximize deliberate reasoning when quality is critical." },
];
const PROVIDER_REASONING_CAPABILITIES = {
    openai: { mode: true, tokens: false },
    gemini: { mode: false, tokens: true },
    anthropic: { mode: false, tokens: true },
};
const PROVIDER_MODEL_CHOICES = {
    openai: [
        { value: DEFAULT_MODEL_BY_PROVIDER.openai, label: "GPT-5 (default)" },
        { value: "gpt-5-2025-08-07", label: "GPT-5 · 2025-08-07" },
        { value: "gpt-5-mini", label: "GPT-5 Mini" },
        { value: "gpt-5-mini-2025-08-07", label: "GPT-5 Mini · 2025-08-07" },
        { value: "gpt-5-nano", label: "GPT-5 Nano" },
        { value: "gpt-5-nano-2025-08-07", label: "GPT-5 Nano · 2025-08-07" },
        { value: "gpt-4.5-preview", label: "GPT-4.5 Preview" },
        { value: "gpt-4.5-preview-2025-02-27", label: "GPT-4.5 Preview · 2025-02-27" },
        { value: "gpt-4o", label: "GPT-4o" },
        { value: "chatgpt-4o-latest", label: "ChatGPT-4o Latest" },
        { value: "gpt-4o-mini", label: "GPT-4o Mini" },
        { value: "gpt-4.1", label: "GPT-4.1" },
        { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
        { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
        { value: "gpt-4", label: "GPT-4" },
        { value: "gpt-4-32k", label: "GPT-4 32K" },
        { value: "gpt-4-1106-preview", label: "GPT-4 1106 Preview" },
        { value: "gpt-4-0125-preview", label: "GPT-4 0125 Preview" },
        { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
        { value: "gpt-4-turbo-2024-04-09", label: "GPT-4 Turbo · 2024-04-09" },
        { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
        { value: "gpt-3.5-turbo-16k", label: "GPT-3.5 Turbo 16K" },
        { value: "o1", label: "o1" },
        { value: "o1-2024-12-17", label: "o1 · 2024-12-17" },
        { value: "o1-preview", label: "o1 Preview" },
        { value: "o1-mini", label: "o1 Mini" },
        { value: "o3", label: "o3" },
        { value: "o3-mini", label: "o3 Mini" },
        { value: "o4-mini", label: "o4 Mini" },
    ],
    gemini: [
        { value: DEFAULT_MODEL_BY_PROVIDER.gemini, label: "Gemini 2.5 Flash (default)" },
        { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
        { value: "gemini-2.0-pro-exp", label: "Gemini 2.0 Pro" },
        { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
    anthropic: [
        { value: DEFAULT_MODEL_BY_PROVIDER.anthropic, label: "Claude 4.5 Sonnet (default)" },
        { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
        { value: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet" },
        { value: "claude-opus-4-1-20250805", label: "Claude Opus 4.1" },
        { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
        { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
        { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
    ],
};
export function renderSetupWizardPage(options) {
    const { step, providerLabel, providerName, verifyAction, briefAction, setupPath, adminPath, providerReady, canSelectProvider, selectedProvider, selectedModel, maxOutputTokens, reasoningMode, reasoningTokens, statusMessage, errorMessage, briefValue, } = options;
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
            maxOutputTokens,
            reasoningMode,
            reasoningTokens,
        })
        : renderBriefStep({ briefAction, setupPath, adminPath, briefValue });
    const script = renderProviderScript(canSelectProvider, selectedProvider, selectedModel, reasoningMode, reasoningTokens, maxOutputTokens);
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
    --bg: #f5f7fb;
    --surface: #ffffff;
    --surface-muted: rgba(255, 255, 255, 0.82);
    --border: #e2e8f0;
    --text: #0f172a;
    --muted: #475569;
    --subtle: #64748b;
    --accent: #1d4ed8;
    --accent-dark: #1e3a8a;
    --ring: rgba(29, 78, 216, 0.18);
    --success: #047857;
    --error: #b91c1c;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: clamp(32px, 6vw, 72px);
    background: radial-gradient(130% 100% at 50% 10%, #ffffff 20%, var(--bg) 70%, #e8ecf6 100%);
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
    box-shadow: 0 38px 80px rgba(15, 23, 42, 0.14);
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
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(16px);
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
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(255, 255, 255, 0.78);
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.2s ease;
  }
  .provider-option:hover {
    transform: translateY(-1px);
    border-color: rgba(29, 78, 216, 0.35);
    box-shadow: 0 16px 28px rgba(15, 23, 42, 0.12);
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
    background: rgba(29, 78, 216, 0.08);
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
    const { providerLabel, providerName, verifyAction, providerReady, canSelectProvider, selectedProvider, selectedModel, maxOutputTokens, reasoningMode, reasoningTokens, } = options;
    const capabilities = PROVIDER_REASONING_CAPABILITIES[selectedProvider] ?? { mode: false, tokens: false };
    const providerSupportsReasoningMode = capabilities.mode;
    const providerSupportsReasoningTokens = capabilities.tokens;
    const defaultReasoningTokens = DEFAULT_REASONING_TOKENS[selectedProvider];
    const statusPill = providerReady
        ? `<span class="pill" aria-live="polite">Key verified · ${escapeHtml(providerLabel)}</span>`
        : canSelectProvider
            ? `<span class="pill">Choose your model partner</span>`
            : `<span class="pill">${escapeHtml(providerLabel)} required</span>`;
    const defaultMaxTokens = DEFAULT_MAX_TOKENS_BY_PROVIDER[selectedProvider] ?? DEFAULT_MAX_OUTPUT_TOKENS;
    const effectiveReasoningTokens = reasoningTokens ?? defaultReasoningTokens;
    const reasoningTokenValue = effectiveReasoningTokens !== undefined && effectiveReasoningTokens !== null
        ? String(effectiveReasoningTokens)
        : "";
    const maxTokensValue = maxOutputTokens !== defaultMaxTokens ? String(maxOutputTokens) : "";
    const advancedOpen = (providerSupportsReasoningMode && reasoningMode !== "none")
        || (providerSupportsReasoningTokens && reasoningTokens !== undefined && reasoningTokens !== defaultReasoningTokens)
        || maxOutputTokens !== defaultMaxTokens;
    const reasoningTokensDisabled = !providerSupportsReasoningTokens
        || (providerSupportsReasoningMode && reasoningMode === "none");
    const reasoningInputMin = String(REASONING_TOKEN_MIN_BY_PROVIDER[selectedProvider] ?? 0);
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
    let initialModel = selectedModel && selectedModel.trim().length > 0 ? selectedModel.trim() : "";
    if (!initialModel) {
        initialModel = defaultModel;
    }
    const suggestions = getModelSuggestions(selectedProvider, initialModel);
    const suggestionValues = suggestions.map((option) => option.value);
    const includesInitial = suggestionValues.includes(initialModel);
    const selectValue = includesInitial ? initialModel : "__custom";
    const customValue = includesInitial ? "" : initialModel;
    const modelOptionsId = "model-options";
    const modelOptions = suggestions.map((option) => {
        const selectedAttr = option.value === selectValue ? " selected" : "";
        return `<option value="${escapeHtml(option.value)}"${selectedAttr}>${escapeHtml(option.label)}</option>`;
    }).join("\n");
    return `<section class="card">
    <div>${statusPill}</div>
    <p data-provider-copy>Pick your creative partner and hand us a fresh API key—we will secure it locally and wire ${escapeHtml(providerName)} into the experience.</p>
    <form method="post" action="${escapeHtml(verifyAction)}" autocomplete="off">
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
      <label for="apiKey">
        <span data-provider-label-text>${escapeHtml(providerLabel)} API key</span>
      </label>
      <input id="apiKey" name="apiKey" type="password" inputmode="latin" spellcheck="false" autocapitalize="none" placeholder="${escapeHtml(apiPlaceholder)}" autocomplete="new-password" required />
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
        min="${escapeHtml(reasoningInputMin)}"
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
function getModelSuggestions(provider, selectedModel) {
    const base = [...(PROVIDER_MODEL_CHOICES[provider] ?? [])];
    const trimmed = selectedModel.trim();
    if (trimmed.length > 0 && !base.some((option) => option.value === trimmed)) {
        base.push({ value: trimmed, label: `${trimmed} (current)` });
    }
    return base;
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
function renderProviderScript(_canSelectProvider, selectedProvider, selectedModel, reasoningMode, reasoningTokens, maxOutputTokens) {
    const modelMapJson = JSON.stringify(PROVIDER_MODEL_CHOICES).replace(/</g, "\\u003c");
    const defaultModelJson = JSON.stringify(DEFAULT_MODEL_BY_PROVIDER).replace(/</g, "\\u003c");
    const providerLabelJson = JSON.stringify(PROVIDER_LABELS).replace(/</g, "\\u003c");
    const placeholderJson = JSON.stringify(PROVIDER_PLACEHOLDERS).replace(/</g, "\\u003c");
    const maxTokensJson = JSON.stringify(DEFAULT_MAX_TOKENS_BY_PROVIDER).replace(/</g, "\\u003c");
    const reasoningDescriptionsJson = JSON.stringify(Object.fromEntries(REASONING_MODE_CHOICES.map((choice) => [choice.value, choice.description]))).replace(/</g, "\\u003c");
    const reasoningCapabilitiesJson = JSON.stringify(PROVIDER_REASONING_CAPABILITIES).replace(/</g, "\\u003c");
    const reasoningDefaultsJson = JSON.stringify(DEFAULT_REASONING_TOKENS).replace(/</g, "\\u003c");
    const reasoningMinJson = JSON.stringify(REASONING_TOKEN_MIN_BY_PROVIDER).replace(/</g, "\\u003c");
    const initialProviderJson = JSON.stringify(selectedProvider);
    const initialModelJson = JSON.stringify(selectedModel);
    const initialReasoningModeJson = JSON.stringify(reasoningMode);
    const initialReasoningTokensJson = JSON.stringify(reasoningTokens ?? null);
    const script = `
  <script>
    (() => {
      const modelMap = ${modelMapJson};
      const defaultModels = ${defaultModelJson};
      const providerLabels = ${providerLabelJson};
      const placeholderMap = ${placeholderJson};
      const maxTokenDefaults = ${maxTokensJson};
      const reasoningDescriptions = ${reasoningDescriptionsJson};
      const reasoningCapabilities = ${reasoningCapabilitiesJson};
      const reasoningDefaults = ${reasoningDefaultsJson};
      const reasoningMins = ${reasoningMinJson};
      const cachedReasoningTokensByProvider = {};
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
      const maxTokensInput = document.querySelector('[data-max-tokens]');
      const reasoningModeWrapper = document.querySelector('[data-reasoning-mode-wrapper]');
      const reasoningModeSelect = document.querySelector('[data-reasoning-mode]');
      const reasoningTokensWrapper = document.querySelector('[data-reasoning-tokens-wrapper]');
      const reasoningTokensInput = document.querySelector('[data-reasoning-tokens]');
      const reasoningHelper = document.querySelector('[data-reasoning-helper]');
      const baseCopy = "Pick your creative partner and hand us a fresh API key—we will secure it locally and wire {provider} into the experience.";

      const setActiveOption = (radio) => {
        if (!optionEls.length) return;
        optionEls.forEach((option) => {
          const optionRadio = option.querySelector('input[name="provider"]');
          option.dataset.active = optionRadio === radio ? 'true' : 'false';
        });
      };

      const updateProviderUI = (provider, explicitLabel) => {
        const providerLabel = explicitLabel || providerLabels[provider] || provider;
        const placeholder = placeholderMap[provider];
        if (labelEl) {
          labelEl.textContent = providerLabel + ' API key';
        }
        if (modelLabelEl) {
          modelLabelEl.textContent = 'Model · ' + providerLabel;
        }
        if (copyEl) {
          copyEl.textContent = baseCopy.replace('{provider}', providerLabel);
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
      };

      const ensureModelValue = (value) => {
        currentModel = value;
        if (modelValueInput) {
          modelValueInput.value = value;
        }
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
          if (typeof minValue === 'number') {
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
        const base = modelMap[provider] ? [...modelMap[provider]] : [];
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

      const applyProvider = (radio, preserveModel) => {
        if (!(radio instanceof HTMLInputElement)) return;
        const previousProvider = activeProvider;
        const previousCaps = reasoningCapabilities[previousProvider] || { tokens: false };
        if (previousCaps.tokens && reasoningTokensInput instanceof HTMLInputElement) {
          cachedReasoningTokensByProvider[previousProvider] = reasoningTokensInput.value.trim();
        }
        activeProvider = radio.value;
        cachedReasoningTokens = cachedReasoningTokensByProvider[activeProvider] || '';
        setActiveOption(radio);
        if (!preserveModel) {
          ensureModelValue('');
        }
        rebuildModelOptions(activeProvider, preserveModel);
        updateProviderUI(activeProvider, radio.dataset.providerLabel);
        const overridePlaceholder = radio.dataset.placeholder;
        if (apiInput instanceof HTMLInputElement && overridePlaceholder) {
          apiInput.placeholder = overridePlaceholder;
        }
        syncReasoningAvailability();
      };

      if (modelSelect instanceof HTMLSelectElement) {
        modelSelect.addEventListener('change', () => {
          const value = modelSelect.value;
          if (value === '__custom') {
            showCustom(currentModel, true);
          } else {
            hideCustom();
            ensureModelValue(value);
            currentModel = value;
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
          updateProviderUI(activeProvider);
          syncReasoningAvailability();
        }
      } else {
        rebuildModelOptions(activeProvider, true);
        updateProviderUI(activeProvider);
        syncReasoningAvailability();
      }
    })();
  </script>`;
    return script;
}
