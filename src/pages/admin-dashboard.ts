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
  REASONING_TOKEN_MIN_BY_PROVIDER,
  getDefaultReasoningTokens,
} from "../constants/providers.js";

export interface AdminProviderInfo {
  provider: string;
  model: string;
  maxOutputTokens: number;
  reasoningMode: ReasoningMode;
  reasoningTokens?: number;
  apiKeyMask: string;
}

export interface AdminRuntimeInfo {
  historyLimit: number;
  historyMaxBytes: number;
  includeInstructionPanel: boolean;
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
  viewUrl: string;
  downloadUrl: string;
}

export interface AdminPageProps {
  brief: string | null;
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

  const briefText = brief && brief.trim().length > 0 ? brief : "(brief not set yet)";
  const providerKey = isModelProvider(provider.provider) ? provider.provider : "openai";
  const providerLabel = PROVIDER_LABELS[providerKey] ?? provider.provider;
  const providerPlaceholder = PROVIDER_PLACEHOLDERS[providerKey] ?? "sk-...";
  const defaultModel = DEFAULT_MODEL_BY_PROVIDER[providerKey] ?? provider.model;
  const defaultMaxTokens = DEFAULT_MAX_TOKENS_BY_PROVIDER[providerKey] ?? provider.maxOutputTokens;
  const hasStoredKey = provider.apiKeyMask !== "not set";
  const reasoningCapability = PROVIDER_REASONING_CAPABILITIES[providerKey] ?? { mode: false, tokens: false };
  const defaultReasoningTokens = getDefaultReasoningTokens(providerKey);
  const baselineReasoningTokens = typeof defaultReasoningTokens === "number" ? defaultReasoningTokens : undefined;
  const currentReasoningTokens = provider.reasoningTokens ?? null;
  const maxTokensValue = provider.maxOutputTokens !== defaultMaxTokens ? String(provider.maxOutputTokens) : "";
  const reasoningTokenInputValue = (() => {
    if (currentReasoningTokens === null || currentReasoningTokens === undefined) {
      return "";
    }
    if (baselineReasoningTokens !== undefined && currentReasoningTokens === baselineReasoningTokens) {
      return "";
    }
    return String(currentReasoningTokens);
  })();
  const reasoningTokensDisabled = !reasoningCapability.tokens || (reasoningCapability.mode && provider.reasoningMode === "none");
  const reasoningTokenMin = REASONING_TOKEN_MIN_BY_PROVIDER[providerKey] ?? 0;
  const reasoningTokensChanged = (() => {
    if (!reasoningCapability.tokens) {
      return false;
    }
    if (currentReasoningTokens === null || currentReasoningTokens === undefined) {
      return false;
    }
    if (baselineReasoningTokens === undefined) {
      // Providers without a defined baseline treat any explicit value as a change.
      return true;
    }
    return currentReasoningTokens !== baselineReasoningTokens;
  })();
  const advancedOpen = provider.maxOutputTokens !== defaultMaxTokens
    || (reasoningCapability.mode && provider.reasoningMode !== "none")
    || reasoningTokensChanged;
  const reasoningHelperText = REASONING_MODE_CHOICES.find((choice) => choice.value === provider.reasoningMode)?.description ?? "";
  const modelInputId = "admin-model";
  const apiInputId = "admin-api-key";
  const maxTokensId = "admin-max-output";
  const reasoningModeId = "admin-reasoning-mode";
  const reasoningTokensId = "admin-reasoning-tokens";
  const providerLabelsPayload = JSON.stringify(PROVIDER_LABELS).replace(/</g, "\\u003C");
  const providerPlaceholdersPayload = JSON.stringify(PROVIDER_PLACEHOLDERS).replace(/</g, "\\u003C");
  const modelDefaultsPayload = JSON.stringify(DEFAULT_MODEL_BY_PROVIDER).replace(/</g, "\\u003C");
  const maxTokenDefaultsPayload = JSON.stringify(DEFAULT_MAX_TOKENS_BY_PROVIDER).replace(/</g, "\\u003C");
  const keyStatusPayload = JSON.stringify(props.providerKeyStatuses).replace(/</g, "\\u003C");
  const reasoningDefaultsPayload = JSON.stringify(
    Object.fromEntries(
      (Object.entries(DEFAULT_REASONING_TOKENS) as Array<[ModelProvider, number | undefined]>)
        .map(([key, value]) => [key, value ?? null]),
    ),
  ).replace(/</g, "\\u003C");
  const reasoningCapabilitiesPayload = JSON.stringify(PROVIDER_REASONING_CAPABILITIES).replace(/</g, "\\u003C");
  const reasoningMinsPayload = JSON.stringify(REASONING_TOKEN_MIN_BY_PROVIDER).replace(/</g, "\\u003C");
  const reasoningDescriptionsPayload = JSON.stringify(
    Object.fromEntries(REASONING_MODE_CHOICES.map((choice) => [choice.value, choice.description] as const)),
  ).replace(/</g, "\\u003C");
  const initialReasoningTokensLiteral = currentReasoningTokens !== null && currentReasoningTokens !== undefined
    ? JSON.stringify(String(currentReasoningTokens)).replace(/</g, "\\u003C")
    : "null";

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
    .field-helper {
      margin: 0;
      font-size: 0.78rem;
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
          <div class="panel-body brief-panel">
            <div class="pill">Craft the brief</div>
            <p class="panel-note">Describe the product vision just like you did in setup—tone, audience, signature moments. Updates land instantly for the next render.</p>
            <form method="post" action="${escapeHtml(`/serve-llm/update-brief`)}">
              <label class="field-group">
                <span class="field-label">What are we building?</span>
                <textarea
                  name="brief"
                  placeholder="Example: You are a ritual planning companion. Focus on warm light, generous whitespace, and a sense of calm. Surfaces should feel curated and tactile."
                  spellcheck="true"
                >${escapeHtml(briefText)}</textarea>
              </label>
              <p class="field-helper">We’ll keep a live snapshot of this brief on every request so you can iterate mid-session.</p>
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
          data-initial-has-key="${props.providerKeyStatuses[providerKey as ModelProvider]?.hasKey ? "true" : "false"}"
        >
          <div class="provider-status">
            <span class="pill pill-muted" data-provider-active>Active · ${escapeHtml(providerLabel)}</span>
            <span class="pill pill-soft" data-provider-model>Model · ${escapeHtml(provider.model)}</span>
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
            <label for="${modelInputId}">
              <span data-model-label>Model · ${escapeHtml(providerLabel)}</span>
            </label>
            <input
              id="${modelInputId}"
              type="text"
              name="model"
              value="${escapeHtml(provider.model || defaultModel)}"
              autocomplete="off"
              spellcheck="false"
              data-model-input
            />
            <p class="field-helper">Curated defaults are pre-filled. Override with an exact identifier to target preview builds.</p>
          </div>
          <details class="advanced" data-advanced ${advancedOpen ? "open" : ""}>
            <summary>
              <span>Advanced controls</span>
              <span class="advanced-subtitle">Tune token budgets and reasoning traces.</span>
            </summary>
            <div class="advanced-body">
              <div class="advanced-grid">
                <div class="field-group">
                  <label for="${maxTokensId}">
                    <span>Max output tokens</span>
                  </label>
                  <input
                    id="${maxTokensId}"
                    name="maxOutputTokens"
                    type="number"
                    min="1"
                    step="1"
                    inputmode="numeric"
                    placeholder="${escapeHtml(String(defaultMaxTokens))}"
                    value="${escapeHtml(maxTokensValue)}"
                    data-max-tokens
                  />
                  <p class="field-helper">Leave blank to stick with the provider default.</p>
                </div>
                <div class="field-group" data-reasoning-mode-wrapper ${reasoningCapability.mode ? "" : "hidden"}>
                  <label for="${reasoningModeId}">
                    <span>Reasoning mode</span>
                  </label>
                  <select id="${reasoningModeId}" name="reasoningMode" data-reasoning-mode>
                    ${REASONING_MODE_CHOICES.map((choice) => {
                      const selectedAttr = choice.value === provider.reasoningMode ? " selected" : "";
                      return `<option value="${escapeHtml(choice.value)}"${selectedAttr}>${escapeHtml(choice.label)}</option>`;
                    }).join("\n")}
                  </select>
                  <p class="field-helper" data-reasoning-helper>${escapeHtml(reasoningHelperText)}</p>
                </div>
                <div class="field-group" data-reasoning-tokens-wrapper ${reasoningCapability.tokens ? "" : "hidden"} ${reasoningTokensDisabled ? 'data-disabled="true"' : ""}>
                  <label for="${reasoningTokensId}">
                    <span>Reasoning max tokens</span>
                  </label>
                  <input
                    id="${reasoningTokensId}"
                    name="reasoningTokens"
                    type="number"
                    min="${escapeHtml(String(reasoningTokenMin))}"
                    step="1"
                    inputmode="numeric"
                    value="${escapeHtml(reasoningTokenInputValue)}"
                    ${reasoningTokensDisabled ? "disabled" : ""}
                    data-reasoning-tokens
                  />
                  <p class="field-helper">Leave blank to defer to provider defaults.</p>
                </div>
              </div>
            </div>
          </details>
          <label class="field-group api-key-field" for="${apiInputId}">
            <span class="field-label">
              <span data-provider-label-text>${escapeHtml(providerLabel)} API key</span>
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
              <button type="button" class="api-key-edit" data-api-key-toggle style="${hasStoredKey ? "" : "display:none;"}">Replace key</button>
            </div>
            <p class="api-key-hint">
              Stored value: <strong>${escapeHtml(provider.apiKeyMask)}</strong>.
              ${hasStoredKey
                ? "Choose “Replace key” to provide a new secret. Leaving the field blank keeps the current key (including values sourced from environment variables)."
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
        const providerContainer = providerForm.querySelector("[data-provider-options]");
        const providerRadios = providerContainer ? Array.from(providerContainer.querySelectorAll("input[name='provider']")) : [];
        const providerCards = providerContainer ? Array.from(providerContainer.querySelectorAll(".provider-option")) : [];
        const providerActivePill = providerForm.querySelector("[data-provider-active]");
        const providerModelPill = providerForm.querySelector("[data-provider-model]");
        const providerLabelTargets = Array.from(providerForm.querySelectorAll("[data-provider-label-text]"));
        const modelLabelEl = providerForm.querySelector("[data-model-label]");
        const modelInput = providerForm.querySelector("[data-model-input]");
        const maxTokensInput = providerForm.querySelector("[data-max-tokens]");
        const reasoningModeWrapper = providerForm.querySelector("[data-reasoning-mode-wrapper]");
        const reasoningModeSelect = providerForm.querySelector("[data-reasoning-mode]");
        const reasoningTokensWrapper = providerForm.querySelector("[data-reasoning-tokens-wrapper]");
        const reasoningTokensInput = providerForm.querySelector("[data-reasoning-tokens]");
        const reasoningHelper = providerForm.querySelector("[data-reasoning-helper]");
        const advanced = providerForm.querySelector("[data-advanced]");
        const providerLabels = ${providerLabelsPayload};
        const placeholderMap = ${providerPlaceholdersPayload};
        const modelDefaults = ${modelDefaultsPayload};
        const maxTokenDefaults = ${maxTokenDefaultsPayload};
        const providerKeyStatus = ${keyStatusPayload};
        const reasoningDefaults = ${reasoningDefaultsPayload};
        const reasoningCapabilities = ${reasoningCapabilitiesPayload};
        const reasoningMins = ${reasoningMinsPayload};
        const reasoningDescriptions = ${reasoningDescriptionsPayload};
        const initialProvider = providerForm.dataset.initialProvider || "";
        const initialHasKey = providerForm.dataset.initialHasKey === "true";
        let forcedKeyEntry = !initialHasKey;
        const cachedModelByProvider = Object.create(null);
        const cachedReasoningTokensByProvider = Object.create(null);
        let currentProvider = providerRadios.find((radio) => radio.checked)?.value || initialProvider;
        const initialReasoningTokens = ${initialReasoningTokensLiteral};
        if (modelInput instanceof HTMLInputElement) {
          cachedModelByProvider[currentProvider] = modelInput.value;
        }
        if (typeof initialReasoningTokens === "string") {
          cachedReasoningTokensByProvider[currentProvider] = initialReasoningTokens;
        } else if (reasoningTokensInput instanceof HTMLInputElement && reasoningTokensInput.value) {
          cachedReasoningTokensByProvider[currentProvider] = reasoningTokensInput.value;
        }

        const updateModelPill = () => {
          if (providerModelPill instanceof HTMLElement && modelInput instanceof HTMLInputElement) {
            const text = modelInput.value.trim();
            providerModelPill.textContent = "Model · " + (text || "—");
          }
        };

        const updateReasoningHelper = (mode) => {
          if (reasoningHelper instanceof HTMLElement) {
            reasoningHelper.textContent = reasoningDescriptions[mode] || "";
          }
        };

        const setActiveCard = (activeProvider) => {
          providerCards.forEach((card) => {
            const radio = card.querySelector("input[name='provider']");
            const isMatch = radio instanceof HTMLInputElement && radio.value === activeProvider;
            card.dataset.active = isMatch ? "true" : "false";
          });
        };

        const syncApiInput = (provider) => {
          const label = providerLabels[provider] || provider;
          const placeholder = placeholderMap[provider] || "";
          providerLabelTargets.forEach((node) => {
            if (node instanceof HTMLElement) {
              node.textContent = label + " API key";
            }
          });
          if (modelLabelEl instanceof HTMLElement) {
            modelLabelEl.textContent = "Model · " + label;
          }
          if (providerActivePill instanceof HTMLElement) {
            providerActivePill.textContent = "Active · " + label;
          }
          if (apiInput instanceof HTMLInputElement) {
            if (placeholder) {
              apiInput.placeholder = placeholder;
            }
            const status = providerKeyStatus[provider] || { hasKey: false, verified: false };
            const isInitial = provider === initialProvider;
            const shouldLock = status.hasKey && !(isInitial && forcedKeyEntry === true);
            apiInput.disabled = shouldLock;
            if (shouldLock) {
              apiInput.removeAttribute("required");
              apiInput.value = "";
            } else {
              apiInput.disabled = false;
              apiInput.removeAttribute("required");
              apiInput.value = "";
            }
            if (toggleKeyButton instanceof HTMLButtonElement) {
              toggleKeyButton.style.display = shouldLock ? "" : "none";
            }
            if (hint instanceof HTMLElement) {
              hint.textContent = shouldLock
                ? "Choose “Replace key” to provide a new secret. Leaving the field blank keeps the current key (including values sourced from environment variables)."
                : "Enter the " + label + " API key. Leave blank to rely on environment configuration.";
            }
          }
          if (maxTokensInput instanceof HTMLInputElement) {
            const maxDefault = maxTokenDefaults[provider];
            if (typeof maxDefault === "number") {
              maxTokensInput.placeholder = String(maxDefault);
            }
          }
        };

        const configureReasoning = (provider) => {
          const capability = reasoningCapabilities[provider] || { mode: false, tokens: false };
          if (reasoningModeWrapper instanceof HTMLElement) {
            reasoningModeWrapper.hidden = !capability.mode;
          }
          if (reasoningTokensWrapper instanceof HTMLElement) {
            reasoningTokensWrapper.hidden = !capability.tokens;
            if (!capability.tokens) {
              reasoningTokensWrapper.removeAttribute("data-disabled");
            }
          }
          if (reasoningModeSelect instanceof HTMLSelectElement) {
            if (!capability.mode) {
              reasoningModeSelect.value = "none";
            }
            updateReasoningHelper(reasoningModeSelect.value);
          }
          if (reasoningTokensInput instanceof HTMLInputElement) {
            const min = reasoningMins[provider];
            if (typeof min === "number") {
              reasoningTokensInput.min = String(min);
            } else {
              reasoningTokensInput.removeAttribute("min");
            }
            const defaultTokens = reasoningDefaults.hasOwnProperty(provider) ? reasoningDefaults[provider] : null;
            const cached = cachedReasoningTokensByProvider[provider];
            let valueToApply = "";
            if (typeof cached === "string" && cached.length > 0) {
              valueToApply = cached;
            } else if (defaultTokens !== null && defaultTokens !== undefined && defaultTokens !== "") {
              valueToApply = String(defaultTokens);
            }
            const disableForMode = capability.mode && reasoningModeSelect instanceof HTMLSelectElement && reasoningModeSelect.value === "none";
            if (disableForMode) {
              if (valueToApply.length > 0) {
                cachedReasoningTokensByProvider[provider] = valueToApply;
              }
              reasoningTokensInput.value = "";
              reasoningTokensInput.disabled = true;
              reasoningTokensWrapper?.setAttribute("data-disabled", "true");
            } else {
              reasoningTokensInput.disabled = !capability.tokens;
              if (capability.tokens) {
                reasoningTokensWrapper?.removeAttribute("data-disabled");
                reasoningTokensInput.value = valueToApply;
              } else {
                reasoningTokensInput.value = "";
              }
            }
          }
        };

        const switchProvider = (nextProvider) => {
          if (!nextProvider || nextProvider === currentProvider) {
            return;
          }
          if (modelInput instanceof HTMLInputElement) {
            cachedModelByProvider[currentProvider] = modelInput.value;
          }
          if (reasoningTokensInput instanceof HTMLInputElement && !reasoningTokensInput.disabled) {
            cachedReasoningTokensByProvider[currentProvider] = reasoningTokensInput.value;
          }
          currentProvider = nextProvider;
          const label = providerLabels[nextProvider] || nextProvider;
          if (modelInput instanceof HTMLInputElement) {
            const cachedModel = cachedModelByProvider[nextProvider];
            if (typeof cachedModel === "string") {
              modelInput.value = cachedModel;
            } else {
              const fallbackModel = modelDefaults[nextProvider];
              modelInput.value = typeof fallbackModel === "string" ? fallbackModel : "";
            }
            updateModelPill();
          }
          syncApiInput(nextProvider);
          configureReasoning(nextProvider);
          setActiveCard(nextProvider);
          if (advanced instanceof HTMLElement && !advanced.open) {
            const capability = reasoningCapabilities[nextProvider] || { mode: false, tokens: false };
            if (capability.mode || capability.tokens) {
              advanced.open = true;
            }
          }
          if (modelInput instanceof HTMLInputElement) {
            cachedModelByProvider[nextProvider] = modelInput.value;
          }
        };

        if (toggleKeyButton instanceof HTMLButtonElement && apiInput instanceof HTMLInputElement) {
          toggleKeyButton.addEventListener("click", (event) => {
            event.preventDefault();
            apiInput.disabled = false;
            apiInput.value = "";
            apiInput.focus();
            apiInput.setAttribute("required", "required");
            forcedKeyEntry = true;
            toggleKeyButton.style.display = "none";
            if (hint instanceof HTMLElement) {
              hint.textContent = "Enter the replacement API key. Leaving this blank will keep the existing one.";
            }
          });
        }

        providerRadios.forEach((radio) => {
          if (!(radio instanceof HTMLInputElement)) {
            return;
          }
          radio.addEventListener("change", () => {
            if (!radio.checked) {
              return;
            }
            switchProvider(radio.value);
          });
        });

        if (modelInput instanceof HTMLInputElement) {
          modelInput.addEventListener("input", () => {
            cachedModelByProvider[currentProvider] = modelInput.value;
            updateModelPill();
          });
        }

        if (reasoningModeSelect instanceof HTMLSelectElement) {
          reasoningModeSelect.addEventListener("change", () => {
            updateReasoningHelper(reasoningModeSelect.value);
            configureReasoning(currentProvider);
          });
        }

        if (reasoningTokensInput instanceof HTMLInputElement) {
          reasoningTokensInput.addEventListener("input", () => {
            cachedReasoningTokensByProvider[currentProvider] = reasoningTokensInput.value;
          });
        }

        setActiveCard(currentProvider);
        syncApiInput(currentProvider);
        configureReasoning(currentProvider);
        updateModelPill();
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
  return value === "openai" || value === "gemini" || value === "anthropic" || value === "grok";
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

      const blockKey = (suffix: string) => `${item.id}:${suffix}`;
      const blocks: string[] = [`<div class="history-meta">${metaRows.join("\n")}</div>`];

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
      blocks.push(
        `<div class="actions"><a class="action-button" href="${escapeHtml(item.viewUrl)}" target="_blank" rel="noopener">View HTML</a><a class="action-button" href="${escapeHtml(item.downloadUrl)}" download>Download HTML</a></div>`,
      );

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

function renderExpandable(title: string, innerHtml: string, blockId?: string): string {
  const idAttr = blockId ? ` data-block-id="${escapeHtml(blockId)}"` : "";
  return `<details class="reason-block"${idAttr}><summary>${escapeHtml(title)}</summary>${innerHtml}</details>`;
}
