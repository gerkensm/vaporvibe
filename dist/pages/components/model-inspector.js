import { escapeHtml } from "../../utils/html.js";
import { getModelMetadata, getModelOptions, getFeaturedModels, PROVIDER_MODEL_METADATA, PROVIDER_REASONING_CAPABILITIES, } from "../../constants/providers.js";
export const CUSTOM_MODEL_DESCRIPTION = "Provide a custom model identifier supported by the provider. You can adjust token budgets below.";
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
const COMPOSITE_SCORE_DESCRIPTIONS = {
    reasoning: "How well the model understands, reasons, and generalizes across complex problems.",
    codingSkill: "How good the model is at writing, understanding, and debugging code.",
    responsiveness: "How fast and interactive the model feels.",
    valueForMoney: "How much overall quality you get per dollar spent.",
};
const COMPOSITE_SCORE_LABELS = {
    reasoning: "Reasoning",
    codingSkill: "Coding skill",
    responsiveness: "Responsiveness",
    valueForMoney: "Value for money",
};
function formatCompositeValue(value) {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
        return "—";
    }
    return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
}
function describeCompositeScore(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "No score yet";
    }
    if (value >= 85) {
        return "Exceptional";
    }
    if (value >= 70) {
        return "Great";
    }
    if (value >= 50) {
        return "Strong";
    }
    if (value >= 30) {
        return "Developing";
    }
    return "Emerging";
}
function renderCompositeScoreItems(scores) {
    if (!scores) {
        return '<p class="model-scores__empty">Composite scores are available for curated models.</p>';
    }
    const items = Object.keys(COMPOSITE_SCORE_LABELS)
        .map((key) => {
        const value = scores[key];
        const safeValue = typeof value === "number" && Number.isFinite(value)
            ? Math.max(0, Math.min(100, value))
            : undefined;
        const ratio = typeof safeValue === "number" ? safeValue / 100 : 0;
        const displayValue = typeof value === "number" && !Number.isNaN(value)
            ? formatCompositeValue(value)
            : "—";
        const description = COMPOSITE_SCORE_DESCRIPTIONS[key];
        const label = COMPOSITE_SCORE_LABELS[key];
        const descriptor = describeCompositeScore(value);
        return `
        <div
          class="model-score"
          role="group"
          aria-label="${escapeHtml(`${label}: ${descriptor} (${displayValue} / 100)`)}"
          title="${escapeHtml(description)}"
          style="--score-fill:${ratio.toFixed(3)};"
        >
          <div class="model-score__header">
            <span class="model-score__label">${escapeHtml(label)}</span>
            <span class="model-score__value">${escapeHtml(displayValue)}</span>
          </div>
          <div class="model-score__meter" aria-hidden="true">
            <span class="model-score__fill"></span>
          </div>
          <span class="model-score__descriptor">${escapeHtml(descriptor)}</span>
        </div>
      `;
    })
        .join("");
    return `<div class="model-score-list">${items}</div>`;
}
function computeCapabilityStates(provider, metadata) {
    const providerCapabilities = PROVIDER_REASONING_CAPABILITIES[provider] ?? {
        mode: false,
        tokens: false,
    };
    const providerSupportsReasoning = providerCapabilities.mode === true || providerCapabilities.tokens === true;
    if (!metadata) {
        return {
            reasoning: providerSupportsReasoning ? "enabled" : "unknown",
            images: "unknown",
        };
    }
    const tokensValue = Object.prototype.hasOwnProperty.call(metadata, "reasoningTokens")
        ? metadata.reasoningTokens
        : undefined;
    const tokensExplicitlyDisabled = tokensValue === null;
    const tokensAvailable = Boolean(tokensValue);
    const modeExplicitlySupported = metadata.supportsReasoningMode === true;
    const modeExplicitlyDisabled = metadata.supportsReasoningMode === false;
    const costIncludesReasoning = typeof metadata.cost?.reasoning === "number";
    const providerTokensAvailable = providerCapabilities.tokens === true && !tokensExplicitlyDisabled;
    const providerModesAvailable = providerCapabilities.mode === true && !modeExplicitlyDisabled;
    const hasReasoning = costIncludesReasoning ||
        tokensAvailable ||
        modeExplicitlySupported ||
        providerTokensAvailable ||
        providerModesAvailable;
    const reasoningState = hasReasoning
        ? "enabled"
        : tokensExplicitlyDisabled || modeExplicitlyDisabled
            ? "disabled"
            : providerSupportsReasoning
                ? "enabled"
                : "disabled";
    const hasImages = Boolean(metadata.supportsImageInput ||
        metadata.isMultimodal ||
        metadata.supportsPDFInput);
    return {
        reasoning: reasoningState,
        images: hasImages ? "enabled" : "disabled",
    };
}
function renderCapabilityIndicator(config) {
    const { icon, label, description, state, variant } = config;
    const statusLabel = state === "enabled"
        ? "Available"
        : state === "disabled"
            ? "Not available"
            : "Unknown";
    return `
    <span
      class="model-capability model-capability--${state} model-capability--type-${variant}"
      role="img"
      aria-label="${escapeHtml(`${label}: ${statusLabel}. ${description}`)}"
      title="${escapeHtml(description)}"
    >
      <span class="model-capability__badge" aria-hidden="true">${icon}</span>
      <span class="model-capability__label">${escapeHtml(label)}</span>
    </span>
  `;
}
function renderCapabilities(provider, metadata) {
    const states = computeCapabilityStates(provider, metadata);
    const reasoningIndicator = renderCapabilityIndicator({
        icon: CAPABILITY_ICON_MARKUP.reasoning,
        label: "Reasoning",
        description: states.reasoning === "enabled"
            ? "This model supports structured reasoning modes for deeper analysis."
            : metadata
                ? "This model does not expose structured reasoning support in serve-llm."
                : "Provide your own model identifier to discover its reasoning support.",
        state: states.reasoning,
        variant: "reasoning",
    });
    const multimodalIndicator = renderCapabilityIndicator({
        icon: CAPABILITY_ICON_MARKUP.images,
        label: "Images",
        description: states.images === "enabled"
            ? "This model accepts image or multimodal inputs."
            : metadata
                ? "Image inputs are not available for this model."
                : "Custom models may or may not accept images—double-check your provider.",
        state: states.images,
        variant: "images",
    });
    return reasoningIndicator + multimodalIndicator;
}
const CAPABILITY_ICON_MARKUP = {
    reasoning: '<svg class="model-capability__svg" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="4" cy="5" r="2" fill="currentColor"/><circle cx="16" cy="5.5" r="2" fill="currentColor"/><circle cx="10" cy="14.5" r="2.1" fill="currentColor"/><path d="M5.6 6.7 8.9 11m5.3-3.2-3.8 6.2M12.2 4.2l-4 .8" stroke="currentColor" fill="none"/></svg>',
    images: '<svg class="model-capability__svg" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="2.5" y="3.5" width="15" height="11" rx="2" stroke="currentColor" fill="none"/><circle cx="7.3" cy="8" r="1.6" fill="currentColor"/><path d="M5.2 13.3 8.4 10l2.7 2.9 2.1-1.9 2.6 2.3" stroke="currentColor" fill="none"/></svg>',
};
export function renderModelDetailPanel(provider, modelValue) {
    const metadata = getModelMetadata(provider, modelValue);
    if (!metadata) {
        return `<div class="model-detail" data-model-detail>
      <div class="model-detail__header">
        <div>
          <h3 data-model-name>${escapeHtml(modelValue)}</h3>
          <p class="model-detail__tagline" data-model-tagline>Custom model</p>
        </div>
        <div class="model-detail__meta">
          <div class="model-detail__cost" data-model-cost>Cost info coming soon</div>
        </div>
      </div>
      <p class="model-detail__description" data-model-description>
        ${escapeHtml(CUSTOM_MODEL_DESCRIPTION)}
      </p>
      <div class="model-capabilities" data-model-capabilities>${renderCapabilities(provider)}</div>
      <div class="model-scores" data-model-scores>${renderCompositeScoreItems()}</div>
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
      <div class="model-detail__meta">
        <div class="model-detail__cost" data-model-cost>${escapeHtml(costDisplay)}</div>
      </div>
    </div>
    <p class="model-detail__description" data-model-description>${escapeHtml(metadata.description)}</p>
    <div class="model-capabilities" data-model-capabilities>${renderCapabilities(provider, metadata)}</div>
    <div class="model-scores" data-model-scores>${renderCompositeScoreItems(metadata.compositeScores)}</div>
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
export const MODEL_INSPECTOR_STYLES = `
  .model-inspector {
    display: grid;
    gap: 24px;
    margin: 16px 0 0;
  }
  @media (min-width: 960px) {
    .model-inspector {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      align-items: start;
    }
  }
  .model-inspector__detail,
  .model-inspector__lineup {
    min-width: 0;
  }
  .model-lineup {
    display: grid;
    gap: 14px;
    padding: 18px 20px;
    border-radius: 18px;
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: 0 18px 36px rgba(15, 23, 42, 0.06);
  }
  .model-lineup[hidden] {
    display: none;
  }
  .model-lineup__title {
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--subtle);
    font-weight: 600;
  }
  .model-lineup__grid {
    display: grid;
    gap: 10px;
  }
  .model-lineup__button {
    appearance: none;
    border: 1px solid rgba(148, 163, 184, 0.32);
    background: rgba(15, 23, 42, 0.02);
    border-radius: 16px;
    padding: 14px 16px;
    display: grid;
    gap: 6px;
    text-align: left;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }
  .model-lineup__button:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.1);
    border-color: rgba(59, 130, 246, 0.5);
  }
  .model-lineup__button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .model-lineup__button.is-active {
    border-color: rgba(59, 130, 246, 0.65);
    background: rgba(59, 130, 246, 0.12);
    box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.18);
  }
  .model-lineup__name {
    font-weight: 600;
    color: var(--text);
    font-size: 0.95rem;
  }
  .model-lineup__tag {
    font-size: 0.8rem;
    color: var(--subtle);
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
    gap: 6px;
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
  .model-detail__description {
    margin: 12px 0 10px;
    color: var(--muted);
    line-height: 1.6;
  }
  .model-capabilities {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin: 0 0 14px;
  }
  .model-capability {
    --cap-bg: rgba(148, 163, 184, 0.12);
    --cap-fg: var(--muted);
    --cap-badge-bg: rgba(148, 163, 184, 0.22);
    --cap-badge-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.32);
    --cap-icon-color: rgba(148, 163, 184, 0.9);
    --cap-border: rgba(148, 163, 184, 0.35);
    display: inline-flex;
    align-items: center;
    gap: 10px;
    border-radius: 999px;
    padding: 6px 14px 6px 8px;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    background: var(--cap-bg);
    color: var(--cap-fg);
    border: 1px solid var(--cap-border);
    transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }
  .model-capability__badge {
    width: 28px;
    height: 28px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: var(--cap-badge-bg);
    box-shadow: var(--cap-badge-shadow);
  }
  .model-capability__svg {
    width: 16px;
    height: 16px;
    stroke: var(--cap-icon-color);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .model-capability__label {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    letter-spacing: 0.06em;
  }
  .model-capability--enabled {
    --cap-bg: rgba(59, 130, 246, 0.14);
    --cap-fg: var(--accent-dark);
    --cap-badge-bg: var(--cap-badge-active, rgba(59, 130, 246, 0.28));
    --cap-badge-shadow: 0 10px 20px rgba(37, 99, 235, 0.18);
    --cap-icon-color: var(--cap-icon-active, var(--accent));
    --cap-border: rgba(59, 130, 246, 0.45);
    box-shadow:
      inset 0 0 0 1px rgba(59, 130, 246, 0.2),
      0 10px 24px rgba(59, 130, 246, 0.18);
  }
  .model-capability--disabled {
    --cap-bg: rgba(148, 163, 184, 0.12);
    --cap-fg: rgba(148, 163, 184, 0.9);
    --cap-badge-bg: rgba(148, 163, 184, 0.22);
    --cap-badge-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.32);
    --cap-icon-color: rgba(148, 163, 184, 0.9);
    --cap-border: rgba(148, 163, 184, 0.3);
    opacity: 0.75;
  }
  .model-capability--unknown {
    --cap-bg: rgba(250, 204, 21, 0.14);
    --cap-fg: #9a6700;
    --cap-badge-bg: rgba(250, 204, 21, 0.26);
    --cap-badge-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.6);
    --cap-icon-color: #d97706;
    --cap-border: rgba(251, 191, 36, 0.4);
  }
  .model-capability--type-reasoning {
    --cap-badge-active: linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(96, 165, 250, 0.58) 100%);
    --cap-icon-active: #2563eb;
  }
  .model-capability--type-images {
    --cap-badge-active: linear-gradient(135deg, rgba(6, 182, 212, 0.28) 0%, rgba(56, 189, 248, 0.52) 100%);
    --cap-icon-active: #0ea5e9;
  }
  .model-scores {
    margin: 0 0 18px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.24);
    background: rgba(15, 23, 42, 0.03);
  }
  .model-score-list {
    display: grid;
    gap: 10px;
  }
  .model-score {
    --score-fill: 0;
    display: grid;
    gap: 4px;
    font-variant-numeric: tabular-nums;
  }
  .model-score__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .model-score__label {
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--subtle);
    font-weight: 600;
  }
  .model-score__value {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--accent-dark);
  }
  .model-score__meter {
    position: relative;
    height: 4px;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.2);
    overflow: hidden;
  }
  .model-score__fill {
    position: absolute;
    inset: 0;
    width: calc(var(--score-fill) * 100%);
    border-radius: inherit;
    background: linear-gradient(90deg, rgba(59, 130, 246, 0.18) 0%, var(--accent) 100%);
    transition: width 0.2s ease;
  }
  .model-score__descriptor {
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .model-scores__empty {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
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
`;
