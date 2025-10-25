import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ModelMetadata,
  ProviderTokenGuidanceEntry,
} from "../api/types";
import ModelInspector, {
  type CustomModelConfig,
} from "./ModelInspector";

import "./ModelSelector.css";

type ProviderStatus = {
  hasKey: boolean;
  verified: boolean;
};

type ProviderChoice = {
  value: string;
  title: string;
  subtitle: string;
  description: string;
  placeholder: string;
};

type ModelOption = {
  value: string;
  label: string;
  tagline?: string;
  featured?: boolean;
};

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
  providerStatuses: Record<string, ProviderStatus | undefined>;
  providerUnlockedMap: Record<string, boolean>;
  customConfig: CustomModelConfig;
  customModelId: string;
  customDescription: string;
  disableProviderSelection?: boolean;
  disableModelSelection?: boolean;
  onProviderChange: (provider: string, nextModel: string) => void;
  onModelChange: (model: string) => void;
  onCustomConfigChange: (config: CustomModelConfig) => void;
  onCustomModelIdChange: (value: string) => void;
}

function findMetadata(
  catalog: Record<string, ModelMetadata[]>,
  provider: string,
  model: string
): ModelMetadata | undefined {
  const list = catalog[provider] ?? [];
  return list.find((item) => item.value === model);
}

function resolveProviderStatusLabel(status?: ProviderStatus): {
  label: string;
  tone: "ready" | "pending" | "empty";
} {
  if (status?.verified) {
    return { label: "Verified", tone: "ready" };
  }
  if (status?.hasKey) {
    return { label: "Verify key", tone: "pending" };
  }
  return { label: "Needs key", tone: "empty" };
}

function ModelCard({
  option,
  active,
  disabled,
  onSelect,
}: {
  option: ModelOption;
  active: boolean;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      className={`model-card${active ? " is-active" : ""}${
        option.featured ? " model-card--featured" : ""
      }`}
      disabled={disabled}
      onClick={() => onSelect(option.value)}
      aria-label={option.featured ? `${option.label} (featured model)` : undefined}
    >
      {option.featured && (
        <span className="model-card__badge" aria-hidden="true">
          ★
        </span>
      )}
      <span className="model-card__label">{option.label}</span>
      {option.tagline && <span className="model-card__tagline">{option.tagline}</span>}
    </button>
  );
}

function CustomModelCard({
  active,
  disabled,
  onSelect,
  unlocked,
}: {
  active: boolean;
  disabled: boolean;
  unlocked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`model-card model-card--custom${active ? " is-active" : ""}`}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="model-card__label">Custom model</span>
      <span className="model-card__tagline">
        {unlocked
          ? "Manually configure capabilities"
          : "Verify an API key to unlock"}
      </span>
    </button>
  );
}

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
  providerStatuses,
  providerUnlockedMap,
  customConfig,
  customModelId,
  customDescription,
  disableProviderSelection = false,
  disableModelSelection = false,
  onProviderChange,
  onModelChange,
  onCustomConfigChange,
  onCustomModelIdChange,
}: ModelSelectorProps) {
  const MIN_CATALOG_HEIGHT = 360;
  const curatedOptions = modelOptions[provider] ?? [];
  const featured = featuredModels[provider] ?? [];
  const metadata = useMemo(
    () => findMetadata(modelCatalog, provider, model),
    [modelCatalog, provider, model]
  );
  const providerLabel = providerLabels[provider] ?? provider;
  const apiKeyPlaceholder = providerPlaceholders[provider] ?? "sk-...";
  const providerGuidance = providerTokenGuidance[provider];
  const providerCapability = providerReasoningCapabilities[provider];
  const providerStatus = providerStatuses[provider];
  const providerUnlocked = providerUnlockedMap[provider] ?? false;
  const statusInfo = resolveProviderStatusLabel(providerStatus);
  const isCustomSelection = !metadata;
  const customId = customModelId || (isCustomSelection ? model : "");

  const canSelectModels = providerUnlocked && !disableModelSelection;
  const [filter, setFilter] = useState("");
  const normalizedFilter = filter.trim().toLowerCase();
  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const [inspectorHeight, setInspectorHeight] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const node = inspectorRef.current;
    if (!node) {
      setInspectorHeight(null);
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextHeight = entry.contentRect.height;
      setInspectorHeight((prev) =>
        Math.abs((prev ?? 0) - nextHeight) > 1 ? nextHeight : prev
      );
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [provider, model, providerUnlocked]);

  const modelPlaceholder = useMemo(() => {
    if (metadata?.value) {
      return metadata.value;
    }
    const defaultModel = defaultModelByProvider[provider];
    if (defaultModel) {
      return defaultModel;
    }
    return `${provider}/model-id`;
  }, [metadata?.value, defaultModelByProvider, provider]);

  const catalogOptions = useMemo(() => {
    const featuredSet = new Set(featured.map((item) => item.value));
    const featuredEntries = featured.map((item) => ({ ...item, featured: true }));
    const curatedEntries = curatedOptions.map((item) => ({
      ...item,
      featured: featuredSet.has(item.value),
    }));
    const combined = [...featuredEntries, ...curatedEntries];
    const seen = new Set<string>();
    return combined.filter((option) => {
      if (seen.has(option.value)) {
        return false;
      }
      seen.add(option.value);
      return true;
    });
  }, [curatedOptions, featured]);

  const filteredOptions = useMemo(() => {
    if (!normalizedFilter) {
      return catalogOptions;
    }
    return catalogOptions.filter((option) => {
      const haystack = `${option.label} ${option.tagline ?? ""} ${option.value}`
        .toLowerCase();
      return haystack.includes(normalizedFilter);
    });
  }, [catalogOptions, normalizedFilter]);

  const handleProviderChange = (value: string) => {
    if (disableProviderSelection || value === provider) return;
    setFilter("");
    const nextOptions = modelOptions[value] ?? [];
    const hinted = defaultModelByProvider[value];
    const nextModel = nextOptions[0]?.value ?? hinted ?? "";
    onProviderChange(value, nextModel);
  };

  const handleModelSelect = (value: string) => {
    if (!canSelectModels) return;
    onModelChange(value);
  };

  const handleCustomSelect = () => {
    if (!canSelectModels) return;
    onModelChange(customId || "");
  };

  const customModeId = customId || model;
  const catalogMaxHeight =
    inspectorHeight != null
      ? Math.max(MIN_CATALOG_HEIGHT, Math.round(inspectorHeight))
      : undefined;

  return (
    <div className="model-selector">
      <div className="model-selector__providers" role="list">
        {providerChoices.map((choice) => {
          const isActive = choice.value === provider;
          const status = resolveProviderStatusLabel(providerStatuses[choice.value]);
          const unlocked = providerUnlockedMap[choice.value] ?? false;
          return (
            <button
              key={choice.value}
              type="button"
              role="listitem"
              className={`model-selector__provider${
                isActive ? " is-active" : ""
              }${unlocked ? " is-unlocked" : " is-locked"}`}
              disabled={disableProviderSelection}
              onClick={() => handleProviderChange(choice.value)}
            >
              <span className="model-selector__provider-title">
                {choice.title}
              </span>
              <span className="model-selector__provider-subtitle">
                {choice.subtitle}
              </span>
              <span
                className={`model-selector__provider-status model-selector__provider-status--${status.tone}`}
              >
                {status.label}
              </span>
            </button>
          );
        })}
      </div>

      {providerUnlocked ? (
        <div className="model-selector__body">
          <div className="model-selector__catalog">
            <div className="model-selector__section">
              <div className="model-selector__section-header">
                <span className="model-selector__section-title">Model catalog</span>
                <span className="model-selector__section-hint">
                  Featured models appear first when available.
                </span>
              </div>
              <div className="model-selector__filter">
                <input
                  type="search"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Search models"
                  aria-label="Search available models"
                />
                {filter && (
                  <button
                    type="button"
                    className="model-selector__filter-clear"
                    onClick={() => setFilter("")}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div
                className="model-selector__grid"
                style={
                  catalogMaxHeight
                    ? {
                        maxHeight: `${catalogMaxHeight}px`,
                        minHeight: `${MIN_CATALOG_HEIGHT}px`,
                      }
                    : undefined
                }
              >
                {filteredOptions.map((option) => (
                  <ModelCard
                    key={option.value}
                    option={option}
                    active={model === option.value}
                    disabled={!canSelectModels}
                    onSelect={handleModelSelect}
                  />
                ))}
                {filteredOptions.length === 0 && (
                  <div className="model-selector__empty">
                    No models match that search.
                  </div>
                )}
                <CustomModelCard
                  active={isCustomSelection}
                  disabled={!canSelectModels}
                  unlocked={providerUnlocked}
                  onSelect={handleCustomSelect}
                />
              </div>
            </div>
          </div>

          <ModelInspector
            ref={inspectorRef}
            providerLabel={providerLabel}
            modelId={model}
            metadata={metadata}
            customMode={isCustomSelection}
            customModelId={customModeId}
            customConfig={customConfig}
            apiKeyPlaceholder={apiKeyPlaceholder}
            modelPlaceholder={modelPlaceholder}
            providerGuidance={providerGuidance}
            providerCapability={providerCapability}
            customDescription={customDescription}
            onCustomConfigChange={onCustomConfigChange}
            onCustomModelIdChange={onCustomModelIdChange}
          />
        </div>
      ) : (
        <div className="model-selector__locked">
          <div>
            <h3>Verify your {providerLabel} API key</h3>
            <p>
              Enter an API key below and save to browse the {providerLabel} model
              catalog. Verified providers unlock quick switching and model
              insights.
            </p>
          </div>
          <span
            className={`model-selector__locked-status model-selector__locked-status--${statusInfo.tone}`}
          >
            {statusInfo.label}
          </span>
        </div>
      )}
    </div>
  );
}

export default ModelSelector;
export type { ModelSelectorProps };
