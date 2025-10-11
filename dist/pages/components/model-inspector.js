import { escapeHtml } from "../../utils/html.js";
import { getModelMetadata, getModelOptions, getFeaturedModels, PROVIDER_MODEL_METADATA, } from "../../constants/providers.js";
function formatCost(cost) {
    if (!cost) {
        return "Cost info coming soon";
    }
    const parts = [];
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
function renderHighlights(highlights) {
    if (!highlights || highlights.length === 0) {
        return "—";
    }
    return highlights
        .map((item) => `<span class="model-highlight">${escapeHtml(item)}</span>`)
        .join(" ");
}
export function renderModelDetailPanel(provider, modelValue) {
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
    <p class="model-detail__description" data-model-description>${escapeHtml(metadata.description)}</p>
    <dl class="model-detail__facts">
      <div><dt>Context window</dt><dd data-model-context>${escapeHtml(context)}</dd></div>
      <div><dt>Recommended for</dt><dd data-model-recommended>${escapeHtml(metadata.recommendedFor ?? "Versatile creative work")}</dd></div>
      <div><dt>Highlights</dt><dd data-model-highlights>${renderHighlights(metadata.highlights)}</dd></div>
      <div><dt>Release</dt><dd data-model-release>${escapeHtml(metadata.release ?? "—")}</dd></div>
    </dl>
  </div>`;
}
function buildLineupButton(model, active) {
    const classes = ["model-lineup__button"];
    if (active) {
        classes.push("is-active");
    }
    return `<button type="button" class="${classes.join(" ")}" data-model-choice="${escapeHtml(model.value)}" data-model-choice-label="${escapeHtml(model.label)}">
    <span class="model-lineup__name">${escapeHtml(model.label)}</span>
    <span class="model-lineup__tag">${escapeHtml(model.tagline ?? "")}</span>
  </button>`;
}
export function renderModelLineup(provider, activeModel) {
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
export function getModelOptionList(provider, selectedModel) {
    const options = getModelOptions(provider);
    const trimmed = selectedModel.trim();
    const exists = options.some((option) => option.value === trimmed);
    if (!exists && trimmed.length > 0) {
        options.push({ value: trimmed, label: `${trimmed} (current)` });
    }
    return options;
}
export function serializeModelCatalogForClient() {
    return JSON.stringify(PROVIDER_MODEL_METADATA).replace(/</g, "\\u003c");
}
