import type { ModelProvider } from "../../types.js";
import { escapeHtml } from "../../utils/html.js";
import {
  getModelMetadata,
  getModelOptions,
  getFeaturedModels,
  PROVIDER_MODEL_METADATA,
} from "../../constants/providers.js";
import type { ModelMetadata } from "../../llm/model-catalog.js";

export const CUSTOM_MODEL_DESCRIPTION =
  "Provide a custom model identifier supported by the provider. You can adjust token budgets below.";

function formatCost(cost?: ModelMetadata["cost"]): string {
  if (!cost) {
    return "Cost info coming soon";
  }
  const parts: string[] = [];
  if (typeof cost.input === "number") {
    parts.push(`$${cost.input.toFixed(cost.input >= 1 ? 2 : 3)} in`);
  }
  if (typeof cost.output === "number") {
    parts.push(`$${cost.output.toFixed(cost.output >= 1 ? 2 : 3)} out`);
  }
  if (typeof cost.reasoning === "number") {
    parts.push(`$${cost.reasoning.toFixed(cost.reasoning >= 1 ? 2 : 3)} reasoning`);
  }
  if (parts.length === 0) {
    return "Cost info coming soon";
  }
  return `${parts.join(" · ")} · ${cost.currency}/${cost.unit}`;
}

function renderHighlights(highlights?: string[]): string {
  if (!highlights || highlights.length === 0) {
    return "—";
  }
  return highlights
    .map((item) => `<span class="model-highlight">${escapeHtml(item)}</span>`)
    .join(" ");
}

export function renderModelDetailPanel(
  provider: ModelProvider,
  modelValue: string,
): string {
  const metadata = getModelMetadata(provider, modelValue);
  if (!metadata) {
    return `<div class="model-detail" data-model-detail>
      <div class="model-detail__header">
        <div>
          <h3 data-model-name>${escapeHtml(modelValue)}</h3>
          <p class="model-detail__tagline" data-model-tagline>Custom model</p>
        </div>
        <div class="model-detail__meta">
          <button
            type="button"
            class="model-detail__insight-trigger"
            data-model-insight-trigger
            aria-expanded="false"
            disabled
            title="Insights are available for curated models"
          >
            Performance snapshot
          </button>
        </div>
      </div>
      <p class="model-detail__description" data-model-description>
        ${escapeHtml(CUSTOM_MODEL_DESCRIPTION)}
      </p>
      <dl class="model-detail__facts">
        <div><dt>Context window</dt><dd data-model-context>—</dd></div>
        <div><dt>Recommended for</dt><dd data-model-recommended>Define your own sweet spot.</dd></div>
        <div><dt>Highlights</dt><dd data-model-highlights>—</dd></div>
        <div><dt>Cost</dt><dd data-model-cost>Cost info coming soon</dd></div>
      </dl>
      <div class="model-insight" data-model-insight hidden>
        <div
          class="model-insight__card"
          role="dialog"
          aria-modal="true"
          aria-label="Model performance snapshot"
        >
          <div class="model-insight__header">
            <h4>Performance snapshot</h4>
            <button type="button" class="model-insight__close" data-model-insight-close aria-label="Close snapshot">×</button>
          </div>
          <div class="model-insight__body" data-model-insight-body>
            <p class="model-insight__empty">Choose one of the curated models to view detailed benchmarks, speed, and cost insights.</p>
          </div>
        </div>
      </div>
    </div>`;
  }

  const costDisplay = formatCost(metadata.cost);
  const context = metadata.contextWindow
    ? `${metadata.contextWindow.toLocaleString()} ${metadata.contextWindowUnit ?? "tokens"}`
    : "—";

  return `<div class="model-detail" data-model-detail>
    <div class="model-detail__header">
      <div>
        <h3 data-model-name>${escapeHtml(metadata.label)}</h3>
        <p class="model-detail__tagline" data-model-tagline>${escapeHtml(metadata.tagline ?? "")}</p>
      </div>
      <div class="model-detail__meta">
        <div class="model-detail__cost" data-model-cost>${escapeHtml(costDisplay)}</div>
        <button
          type="button"
          class="model-detail__insight-trigger"
          data-model-insight-trigger
          aria-expanded="false"
        >
          Performance snapshot
        </button>
      </div>
    </div>
    <p class="model-detail__description" data-model-description>${escapeHtml(
      metadata.description,
    )}</p>
    <dl class="model-detail__facts">
      <div><dt>Context window</dt><dd data-model-context>${escapeHtml(context)}</dd></div>
      <div><dt>Recommended for</dt><dd data-model-recommended>${escapeHtml(
        metadata.recommendedFor ?? "Versatile creative work",
      )}</dd></div>
      <div><dt>Highlights</dt><dd data-model-highlights>${renderHighlights(
        metadata.highlights,
      )}</dd></div>
      <div><dt>Release</dt><dd data-model-release>${escapeHtml(metadata.release ?? "—")}</dd></div>
    </dl>
    <div class="model-insight" data-model-insight hidden>
      <div
        class="model-insight__card"
        role="dialog"
        aria-modal="true"
        aria-label="Model performance snapshot"
      >
        <div class="model-insight__header">
          <h4>Performance snapshot</h4>
          <button type="button" class="model-insight__close" data-model-insight-close aria-label="Close snapshot">×</button>
        </div>
        <div class="model-insight__body" data-model-insight-body>
          <p class="model-insight__empty">Loading metrics…</p>
        </div>
      </div>
    </div>
  </div>`;
}

function buildLineupButton(model: ModelMetadata, active: boolean): string {
  const classes = ["model-lineup__button"];
  if (active) {
    classes.push("is-active");
  }
  return `<button type="button" class="${classes.join(" ")}" data-model-choice="${escapeHtml(
    model.value,
  )}" data-model-choice-label="${escapeHtml(model.label)}">
    <span class="model-lineup__name">${escapeHtml(model.label)}</span>
    <span class="model-lineup__tag">${escapeHtml(model.tagline ?? "")}</span>
  </button>`;
}

export function renderModelLineup(
  provider: ModelProvider,
  activeModel: string,
): string {
  const featured = getFeaturedModels(provider);
  if (featured.length === 0) {
    return `<div class="model-lineup" data-model-lineup hidden></div>`;
  }
  const buttons = featured
    .map((model) => buildLineupButton(model, model.value === activeModel))
    .join("");
  return `<div class="model-lineup" data-model-lineup>
    <span class="model-lineup__title">Quick swap</span>
    <div class="model-lineup__grid" data-model-lineup-grid>${buttons}</div>
  </div>`;
}

export function getModelOptionList(
  provider: ModelProvider,
  selectedModel: string,
): Array<{ value: string; label: string }> {
  const options = getModelOptions(provider);
  const trimmed = selectedModel.trim();
  const exists = options.some((option) => option.value === trimmed);
  if (!exists && trimmed.length > 0) {
    options.push({ value: trimmed, label: `${trimmed} (current)` });
  }
  return options;
}

export function serializeModelCatalogForClient(): string {
  return JSON.stringify(PROVIDER_MODEL_METADATA).replace(/</g, "\\u003c");
}

export const MODEL_INSPECTOR_STYLES = `
  .model-inspector {
    display: grid;
    gap: 16px;
    margin: 4px 0 12px;
  }
  .model-inspector__detail {
    min-width: 0;
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
  .model-detail__meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
    margin-left: auto;
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
  .model-detail__insight-trigger {
    appearance: none;
    border: 1px solid transparent;
    border-radius: 999px;
    background: rgba(59, 130, 246, 0.12);
    color: var(--accent-dark);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    padding: 6px 14px;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  }
  .model-detail__insight-trigger:hover:not(:disabled) {
    transform: translateY(-1px);
    background: rgba(59, 130, 246, 0.2);
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.22);
  }
  .model-detail__insight-trigger:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .model-detail__insight-trigger:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
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
  body.model-insight-open {
    overflow: hidden;
  }
  .model-insight {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.58);
    backdrop-filter: blur(14px);
    display: grid;
    place-items: center;
    padding: 32px 16px;
    z-index: 1200;
  }
  .model-insight[hidden] {
    display: none;
  }
  .model-insight__card {
    width: min(680px, 100%);
    max-height: 85vh;
    overflow: hidden;
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: var(--surface);
    box-shadow: 0 28px 72px rgba(15, 23, 42, 0.34);
    display: grid;
    grid-template-rows: auto 1fr;
  }
  .model-insight__header {
    padding: 22px 26px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .model-insight__header h4 {
    margin: 0;
    font-size: 1.05rem;
    color: var(--text);
  }
  .model-insight__close {
    appearance: none;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(15, 23, 42, 0.06);
    color: var(--muted);
    border-radius: 999px;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
  }
  .model-insight__close:hover {
    background: rgba(59, 130, 246, 0.16);
    color: var(--accent-dark);
    transform: rotate(4deg);
  }
  .model-insight__close:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .model-insight__body {
    padding: 4px 26px 26px;
    overflow-y: auto;
    display: grid;
    gap: 22px;
  }
  .model-insight__section {
    display: grid;
    gap: 14px;
  }
  .model-insight__section h5 {
    margin: 0;
    font-size: 0.88rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--subtle);
  }
  .model-insight__empty {
    margin: 0;
    color: var(--muted);
    line-height: 1.6;
  }
  .model-insight__bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }
  .insight-bar {
    border-radius: 18px;
    border: 1px solid var(--border);
    background: var(--surface-glass);
    overflow: hidden;
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
  }
  .insight-bar__toggle {
    appearance: none;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
    display: grid;
    gap: 10px;
    padding: 18px 56px 16px 18px;
    cursor: pointer;
    position: relative;
    transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }
  .insight-bar__toggle:hover,
  .insight-bar__toggle:focus-visible {
    background: rgba(59, 130, 246, 0.08);
  }
  .insight-bar__toggle:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .insight-bar__toggle.is-open {
    background: rgba(59, 130, 246, 0.06);
    box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.18);
  }
  .insight-bar__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .insight-bar__label {
    font-weight: 600;
    color: var(--text);
  }
  .insight-bar__rating {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: var(--accent-dark);
    background: var(--accent-soft);
    border-radius: 999px;
    padding: 3px 10px;
  }
  .insight-bar__description {
    margin: 0;
    color: var(--muted);
    font-size: 0.86rem;
    line-height: 1.5;
  }
  .insight-bar__meter {
    background: rgba(148, 163, 184, 0.16);
    border-radius: 999px;
    height: 8px;
    overflow: hidden;
  }
  .insight-bar__meter span {
    display: block;
    height: 100%;
    border-radius: inherit;
    width: calc(var(--value, 0) * 1%);
    background: linear-gradient(90deg, rgba(59, 130, 246, 0.25) 0%, var(--accent) 100%);
    transition: width 0.25s ease;
  }
  .insight-bar__range {
    margin: 0;
    font-size: 0.78rem;
    color: var(--subtle);
  }
  .insight-bar__chevron {
    position: absolute;
    top: 18px;
    right: 18px;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    color: var(--subtle);
    transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease;
  }
  .insight-bar__chevron::before {
    content: "";
    border: solid currentColor;
    border-width: 0 2px 2px 0;
    display: inline-block;
    padding: 4px;
    transform: rotate(45deg);
    transition: transform 0.2s ease;
  }
  .insight-bar__toggle:hover .insight-bar__chevron,
  .insight-bar__toggle:focus-visible .insight-bar__chevron {
    background: rgba(59, 130, 246, 0.16);
    color: var(--accent-dark);
  }
  .insight-bar__toggle.is-open .insight-bar__chevron {
    background: rgba(59, 130, 246, 0.16);
    color: var(--accent-dark);
  }
  .insight-bar__toggle.is-open .insight-bar__chevron::before {
    transform: rotate(225deg);
  }
  .insight-bar__evidence {
    padding: 0 18px 18px;
    display: grid;
    gap: 12px;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.04);
  }
  .insight-bar__evidence[hidden] {
    display: none;
  }
  .insight-bar__evidence-title {
    margin: 16px 0 0;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--subtle);
  }
  .insight-bar__metrics {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }
  .insight-speed__grid {
    display: grid;
    gap: 18px;
  }
  @media (min-width: 720px) {
    .insight-speed__grid {
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
  }
  .insight-speed__card {
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--surface);
    padding: 18px 20px;
    display: grid;
    gap: 14px;
  }
  .insight-speed__title {
    margin: 0;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--subtle);
  }
  .insight-speed__card--stream {
    gap: 16px;
  }
  .insight-speed__distribution {
    display: grid;
    gap: 14px;
  }
  .insight-speed__lane {
    position: relative;
    height: 18px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.28);
    background: linear-gradient(
      90deg,
      rgba(148, 163, 184, 0.12) 0%,
      rgba(59, 130, 246, 0.08) 45%,
      rgba(56, 189, 248, 0.2) 100%
    );
    overflow: visible;
  }
  .insight-speed__band {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    left: calc(var(--start, 0) * 1%);
    width: calc(var(--size, 0) * 1%);
    border-radius: 999px;
  }
  .insight-speed__band--spread {
    height: 100%;
    background: rgba(59, 130, 246, 0.18);
  }
  .insight-speed__band--core {
    height: 100%;
    background: rgba(59, 130, 246, 0.32);
  }
  .insight-speed__marker {
    position: absolute;
    left: calc(var(--position, 0) * 1%);
    top: 50%;
    transform: translate(-50%, -50%);
    display: grid;
    place-items: center;
    z-index: 1;
    pointer-events: none;
    --marker-color: var(--accent);
    --marker-glow: rgba(59, 130, 246, 0.28);
  }
  .insight-speed__marker-dot {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: var(--marker-color);
    box-shadow: 0 0 0 4px var(--marker-glow);
  }
  .insight-speed__marker--slow {
    --marker-color: rgba(148, 163, 184, 0.9);
    --marker-glow: rgba(148, 163, 184, 0.3);
  }
  .insight-speed__marker--median {
    --marker-color: rgba(59, 130, 246, 1);
    --marker-glow: rgba(59, 130, 246, 0.26);
  }
  .insight-speed__marker--fast {
    --marker-color: rgba(14, 165, 233, 1);
    --marker-glow: rgba(14, 165, 233, 0.24);
  }
  .insight-speed__axis {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--subtle);
  }
  .insight-speed__axis-label {
    white-space: nowrap;
  }
  .insight-speed__marker-details {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  .insight-speed__detail {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: flex-start;
    --marker-color: rgba(59, 130, 246, 1);
    --marker-glow: rgba(59, 130, 246, 0.2);
  }
  .insight-speed__detail-swatch {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: var(--marker-color);
    box-shadow: 0 0 0 3px var(--marker-glow);
    margin-top: 4px;
  }
  .insight-speed__detail-copy {
    display: grid;
    gap: 4px;
  }
  .insight-speed__detail-label {
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--subtle);
    font-weight: 600;
  }
  .insight-speed__detail-values {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .insight-speed__detail-value {
    font-size: 0.96rem;
    color: var(--text);
  }
  .insight-speed__detail-rank {
    font-size: 0.74rem;
    color: var(--accent-dark);
    background: rgba(59, 130, 246, 0.16);
    border-radius: 999px;
    padding: 2px 8px;
  }
  .insight-speed__detail--slow {
    --marker-color: rgba(148, 163, 184, 0.9);
    --marker-glow: rgba(148, 163, 184, 0.24);
  }
  .insight-speed__detail--median {
    --marker-color: rgba(59, 130, 246, 1);
    --marker-glow: rgba(59, 130, 246, 0.26);
  }
  .insight-speed__detail--fast {
    --marker-color: rgba(14, 165, 233, 1);
    --marker-glow: rgba(14, 165, 233, 0.24);
  }
  .insight-speed__notes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .insight-speed__note {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
    line-height: 1.5;
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .insight-speed__note::before {
    content: "•";
    color: var(--accent);
    font-size: 1rem;
    line-height: 1;
  }
  .insight-timeline {
    display: grid;
    gap: 16px;
  }
  .insight-timeline__axis {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--subtle);
  }
  .insight-timeline__row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 12px;
    align-items: center;
  }
  .insight-timeline__label {
    font-weight: 600;
    color: var(--text);
    font-size: 0.92rem;
  }
  .insight-timeline__track {
    position: relative;
    height: 16px;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      rgba(34, 197, 94, 0.2) 0%,
      rgba(250, 204, 21, 0.18) 50%,
      rgba(239, 68, 68, 0.24) 100%
    );
    overflow: hidden;
  }
  .insight-timeline__band {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    left: calc(var(--start, 0) * 1%);
    width: calc(var(--size, 0) * 1%);
    border-radius: inherit;
  }
  .insight-timeline__band--spread {
    height: 100%;
    background: rgba(59, 130, 246, 0.16);
  }
  .insight-timeline__band--core {
    height: 100%;
    background: rgba(59, 130, 246, 0.32);
  }
  .insight-timeline__reasoning {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: calc(var(--size, 0) * 1%);
    background: rgba(45, 212, 191, 0.45);
    border-radius: inherit;
  }
  .insight-timeline__marker {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    left: calc(var(--position, 0) * 1%);
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--surface);
    border: 3px solid var(--accent);
    box-shadow: 0 8px 18px rgba(29, 78, 216, 0.18);
  }
  .insight-timeline__value {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }
  .insight-timeline__value-number {
    font-weight: 600;
    color: var(--text);
    font-size: 0.9rem;
  }
  .insight-timeline__badge {
    font-size: 0.72rem;
    color: var(--accent-dark);
    background: rgba(59, 130, 246, 0.16);
    border-radius: 999px;
    padding: 2px 8px;
  }
  .model-insight__bars--glossary {
    margin-top: 4px;
  }
  .model-insight__bars--glossary .insight-bar {
    background: var(--surface);
  }
  .model-insight__bars--glossary .insight-bar__toggle {
    padding-right: 56px;
  }
  .model-insight__bars--glossary .insight-bar__description {
    color: var(--muted);
  }
  .insight-bar--glossary {
    border: 1px solid rgba(148, 163, 184, 0.32);
  }
  .insight-bar__meter--glossary {
    background: rgba(148, 163, 184, 0.14);
  }
  .insight-bar__meter--glossary span {
    background: linear-gradient(
      90deg,
      rgba(59, 130, 246, 0.18) 0%,
      rgba(56, 189, 248, 0.45) 100%
    );
  }
  .insight-bar__evidence--glossary {
    background: rgba(15, 23, 42, 0.04);
  }
  .insight-metric {
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 14px 16px;
    background: var(--surface);
    display: grid;
    gap: 8px;
  }
  .insight-metric__header {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .insight-metric__label {
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }
  .insight-metric__group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent-dark);
    background: rgba(59, 130, 246, 0.12);
    border-radius: 999px;
    padding: 2px 10px;
  }
  .insight-metric__group::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: currentColor;
  }
  .insight-metric__badge {
    margin-left: auto;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: var(--accent-dark);
    background: var(--accent-soft);
    border-radius: 999px;
    padding: 3px 10px;
  }
  .insight-metric__description {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .insight-metric__meter {
    background: rgba(148, 163, 184, 0.18);
    border-radius: 999px;
    height: 8px;
    overflow: hidden;
  }
  .insight-metric__meter span {
    display: block;
    height: 100%;
    width: calc(var(--value, 0) * 1%);
    border-radius: inherit;
    background: linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, var(--accent) 100%);
    transition: width 0.25s ease;
  }
  .insight-metric__value {
    margin: 0;
    color: var(--subtle);
    font-size: 0.82rem;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: baseline;
  }
  .insight-metric__value strong {
    color: var(--accent-dark);
    font-weight: 700;
  }
  .insight-metric__direction {
    font-size: 0.75rem;
    color: var(--accent-dark);
    background: rgba(59, 130, 246, 0.12);
    border-radius: 999px;
    padding: 2px 10px;
  }
  .insight-metric__value span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .insight-metric--compact {
    gap: 6px;
    padding: 12px 14px;
  }
  .insight-metric--compact .insight-metric__description {
    font-size: 0.78rem;
  }
  .insight-metric--compact .insight-metric__meter {
    height: 6px;
  }
  .insight-metric--compact .insight-metric__header {
    gap: 6px;
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
  @media (max-width: 640px) {
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
`;
