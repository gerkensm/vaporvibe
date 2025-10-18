import type { ChangeEvent } from "react";

import type {
  ModelCompositeScores,
  ModelMetadata,
  ModelReasoningTokens,
  ProviderTokenGuidanceEntry,
} from "../api/types";

import "./ModelInspector.css";

export interface CustomModelConfig {
  isMultimodal: boolean;
  supportsImageInput: boolean;
  supportsPDFInput: boolean;
  supportsReasoning: boolean;
  supportsReasoningMode: boolean;
}

interface CapabilityBadge {
  key: string;
  label: string;
  value?: string;
  variant: "positive" | "muted" | "info";
  title?: string;
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

function buildFeatureBadges(
  metadata?: ModelMetadata,
  customConfig?: CustomModelConfig
): CapabilityBadge[] {
  const badges: CapabilityBadge[] = [];
  const multimodal = metadata?.isMultimodal ?? customConfig?.isMultimodal ?? false;
  const image = metadata?.supportsImageInput ?? customConfig?.supportsImageInput ?? false;
  const pdf = metadata?.supportsPDFInput ?? customConfig?.supportsPDFInput ?? false;

  if (multimodal) {
    badges.push({
      key: "modality",
      label: "Multimodal",
      variant: "positive",
    });
  }

  if (image) {
    badges.push({
      key: "image-input",
      label: "Image input",
      variant: "positive",
    });
  }

  if (pdf) {
    badges.push({
      key: "pdf-input",
      label: "PDF upload",
      variant: "positive",
    });
  }

  if (!multimodal && !image && !pdf) {
    badges.push({
      key: "text-only",
      label: "Text only",
      variant: "muted",
    });
  }

  return badges;
}

function buildReasoningBadges({
  metadata,
  customConfig,
  providerTokens,
  providerSupportsReasoningMode,
}: {
  metadata?: ModelMetadata;
  customConfig?: CustomModelConfig;
  providerTokens?: ModelReasoningTokens;
  providerSupportsReasoningMode?: boolean;
}): CapabilityBadge[] {
  const badges: CapabilityBadge[] = [];

  const modelTokens = metadata?.reasoningTokens;
  const tokensSupported = metadata
    ? modelTokens?.supported === true
    : Boolean(customConfig?.supportsReasoning || providerTokens?.supported);
  const tokensHelper = metadata
    ? modelTokens?.helper ?? providerTokens?.helper
    : providerTokens?.helper;

  const modeFlag = metadata?.supportsReasoningMode;
  const modesSupported = metadata
    ? modeFlag === true
    : Boolean(customConfig?.supportsReasoningMode ?? providerSupportsReasoningMode);

  const reasoningSupported = tokensSupported || modesSupported;
  if (reasoningSupported) {
    const helper = tokensHelper ?? metadata?.reasoningModeNotes;
    badges.push({
      key: "reasoning",
      label: "Reasoning",
      variant: metadata ? "positive" : "info",
      title: helper || undefined,
    });
  }

  return badges;
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

function CustomCapabilitiesForm({
  customId,
  onCustomIdChange,
  placeholder,
  config,
  onConfigChange,
  description,
}: {
  customId: string;
  onCustomIdChange: (value: string) => void;
  placeholder: string;
  config: CustomModelConfig;
  onConfigChange: (value: CustomModelConfig) => void;
  description: string;
}) {
  const handleToggle = (key: keyof CustomModelConfig) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onConfigChange({
        ...config,
        [key]: event.target.checked,
      });
    };

  return (
    <div className="model-detail__custom">
      <label className="model-detail__field">
        <span className="model-detail__field-label">Model identifier</span>
        <input
          type="text"
          value={customId}
          placeholder={placeholder || "Enter the exact model ID"}
          onChange={(event) => onCustomIdChange(event.target.value)}
        />
        <p className="model-detail__helper">
          The identifier is sent to the provider API. Leave hints in the brief if
          additional context is required.
        </p>
      </label>

      <p className="model-detail__description">{description}</p>

      <div className="model-detail__custom-grid">
        <label className="model-detail__toggle">
          <input
            type="checkbox"
            checked={config.supportsReasoning}
            onChange={handleToggle("supportsReasoning")}
          />
          <span>Supports reasoning tokens</span>
        </label>
        <label className="model-detail__toggle">
          <input
            type="checkbox"
            checked={config.supportsReasoningMode}
            onChange={handleToggle("supportsReasoningMode")}
          />
          <span>Has qualitative reasoning modes</span>
        </label>
        <label className="model-detail__toggle">
          <input
            type="checkbox"
            checked={config.isMultimodal}
            onChange={handleToggle("isMultimodal")}
          />
          <span>Supports multimodal input</span>
        </label>
        <label className="model-detail__toggle">
          <input
            type="checkbox"
            checked={config.supportsImageInput}
            onChange={handleToggle("supportsImageInput")}
          />
          <span>Accepts image uploads</span>
        </label>
        <label className="model-detail__toggle">
          <input
            type="checkbox"
            checked={config.supportsPDFInput}
            onChange={handleToggle("supportsPDFInput")}
          />
          <span>Accepts PDF uploads</span>
        </label>
      </div>
      <p className="model-detail__note">
        Advanced settings stay uncapped for custom models. Set max output tokens
        and reasoning budgets to match the provider docs.
      </p>
    </div>
  );
}

interface ModelInspectorProps {
  providerLabel: string;
  modelId: string;
  metadata?: ModelMetadata;
  customMode: boolean;
  customModelId: string;
  customConfig: CustomModelConfig;
  apiKeyPlaceholder: string;
  modelPlaceholder: string;
  providerGuidance?: ProviderTokenGuidanceEntry;
  providerCapability?: { mode: boolean; tokens: boolean };
  customDescription: string;
  onCustomConfigChange: (config: CustomModelConfig) => void;
  onCustomModelIdChange: (value: string) => void;
}

export function ModelInspector({
  providerLabel,
  modelId,
  metadata,
  customMode,
  customModelId,
  customConfig,
  apiKeyPlaceholder,
  modelPlaceholder,
  providerGuidance,
  providerCapability,
  customDescription,
  onCustomConfigChange,
  onCustomModelIdChange,
}: ModelInspectorProps) {
  const badges = [
    ...buildFeatureBadges(metadata, customMode ? customConfig : undefined),
    ...buildReasoningBadges({
      metadata,
      customConfig: customMode ? customConfig : undefined,
      providerTokens: providerGuidance?.reasoningTokens,
      providerSupportsReasoningMode: providerCapability?.mode,
    }),
  ];

  const headingLabel = metadata?.label ?? (customModelId || "Custom model");
  const tagline = metadata?.tagline ??
    (customMode
      ? "Describe capabilities so teammates know what to expect."
      : "Provide your own model identifier.");

  return (
    <div className="model-detail">
      <div className="model-detail__header">
        <div>
          <h3>{headingLabel}</h3>
          <p className="model-detail__tagline">{tagline}</p>
        </div>
        <div className="model-detail__meta">
          {metadata ? formatCost(metadata.cost) : providerLabel}
        </div>
      </div>

      <CapabilityPills badges={badges} />

      {customMode ? (
        <CustomCapabilitiesForm
          customId={customModelId}
          onCustomIdChange={onCustomModelIdChange}
          placeholder={modelPlaceholder}
          config={customConfig}
          onConfigChange={onCustomConfigChange}
          description={customDescription}
        />
      ) : (
        <>
          <p className="model-detail__description">
            {metadata?.description ?? customDescription}
          </p>

          {metadata?.reasoningModeNotes && (
            <p className="model-detail__note">{metadata.reasoningModeNotes}</p>
          )}

          {providerGuidance?.reasoningTokens?.helper && !metadata?.reasoningTokens.helper && (
            <p className="model-detail__note">
              {providerGuidance.reasoningTokens.helper}
            </p>
          )}

          <div className="model-detail__facts">
            <div>
              <dt>Context window</dt>
              <dd>
                {typeof metadata?.contextWindow === "number"
                  ? `${metadata.contextWindow.toLocaleString()} ${
                      metadata.contextWindowUnit ?? "tokens"
                    }`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Recommended for</dt>
              <dd>{metadata?.recommendedFor ?? "Versatile creative work"}</dd>
            </div>
            <div>
              <dt>Highlights</dt>
              <dd>
                {metadata?.highlights && metadata.highlights.length > 0 ? (
                  <span className="model-highlight-list">
                    {metadata.highlights.map((item) => (
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

          <CompositeScores scores={metadata?.compositeScores} />

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
              supported capabilities. API key placeholder: {apiKeyPlaceholder}
            </p>
          )}
        </>
      )}

      {!customMode && !metadata && (
        <p className="model-detail__hint">
          Model `{modelId}` is not in the curated catalog. Configure it manually
          via advanced settings and the custom capability toggles.
        </p>
      )}
    </div>
  );
}

export default ModelInspector;
export type { ModelInspectorProps };
