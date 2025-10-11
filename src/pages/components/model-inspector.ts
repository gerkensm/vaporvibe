import type { ModelProvider } from "../../types.js";
import { escapeHtml } from "../../utils/html.js";
import {
  getModelMetadata,
  getModelOptions,
  getFeaturedModels,
  PROVIDER_MODEL_METADATA,
} from "../../constants/providers.js";
import type { ModelMetadata } from "../../llm/model-catalog.js";

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
      </div>
      <p class="model-detail__description" data-model-description>
        Provide a custom model identifier supported by the provider. You can adjust token budgets below.
      </p>
      <dl class="model-detail__facts">
        <div><dt>Context window</dt><dd data-model-context>—</dd></div>
        <div><dt>Recommended for</dt><dd data-model-recommended>Define your own sweet spot.</dd></div>
        <div><dt>Highlights</dt><dd data-model-highlights>—</dd></div>
        <div><dt>Cost</dt><dd data-model-cost>Cost info coming soon</dd></div>
      </dl>
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
      <div class="model-detail__cost" data-model-cost>${escapeHtml(costDisplay)}</div>
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
