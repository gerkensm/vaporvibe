import { escapeHtml } from "../utils/html.js";
import { DEFAULT_REASONING_TOKENS } from "../constants.js";
import type { ModelProvider, ReasoningMode } from "../types.js";
import {
  PROVIDER_CHOICES,
  PROVIDER_LABELS,
  PROVIDER_PLACEHOLDERS,
  DEFAULT_MODEL_BY_PROVIDER,
  DEFAULT_MAX_TOKENS_BY_PROVIDER,
  REASONING_MODE_CHOICES,
  PROVIDER_REASONING_CAPABILITIES,
  PROVIDER_TOKEN_GUIDANCE,
  getModelMetadata,
  getDefaultReasoningTokens,
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
import {
  renderTokenBudgetControl,
  TOKEN_BUDGET_STYLES,
  TOKEN_BUDGET_RUNTIME,
} from "./components/token-budget-control.js";

export interface AdminProviderInfo {
  provider: string;
  model: string;
  maxOutputTokens: number;
  reasoningMode: ReasoningMode;
  reasoningTokensEnabled?: boolean;
  reasoningTokens?: number;
  apiKeyMask: string;
}

export interface AdminRuntimeInfo {
  historyLimit: number;
  historyMaxBytes: number;
  includeInstructionPanel: boolean;
}

export interface AdminBriefAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  isImage: boolean;
}

export interface AdminHistoryItem {
  id: string;
  createdAt: string;
  method: string;
  path: string;
  durationMs: number;
  instructions?: string;
  querySummary: string;
  bodySummary: string;
  usageSummary?: string;
  reasoningSummaries?: string[];
  reasoningDetails?: string[];
  html: string;
  attachments?: AdminBriefAttachment[];
  viewUrl: string;
  downloadUrl: string;
}

export interface AdminPageProps {
  brief: string | null;
  attachments: AdminBriefAttachment[];
  provider: AdminProviderInfo;
  runtime: AdminRuntimeInfo;
  history: AdminHistoryItem[];
  totalHistoryCount: number;
  sessionCount: number;
  statusMessage?: string;
  errorMessage?: string;
  exportJsonUrl: string;
  exportMarkdownUrl: string;
  historyEndpoint: string;
  providerKeyStatuses: Record<
    ModelProvider,
    { hasKey: boolean; verified: boolean }
  >;
}

export function renderAdminDashboard(props: AdminPageProps): string {
  const {
    brief,
    attachments,
    provider,
    runtime,
    history,
    totalHistoryCount,
    sessionCount,
    statusMessage,
    errorMessage,
    exportJsonUrl,
    exportMarkdownUrl,
    historyEndpoint,
  } = props;

  const briefText =
    brief && brief.trim().length > 0 ? brief : "(brief not set yet)";
  const providerKey = isModelProvider(provider.provider)
    ? provider.provider
    : "openai";
  const providerLabel = PROVIDER_LABELS[providerKey] ?? provider.provider;
  const providerPlaceholder = PROVIDER_PLACEHOLDERS[providerKey] ?? "sk-...";
  const defaultModel = DEFAULT_MODEL_BY_PROVIDER[providerKey] ?? provider.model;
  const defaultMaxTokens =
    DEFAULT_MAX_TOKENS_BY_PROVIDER[providerKey] ?? provider.maxOutputTokens;
  const hasStoredKey = provider.apiKeyMask !== "not set";
  const reasoningCapability = PROVIDER_REASONING_CAPABILITIES[providerKey] ?? {
    mode: false,
    tokens: false,
  };
  const defaultReasoningTokens = getDefaultReasoningTokens(providerKey);
  const baselineReasoningTokens =
    typeof defaultReasoningTokens === "number"
      ? defaultReasoningTokens
      : undefined;
  const providerGuidance = PROVIDER_TOKEN_GUIDANCE[providerKey];
  const modelMetadata = getModelMetadata(providerKey, provider.model);
  const maxOutputRange = (() => {
    const base = providerGuidance?.maxOutputTokens ?? {};
    const override = modelMetadata?.maxOutputTokens ?? {};
    const description = override.description ?? base.description ?? "";
    const defaultValue =
      override.default ??
      base.default ??
      defaultMaxTokens ??
      provider.maxOutputTokens;
    return {
      min: override.min ?? base.min,
      max: override.max ?? base.max,
      default: defaultValue,
      description,
    };
  })();
  const maxOutputDefault =
    typeof maxOutputRange.default === "number"
      ? maxOutputRange.default
      : defaultMaxTokens;
  const explicitMaxOutputValue =
    provider.maxOutputTokens !== maxOutputDefault
      ? provider.maxOutputTokens
      : null;
  const reasoningGuidance = (() => {
    const base = providerGuidance?.reasoningTokens;
    if (!base) {
      return undefined;
    }
    const override = modelMetadata?.reasoningTokens;
    const overrideRange = override ?? undefined;
    const baseDefault =
      typeof base.default === "number" ? base.default : baselineReasoningTokens;
    const mergedDefault =
      typeof overrideRange?.default === "number"
        ? overrideRange.default
        : baseDefault;
    const allowDisable =
      overrideRange &&
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
  const metadataAllowsReasoningMode =
    !modelMetadata || modelMetadata.supportsReasoningMode === true;
  const modelSupportsReasoningMode =
    reasoningCapability.mode &&
    !modelSupportsReasoningTokens &&
    metadataAllowsReasoningMode;
  const reasoningToggleAllowed =
    modelSupportsReasoningTokens && reasoningGuidance?.allowDisable !== false;
  const reasoningToggleEnabled = modelSupportsReasoningTokens
    ? reasoningToggleAllowed
      ? provider.reasoningTokensEnabled !== false
      : true
    : false;
  const currentReasoningTokens =
    reasoningToggleEnabled && typeof provider.reasoningTokens === "number"
      ? provider.reasoningTokens
      : null;
  const reasoningDefaultValue =
    typeof baselineReasoningTokens === "number"
      ? baselineReasoningTokens
      : reasoningGuidance?.default;
  const explicitReasoningValue =
    reasoningToggleEnabled &&
    currentReasoningTokens !== null &&
    currentReasoningTokens !== undefined &&
    (reasoningDefaultValue === undefined ||
      currentReasoningTokens !== reasoningDefaultValue)
      ? currentReasoningTokens
      : null;
  const reasoningTokensChanged = reasoningToggleEnabled
    ? Boolean(explicitReasoningValue)
    : modelSupportsReasoningTokens && provider.reasoningTokensEnabled === false;
  const advancedOpen =
    explicitMaxOutputValue !== null ||
    (modelSupportsReasoningMode && provider.reasoningMode !== "none") ||
    reasoningTokensChanged;
  const reasoningHelperText =
    REASONING_MODE_CHOICES.find(
      (choice) => choice.value === provider.reasoningMode
    )?.description ?? "";
  const modelInputId = "admin-model";
  const modelSelectorMarkup = renderModelSelector({
    provider: providerKey,
    providerLabel,
    selectedModel: provider.model || defaultModel,
    selectId: modelInputId,
    customInputId: "admin-model-custom",
    inputName: "model",
    note: "Curated defaults are pre-filled. Override with an exact identifier to target preview builds.",
  });
  const apiInputId = "admin-api-key";
  const maxTokensId = "admin-max-output";
  const reasoningModeId = "admin-reasoning-mode";
  const reasoningTokensId = "admin-reasoning-tokens";
  const maxOutputHelperText =
    "Higher limits unlock richer layouts; smaller caps return faster.";
  const maxOutputDescription = maxOutputRange.description?.trim().length
    ? maxOutputRange.description
    : "Give the model a ceiling for each response.";
  const maxTokensControlMarkup = renderTokenBudgetControl({
    id: maxTokensId,
    name: "maxOutputTokens",
    label: "Max output tokens",
    description: maxOutputDescription,
    helper: maxOutputHelperText,
    value: explicitMaxOutputValue ?? null,
    defaultValue:
      typeof maxOutputDefault === "number" ? maxOutputDefault : undefined,
    min: maxOutputRange.min,
    max: maxOutputRange.max,
    units: "tokens",
    allowBlank: true,
    sliderEnabled: true,
    disabled: false,
    accent: "output",
    manualPlaceholder: "Exact token cap or leave blank",
  });
  const reasoningSliderHelperParts = [
    "Less reasoning tokens = faster. More tokens unlock complex flows.",
  ];
  if (reasoningGuidance?.helper) {
    reasoningSliderHelperParts.push(reasoningGuidance.helper);
  }
  const reasoningSliderHelper = reasoningSliderHelperParts.join(" ");
  const reasoningSliderDescription = reasoningGuidance?.description?.trim()
    .length
    ? reasoningGuidance.description
    : "Reserve a deliberate thinking budget for models that support it.";
  const reasoningSpecialLabels: Record<string, string> =
    providerKey === "gemini" ? { "-1": "Auto-managed", "0": "Disabled" } : {};
  const initialReasoningDisabled =
    !reasoningToggleEnabled ||
    (modelSupportsReasoningMode && provider.reasoningMode === "none");
  const reasoningTokensControlMarkup = renderTokenBudgetControl({
    id: reasoningTokensId,
    name: "reasoningTokens",
    label: "Reasoning budget",
    description: reasoningSliderDescription,
    helper: reasoningSliderHelper,
    value: explicitReasoningValue ?? null,
    defaultValue:
      typeof reasoningDefaultValue === "number"
        ? reasoningDefaultValue
        : undefined,
    min: reasoningGuidance?.min ?? providerGuidance?.reasoningTokens?.min,
    max: reasoningGuidance?.max ?? providerGuidance?.reasoningTokens?.max,
    units: "tokens",
    allowBlank: true,
    sliderEnabled: modelSupportsReasoningTokens,
    disabled: initialReasoningDisabled,
    accent: "reasoning",
    manualPlaceholder: "Leave blank to follow provider defaults",
    emptyLabel: "Auto (provider default)",
    defaultLabel: "Provider default",
    specialLabels: reasoningSpecialLabels,
  });
  const providerLabelsPayload = JSON.stringify(PROVIDER_LABELS).replace(
    /</g,
    "\\u003C"
  );
  const providerPlaceholdersPayload = JSON.stringify(
    PROVIDER_PLACEHOLDERS
  ).replace(/</g, "\\u003C");
  const providerDefaultsPayload = JSON.stringify(
    DEFAULT_MAX_TOKENS_BY_PROVIDER
  ).replace(/</g, "\\u003C");
  const keyStatusPayload = JSON.stringify(props.providerKeyStatuses).replace(
    /</g,
    "\\u003C"
  );
  const reasoningCapabilitiesPayload = JSON.stringify(
    PROVIDER_REASONING_CAPABILITIES
  ).replace(/</g, "\\u003C");
  const tokenGuidancePayload = JSON.stringify(PROVIDER_TOKEN_GUIDANCE).replace(
    /</g,
    "\\u003C"
  );
  const reasoningDescriptionsPayload = JSON.stringify(
    Object.fromEntries(
      REASONING_MODE_CHOICES.map(
        (choice) => [choice.value, choice.description] as const
      )
    )
  ).replace(/</g, "\\u003C");
  const modelSelectorDataScript = renderModelSelectorDataScript();
  const modelSelectorRuntimeScript = `<script>${MODEL_SELECTOR_RUNTIME}</script>`;
  const tokenBudgetRuntimeScript = `<script>${TOKEN_BUDGET_RUNTIME}</script>`;
  const attachmentRuntimeScript = `<script>${ATTACHMENT_UPLOADER_RUNTIME}</script>`;

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
    [hidden] {
      display: none !important;
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
    .provider-panel {
      gap: 24px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .pill-muted {
      background: rgba(15, 23, 42, 0.08);
      color: var(--muted);
    }
    .pill-soft {
      background: rgba(15, 23, 42, 0.06);
      color: var(--subtle);
    }
    .provider-status {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .provider-grid {
      display: grid;
      gap: 12px;
    }
    ${MODEL_SELECTOR_STYLES}
    ${MODEL_INSPECTOR_STYLES}
    ${ATTACHMENT_UPLOADER_STYLES}
    ${TOKEN_BUDGET_STYLES}
    .provider-option {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.94);
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.2s ease;
    }
    .provider-option:hover {
      transform: translateY(-1px);
      border-color: rgba(29, 78, 216, 0.32);
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
    }
    .provider-option[data-active="true"] {
      border-color: var(--accent);
      background: linear-gradient(135deg, rgba(29, 78, 216, 0.12), rgba(29, 78, 216, 0.04));
      box-shadow: 0 16px 30px rgba(29, 78, 216, 0.18);
    }
    .provider-option input {
      margin-top: 4px;
    }
    .provider-meta {
      display: grid;
      gap: 4px;
    }
    .provider-meta strong {
      font-size: 0.98rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--text);
    }
    .provider-meta span {
      font-size: 0.82rem;
      color: var(--muted);
    }
    .provider-meta p {
      margin: 0;
      color: var(--subtle);
      font-size: 0.8rem;
      max-width: 48ch;
      line-height: 1.5;
    }
    .field-group {
      display: grid;
      gap: 8px;
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
    .field-helper {
      margin: 0;
      font-size: 0.78rem;
      color: var(--subtle);
    }
    .attachment-section {
      display: grid;
      gap: 12px;
      margin-top: 18px;
    }
    .attachment-gallery {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    }
    .attachment-gallery--history {
      margin-top: 8px;
    }
    .attachment-card {
      display: grid;
      gap: 12px;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--surface-muted);
      box-shadow: var(--shadow-subtle);
    }
    .attachment-thumb {
      width: 100%;
      aspect-ratio: 4 / 3;
      border-radius: 14px;
      background: rgba(148, 163, 184, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .attachment-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .attachment-file-icon {
      font-size: 2.5rem;
      font-weight: 600;
      color: var(--accent);
    }
    .attachment-meta {
      display: grid;
      gap: 4px;
    }
    .attachment-meta strong {
      font-size: 0.95rem;
      color: var(--text);
    }
    .attachment-meta span {
      font-size: 0.8rem;
      color: var(--subtle);
    }
    .attachment-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .attachment-remove {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      color: var(--muted);
    }
    .attachment-remove input {
      accent-color: var(--accent);
    }
    .attachment-download {
      font-size: 0.82rem;
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }
    .attachment-download:hover {
      text-decoration: underline;
    }
    .attachment-empty {
      margin: 4px 0 0;
      font-size: 0.82rem;
      color: var(--muted);
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
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-weight: 600;
      color: var(--text);
      font-size: 0.88rem;
    }
    .advanced summary::-webkit-details-marker {
      display: none;
    }
    .advanced[open] summary {
      border-bottom: 1px solid rgba(148, 163, 184, 0.28);
    }
    .advanced-subtitle {
      font-size: 0.78rem;
      font-weight: 400;
      color: var(--subtle);
    }
    .advanced-body {
      padding: 18px;
      display: grid;
      gap: 14px;
    }
    .advanced-grid {
      display: grid;
      gap: 14px;
    }
    .field-group[data-disabled="true"] {
      opacity: 0.6;
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
      .model-lineup__grid { grid-template-columns: 1fr; }
    }
    @media (min-width: 1100px) {
      .model-inspector {
        grid-template-columns: minmax(0, 1.7fr) minmax(260px, 0.9fr);
        align-items: start;
      }
    }
  </style>
  ${modelSelectorDataScript}
  ${tokenBudgetRuntimeScript}
  ${modelSelectorRuntimeScript}
  ${attachmentRuntimeScript}
</head>
<body>
  <main>
    <header>
      <h1>serve-llm Admin Console</h1>
      <div class="status-bar">
        <div class="status-pill" data-status="historyTotal">History entries: ${totalHistoryCount}</div>
        <div class="status-pill" data-status="sessions">Active sessions tracked: ${sessionCount}</div>
        <div class="status-pill" data-status="provider">Current provider: ${escapeHtml(
          provider.provider
        )} · ${escapeHtml(provider.model)}</div>
        <div class="status-pill" data-status="historyLimit">History limit: ${escapeHtml(
          String(runtime.historyLimit)
        )}</div>
        <div class="status-pill" data-status="historyBytes">Byte budget: ${escapeHtml(
          String(runtime.historyMaxBytes)
        )}</div>
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
          <div class="panel-body brief-panel">
            <div class="pill">Craft the brief</div>
            <p class="panel-note">Describe the product vision — tone, audience, signature moments. Updates land instantly for the next render.</p>
            <form
              method="post"
              action="${escapeHtml(`/serve-llm/update-brief`)}"
              enctype="multipart/form-data"
            >
              <label class="field-group">
                <span class="field-label">What are we building?</span>
                <textarea
                  name="brief"
                  placeholder="Example: You are a ritual planning companion. Focus on warm light, generous whitespace, and a sense of calm. Surfaces should feel curated and tactile."
                  spellcheck="true"
                >${escapeHtml(briefText)}</textarea>
              </label>
              <p class="field-helper">The brief will guide the model throughout this session.</p>
              <div class="attachment-section">
                <span class="field-label">Brief attachments</span>
                <p class="field-helper">Drop in napkin sketches, screenshots, reference images or PDFs (depending on the model) to set the scene.</p>
                ${renderBriefAttachmentManager(attachments)}
                ${renderAttachmentUploader({
                  inputName: "briefAttachments",
                  label: "Add brief attachments",
                  hint: "Drop files, paste with Ctrl+V, or click browse to upload images and PDFs.",
                  browseLabel: "Browse files",
                  emptyStatus: "No new files selected yet.",
                })}
              </div>
              <button type="submit" class="action-button">Save brief</button>
            </form>
          </div>
        </section>

        <section class="tab-panel" id="tab-provider" role="tabpanel" hidden>
      <div class="panel-body provider-panel">
        <div class="pill">Provider &amp; model</div>
        <p class="panel-note">Switch providers or tune models without restarting. Leave the key blank to keep the current secret.</p>
        <form
          method="post"
          action="${escapeHtml(`/serve-llm/update-provider`)}"
          data-provider-form
          data-initial-provider="${escapeHtml(providerKey)}"
          data-initial-has-key="${
            props.providerKeyStatuses[providerKey as ModelProvider]?.hasKey
              ? "true"
              : "false"
          }"
          data-initial-reasoning-enabled="${
            reasoningToggleEnabled ? "true" : "false"
          }"
        >
          <div class="provider-status">
            <span class="pill pill-muted" data-provider-active>Active · ${escapeHtml(
              providerLabel
            )}</span>
            <span class="pill pill-soft" data-provider-model>Model · ${escapeHtml(
              provider.model
            )}</span>
          </div>
          <div class="provider-grid" role="radiogroup" aria-label="Model provider" data-provider-options>
            ${PROVIDER_CHOICES.map((choice) => {
              const active = choice.value === providerKey;
              const inputId = `admin-provider-${choice.value}`;
              return `<label class="provider-option" data-active="${active}" for="${inputId}">
                <input
                  id="${inputId}"
                  type="radio"
                  name="provider"
                  value="${escapeHtml(choice.value)}"
                  ${active ? "checked" : ""}
                  data-placeholder="${escapeHtml(choice.placeholder)}"
                  data-provider-label="${escapeHtml(choice.title)}"
                />
                <div class="provider-meta">
                  <strong>${escapeHtml(choice.title)}</strong>
                  <span>${escapeHtml(choice.subtitle)}</span>
                  <p>${escapeHtml(choice.description)}</p>
                </div>
              </label>`;
            }).join("\n")}
          </div>
          <div class="field-group">
            ${modelSelectorMarkup}
          </div>
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
                <div class="field-group" data-reasoning-mode-wrapper ${
                  modelSupportsReasoningMode ? "" : "hidden"
                }>
                  <label for="${reasoningModeId}">
                    <span>Reasoning mode</span>
                  </label>
                  <select id="${reasoningModeId}" name="reasoningMode" data-reasoning-mode>
                    ${REASONING_MODE_CHOICES.map((choice) => {
                      const selectedAttr =
                        choice.value === provider.reasoningMode
                          ? " selected"
                          : "";
                      return `<option value="${escapeHtml(
                        choice.value
                      )}"${selectedAttr}>${escapeHtml(choice.label)}</option>`;
                    }).join("\n")}
                  </select>
                  <p class="field-helper" data-reasoning-helper>${escapeHtml(
                    reasoningHelperText
                  )}</p>
                </div>
                <div
                  class="reasoning-toggle-group"
                  data-reasoning-toggle-block
                  data-allow-disable="${
                    reasoningToggleAllowed ? "true" : "false"
                  }"
                  ${modelSupportsReasoningTokens ? "" : "hidden"}
                >
                  <div class="reasoning-toggle" data-reasoning-toggle-wrapper ${
                    reasoningToggleAllowed ? "" : "hidden"
                  }>
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
                      Disable to skip deliberate thinking for faster runs.
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
          <label class="field-group api-key-field" for="${apiInputId}">
            <span class="field-label">
              <span data-provider-label-text>${escapeHtml(
                providerLabel
              )} API key</span>
            </span>
            <div class="api-key-control">
              <input
                id="${apiInputId}"
                type="password"
                name="apiKey"
                placeholder="${escapeHtml(providerPlaceholder)}"
                autocomplete="new-password"
                spellcheck="false"
                data-api-key-input
                ${hasStoredKey ? "disabled" : ""}
                ${hasStoredKey ? "" : "required"}
              />
              <button type="button" class="api-key-edit" data-api-key-toggle style="${
                hasStoredKey ? "" : "display:none;"
              }">Replace key</button>
            </div>
            <p class="api-key-hint">
              Stored value: <strong>${escapeHtml(provider.apiKeyMask)}</strong>.
              ${
                hasStoredKey
                  ? 'Choose "Replace key" to provide a new secret. Leaving the field blank keeps the current key (including values sourced from environment variables).'
                  : "Provide the API key for this provider. Values from environment variables will appear here on restart."
              }<br><br>
              <strong>Secure Storage:</strong> API keys entered in the UI are stored securely in your OS keychain (macOS Keychain, Windows Credential Manager, or Linux Secret Service). Keys supplied via environment variables or CLI options are never stored—they remain in memory only for the current session.
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
              <input type="number" min="1" name="historyLimit" value="${escapeHtml(
                String(runtime.historyLimit)
              )}" />
            </label>
            <label>
              Prompt history byte budget
              <input type="number" min="1" name="historyMaxBytes" value="${escapeHtml(
                String(runtime.historyMaxBytes)
              )}" />
            </label>
            <label>
              Instruction panel
              <select name="instructionPanel">
                <option value="on" ${
                  runtime.includeInstructionPanel ? "selected" : ""
                }>On</option>
                <option value="off" ${
                  runtime.includeInstructionPanel ? "" : "selected"
                }>Off</option>
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
        <form method="post" action="${escapeHtml(
          `/serve-llm/history/import`
        )}" data-import-form>
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
          <a class="action-button" href="${escapeHtml(
            exportJsonUrl
          )}" download>Download JSON snapshot</a>
          <a class="action-button" href="${escapeHtml(
            exportMarkdownUrl
          )}" download>Download prompt.md</a>
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
      let currentTabId = "tab-brief";
      let onTabChange = (_isHistory) => {};

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
        currentTabId = id;
        onTabChange(id === "tab-history");
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
        const providerLabels = ${providerLabelsPayload};
        const placeholderMap = ${providerPlaceholdersPayload};
        const providerKeyStatus = ${keyStatusPayload};
        const reasoningCapabilities = ${reasoningCapabilitiesPayload};
        const reasoningDescriptions = ${reasoningDescriptionsPayload};
        const providerTokenGuidance = ${tokenGuidancePayload};
        const providerDefaultMaxTokens = ${providerDefaultsPayload};
        const modelCatalogData =
          window.__SERVE_LLM_MODEL_SELECTOR_DATA?.catalog || {};
        const tokenControlApi = window.__SERVE_LLM_TOKEN_CONTROL;

        const providerOptions = providerForm.querySelector("[data-provider-options]");
        const providerRadios = providerOptions
          ? Array.from(providerOptions.querySelectorAll("input[name='provider']"))
          : [];
        const providerCards = providerOptions
          ? Array.from(providerOptions.querySelectorAll(".provider-option"))
          : [];
        const providerActivePill = providerForm.querySelector("[data-provider-active]");
        const providerModelPill = providerForm.querySelector("[data-provider-model]");
        const providerLabelTargets = Array.from(
          providerForm.querySelectorAll("[data-provider-label-text]"),
        );
        const apiInput = providerForm.querySelector("[data-api-key-input]");
        const toggleKeyButton = providerForm.querySelector("[data-api-key-toggle]");
        const hint = providerForm.querySelector(".api-key-hint");
        const reasoningModeWrapper = providerForm.querySelector(
          "[data-reasoning-mode-wrapper]",
        );
        const reasoningModeSelect = providerForm.querySelector("[data-reasoning-mode]");
        const reasoningTokensWrapper = providerForm.querySelector(
          "[data-reasoning-tokens-wrapper]",
        );
        const reasoningToggleBlock = providerForm.querySelector(
          "[data-reasoning-toggle-block]",
        );
        const reasoningToggleWrapper = providerForm.querySelector(
          "[data-reasoning-toggle-wrapper]",
        );
        const reasoningToggleInput = providerForm.querySelector(
          "[data-reasoning-toggle-input]",
        );
        const reasoningToggleHidden = providerForm.querySelector(
          "[data-reasoning-toggle-hidden]",
        );
        const reasoningHelper = providerForm.querySelector("[data-reasoning-helper]");
        const advanced = providerForm.querySelector("[data-advanced]");
        const modelRoot = providerForm.querySelector("[data-model-selector]");
        const hiddenModelInput = providerForm.querySelector("[data-model-value]");
        const maxTokensControlRoot = providerForm.querySelector(
          "[data-token-control='maxOutputTokens']",
        );
        const reasoningTokensControlRoot = providerForm.querySelector(
          "[data-token-control='reasoningTokens']",
        );
        const maxTokensWrapper = providerForm.querySelector(
          "[data-token-control-wrapper='maxOutputTokens']",
        );
        const maxTokensControl =
          tokenControlApi && typeof tokenControlApi.init === "function"
            ? tokenControlApi.init(maxTokensControlRoot)
            : null;
        const reasoningTokensControl =
          tokenControlApi && typeof tokenControlApi.init === "function"
            ? tokenControlApi.init(reasoningTokensControlRoot)
            : null;

        const fallbackProvider = ${JSON.stringify(providerKey).replace(
          /</g,
          "\\u003C"
        )};
        const initialProvider = providerForm.dataset.initialProvider || fallbackProvider;
        const initialHasKey = providerForm.dataset.initialHasKey === "true";
        let forcedKeyEntry = !initialHasKey;

        const providerLabelFromRadio = (value) => {
          const radio = providerRadios.find(
            (item) => item instanceof HTMLInputElement && item.value === value,
          );
          if (radio instanceof HTMLInputElement) {
            const label = radio.getAttribute("data-provider-label");
            if (label) {
              return label;
            }
          }
          return providerLabels[value] || value;
        };

        let activeProvider = initialProvider;
        let activeProviderLabel = providerLabelFromRadio(activeProvider);
        let providerSupportsMode = false;
        let providerSupportsTokens = false;
        let reasoningModeSupported = false;
        let reasoningTokensSupported = false;
        let reasoningToggleAllowed = true;
        let currentReasoningMode =
          reasoningModeSelect instanceof HTMLSelectElement && reasoningModeSelect.value
            ? reasoningModeSelect.value
            : "none";

        const cachedApiInputs = Object.create(null);
        const cachedModelByProvider = Object.create(null);

        const buildMaxTokenCacheKey = (provider, modelValue) => {
          const normalizedProvider = (provider || "").trim() || "__default__";
          const normalizedModel = (modelValue || "").trim() || "__default__";
          return normalizedProvider + "::" + normalizedModel;
        };

        const clampNumber = (value, min, max) => {
          let next = value;
          if (typeof min === "number" && Number.isFinite(min)) {
            next = Math.max(next, min);
          }
          if (typeof max === "number" && Number.isFinite(max)) {
            next = Math.min(next, max);
          }
          return next;
        };

        if (apiInput instanceof HTMLInputElement && apiInput.value) {
          cachedApiInputs[activeProvider] = apiInput.value;
        }

        const modelSelector =
          window.__SERVE_LLM_MODEL_SELECTOR?.init(modelRoot, {
            provider: activeProvider,
            providerLabel: activeProviderLabel,
            model:
              hiddenModelInput instanceof HTMLInputElement
                ? hiddenModelInput.value
                : "",
          }) || null;

        const updateModelPill = (state) => {
          if (!(providerModelPill instanceof HTMLElement)) {
            return;
          }
          const resolved = state?.input || state?.value || "—";
          providerModelPill.textContent = "Model · " + resolved;
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
            getModelList(provider).find((item) => item.value === normalized) ||
            null
          );
        };

        const isCustomModel = (provider, value) => {
          if (!value) {
            return false;
          }
          return !findModelMetadata(provider, value);
        };

        const reasoningSpecialLabelsByProvider = {
          gemini: { "-1": "Auto-managed", "0": "Disabled" },
        };

        const getReasoningSpecialLabels = (provider) =>
          reasoningSpecialLabelsByProvider[provider] || {};

        const getCurrentModelState = () => {
          if (modelSelector) {
            return modelSelector.getState();
          }
          const fallback =
            hiddenModelInput instanceof HTMLInputElement
              ? hiddenModelInput.value
              : "";
          return {
            provider: activeProvider,
            value: fallback,
            input: fallback,
            providerLabel: activeProviderLabel,
          };
        };

        const cachedMaxTokensBySelection = Object.create(null);
        const defaultMaxTokensAppliedBySelection = Object.create(null);
        const cachedReasoningTokensByProvider = Object.create(null);
        const reasoningEnabledByProvider = Object.create(null);

        const initialReasoningEnabled =
          providerForm.dataset.initialReasoningEnabled !== "false";
        reasoningEnabledByProvider[activeProvider] = initialReasoningEnabled;
        let reasoningTokensEnabled = initialReasoningEnabled;

        if (maxTokensControl) {
          const state = maxTokensControl.getState();
          const initialModelState = getCurrentModelState();
          const initialModelValue =
            initialModelState?.value || initialModelState?.input || "";
          const initialCacheKey = buildMaxTokenCacheKey(
            activeProvider,
            initialModelValue,
          );
          cachedMaxTokensBySelection[initialCacheKey] = state.raw || "";
          if (defaultMaxTokensAppliedBySelection[initialCacheKey] === undefined) {
            defaultMaxTokensAppliedBySelection[initialCacheKey] = false;
          }
        }
        if (reasoningTokensControl) {
          const state = reasoningTokensControl.getState();
          cachedReasoningTokensByProvider[activeProvider] = state.raw || "";
        }

        let activeMaxRange = null;
        let activeReasoningRange = null;
        let isApplyingConstraint = false;

        const ensureProviderCaches = (provider) => {
          if (cachedReasoningTokensByProvider[provider] === undefined) {
            cachedReasoningTokensByProvider[provider] = "";
          }
          if (reasoningEnabledByProvider[provider] === undefined) {
            reasoningEnabledByProvider[provider] = true;
          }
        };

        const ensureMaxTokenCache = (cacheKey) => {
          if (cachedMaxTokensBySelection[cacheKey] === undefined) {
            cachedMaxTokensBySelection[cacheKey] = "";
          }
          if (defaultMaxTokensAppliedBySelection[cacheKey] === undefined) {
            defaultMaxTokensAppliedBySelection[cacheKey] = false;
          }
        };

        const getActiveMaxTokenCacheKey = () => {
          const modelState = getCurrentModelState();
          const modelValue = modelState?.value || modelState?.input || "";
          return buildMaxTokenCacheKey(activeProvider, modelValue);
        };

        const updateReasoningHelper = (mode) => {
          if (reasoningHelper instanceof HTMLElement) {
            reasoningHelper.textContent = reasoningDescriptions[mode] || "";
          }
        };

        const enforceTokenConstraint = () => {
          if (!maxTokensControl || isApplyingConstraint) {
            return;
          }
          isApplyingConstraint = true;
          try {
            const providerMin =
              typeof activeMaxRange?.min === "number"
                ? activeMaxRange.min
                : undefined;
            let requiredOutput =
              typeof providerMin === "number" ? providerMin : undefined;
            let statusMessage = "";
            const reasoningModeActive =
              reasoningModeSupported && !reasoningTokensSupported;
            if (
              reasoningTokensControl &&
              activeReasoningRange &&
              activeReasoningRange.supported &&
              reasoningTokensEnabled &&
              !(reasoningModeActive && currentReasoningMode === "none")
            ) {
              const reasoningState = reasoningTokensControl.getState();
              let effectiveReasoning = null;
              if (reasoningState.isBlank) {
                if (typeof activeReasoningRange.default === "number") {
                  effectiveReasoning = activeReasoningRange.default;
                }
              } else if (typeof reasoningState.numeric === "number") {
                effectiveReasoning = reasoningState.numeric;
              }
              if (
                typeof effectiveReasoning === "number" &&
                Number.isFinite(effectiveReasoning) &&
                effectiveReasoning >= 0
              ) {
                const baseConstraint =
                  effectiveReasoning === -1
                    ? typeof activeReasoningRange.min === "number"
                      ? activeReasoningRange.min ?? 0
                      : 0
                    : effectiveReasoning;
                const candidate = baseConstraint + 1;
                requiredOutput =
                  typeof requiredOutput === "number"
                    ? Math.max(requiredOutput, candidate)
                    : candidate;
                if (
                  typeof requiredOutput === "number" &&
                  (typeof providerMin !== "number" || requiredOutput > providerMin)
                ) {
                  statusMessage = "Raised to stay aligned with the reasoning budget.";
                }
              }
            }

            const minFloor =
              typeof providerMin === "number"
                ? providerMin
                : typeof activeMaxRange?.min === "number"
                ? activeMaxRange.min
                : undefined;

            if (typeof minFloor === "number") {
              if (activeMaxRange) {
                activeMaxRange.min = minFloor;
                if (
                  typeof activeMaxRange.default === "number" &&
                  activeMaxRange.default < minFloor
                ) {
                  activeMaxRange.default = minFloor;
                }
              }
              const defaultFloor =
                typeof activeMaxRange?.default === "number"
                  ? Math.max(activeMaxRange.default, minFloor)
                  : minFloor;
              maxTokensControl.configure({
                min: minFloor,
                autoStep: true,
                defaultValue: defaultFloor,
              });
            }

            const constraintActive =
              typeof requiredOutput === "number" &&
              Number.isFinite(requiredOutput) &&
              statusMessage !== "";
            if (constraintActive) {
              const maxState = maxTokensControl.getState();
              const needsAdjustment =
                !maxState ||
                typeof maxState.numeric !== "number" ||
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
              maxTokensControl.configure({ status: "" });
            }
          } finally {
            isApplyingConstraint = false;
          }
        };

        const updateTokenControls = () => {
          ensureProviderCaches(activeProvider);
          const modelState = getCurrentModelState();
          const modelValue = modelState?.value || modelState?.input || "";
          const maxTokenCacheKey = buildMaxTokenCacheKey(
            activeProvider,
            modelValue,
          );
          ensureMaxTokenCache(maxTokenCacheKey);
          const metadata = findModelMetadata(activeProvider, modelValue || "");
          const customModel = isCustomModel(activeProvider, modelValue || "");
          const guidance = getProviderGuidance(activeProvider);
          const maxGuidance = guidance.maxOutputTokens || {};
          const reasoningGuidance = guidance.reasoningTokens;
          const providerDefaultMax = (() => {
            const mapped = providerDefaultMaxTokens?.[activeProvider];
            return typeof mapped === "number" && Number.isFinite(mapped)
              ? mapped
              : null;
          })();

          const mergedMaxRange = {
            min:
              typeof metadata?.maxOutputTokens?.min === "number"
                ? metadata.maxOutputTokens.min
                : maxGuidance.min,
            max:
              typeof metadata?.maxOutputTokens?.max === "number"
                ? metadata.maxOutputTokens.max
                : maxGuidance.max,
            default:
              typeof metadata?.maxOutputTokens?.default === "number"
                ? metadata.maxOutputTokens.default
                : maxGuidance.default,
            description:
              (metadata?.maxOutputTokens?.description || maxGuidance.description || "").trim(),
          };
          const minBound =
            typeof mergedMaxRange.min === "number" && Number.isFinite(mergedMaxRange.min)
              ? mergedMaxRange.min
              : null;
          const normalizedDefault =
            typeof mergedMaxRange.default === "number" &&
            Number.isFinite(mergedMaxRange.default)
              ? mergedMaxRange.default
              : providerDefaultMax;
          const finalDefault =
            normalizedDefault !== null
              ? minBound !== null
                ? Math.max(normalizedDefault, minBound)
                : normalizedDefault
              : minBound ?? providerDefaultMax;
          if (typeof finalDefault === "number" && Number.isFinite(finalDefault)) {
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
                mergedMaxRange.description || "Give the model a ceiling for each response.",
              helper: "Higher limits unlock richer layouts; smaller caps return faster.",
              autoStep: true,
            };
            if (
              typeof cachedValue === "string" &&
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
              typeof mergedMaxRange.default === "number" &&
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
              Object.prototype.hasOwnProperty.call(metadata, "reasoningTokens");
            const supported =
              providerSupports &&
              (customModel || !metadata || !hasOverride || override !== null);
            const overrideAllows =
              override &&
              Object.prototype.hasOwnProperty.call(override, "allowDisable")
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
                typeof override?.min === "number"
                  ? override.min
                  : reasoningGuidance.min,
              max:
                typeof override?.max === "number"
                  ? override.max
                  : reasoningGuidance.max,
              default:
                typeof override?.default === "number"
                  ? override.default
                  : reasoningGuidance.default,
              description:
                (override?.description || reasoningGuidance.description || "").trim(),
              helper: reasoningGuidance.helper || "",
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
              currentReasoningMode = "none";
            }
            reasoningModeSelect.value = currentReasoningMode;
          } else if (!showReasoningMode) {
            currentReasoningMode = "none";
          }
          updateReasoningHelper(currentReasoningMode);
          if (tokensSupported) {
            if (reasoningEnabledByProvider[activeProvider] === undefined) {
              reasoningEnabledByProvider[activeProvider] = true;
            }
            const storedToggle = reasoningEnabledByProvider[activeProvider];
            reasoningTokensEnabled = allowDisable
              ? storedToggle !== false
              : true;
          } else {
            reasoningTokensEnabled = false;
          }

          const helperPieces = [
            "Less reasoning tokens = faster. More tokens unlock complex flows.",
          ];
          if (mergedReasoningRange?.helper) {
            helperPieces.push(mergedReasoningRange.helper);
          }
          const sliderHelper = helperPieces.join(" ");
          const sliderDescription =
            mergedReasoningRange?.description ||
            "Reserve a deliberate thinking budget for models that support it.";

          const modeDisablesTokens =
            showReasoningMode && currentReasoningMode === "none";
          reasoningToggleAllowed =
            tokensSupported && allowDisable && !modeDisablesTokens;
          const showReasoningBudget =
            tokensSupported && reasoningTokensEnabled && !modeDisablesTokens;
          const tokensDisabled = !showReasoningBudget;

          if (reasoningToggleBlock instanceof HTMLElement) {
            reasoningToggleBlock.hidden = !tokensSupported;
            reasoningToggleBlock.setAttribute(
              "data-allow-disable",
              tokensSupported && allowDisable ? "true" : "false",
            );
          }
          if (reasoningToggleWrapper instanceof HTMLElement) {
            reasoningToggleWrapper.hidden = !reasoningToggleAllowed;
            if (!reasoningToggleAllowed && tokensSupported && modeDisablesTokens) {
              reasoningToggleWrapper.setAttribute("data-disabled", "true");
            } else {
              reasoningToggleWrapper.removeAttribute("data-disabled");
            }
          }
          if (reasoningToggleInput instanceof HTMLInputElement) {
            reasoningToggleInput.checked = reasoningTokensEnabled;
            reasoningToggleInput.disabled =
              !tokensSupported || !allowDisable || modeDisablesTokens;
          }
          if (reasoningToggleHidden instanceof HTMLInputElement) {
            reasoningToggleHidden.value = reasoningTokensEnabled ? "on" : "off";
          }

          if (reasoningTokensWrapper instanceof HTMLElement) {
            reasoningTokensWrapper.hidden = !showReasoningBudget;
            if (!showReasoningBudget) {
              reasoningTokensWrapper.setAttribute("data-disabled", "true");
            } else {
              reasoningTokensWrapper.removeAttribute("data-disabled");
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
                typeof mergedReasoningRange?.default === "number"
                  ? mergedReasoningRange.default
                  : undefined,
              specialLabels: getReasoningSpecialLabels(activeProvider),
              emptyLabel: "Auto (provider default)",
              defaultLabel: "Provider default",
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
            if (!state || state.source === "configure" || isApplyingConstraint) {
              return;
            }
            const cacheKey = getActiveMaxTokenCacheKey();
            ensureMaxTokenCache(cacheKey);
            cachedMaxTokensBySelection[cacheKey] = state.raw || "";
            enforceTokenConstraint();
          });
        }

        if (reasoningTokensControl) {
          reasoningTokensControl.onChange((state) => {
            if (!state || state.source === "configure" || isApplyingConstraint) {
              return;
            }
            cachedReasoningTokensByProvider[activeProvider] = state.raw || "";
            enforceTokenConstraint();
          });
        }

        const setActiveCard = (provider) => {
          providerCards.forEach((card) => {
            const radio = card.querySelector("input[name='provider']");
            const isMatch =
              radio instanceof HTMLInputElement && radio.value === provider;
            card.dataset.active = isMatch ? "true" : "false";
          });
        };

        const updateReasoningSupport = (provider) => {
          const capability = reasoningCapabilities[provider] || {
            mode: false,
            tokens: false,
          };
          providerSupportsMode = Boolean(capability.mode);
          providerSupportsTokens = Boolean(capability.tokens);
          reasoningModeSupported = false;
          reasoningTokensSupported = false;
          reasoningToggleAllowed = providerSupportsTokens;
          if (!providerSupportsMode) {
            currentReasoningMode = "none";
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
              "data-allow-disable",
              providerSupportsTokens ? "true" : "false",
            );
          }
          if (reasoningToggleWrapper instanceof HTMLElement) {
            reasoningToggleWrapper.hidden = true;
            reasoningToggleWrapper.removeAttribute("data-disabled");
          }
          if (reasoningToggleInput instanceof HTMLInputElement) {
            reasoningToggleInput.checked = true;
            reasoningToggleInput.disabled = !providerSupportsTokens;
          }
          if (reasoningToggleHidden instanceof HTMLInputElement) {
            reasoningToggleHidden.value = "on";
          }
          updateReasoningHelper(currentReasoningMode);
        };

        const applyReasoningMode = (mode) => {
          const normalized = (mode || "none").toLowerCase();
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
          reasoningTokensEnabled = effective;
          if (reasoningToggleHidden instanceof HTMLInputElement) {
            reasoningToggleHidden.value = effective ? "on" : "off";
          }
          updateTokenControls();
        };

        if (modelSelector) {
          const initialState = modelSelector.getState();
          cachedModelByProvider[initialState.provider] = initialState.input;
          updateModelPill(initialState);
          modelSelector.onChange((state) => {
            cachedModelByProvider[state.provider] = state.input;
            updateModelPill(state);
            if (state.provider === activeProvider) {
              updateTokenControls();
            }
          });
        }

        updateTokenControls();

        const storageNote =
          "Keys entered in the UI are stored securely in your OS keychain. Keys from environment variables or CLI options are never stored.";

        const updateKeyUi = (provider, providerLabel) => {
          const status = providerKeyStatus[provider] || {
            hasKey: false,
            verified: false,
          };
          const isInitial = provider === initialProvider;
          const shouldLock = status.hasKey && !(isInitial && forcedKeyEntry);
          if (apiInput instanceof HTMLInputElement) {
            const placeholder = placeholderMap[provider];
            if (placeholder) {
              apiInput.placeholder = placeholder;
            }
            if (shouldLock) {
              apiInput.disabled = true;
              apiInput.value = "";
              apiInput.removeAttribute("required");
            } else {
              apiInput.disabled = false;
              const cachedValue = cachedApiInputs[provider];
              apiInput.value = typeof cachedValue === "string" ? cachedValue : "";
              if (!status.hasKey) {
                apiInput.setAttribute("required", "true");
              } else {
                apiInput.removeAttribute("required");
              }
            }
          }
          if (toggleKeyButton instanceof HTMLButtonElement) {
            toggleKeyButton.style.display = shouldLock ? "" : "none";
          }
          if (hint instanceof HTMLElement) {
            const lockMessage =
              'Choose "Replace key" to provide a new secret. Leaving the field blank keeps the current key (including values sourced from environment variables).';
            const unlockMessage =
              "Enter the " + providerLabel + " API key. Leave blank to rely on environment configuration.";
            hint.textContent = (shouldLock ? lockMessage : unlockMessage) + " " + storageNote;
          }
          return shouldLock;
        };

        const applyProvider = (provider, explicitLabel) => {
          const providerLabel = explicitLabel || providerLabels[provider] || provider;
          activeProvider = provider;
          activeProviderLabel = providerLabel;

          providerLabelTargets.forEach((node) => {
            if (node instanceof HTMLElement) {
              node.textContent = providerLabel + " API key";
            }
          });
          if (providerActivePill instanceof HTMLElement) {
            providerActivePill.textContent = "Active · " + providerLabel;
          }

          updateKeyUi(provider, providerLabel);

          if (modelSelector) {
            const cachedModel = cachedModelByProvider[provider];
            modelSelector.setProvider(provider, {
              providerLabel,
              model: typeof cachedModel === "string" ? cachedModel : "",
            });
          }

          updateReasoningSupport(provider);
          ensureProviderCaches(provider);
          const modelState = getCurrentModelState();
          const modelValue = modelState?.value || modelState?.input || "";
          const providerCacheKey = buildMaxTokenCacheKey(provider, modelValue);
          ensureMaxTokenCache(providerCacheKey);
          const storedToggle = reasoningEnabledByProvider[provider];
          reasoningTokensEnabled = storedToggle !== false;
          const nextMode = reasoningModeSupported ? currentReasoningMode : "none";
          applyReasoningMode(nextMode);

          if (
            advanced instanceof HTMLDetailsElement &&
            !advanced.open &&
            (reasoningModeSupported || reasoningTokensSupported)
          ) {
            advanced.open = true;
          }
        };

        const handleProviderChange = (radio) => {
          if (!(radio instanceof HTMLInputElement) || !radio.checked) {
            return;
          }
          const nextProvider = radio.value;
          if (!nextProvider || nextProvider === activeProvider) {
            setActiveCard(activeProvider);
            return;
          }
          if (apiInput instanceof HTMLInputElement && !apiInput.disabled) {
            cachedApiInputs[activeProvider] = apiInput.value;
          }
          if (maxTokensControl) {
            const maxState = maxTokensControl.getState();
            const cacheKey = getActiveMaxTokenCacheKey();
            ensureMaxTokenCache(cacheKey);
            cachedMaxTokensBySelection[cacheKey] = maxState.raw || "";
          }
          if (reasoningTokensControl) {
            const reasoningState = reasoningTokensControl.getState();
            cachedReasoningTokensByProvider[activeProvider] =
              reasoningState.raw || "";
          }
          if (modelSelector) {
            const state = modelSelector.getState();
            cachedModelByProvider[state.provider] = state.input;
          }
          const label =
            radio.getAttribute("data-provider-label") ||
            providerLabels[nextProvider] ||
            nextProvider;
          applyProvider(nextProvider, label);
          setActiveCard(nextProvider);
        };

        providerRadios.forEach((radio) => {
          if (radio instanceof HTMLInputElement) {
            radio.addEventListener("change", () => handleProviderChange(radio));
          }
        });

        if (toggleKeyButton instanceof HTMLButtonElement && apiInput instanceof HTMLInputElement) {
          toggleKeyButton.addEventListener("click", (event) => {
            event.preventDefault();
            forcedKeyEntry = true;
            cachedApiInputs[activeProvider] = "";
            updateKeyUi(activeProvider, activeProviderLabel);
            apiInput.disabled = false;
            apiInput.value = "";
            apiInput.focus();
            apiInput.setAttribute("required", "true");
            if (hint instanceof HTMLElement) {
              hint.textContent =
                "Enter the replacement API key. " + storageNote;
            }
          });
        }

        if (apiInput instanceof HTMLInputElement) {
          apiInput.addEventListener("input", () => {
            cachedApiInputs[activeProvider] = apiInput.value;
          });
        }

        if (reasoningModeSelect instanceof HTMLSelectElement) {
          reasoningModeSelect.addEventListener("change", () => {
            applyReasoningMode(reasoningModeSelect.value);
          });
        }

        if (reasoningToggleInput instanceof HTMLInputElement) {
          reasoningToggleInput.addEventListener("change", () => {
            applyReasoningToggle(Boolean(reasoningToggleInput.checked));
          });
        }

        applyProvider(activeProvider, activeProviderLabel);
        setActiveCard(activeProvider);
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
      let historyTabActive = currentTabId === "tab-history";
      let autoEnabled = true;
      const intervalMs = 8000;
      let timer = window.setInterval(tick, intervalMs);
      let refreshing = false;

      const updateToggleUi = () => {
        toggleButton.dataset.enabled = String(autoEnabled);
        toggleButton.textContent = autoEnabled
          ? "Auto-refresh: on"
          : "Auto-refresh: off";
      };

      const updateStatus = (message) => {
        if (!(statusEl instanceof HTMLElement)) {
          return;
        }
        if (message) {
          statusEl.textContent = message;
          return;
        }
        if (autoEnabled && historyTabActive) {
          statusEl.textContent = "Auto-refresh running";
        } else if (historyTabActive) {
          statusEl.textContent = "Auto-refresh paused";
        } else {
          statusEl.textContent = "Auto-refresh paused while viewing other tabs";
        }
      };

      const restartTimer = () => {
        window.clearInterval(timer);
        timer = window.setInterval(tick, intervalMs);
      };

      onTabChange = (isHistory) => {
        historyTabActive = isHistory;
        if (historyTabActive) {
          if (autoEnabled) {
            updateStatus("Auto-refresh resumed");
            refresh();
            restartTimer();
          } else {
            updateStatus("Auto-refresh paused");
          }
        } else {
          updateStatus("Auto-refresh paused while viewing other tabs");
        }
      };

      updateToggleUi();
      updateStatus();

      refreshButton.addEventListener("click", () => {
        updateStatus("Refreshing…");
        refresh();
      });

      toggleButton.addEventListener("click", () => {
        autoEnabled = !autoEnabled;
        updateToggleUi();
        if (autoEnabled) {
          restartTimer();
          if (historyTabActive) {
            updateStatus("Auto-refresh resumed");
            refresh();
          } else {
            updateStatus("Auto-refresh will resume on the History tab");
          }
        } else {
          updateStatus("Auto-refresh paused");
          window.clearInterval(timer);
        }
      });

      async function tick() {
        if (!autoEnabled || !historyTabActive) {
          return;
        }
        await refresh();
      }

      async function refresh() {
        if (refreshing) {
          return;
        }
        refreshing = true;
        try {
          updateStatus("Refreshing…");
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
          updateStatus('Last updated ' + new Date().toLocaleTimeString());
        } catch (error) {
          console.error("Failed to refresh history", error);
          updateStatus("Refresh failed — will retry");
        } finally {
          refreshing = false;
        }
      }

      if (historyTabActive && autoEnabled) {
        refresh().catch((error) => {
          console.error("Failed to bootstrap history", error);
        });
      }

      updateStatus();

      window.addEventListener("beforeunload", () => {
        window.clearInterval(timer);
      });
    })();
  </script>
</body>
</html>`;
}

function renderStatus(status?: string, error?: string): string {
  if (error) {
    return `<div class="status-pill error">${escapeHtml(error)}</div>`;
  }
  if (status) {
    return `<div class="status-pill success">${escapeHtml(status)}</div>`;
  }
  return "";
}

function isModelProvider(value: string): value is ModelProvider {
  return (
    value === "openai" ||
    value === "gemini" ||
    value === "anthropic" ||
    value === "grok" ||
    value === "groq"
  );
}

export function renderHistory(history: AdminHistoryItem[]): string {
  if (history.length === 0) {
    return `<p class="reasoning">No pages generated yet — once the LLM responds this list will populate automatically.</p>`;
  }

  const items = history
    .map((item, index) => {
      const idx = index + 1;
      const chips: string[] = [
        `<span class="chip">${escapeHtml(item.createdAt)}</span>`,
        `<span class="chip">${item.durationMs} ms</span>`,
      ];
      if (item.attachments?.length) {
        chips.push(
          `<span class="chip">Attachments · ${item.attachments.length}</span>`
        );
      }
      if (item.instructions) {
        chips.push(`<span class="chip">Instructions</span>`);
      }

      const metaRows = [
        `<div class="history-meta-row"><span>Query</span><strong>${escapeHtml(
          item.querySummary
        )}</strong></div>`,
        `<div class="history-meta-row"><span>Body</span><strong>${escapeHtml(
          item.bodySummary
        )}</strong></div>`,
      ];
      if (item.usageSummary) {
        metaRows.push(
          `<div class="history-meta-row"><span>Usage</span><strong>${escapeHtml(
            item.usageSummary
          )}</strong></div>`
        );
      }

      const blockKey = (suffix: string) => `${item.id}:${suffix}`;
      const blocks: string[] = [
        `<div class="history-meta">${metaRows.join("\n")}</div>`,
      ];

      if (item.attachments?.length) {
        blocks.push(
          renderExpandable(
            "Brief attachments",
            renderHistoryAttachments(item.attachments),
            blockKey("brief-attachments")
          )
        );
      }
      if (item.instructions) {
        blocks.push(
          renderExpandable(
            "Instructions",
            `<pre>${escapeHtml(item.instructions)}</pre>`,
            blockKey("instructions")
          )
        );
      }
      if (item.reasoningSummaries?.length) {
        const content = item.reasoningSummaries
          .map((value) => `<p>${escapeHtml(value)}</p>`)
          .join("\n");
        blocks.push(
          renderExpandable(
            "Reasoning summary",
            content,
            blockKey("reasoning-summary")
          )
        );
      }
      if (item.reasoningDetails?.length) {
        const content = item.reasoningDetails
          .map((value) => `<p>${escapeHtml(value)}</p>`)
          .join("\n");
        blocks.push(
          renderExpandable(
            "Reasoning detail",
            content,
            blockKey("reasoning-detail")
          )
        );
      }
      blocks.push(
        renderExpandable(
          "Rendered HTML",
          `<pre>${escapeHtml(item.html)}</pre>`,
          blockKey("rendered-html")
        )
      );
      blocks.push(
        `<div class="actions"><a class="action-button" href="${escapeHtml(
          item.viewUrl
        )}" target="_blank" rel="noopener">View HTML</a><a class="action-button" href="${escapeHtml(
          item.downloadUrl
        )}" download>Download HTML</a></div>`
      );

      return `<details class="history-item" data-history-id="${escapeHtml(
        item.id
      )}">
  <summary class="history-title">
    <span>#${idx.toString().padStart(2, "0")} · ${escapeHtml(
        item.method
      )} ${escapeHtml(item.path)}</span>
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

function renderBriefAttachmentManager(
  attachments: AdminBriefAttachment[]
): string {
  if (!attachments || attachments.length === 0) {
    return `<p class="attachment-empty">No attachments yet.</p>`;
  }
  const cards = attachments
    .map((attachment) => renderFormAttachmentCard(attachment))
    .join("\n");
  return `<div class="attachment-gallery">${cards}</div>`;
}

function renderFormAttachmentCard(attachment: AdminBriefAttachment): string {
  const preview = attachment.isImage
    ? `<img src="${escapeHtml(attachment.dataUrl)}" alt="${escapeHtml(
        `${attachment.name} preview`
      )}" loading="lazy" />`
    : `<div class="attachment-file-icon" aria-hidden="true">${
        attachment.mimeType === "application/pdf" ? "PDF" : "FILE"
      }</div>`;
  return `<div class="attachment-card">
    <div class="attachment-thumb">${preview}</div>
    <div class="attachment-meta">
      <strong>${escapeHtml(attachment.name)}</strong>
      <span>${escapeHtml(attachment.mimeType)} · ${escapeHtml(
    formatBytes(attachment.size)
  )}</span>
    </div>
    <div class="attachment-actions">
      <label class="attachment-remove">
        <input type="checkbox" name="removeAttachment" value="${escapeHtml(
          attachment.id
        )}" />
        <span>Remove</span>
      </label>
      <a class="attachment-download" href="${escapeHtml(
        attachment.dataUrl
      )}" download="${escapeHtml(attachment.name)}">Download</a>
    </div>
  </div>`;
}

function renderHistoryAttachments(attachments: AdminBriefAttachment[]): string {
  const cards = attachments
    .map((attachment) => renderHistoryAttachmentCard(attachment))
    .join("\n");
  return `<div class="attachment-gallery attachment-gallery--history">${cards}</div>`;
}

function renderHistoryAttachmentCard(attachment: AdminBriefAttachment): string {
  const preview = attachment.isImage
    ? `<img src="${escapeHtml(attachment.dataUrl)}" alt="${escapeHtml(
        `${attachment.name} preview`
      )}" loading="lazy" />`
    : `<div class="attachment-file-icon" aria-hidden="true">${
        attachment.mimeType === "application/pdf" ? "PDF" : "FILE"
      }</div>`;
  return `<div class="attachment-card">
    <div class="attachment-thumb">${preview}</div>
    <div class="attachment-meta">
      <strong>${escapeHtml(attachment.name)}</strong>
      <span>${escapeHtml(attachment.mimeType)} · ${escapeHtml(
    formatBytes(attachment.size)
  )}</span>
    </div>
    <div class="attachment-actions">
      <a class="attachment-download" href="${escapeHtml(
        attachment.dataUrl
      )}" download="${escapeHtml(attachment.name)}">Download</a>
    </div>
  </div>`;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const precision = size < 10 && unitIndex > 0 ? 1 : 0;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function renderExpandable(
  title: string,
  innerHtml: string,
  blockId?: string
): string {
  const idAttr = blockId ? ` data-block-id="${escapeHtml(blockId)}"` : "";
  return `<details class="reason-block"${idAttr}><summary>${escapeHtml(
    title
  )}</summary>${innerHtml}</details>`;
}
