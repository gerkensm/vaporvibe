import { useMemo, useState } from "react";

import type {
  ModelCompositeScores,
  ModelMetadata,
  ModelReasoningTokens,
  ProviderTokenGuidanceEntry,
} from "../api/types";

import "./ModelSelector.css";

interface ProviderChoice {
  value: string;
  title: string;
  subtitle: string;
  description: string;
  placeholder: string;
}

interface ModelOption {
  value: string;
  label: string;
  tagline?: string;
}

interface ModelSelectorProps {
  provider: string;
  model: string;
  providerChoices: ProviderChoice[];
  modelOptions: Record<string, ModelOption[]>;
  modelCatalog: Record<string, ModelMetadata[]>;
  featuredModels: Record<string, ModelOption[]>;
  providerLabels: Record<string, string>;
  providerPlaceholders: Record<string, string>;
  defaultModelByProvider: Record<string, string>;
  providerTokenGuidance: Record<string, ProviderTokenGuidanceEntry>;
  providerReasoningCapabilities: Record<string, { mode: boolean; tokens: boolean }>;
  customDescription: string;
  disableProviderSelection?: boolean;
  disableModelSelection?: boolean;
  onProviderChange: (provider: string, nextModel: string) => void;
  onModelChange: (model: string) => void;
}

function findMetadata(
  catalog: Record<string, ModelMetadata[]>,
  provider: string,
  model: string
): ModelMetadata | undefined {
  const list = catalog[provider] ?? [];
  return list.find((item) => item.value === model);
}

function formatCost(cost?: ModelMetadata["cost"]): string {
  if (!cost) return "Cost info coming soon";
  const parts: string[] = [];
  if (typeof cost.input === "number") {
    parts.push(`$${cost.input.toFixed(cost.input >= 1 ? 2 : 3)} in`);
  }
  if (typeof cost.output === "number") {
    parts.push(`$${cost.output.toFixed(cost.output >= 1 ? 2 : 3)} out`);
  }
  if (typeof cost.reasoning === "number") {
    parts.push(
      `$${cost.reasoning.toFixed(cost.reasoning >= 1 ? 2 : 3)} reasoning`
    );
  }
  if (parts.length === 0) return "Cost info coming soon";
  return `${parts.join(" · ")} · ${cost.currency}/${cost.unit}`;
}

function describeCompositeScore(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "No score yet";
  if (value >= 85) return "Exceptional";
  if (value >= 70) return "Great";
  if (value >= 50) return "Strong";
  if (value >= 30) return "Developing";
  return "Emerging";
}

function formatCompositeValue(value: number): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return "—";
  }
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
}

const COMPOSITE_SCORE_LABELS: Array<{
  key: keyof ModelCompositeScores;
  label: string;
  description: string;
}> = [
  {
    key: "reasoning",
    label: "Reasoning",
    description:
      "How well the model understands, reasons, and generalizes across complex problems.",
  },
  {
    key: "codingSkill",
    label: "Coding skill",
    description:
      "How good the model is at writing, understanding, and debugging code.",
  },
  {
    key: "responsiveness",
    label: "Responsiveness",
    description: "How fast and interactive the model feels.",
  },
  {
    key: "valueForMoney",
    label: "Value for money",
    description: "How much overall quality you get per dollar spent.",
  },
];

export function ModelSelector({
  provider,
  model,
  providerChoices,
  modelOptions,
  modelCatalog,
  featuredModels,
  providerLabels,
  providerPlaceholders,
  defaultModelByProvider,
  providerTokenGuidance,
  providerReasoningCapabilities,
  customDescription,
  disableProviderSelection = false,
  disableModelSelection = false,
  onProviderChange,
  onModelChange,
}: ModelSelectorProps) {
  const options = modelOptions[provider] ?? [];
  const isCurated = options.some((option) => option.value === model);
  const selectValue = isCurated ? model : "__custom";
  const [customValue, setCustomValue] = useState<string>(() =>
    isCurated ? "" : model
  );

  const metadata = useMemo(
    () => findMetadata(modelCatalog, provider, model),
    [modelCatalog, provider, model]
  );

  const featured = featuredModels[provider] ?? [];
  const providerLabel = providerLabels[provider] ?? provider;
  const placeholder = providerPlaceholders[provider] ?? "sk-...";
  const providerGuidance = providerTokenGuidance[provider];
  const providerCapability = providerReasoningCapabilities[provider];

  const handleProviderChange = (value: string) => {
    if (disableProviderSelection) return;
    const nextProvider = value as string;
    const defaults = defaultModelByProvider[nextProvider] ?? "";
    const nextOptions = modelOptions[nextProvider] ?? [];
    const nextModel = nextOptions[0]?.value ?? defaults;
    onProviderChange(nextProvider, nextModel || "");
    if (!nextOptions.some((item) => item.value === (nextModel || ""))) {
      setCustomValue(nextModel || "");
    } else {
      setCustomValue("");
    }
  };

  const handleModelChange = (value: string) => {
    if (disableModelSelection) return;
    if (value === "__custom") {
      onModelChange(customValue || "");
    } else {
      onModelChange(value);
    }
  };

  const handleCustomChange = (value: string) => {
    setCustomValue(value);
    onModelChange(value);
  };

  return (
    <div className="model-selector">
      <label className="model-selector__field">
        <span className="model-selector__label">Provider</span>
        <select
          value={provider}
          disabled={disableProviderSelection}
          onChange={(event) => handleProviderChange(event.target.value)}
        >
          {providerChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.title}
            </option>
          ))}
        </select>
      </label>

      <label className="model-selector__field">
        <span className="model-selector__label">Model · {providerLabel}</span>
        <select
          value={selectValue}
          disabled={disableModelSelection}
          onChange={(event) => handleModelChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value="__custom">Custom…</option>
        </select>
      </label>

      {selectValue === "__custom" && (
        <label className="model-selector__field">
          <span className="model-selector__label">Custom model identifier</span>
          <input
            type="text"
            value={customValue}
            placeholder="Enter the exact model ID"
            disabled={disableModelSelection}
            onChange={(event) => handleCustomChange(event.target.value)}
          />
        </label>
      )}

      <ModelDetail
        model={model}
        metadata={metadata}
        customDescription={customDescription}
        placeholder={placeholder}
        providerGuidance={providerGuidance}
        providerCapability={providerCapability}
      />

      {featured.length > 0 && (
        <div className="model-lineup">
          <span className="model-lineup__title">Quick swap</span>
          <div className="model-lineup__grid">
            {featured.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`model-lineup__button${
                  item.value === model ? " is-active" : ""
                }`}
                onClick={() => onModelChange(item.value)}
              >
                <span className="model-lineup__name">{item.label}</span>
                {item.tagline && (
                  <span className="model-lineup__tag">{item.tagline}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ModelDetailProps {
  model: string;
  metadata?: ModelMetadata;
  customDescription: string;
  placeholder: string;
  providerGuidance?: ProviderTokenGuidanceEntry;
  providerCapability?: { mode: boolean; tokens: boolean };
}

function ModelDetail({
  model,
  metadata,
  customDescription,
  placeholder,
  providerGuidance,
  providerCapability,
}: ModelDetailProps) {
  const highlights = metadata?.highlights ?? [];
  const compositeScores = metadata?.compositeScores;
  const recommendedFor = metadata?.recommendedFor ?? "Versatile creative work";
  const contextWindow = metadata?.contextWindow;
  const contextUnit = metadata?.contextWindowUnit ?? "tokens";
  const modelReasoningTokens = metadata?.reasoningTokens;
  const providerReasoningTokens = providerGuidance?.reasoningTokens;
  const supportsReasoningMode = metadata?.supportsReasoningMode;
  const providerSupportsMode = providerCapability?.mode;
  const tokensHelperNote =
    (modelReasoningTokens?.supported === false && modelReasoningTokens.helper) ||
    (providerReasoningTokens?.supported === false && providerReasoningTokens.helper) ||
    undefined;

  return (
    <div className="model-detail">
      <div className="model-detail__header">
        <div>
          <h3>{metadata?.label ?? (model || "Custom model")}</h3>
          <p className="model-detail__tagline">
            {metadata?.tagline ?? "Provide your own model identifier."}
          </p>
        </div>
        <div className="model-detail__meta">
          <div className="model-detail__cost">{formatCost(metadata?.cost)}</div>
        </div>
      </div>

      <CapabilityPills
        badges={[
          ...buildFeatureBadges(metadata),
          ...buildReasoningBadges({
            modelTokens: modelReasoningTokens,
            providerTokens: providerReasoningTokens,
            supportsReasoningMode,
            providerSupportsReasoningMode: providerSupportsMode,
            reasoningModeNotes: metadata?.reasoningModeNotes,
          }),
        ]}
      />

      <p className="model-detail__description">
        {metadata?.description ?? customDescription}
      </p>

      {metadata?.reasoningModeNotes && (
        <p className="model-detail__note">{metadata.reasoningModeNotes}</p>
      )}

      {tokensHelperNote && (
        <p className="model-detail__note">{tokensHelperNote}</p>
      )}

      <div className="model-detail__facts">
        <div>
          <dt>Context window</dt>
          <dd>
            {typeof contextWindow === "number"
              ? `${contextWindow.toLocaleString()} ${contextUnit}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Recommended for</dt>
          <dd>{recommendedFor}</dd>
        </div>
        <div>
          <dt>Highlights</dt>
          <dd>
            {highlights.length > 0 ? (
              <span className="model-highlight-list">
                {highlights.map((item) => (
                  <span key={item} className="model-highlight">
                    {item}
                  </span>
                ))}
              </span>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>{formatCost(metadata?.cost)}</dd>
        </div>
      </div>

      <CompositeScores scores={compositeScores} />

      {metadata?.documentationUrl && (
        <a
          className="model-detail__docs"
          href={metadata.documentationUrl}
          target="_blank"
          rel="noreferrer"
        >
          View provider docs
        </a>
      )}

      {!metadata && (
        <p className="model-detail__hint">
          Using a custom identifier? Double-check the provider docs for
          supported capabilities. API key placeholder: {placeholder}
        </p>
      )}
    </div>
  );
}

interface CapabilityBadge {
  key: string;
  label: string;
  value?: string;
  variant: "positive" | "muted" | "info";
  title?: string;
}

function CapabilityPills({ badges }: { badges: CapabilityBadge[] }) {
  if (badges.length === 0) {
    return null;
  }
  return (
    <div className="model-detail__capabilities">
      {badges.map((badge) => (
        <div
          key={badge.key}
          className={`model-detail__badge model-detail__badge--${badge.variant}`}
          title={badge.title}
        >
          <span className="model-detail__badge-label">
            {badge.value ? `${badge.label} · ${badge.value}` : badge.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function buildFeatureBadges(metadata?: ModelMetadata): CapabilityBadge[] {
  if (!metadata) {
    return [];
  }

  const badges: CapabilityBadge[] = [];
  if (metadata.isMultimodal) {
    badges.push({
      key: "modality",
      label: "Modality",
      value: "Multimodal",
      variant: "positive",
    });
  }
  if (metadata.supportsImageInput) {
    badges.push({
      key: "image-input",
      label: "Image input",
      variant: "positive",
    });
  }
  if (metadata.supportsPDFInput) {
    badges.push({
      key: "pdf-input",
      label: "PDF upload",
      variant: "positive",
    });
  }

  if (badges.length === 0) {
    badges.push({
      key: "text-only",
      label: "Modality",
      value: "Text only",
      variant: "muted",
    });
  }

  return badges;
}

interface BuildReasoningBadgesArgs {
  modelTokens?: ModelReasoningTokens;
  providerTokens?: ModelReasoningTokens;
  supportsReasoningMode?: boolean;
  providerSupportsReasoningMode?: boolean;
  reasoningModeNotes?: string;
}

function formatTokenAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  return value.toLocaleString();
}

function summarizeReasoningTokens(tokens: ModelReasoningTokens): string {
  const parts: string[] = [];
  const { min, max, default: defaultValue, allowDisable } = tokens;
  if (typeof min === "number" && typeof max === "number") {
    parts.push(`${formatTokenAmount(min)}–${formatTokenAmount(max)} tokens`);
  } else if (typeof max === "number") {
    parts.push(`Up to ${formatTokenAmount(max)} tokens`);
  } else if (typeof min === "number") {
    parts.push(`Starts at ${formatTokenAmount(min)} tokens`);
  } else {
    parts.push("Configurable thinking budget");
  }

  if (allowDisable) {
    parts.push("Disable with 0");
  }

  if (typeof defaultValue === "number") {
    const defaultLabel = defaultValue < 0 ? "Auto" : formatTokenAmount(defaultValue);
    parts.push(`Default ${defaultLabel}`);
  }

  return parts.join(" · ");
}

function buildReasoningBadges({
  modelTokens,
  providerTokens,
  supportsReasoningMode,
  providerSupportsReasoningMode,
  reasoningModeNotes,
}: BuildReasoningBadgesArgs): CapabilityBadge[] {
  const badges: CapabilityBadge[] = [];
  const explicitModeSupport =
    typeof supportsReasoningMode === "boolean" ? supportsReasoningMode : undefined;
  const effectiveModeSupport = explicitModeSupport ?? providerSupportsReasoningMode ?? false;
  const showModeBadge = effectiveModeSupport === true;

  const modelSupportsTokens = modelTokens?.supported === true;
  const providerSupportsTokens = providerTokens?.supported === true;
  const tokensSource = modelSupportsTokens
    ? modelTokens
    : providerSupportsTokens
    ? providerTokens
    : undefined;
  const showTokensBadge = Boolean(tokensSource);

  if (showModeBadge) {
    badges.push({
      key: "mode",
      label: "Reasoning modes",
      variant: "positive",
      title: reasoningModeNotes,
    });
  }

  if (showTokensBadge && tokensSource) {
    const helper = tokensSource.helper ?? modelTokens?.helper ?? providerTokens?.helper;
    badges.push({
      key: "tokens",
      label: "Reasoning tokens",
      value: summarizeReasoningTokens(tokensSource),
      variant: "positive",
      title: helper,
    });
  }

  return badges;
}

function CompositeScores({ scores }: { scores?: ModelCompositeScores }) {
  if (!scores) {
    return (
      <div className="model-scores">
        <p className="model-scores__empty">
          Composite scores are available for curated models.
        </p>
      </div>
    );
  }

  return (
    <div className="model-scores">
      {COMPOSITE_SCORE_LABELS.map(({ key, label, description }) => {
        const value = scores[key];
        const display = formatCompositeValue(value);
        const descriptor = describeCompositeScore(value);
        const ratio =
          typeof value === "number" && Number.isFinite(value)
            ? Math.max(0, Math.min(100, value)) / 100
            : 0;
        return (
          <div
            key={key}
            className="model-score"
            title={`${label}: ${description}`}
          >
            <div className="model-score__header">
              <span className="model-score__label">{label}</span>
              <span className="model-score__value">{display}</span>
            </div>
            <div className="model-score__meter" aria-hidden="true">
              <span
                className="model-score__fill"
                style={{ transform: `scaleX(${ratio})` }}
              />
            </div>
            <span className="model-score__descriptor">{descriptor}</span>
          </div>
        );
      })}
    </div>
  );
}

export default ModelSelector;

export type { ModelSelectorProps };
