import { escapeHtml } from "../../utils/html.js";
import { DEFAULT_MODEL_BY_PROVIDER, PROVIDER_LABELS, } from "../../constants/providers.js";
import { CUSTOM_MODEL_DESCRIPTION, getModelOptionList, renderModelDetailPanel, renderModelLineup, serializeModelCatalogForClient, MODEL_INSPECTOR_STYLES, } from "./model-inspector.js";
export function renderModelSelector(options) {
    const { provider, providerLabel, selectedModel, selectId, customInputId, inputName, note = "These options are curated defaults. Choose “Custom…” to supply an exact identifier.", hint = "Need a specific tier or preview build? Paste the full model identifier here.", } = options;
    const defaultModel = DEFAULT_MODEL_BY_PROVIDER[provider] ?? "";
    let initialModel = selectedModel.trim();
    if (!initialModel && defaultModel) {
        initialModel = defaultModel;
    }
    const modelOptions = getModelOptionList(provider, initialModel);
    const hasCuratedChoice = modelOptions.some((option) => option.value === initialModel);
    const selectValue = hasCuratedChoice ? initialModel : "__custom";
    const customValue = selectValue === "__custom" ? initialModel : "";
    const detailPanel = renderModelDetailPanel(provider, initialModel);
    const lineupMarkup = renderModelLineup(provider, initialModel);
    const providerLabelText = providerLabel || PROVIDER_LABELS[provider] || provider;
    const optionMarkup = modelOptions
        .map((option) => {
        const selectedAttr = selectValue === option.value ? " selected" : "";
        return `<option value="${escapeHtml(option.value)}"${selectedAttr}>${escapeHtml(option.label)}</option>`;
    })
        .join("\n");
    const customAttributes = selectValue === "__custom" ? "" : " hidden";
    return `<div class="model-selector" data-model-selector data-provider="${escapeHtml(provider)}" data-provider-label="${escapeHtml(providerLabelText)}">
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
      <option value="__custom"${selectValue === "__custom" ? " selected" : ""}>Custom…</option>
    </select>
    <p class="model-note field-helper">${escapeHtml(note)}</p>
    <div class="model-custom" data-model-custom${customAttributes}>
      <label for="${escapeHtml(customInputId)}"><span>Custom model identifier</span></label>
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

  const getArray = (value) => (Array.isArray(value) ? value : []);

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
        '  <div class="model-detail__cost" data-model-cost></div>',
        '</div>',
        '<p class="model-detail__description" data-model-description></p>',
        '<dl class="model-detail__facts">',
        '  <div><dt>Context window</dt><dd data-model-context></dd></div>',
        '  <div><dt>Recommended for</dt><dd data-model-recommended></dd></div>',
        '  <div><dt>Highlights</dt><dd data-model-highlights></dd></div>',
        '  <div><dt>Release</dt><dd data-model-release></dd></div>',
        '</dl>',
      ].join("");
      const name = detail.querySelector('[data-model-name]');
      const tagline = detail.querySelector('[data-model-tagline]');
      const description = detail.querySelector('[data-model-description]');
      const context = detail.querySelector('[data-model-context]');
      const recommended = detail.querySelector('[data-model-recommended]');
      const highlights = detail.querySelector('[data-model-highlights]');
      const release = detail.querySelector('[data-model-release]');
      const cost = detail.querySelector('[data-model-cost]');
      if (name) name.textContent = metadata.label || value;
      if (tagline) tagline.textContent = metadata.tagline || "";
      if (description) description.textContent = metadata.description || "";
      if (context) {
        if (typeof metadata.contextWindow === "number") {
          const unit = metadata.contextWindowUnit || "tokens";
          context.textContent = metadata.contextWindow.toLocaleString() + " " + unit;
        } else {
          context.textContent = "—";
        }
      }
      if (recommended) {
        recommended.textContent = metadata.recommendedFor || "Versatile creative work";
      }
      if (highlights) {
        highlights.innerHTML = "";
        if (Array.isArray(metadata.highlights) && metadata.highlights.length) {
          metadata.highlights.forEach((item) => {
            const badge = document.createElement("span");
            badge.className = "model-highlight";
            badge.textContent = item;
            highlights.appendChild(badge);
            highlights.appendChild(document.createTextNode(" "));
          });
        } else {
          highlights.textContent = "—";
        }
      }
      if (release) {
        release.textContent = metadata.release || "—";
      }
      if (cost) {
        cost.textContent = formatCost(metadata.cost) || "Cost info coming soon";
      }
    } else {
      detail.innerHTML = [
        '<div class="model-detail__header">',
        '  <div>',
        '    <h3 data-model-name></h3>',
        '    <p class="model-detail__tagline">Custom model</p>',
        '  </div>',
        '</div>',
        '<p class="model-detail__description" data-model-description></p>',
        '<dl class="model-detail__facts">',
        '  <div><dt>Context window</dt><dd data-model-context>—</dd></div>',
        '  <div><dt>Recommended for</dt><dd data-model-recommended>Define your own sweet spot.</dd></div>',
        '  <div><dt>Highlights</dt><dd data-model-highlights>—</dd></div>',
        '  <div><dt>Cost</dt><dd data-model-cost>Cost info coming soon</dd></div>',
        '</dl>',
      ].join("");
      const name = detail.querySelector('[data-model-name]');
      const description = detail.querySelector('[data-model-description]');
      if (name) name.textContent = rawValue || value || "Custom model";
      if (description) {
        description.textContent = customModelDescription;
      }
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
export function renderModelSelectorDataScript() {
    const modelCatalogJson = serializeModelCatalogForClient();
    const modelDefaultsJson = JSON.stringify(DEFAULT_MODEL_BY_PROVIDER).replace(/</g, "\\u003c");
    const providerLabelsJson = JSON.stringify(PROVIDER_LABELS).replace(/</g, "\\u003c");
    return `<script>
    window.__SERVE_LLM_MODEL_SELECTOR_DATA = {
      catalog: ${modelCatalogJson},
      defaults: ${modelDefaultsJson},
      labels: ${providerLabelsJson},
    };
  </script>`;
}
export { MODEL_INSPECTOR_STYLES };
