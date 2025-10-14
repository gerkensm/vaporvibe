import type { ModelProvider } from "../../types.js";
import { escapeHtml } from "../../utils/html.js";
import {
  DEFAULT_MODEL_BY_PROVIDER,
  PROVIDER_LABELS,
  PROVIDER_REASONING_CAPABILITIES,
} from "../../constants/providers.js";
import {
  CUSTOM_MODEL_DESCRIPTION,
  getModelOptionList,
  renderModelDetailPanel,
  renderModelLineup,
  serializeModelCatalogForClient,
  MODEL_INSPECTOR_STYLES,
} from "./model-inspector.js";

interface ModelSelectorOptions {
  provider: ModelProvider;
  providerLabel: string;
  selectedModel: string;
  selectId: string;
  customInputId: string;
  inputName: string;
  note?: string;
  hint?: string;
}

export function renderModelSelector(options: ModelSelectorOptions): string {
  const {
    provider,
    providerLabel,
    selectedModel,
    selectId,
    customInputId,
    inputName,
    note = "These options are curated defaults. Choose “Custom…” to supply an exact identifier.",
    hint = "Need a specific tier or preview build? Paste the full model identifier here.",
  } = options;
  const defaultModel = DEFAULT_MODEL_BY_PROVIDER[provider] ?? "";
  let initialModel = selectedModel.trim();
  if (!initialModel && defaultModel) {
    initialModel = defaultModel;
  }
  const modelOptions = getModelOptionList(provider, initialModel);
  const hasCuratedChoice = modelOptions.some(
    (option) => option.value === initialModel
  );
  const selectValue = hasCuratedChoice ? initialModel : "__custom";
  const customValue = selectValue === "__custom" ? initialModel : "";
  const detailPanel = renderModelDetailPanel(provider, initialModel);
  const lineupMarkup = renderModelLineup(provider, initialModel);
  const providerLabelText =
    providerLabel || PROVIDER_LABELS[provider] || provider;

  const optionMarkup = modelOptions
    .map((option) => {
      const selectedAttr = selectValue === option.value ? " selected" : "";
      return `<option value="${escapeHtml(
        option.value
      )}"${selectedAttr}>${escapeHtml(option.label)}</option>`;
    })
    .join("\n");

  const customAttributes = selectValue === "__custom" ? "" : " hidden";

  return `<div class="model-selector" data-model-selector data-provider="${escapeHtml(
    provider
  )}" data-provider-label="${escapeHtml(providerLabelText)}">
    <input
      type="hidden"
      name="${escapeHtml(inputName)}"
      value="${escapeHtml(initialModel)}"
      data-model-value
    />
    <label for="${escapeHtml(selectId)}">
      <span data-model-label>Model · ${escapeHtml(providerLabelText)}</span>
    </label>
    <select id="${escapeHtml(selectId)}" data-model-select>
      ${optionMarkup}
      <option value="__custom"${
        selectValue === "__custom" ? " selected" : ""
      }>Custom…</option>
    </select>
    <p class="model-note field-helper">${escapeHtml(note)}</p>
    <div class="model-custom" data-model-custom${customAttributes}>
      <label for="${escapeHtml(
        customInputId
      )}"><span>Custom model identifier</span></label>
      <input
        id="${escapeHtml(customInputId)}"
        type="text"
        inputmode="text"
        spellcheck="false"
        autocomplete="off"
        data-model-custom-input
        value="${escapeHtml(customValue)}"
        placeholder="Enter the exact model ID"
      />
      <p class="model-hint field-helper">${escapeHtml(hint)}</p>
    </div>
    <div class="model-inspector" data-model-inspector>
      <div class="model-inspector__detail" data-model-detail-container>${detailPanel}</div>
      <div class="model-inspector__lineup" data-model-lineup-container>${lineupMarkup}</div>
    </div>
  </div>`;
}

export const MODEL_SELECTOR_STYLES = `
  .model-selector {
    display: grid;
    gap: 12px;
  }
  .model-custom {
    display: grid;
    gap: 12px;
  }
  .model-custom[hidden] {
    display: none;
  }
  .model-note {
    margin: -8px 0 0;
    font-size: 0.85rem;
    color: var(--subtle);
  }
  .model-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--subtle);
  }
`;

export const MODEL_SELECTOR_RUNTIME = `(() => {
  const globalDataKey = "__SERVE_LLM_MODEL_SELECTOR_DATA";
  const controllers = new WeakMap();
  const customModelDescription = ${JSON.stringify(CUSTOM_MODEL_DESCRIPTION)};
  const SCORE_FIELDS = [
    { key: "reasoning", label: "Reasoning", description: "How well the model understands, reasons, and generalizes across complex problems." },
    { key: "codingSkill", label: "Coding skill", description: "How good the model is at writing, understanding, and debugging code." },
    { key: "responsiveness", label: "Responsiveness", description: "How fast and interactive the model feels." },
    { key: "valueForMoney", label: "Value for money", description: "How much overall quality you get per dollar spent." },
  ];
  const CAPABILITY_ICON_MARKUP = {
    reasoning: '<svg class="model-capability__svg" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="4" cy="5" r="2" fill="currentColor"/><circle cx="16" cy="5.5" r="2" fill="currentColor"/><circle cx="10" cy="14.5" r="2.1" fill="currentColor"/><path d="M5.6 6.7 8.9 11m5.3-3.2-3.8 6.2M12.2 4.2l-4 .8" stroke="currentColor" fill="none"/></svg>',
    images: '<svg class="model-capability__svg" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="2.5" y="3.5" width="15" height="11" rx="2" stroke="currentColor" fill="none"/><circle cx="7.3" cy="8" r="1.6" fill="currentColor"/><path d="M5.2 13.3 8.4 10l2.7 2.9 2.1-1.9 2.6 2.3" stroke="currentColor" fill="none"/></svg>',
  };
  const CAPABILITY_FIELDS = [
    {
      key: "reasoning",
      label: "Reasoning",
      descriptions: {
        active: "This model supports structured reasoning modes for deeper analysis.",
        inactive: "This model does not expose structured reasoning support in serve-llm.",
        unknown: "Provide your own model identifier to discover its reasoning support.",
      },
    },
    {
      key: "images",
      label: "Images",
      descriptions: {
        active: "This model accepts image or multimodal inputs.",
        inactive: "Image inputs are not available for this model.",
        unknown: "Custom models may or may not accept images—double-check your provider.",
      },
    },
  ];

  const getArray = (value) => (Array.isArray(value) ? value : []);

  const clamp = (value, min, max) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return min;
    }
    return Math.min(max, Math.max(min, value));
  };

  const formatNumber = (value, options = {}) => {
    try {
      return new Intl.NumberFormat(undefined, options).format(value);
    } catch (error) {
      return String(value);
    }
  };

  const describeCompositeScore = (value) => {
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
  };

  const formatCost = (cost) => {
    if (!cost) {
      return "";
    }
    const parts = [];
    if (typeof cost.input === "number") {
      parts.push("$" + cost.input.toFixed(cost.input >= 1 ? 2 : 3) + " in");
    }
    if (typeof cost.output === "number") {
      parts.push("$" + cost.output.toFixed(cost.output >= 1 ? 2 : 3) + " out");
    }
    if (typeof cost.reasoning === "number") {
      parts.push("$" + cost.reasoning.toFixed(cost.reasoning >= 1 ? 2 : 3) + " reasoning");
    }
    if (!parts.length) {
      return "";
    }
    return parts.join(" · ") + " · " + cost.currency + "/" + cost.unit;
  };

  const setText = (element, text) => {
    if (element instanceof HTMLElement) {
      element.textContent = text || "";
    }
  };

  const renderHighlights = (container, highlights) => {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    container.innerHTML = "";
    if (Array.isArray(highlights) && highlights.length) {
      highlights.forEach((item) => {
        const badge = document.createElement("span");
        badge.className = "model-highlight";
        badge.textContent = item;
        container.appendChild(badge);
        container.appendChild(document.createTextNode(" "));
      });
    } else {
      container.textContent = "—";
    }
  };

  const computeCapabilityStates = (provider, metadata, capabilityMap = {}) => {
    const providerCapabilities = capabilityMap && typeof capabilityMap === "object"
      ? capabilityMap[provider] || {}
      : {};
    const providerSupportsModes = providerCapabilities.mode === true;
    const providerSupportsTokens = providerCapabilities.tokens === true;
    const providerSupportsReasoning = providerSupportsModes || providerSupportsTokens;

    if (!metadata || typeof metadata !== "object") {
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

    const providerTokensAvailable =
      providerSupportsTokens && !tokensExplicitlyDisabled;
    const providerModesAvailable =
      providerSupportsModes && !modeExplicitlyDisabled;

    const hasReasoning = 
      tokensAvailable ||
      modeExplicitlySupported ||
      providerTokensAvailable;

    const reasoningState = hasReasoning
      ? "enabled"
      : tokensExplicitlyDisabled || modeExplicitlyDisabled
        ? "disabled"
        : hasReasoning
          ? "enabled"
          : "disabled";

    const hasImages = Boolean(
      metadata.supportsImageInput || metadata.isMultimodal || metadata.supportsPDFInput,
    );

    return {
      reasoning: reasoningState,
      images: hasImages ? "enabled" : "disabled",
    };
  };

  const renderCapabilities = (container, metadata, provider, data) => {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    container.innerHTML = "";
    const states = computeCapabilityStates(provider, metadata, data.capabilities);
    CAPABILITY_FIELDS.forEach((field) => {
      const state = states[field.key] || "unknown";
      const descKey = metadata ? (state === "enabled" ? "active" : "inactive") : "unknown";
      const title = field.descriptions[descKey];
      const badge = document.createElement("span");
      badge.className =
        "model-capability model-capability--" + state + " model-capability--type-" + field.key;
      badge.title = title;
      badge.setAttribute(
        "aria-label",
        field.label + ": " + (state === "enabled" ? "Available" : metadata ? "Not available" : "Unknown") + ". " + title,
      );
      const badgeIcon = document.createElement("span");
      badgeIcon.className = "model-capability__badge";
      badgeIcon.setAttribute("aria-hidden", "true");
      badgeIcon.innerHTML = CAPABILITY_ICON_MARKUP[field.key];
      const label = document.createElement("span");
      label.className = "model-capability__label";
      label.textContent = field.label;
      badge.appendChild(badgeIcon);
      badge.appendChild(label);
      container.appendChild(badge);
    });
  };

  const renderCompositeScores = (container, scores) => {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    container.innerHTML = "";
    if (!scores) {
      const empty = document.createElement("p");
      empty.className = "model-scores__empty";
      empty.textContent = "Composite scores are available for curated models.";
      container.appendChild(empty);
      return;
    }
  const list = document.createElement("div");
  list.className = "model-score-list";
    SCORE_FIELDS.forEach((field) => {
      const wrapper = document.createElement("div");
      wrapper.className = "model-score";
      wrapper.title = field.description;
      const rawValue = typeof scores[field.key] === "number" ? scores[field.key] : null;
      const safeValue = typeof rawValue === "number" && Number.isFinite(rawValue)
        ? clamp(rawValue, 0, 100)
        : undefined;
      const ratio = typeof safeValue === "number" ? safeValue / 100 : 0;
      const display = rawValue === null || Number.isNaN(rawValue)
        ? "—"
        : (Number.isInteger(rawValue) ? rawValue.toFixed(0) : rawValue.toFixed(2));
      const descriptor = describeCompositeScore(rawValue);
      wrapper.setAttribute(
        "aria-label",
        field.label + ": " + descriptor + " (" + display + " / 100)",
      );
      wrapper.style.setProperty("--score-fill", ratio.toFixed(3));

      const header = document.createElement("div");
      header.className = "model-score__header";
      const label = document.createElement("span");
      label.className = "model-score__label";
      label.textContent = field.label;
      const valueEl = document.createElement("span");
      valueEl.className = "model-score__value";
      valueEl.textContent = display;
      header.appendChild(label);
      header.appendChild(valueEl);
      const meter = document.createElement("div");
      meter.className = "model-score__meter";
      meter.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      fill.className = "model-score__fill";
      meter.appendChild(fill);
      const descriptorEl = document.createElement("span");
      descriptorEl.className = "model-score__descriptor";
      descriptorEl.textContent = descriptor;

      wrapper.appendChild(header);
      wrapper.appendChild(meter);
      wrapper.appendChild(descriptorEl);
      list.appendChild(wrapper);
    });
    container.appendChild(list);
  };

  const updateDetail = (container, provider, value, rawValue, data) => {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    const catalog = getArray(data.catalog[provider]);
    const metadata = catalog.find((item) => item && item.value === value);
    container.innerHTML = "";
    const detail = document.createElement("div");
    detail.className = "model-detail";
    if (metadata) {
      detail.innerHTML = [
        '<div class="model-detail__header">',
        '  <div>',
        '    <h3 data-model-name></h3>',
        '    <p class="model-detail__tagline" data-model-tagline></p>',
        '  </div>',
        '  <div class="model-detail__meta">',
        '    <div class="model-detail__cost" data-model-cost></div>',
        '  </div>',
        '</div>',
        '<p class="model-detail__description" data-model-description></p>',
        '<div class="model-capabilities" data-model-capabilities></div>',
        '<div class="model-scores" data-model-scores></div>',
        '<dl class="model-detail__facts">',
        '  <div><dt>Context window</dt><dd data-model-context></dd></div>',
        '  <div><dt>Recommended for</dt><dd data-model-recommended></dd></div>',
        '  <div><dt>Highlights</dt><dd data-model-highlights></dd></div>',
        '  <div><dt>Release</dt><dd data-model-release></dd></div>',
        '</dl>',
      ].join("");
      setText(detail.querySelector('[data-model-name]'), metadata.label || value);
      setText(detail.querySelector('[data-model-tagline]'), metadata.tagline || "");
      detail.querySelectorAll('[data-model-cost]').forEach((node) => {
        setText(node, formatCost(metadata.cost) || "Cost info coming soon");
      });
      setText(detail.querySelector('[data-model-description]'), metadata.description || "");
      const contextEl = detail.querySelector('[data-model-context]');
      if (contextEl instanceof HTMLElement) {
        if (typeof metadata.contextWindow === "number") {
          const unit = metadata.contextWindowUnit || "tokens";
          contextEl.textContent = metadata.contextWindow.toLocaleString() + " " + unit;
        } else {
          contextEl.textContent = "—";
        }
      }
      setText(detail.querySelector('[data-model-recommended]'), metadata.recommendedFor || "Versatile creative work");
      renderHighlights(detail.querySelector('[data-model-highlights]'), metadata.highlights);
      setText(detail.querySelector('[data-model-release]'), metadata.release || "—");
      renderCapabilities(
        detail.querySelector('[data-model-capabilities]'),
        metadata,
        provider,
        data,
      );
      renderCompositeScores(detail.querySelector('[data-model-scores]'), metadata.compositeScores);
    } else {
      detail.innerHTML = [
        '<div class="model-detail__header">',
        '  <div>',
        '    <h3 data-model-name></h3>',
        '    <p class="model-detail__tagline">Custom model</p>',
        '  </div>',
        '  <div class="model-detail__meta">',
        '    <div class="model-detail__cost" data-model-cost>Cost info coming soon</div>',
        '  </div>',
        '</div>',
        '<p class="model-detail__description" data-model-description></p>',
        '<div class="model-capabilities" data-model-capabilities></div>',
        '<div class="model-scores" data-model-scores></div>',
        '<dl class="model-detail__facts">',
        '  <div><dt>Context window</dt><dd data-model-context>—</dd></div>',
        '  <div><dt>Recommended for</dt><dd data-model-recommended>Define your own sweet spot.</dd></div>',
        '  <div><dt>Highlights</dt><dd data-model-highlights>—</dd></div>',
        '  <div><dt>Cost</dt><dd data-model-cost>Cost info coming soon</dd></div>',
        '</dl>',
      ].join("");
      setText(detail.querySelector('[data-model-name]'), rawValue || value || "Custom model");
      setText(detail.querySelector('[data-model-description]'), customModelDescription);
      detail.querySelectorAll('[data-model-cost]').forEach((node) => {
        setText(node, "Cost info coming soon");
      });
      renderCapabilities(
        detail.querySelector('[data-model-capabilities]'),
        undefined,
        provider,
        data,
      );
      renderCompositeScores(detail.querySelector('[data-model-scores]'), undefined);
    }
    container.appendChild(detail);
  };

  const updateLineup = (container, provider, value, data) => {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    const catalog = getArray(data.catalog[provider]);
    const featured = catalog.filter((item) => item && item.featured);
    container.innerHTML = "";
    if (!featured.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    const title = document.createElement("span");
    title.className = "model-lineup__title";
    title.textContent = "Quick swap";
    const grid = document.createElement("div");
    grid.className = "model-lineup__grid";
    featured.forEach((model) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "model-lineup__button";
      if (model.value === value) {
        button.classList.add("is-active");
      }
      button.dataset.modelChoice = model.value;
      button.dataset.modelChoiceLabel = model.label || model.value;
      const name = document.createElement("span");
      name.className = "model-lineup__name";
      name.textContent = model.label || model.value;
      const tag = document.createElement("span");
      tag.className = "model-lineup__tag";
      tag.textContent = model.tagline || "";
      button.appendChild(name);
      button.appendChild(tag);
      grid.appendChild(button);
    });
    container.appendChild(title);
    container.appendChild(grid);
  };

  const ensureOptions = (selectEl, provider, rawValue, resolvedValue, data) => {
    if (!(selectEl instanceof HTMLSelectElement)) {
      return;
    }
    const catalog = getArray(data.catalog[provider]);
    const fragment = document.createDocumentFragment();
    catalog.forEach((model) => {
      if (!model || typeof model.value !== "string") {
        return;
      }
      const option = document.createElement("option");
      option.value = model.value;
      option.textContent = model.label;
      fragment.appendChild(option);
    });
    const candidate = (rawValue && rawValue.trim()) || resolvedValue || "";
    if (candidate && !catalog.some((model) => model && model.value === candidate)) {
      const option = document.createElement("option");
      option.value = candidate;
      option.textContent = candidate + " (current)";
      fragment.appendChild(option);
    }
    const custom = document.createElement("option");
    custom.value = "__custom";
    custom.textContent = "Custom…";
    fragment.appendChild(custom);
    selectEl.innerHTML = "";
    selectEl.appendChild(fragment);
  };

  const getData = () => {
    const data = window[globalDataKey] || {};
    return {
      catalog: data.catalog || {},
      defaults: data.defaults || {},
      labels: data.labels || {},
      capabilities: data.capabilities || {},
    };
  };
  const init = (root, options = {}) => {
    if (!(root instanceof HTMLElement)) {
      return null;
    }
    if (controllers.has(root)) {
      return controllers.get(root);
    }
    const data = getData();
    const hiddenInput = root.querySelector('[data-model-value]');
    const selectEl = root.querySelector('[data-model-select]');
    const customWrapper = root.querySelector('[data-model-custom]');
    const customInput = root.querySelector('[data-model-custom-input]');
    const detailContainer = root.querySelector('[data-model-detail-container]');
    const lineupContainer = root.querySelector('[data-model-lineup-container]');
    const labelEl = root.querySelector('[data-model-label]');

    let currentProvider =
      typeof options.provider === "string"
        ? options.provider
        : root.dataset.provider || "openai";
    let currentLabel =
      typeof options.providerLabel === "string"
        ? options.providerLabel
        : root.dataset.providerLabel || data.labels[currentProvider] || currentProvider;

    const initialValue =
      typeof options.model === "string"
        ? options.model
        : hiddenInput instanceof HTMLInputElement
        ? hiddenInput.value
        : "";

    let currentResolvedValue = initialValue;
    let currentInputValue = initialValue;

    const setLabel = (label) => {
      if (labelEl instanceof HTMLElement) {
        labelEl.textContent = "Model · " + label;
      }
      root.dataset.providerLabel = label;
    };

    const syncValue = (rawValue, opts = {}) => {
      const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
      const catalog = getArray(data.catalog[currentProvider]);
      const defaults = data.defaults || {};
      const defaultModel =
        typeof defaults[currentProvider] === "string"
          ? defaults[currentProvider]
          : catalog[0] && catalog[0].value
          ? catalog[0].value
          : "";
      const curatedMatch = trimmed && catalog.some((model) => model && model.value === trimmed);
      const resolved =
        curatedMatch || !trimmed ? (curatedMatch ? trimmed : defaultModel) : trimmed;

      ensureOptions(selectEl, currentProvider, trimmed, resolved, data);

      if (selectEl instanceof HTMLSelectElement) {
        if (curatedMatch || (!trimmed && resolved)) {
          selectEl.value = resolved || "";
        } else {
          selectEl.value = "__custom";
        }
      }

      const showCustom =
        selectEl instanceof HTMLSelectElement && selectEl.value === "__custom";
      if (customWrapper instanceof HTMLElement) {
        if (showCustom) {
          customWrapper.removeAttribute("hidden");
        } else {
          customWrapper.setAttribute("hidden", "true");
        }
      }
      if (customInput instanceof HTMLInputElement) {
        if (showCustom) {
          customInput.value = trimmed;
          if (opts.focusCustom) {
            customInput.focus();
            const end = customInput.value.length;
            try {
              customInput.setSelectionRange(end, end);
            } catch (err) {
              /* ignore selection errors */
            }
          }
        } else {
          customInput.value = "";
        }
      }
      if (hiddenInput instanceof HTMLInputElement) {
        hiddenInput.value = resolved || "";
      }
      currentResolvedValue = hiddenInput instanceof HTMLInputElement ? hiddenInput.value : resolved || "";
      const rawForState = trimmed || resolved || "";
      currentInputValue = rawForState;

      updateDetail(detailContainer, currentProvider, currentResolvedValue, currentInputValue, data);
      updateLineup(lineupContainer, currentProvider, currentResolvedValue, data);
    };

    const listeners = new Set();
    const emitChange = () => {
      const state = controller.getState();
      listeners.forEach((listener) => {
        try {
          listener(state);
        } catch (error) {
          console.error(error);
        }
      });
      root.dispatchEvent(
        new CustomEvent("model-selector:change", {
          detail: state,
        }),
      );
    };

    const controller = {
      setProvider(provider, config = {}) {
        currentProvider = provider;
        const label =
          typeof config.providerLabel === "string"
            ? config.providerLabel
            : data.labels[provider] || provider;
        currentLabel = label;
        setLabel(label);
        root.dataset.provider = provider;
        const nextRaw =
          typeof config.model === "string" ? config.model : "";
        syncValue(nextRaw);
        emitChange();
      },
      setValue(value, opts = {}) {
        syncValue(value, opts);
        emitChange();
      },
      getState() {
        return {
          provider: currentProvider,
          value: currentResolvedValue,
          input: currentInputValue,
          providerLabel: currentLabel,
        };
      },
      onChange(listener) {
        if (typeof listener === "function") {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        }
        return () => undefined;
      },
      focus() {
        if (selectEl instanceof HTMLSelectElement) {
          selectEl.focus();
        }
      },
      focusCustom() {
        if (customInput instanceof HTMLInputElement) {
          customInput.focus();
        }
      },
    };

    if (selectEl instanceof HTMLSelectElement) {
      selectEl.addEventListener("change", () => {
        if (selectEl.value === "__custom") {
          syncValue(
            customInput instanceof HTMLInputElement ? customInput.value : "",
            { focusCustom: true },
          );
          emitChange();
        } else {
          syncValue(selectEl.value);
          emitChange();
        }
      });
    }

    if (customInput instanceof HTMLInputElement) {
      const handleInput = () => {
        syncValue(customInput.value);
        emitChange();
      };
      customInput.addEventListener("input", handleInput);
      customInput.addEventListener("change", handleInput);
    }

    if (lineupContainer instanceof HTMLElement) {
      lineupContainer.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) {
          return;
        }
        const button = target.closest('[data-model-choice]');
        if (!(button instanceof HTMLElement)) {
          return;
        }
        event.preventDefault();
        const value = button.dataset.modelChoice || "";
        syncValue(value);
        emitChange();
      });
    }

    setLabel(currentLabel);
    syncValue(initialValue);

    controllers.set(root, controller);
    return controller;
  };

  window.__SERVE_LLM_MODEL_SELECTOR = {
    init,
  };
})();`;

export function renderModelSelectorDataScript(): string {
  const modelCatalogJson = serializeModelCatalogForClient();
  const modelDefaultsJson = JSON.stringify(DEFAULT_MODEL_BY_PROVIDER).replace(
    /</g,
    "\\u003c"
  );
  const providerLabelsJson = JSON.stringify(PROVIDER_LABELS).replace(
    /</g,
    "\\u003c"
  );
  const providerCapabilitiesJson = JSON.stringify(
    PROVIDER_REASONING_CAPABILITIES
  ).replace(/</g, "\\u003c");
  return `<script>
    window.__SERVE_LLM_MODEL_SELECTOR_DATA = {
      catalog: ${modelCatalogJson},
      defaults: ${modelDefaultsJson},
      labels: ${providerLabelsJson},
      capabilities: ${providerCapabilitiesJson},
    };
  </script>`;
}

export { MODEL_INSPECTOR_STYLES };
