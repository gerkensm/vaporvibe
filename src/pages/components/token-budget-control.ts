import { escapeHtml } from "../../utils/html.js";

export interface TokenBudgetControlOptions {
  id: string;
  name: string;
  label: string;
  description: string;
  helper: string;
  value?: number | null;
  defaultValue?: number | null;
  min?: number | null;
  max?: number | null;
  step?: number | null;
  units?: string;
  allowBlank?: boolean;
  sliderEnabled?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  defaultLabel?: string;
  specialLabels?: Record<string, string>;
  accent?: "reasoning" | "output";
  manualPlaceholder?: string;
}

function formatTokenDisplay(value: number | null | undefined, units: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }
  if (!Number.isFinite(value)) {
    return String(value);
  }
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M ${units}`;
  }
  if (abs >= 1000) {
    return `${sign}${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}K ${units}`;
  }
  return `${sign}${abs} ${units}`;
}

function safeNumber(value: number | null | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

export function renderTokenBudgetControl(options: TokenBudgetControlOptions): string {
  const {
    id,
    name,
    label,
    description,
    helper,
    value,
    defaultValue,
    min,
    max,
    step,
    units = "tokens",
    allowBlank = true,
    sliderEnabled = true,
    disabled = false,
    emptyLabel = "Provider default",
    defaultLabel = "Provider default",
    specialLabels = {},
    accent,
    manualPlaceholder = "Enter an exact value",
  } = options;

  const hasDefinedValue = typeof value === "number" && Number.isFinite(value);
  const formValue = hasDefinedValue ? String(Math.floor(value)) : "";
  const sliderMin = safeNumber(min, 0);
  const effectiveDefault = defaultValue ?? null;
  const sliderMaxCandidate = max ?? (effectiveDefault !== null ? effectiveDefault * 2 : sliderMin * 4 || 4096);
  const sliderMax = Math.max(sliderMaxCandidate, sliderMin > 0 ? sliderMin : 1);
  const sliderStep = safeNumber(step, 1);
  const sliderValue = hasDefinedValue
    ? Math.min(Math.max(Math.floor(value!), sliderMin), sliderMax)
    : effectiveDefault !== null
    ? Math.min(Math.max(Math.floor(effectiveDefault), sliderMin), sliderMax)
    : sliderMin;

  const accentClass = accent ? ` token-budget--${accent}` : "";

  const badgeInitialLabel = (() => {
    if (hasDefinedValue) {
      const key = String(Math.floor(value!));
      if (Object.prototype.hasOwnProperty.call(specialLabels, key)) {
        return specialLabels[key];
      }
      return formatTokenDisplay(Math.floor(value!), units);
    }
    if (effectiveDefault !== null) {
      const defaultKey = String(Math.floor(effectiveDefault));
      if (Object.prototype.hasOwnProperty.call(specialLabels, defaultKey)) {
        return `${specialLabels[defaultKey]} · ${defaultLabel}`;
      }
      return `${formatTokenDisplay(Math.floor(effectiveDefault), units)} · ${defaultLabel}`;
    }
    return emptyLabel;
  })();

  const specialLabelEntries = Object.entries(specialLabels).map(
    ([key, val]) => `\"${escapeHtml(key)}\":\"${escapeHtml(val)}\"`,
  );
  const specialLabelsJson = `{${specialLabelEntries.join(",")}}`;

  return `<div
    class="token-budget${accentClass}"
    data-token-control="${escapeHtml(name)}"
    data-token-units="${escapeHtml(units)}"
    data-token-allow-blank="${allowBlank ? "true" : "false"}"
    data-token-slider-enabled="${sliderEnabled ? "true" : "false"}"
    data-token-disabled="${disabled ? "true" : "false"}"
    data-token-default="${
      effectiveDefault !== null && effectiveDefault !== undefined
        ? escapeHtml(String(Math.floor(effectiveDefault)))
        : ""
    }"
    data-token-min="${escapeHtml(String(sliderMin))}"
    data-token-max="${escapeHtml(String(sliderMax))}"
    data-token-step="${escapeHtml(String(sliderStep))}"
    data-token-empty-label="${escapeHtml(emptyLabel)}"
    data-token-default-label="${escapeHtml(defaultLabel)}"
    data-token-special-labels='${specialLabelsJson}'
  >
    <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(formValue)}" data-token-hidden />
    <div class="token-budget__header">
      <div>
        <label class="token-budget__label" for="${escapeHtml(id)}">${escapeHtml(label)}</label>
        <p class="token-budget__description" data-token-description>${escapeHtml(description)}</p>
      </div>
      <span class="token-budget__badge" data-token-badge>${escapeHtml(badgeInitialLabel)}</span>
    </div>
    <div class="token-budget__slider" data-token-slider-section>
      <input
        id="${escapeHtml(id)}"
        type="range"
        class="token-budget__range"
        data-token-slider
        min="${escapeHtml(String(sliderMin))}"
        max="${escapeHtml(String(sliderMax))}"
        step="${escapeHtml(String(sliderStep))}"
        value="${escapeHtml(String(sliderValue))}"
        ${sliderEnabled && !disabled ? "" : "disabled"}
      />
      <div class="token-budget__scale" data-token-scale>
        <span data-token-min-label>Min · ${escapeHtml(formatTokenDisplay(sliderMin, units))}</span>
        <span data-token-max-label>Max · ${escapeHtml(formatTokenDisplay(sliderMax, units))}</span>
      </div>
    </div>
    <div class="token-budget__manual">
      <label class="token-budget__manual-label" for="${escapeHtml(id)}-manual">Manual override</label>
      <div class="token-budget__manual-row">
        <input
          id="${escapeHtml(id)}-manual"
          type="number"
          inputmode="numeric"
          class="token-budget__manual-input"
          data-token-manual
          value="${escapeHtml(formValue)}"
          placeholder="${escapeHtml(manualPlaceholder)}"
          ${disabled ? "disabled" : ""}
        />
        <span class="token-budget__unit">${escapeHtml(units)}</span>
        <button type="button" class="token-budget__reset" data-token-reset>Use default</button>
      </div>
      <p class="token-budget__helper" data-token-helper>${escapeHtml(helper)}</p>
      <p class="token-budget__status" data-token-status hidden></p>
    </div>
  </div>`;
}

export const TOKEN_BUDGET_STYLES = `
  .token-budget {
    border-radius: 20px;
    border: 1px solid var(--border);
    padding: 18px;
    background: var(--surface-muted, rgba(255, 255, 255, 0.85));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
    display: grid;
    gap: 16px;
    position: relative;
  }
  .token-budget--reasoning {
    border-color: rgba(99, 102, 241, 0.32);
    background: linear-gradient(180deg, rgba(238, 242, 255, 0.7) 0%, rgba(224, 231, 255, 0.45) 100%);
  }
  .token-budget--output {
    border-color: rgba(14, 165, 233, 0.28);
    background: linear-gradient(180deg, rgba(219, 234, 254, 0.65) 0%, rgba(191, 219, 254, 0.38) 100%);
  }
  .token-budget__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  .token-budget__label {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text);
    display: block;
    margin: 0 0 6px;
  }
  .token-budget__description {
    margin: 0;
    color: var(--muted);
    font-size: 0.88rem;
    max-width: 46ch;
  }
  .token-budget__badge {
    background: rgba(30, 64, 175, 0.1);
    color: rgba(30, 64, 175, 0.8);
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .token-budget__slider {
    display: grid;
    gap: 8px;
  }
  .token-budget__range {
    width: 100%;
    accent-color: var(--accent);
  }
  .token-budget__scale {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--subtle);
  }
  .token-budget__manual {
    display: grid;
    gap: 10px;
  }
  .token-budget__manual-label {
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--muted);
  }
  .token-budget__manual-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
  }
  .token-budget__manual-input {
    border-radius: 12px;
    border: 1px solid var(--border);
    padding: 10px 12px;
    font: inherit;
    background: var(--surface, #fff);
  }
  .token-budget__manual-input:focus-visible {
    outline: 3px solid var(--accent-ring, rgba(59, 130, 246, 0.25));
    outline-offset: 1px;
  }
  .token-budget__unit {
    font-size: 0.8rem;
    color: var(--subtle);
    font-weight: 500;
  }
  .token-budget__reset {
    border: 1px solid transparent;
    border-radius: 12px;
    background: rgba(59, 130, 246, 0.12);
    color: var(--accent, #1d4ed8);
    font-size: 0.78rem;
    font-weight: 600;
    padding: 8px 12px;
    cursor: pointer;
  }
  .token-budget__reset:hover {
    background: rgba(59, 130, 246, 0.18);
  }
  .token-budget__helper {
    margin: 0;
    color: var(--subtle);
    font-size: 0.82rem;
  }
  .token-budget__status {
    margin: 0;
    font-size: 0.78rem;
    color: var(--accent);
  }
  .token-budget[data-slider-disabled="true"] .token-budget__slider {
    opacity: 0.45;
    pointer-events: none;
  }
  .token-budget[data-disabled="true"] {
    opacity: 0.65;
  }
  .token-budget[data-slider-outside="true"] .token-budget__badge {
    background: rgba(185, 28, 28, 0.14);
    color: rgba(153, 27, 27, 0.85);
  }
`;

export const TOKEN_BUDGET_RUNTIME = `(() => {
  const controllers = new WeakMap();

  const formatTokenDisplay = (value, units, specialLabels, defaultLabel, emptyLabel, hasValue) => {
    if (typeof value === "string" && value.trim() === "") {
      return emptyLabel;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      if (typeof value === "string" && value.trim()) {
        const key = value.trim();
        if (Object.prototype.hasOwnProperty.call(specialLabels, key)) {
          return specialLabels[key];
        }
        return value.trim();
      }
      return emptyLabel;
    }
    const key = String(Math.floor(numeric));
    if (Object.prototype.hasOwnProperty.call(specialLabels, key)) {
      return specialLabels[key];
    }
    const abs = Math.abs(numeric);
    const sign = numeric < 0 ? "-" : "";
    if (abs >= 1_000_000) {
      return sign + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + "M " + units;
    }
    if (abs >= 1000) {
      return sign + (abs / 1000).toFixed(abs >= 10_000 ? 0 : 1) + "K " + units;
    }
    if (!hasValue) {
      return emptyLabel;
    }
    return sign + Math.floor(abs) + " " + units;
  };

  const clamp = (value, min, max) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return value;
    }
    if (typeof min === "number" && value < min) {
      return min;
    }
    if (typeof max === "number" && value > max) {
      return max;
    }
    return value;
  };

  const computeStep = (min, max, fallback) => {
    if (typeof min !== "number" || Number.isNaN(min) || typeof max !== "number" || Number.isNaN(max)) {
      return fallback;
    }
    const span = Math.max(max - min, 1);
    const rough = span / 200;
    if (rough <= 1) {
      return 1;
    }
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    let step = pow;
    for (const base of [1, 2, 5]) {
      const candidate = base * pow;
      if (candidate >= rough) {
        step = candidate;
        break;
      }
    }
    if (step < rough) {
      step = 10 * pow;
    }
    return Math.max(1, Math.round(step));
  };

  const parseSpecialLabels = (root) => {
    const raw = root.getAttribute("data-token-special-labels");
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn("Failed to parse special labels", error);
      return {};
    }
  };

  const init = (root, config = {}) => {
    if (!(root instanceof HTMLElement)) {
      return null;
    }
    if (controllers.has(root)) {
      const existing = controllers.get(root);
      if (config && typeof config === "object") {
        existing.configure(config);
      }
      return existing;
    }

    const hiddenInput = root.querySelector("[data-token-hidden]");
    const slider = root.querySelector("[data-token-slider]");
    const manualInput = root.querySelector("[data-token-manual]");
    const badge = root.querySelector("[data-token-badge]");
    const helper = root.querySelector("[data-token-helper]");
    const description = root.querySelector("[data-token-description]");
    const status = root.querySelector("[data-token-status]");
    const minLabel = root.querySelector("[data-token-min-label]");
    const maxLabel = root.querySelector("[data-token-max-label]");

    const state = {
      allowBlank: root.getAttribute("data-token-allow-blank") === "true",
      sliderEnabled: root.getAttribute("data-token-slider-enabled") !== "false",
      disabled: root.getAttribute("data-token-disabled") === "true",
      units: root.getAttribute("data-token-units") || "tokens",
      emptyLabel: root.getAttribute("data-token-empty-label") || "Provider default",
      defaultLabel: root.getAttribute("data-token-default-label") || "Provider default",
      defaultValue: root.getAttribute("data-token-default") || "",
      min: Number(root.getAttribute("data-token-min") || "0"),
      max: Number(root.getAttribute("data-token-max") || "0"),
      step: Number(root.getAttribute("data-token-step") || "1"),
      specialLabels: parseSpecialLabels(root),
      value: hiddenInput instanceof HTMLInputElement ? hiddenInput.value : "",
      manualPlaceholder: manualInput instanceof HTMLInputElement ? manualInput.placeholder : "",
    };

    const listeners = new Set();

    const emit = (detail) => {
      listeners.forEach((listener) => {
        try {
          listener(detail);
        } catch (error) {
          console.error(error);
        }
      });
      root.dispatchEvent(
        new CustomEvent("token-control:change", {
          detail,
        }),
      );
    };

    const formatBadge = (rawValue) => {
      const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
      const hasValue = trimmed.length > 0;
      if (!hasValue) {
        const defaultValue = state.defaultValue;
        if (defaultValue) {
          const formattedDefault = formatTokenDisplay(defaultValue, state.units, state.specialLabels, state.defaultLabel, state.emptyLabel, true);
          return formattedDefault + " · " + state.defaultLabel;
        }
        return state.emptyLabel;
      }
      return formatTokenDisplay(trimmed, state.units, state.specialLabels, state.defaultLabel, state.emptyLabel, true);
    };

    const updateSliderRange = () => {
      if (!(slider instanceof HTMLInputElement)) {
        return;
      }
      const step = state.step || 1;
      slider.min = String(state.min);
      slider.max = String(state.max);
      slider.step = String(step);
      const currentNumeric = Number(slider.value);
      if (!Number.isFinite(currentNumeric)) {
        const candidate = Number(state.defaultValue || state.min || 0);
        slider.value = String(candidate);
      } else {
        const next = clamp(currentNumeric, state.min, state.max);
        slider.value = String(next);
      }
      if (minLabel instanceof HTMLElement) {
        minLabel.textContent =
          "Min · " +
          formatTokenDisplay(
            state.min,
            state.units,
            {},
            state.defaultLabel,
            state.emptyLabel,
            true,
          );
      }
      if (maxLabel instanceof HTMLElement) {
        maxLabel.textContent =
          "Max · " +
          formatTokenDisplay(
            state.max,
            state.units,
            {},
            state.defaultLabel,
            state.emptyLabel,
            true,
          );
      }
    };

    const applyValue = (rawValue, source) => {
      let normalized = typeof rawValue === "string" ? rawValue.trim() : "";
      if (!state.allowBlank && !normalized) {
        normalized = state.defaultValue || String(state.min);
      }
      const treatAsBlank = normalized === "" && state.allowBlank;
      const numeric = normalized === "" ? Number.NaN : Number(normalized);
      let sliderInRange = true;
      let sliderNumeric = Number.NaN;
      if (slider instanceof HTMLInputElement) {
        if (Number.isFinite(numeric)) {
          sliderNumeric = clamp(numeric, state.min, state.max);
          slider.value = String(sliderNumeric);
          sliderInRange = sliderNumeric === numeric;
        } else {
          const fallback = Number(state.defaultValue || state.min || 0);
          sliderNumeric = clamp(fallback, state.min, state.max);
          slider.value = String(sliderNumeric);
          sliderInRange = treatAsBlank;
        }
      }
      let finalValue = normalized;
      if (!treatAsBlank && Number.isFinite(sliderNumeric) && !sliderInRange) {
        finalValue = String(Math.floor(sliderNumeric));
      }
      if (hiddenInput instanceof HTMLInputElement) {
        hiddenInput.value = finalValue;
      }
      if (manualInput instanceof HTMLInputElement) {
        manualInput.value = finalValue;
      }
      if (badge instanceof HTMLElement) {
        badge.textContent = formatBadge(finalValue);
      }
      const sliderOutside = !sliderInRange && !treatAsBlank;
      root.dataset.sliderOutside = sliderOutside ? "true" : "false";
      state.value = finalValue;
      const emittedNumeric = Number(finalValue);
      emit({
        raw: finalValue,
        numeric: Number.isFinite(emittedNumeric) ? emittedNumeric : null,
        isBlank: finalValue === "",
        source: source || "api",
        withinSlider: sliderOutside ? false : true,
      });
    };

    const configure = (nextConfig = {}) => {
      if (typeof nextConfig !== "object" || nextConfig === null) {
        return;
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "allowBlank")) {
        state.allowBlank = Boolean(nextConfig.allowBlank);
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "sliderEnabled")) {
        state.sliderEnabled = Boolean(nextConfig.sliderEnabled);
        root.dataset.sliderDisabled = state.sliderEnabled ? "false" : "true";
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "disabled")) {
        state.disabled = Boolean(nextConfig.disabled);
        root.dataset.disabled = state.disabled ? "true" : "false";
        if (manualInput instanceof HTMLInputElement) {
          manualInput.disabled = state.disabled;
        }
        if (slider instanceof HTMLInputElement) {
          slider.disabled = state.disabled || !state.sliderEnabled;
        }
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "units")) {
        state.units = String(nextConfig.units);
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "emptyLabel")) {
        state.emptyLabel = String(nextConfig.emptyLabel);
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "defaultLabel")) {
        state.defaultLabel = String(nextConfig.defaultLabel);
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "defaultValue")) {
        state.defaultValue = nextConfig.defaultValue === null ? "" : String(nextConfig.defaultValue);
        root.setAttribute("data-token-default", state.defaultValue);
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "min")) {
        const min = Number(nextConfig.min);
        if (Number.isFinite(min)) {
          state.min = min;
          root.setAttribute("data-token-min", String(state.min));
        }
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "max")) {
        const max = Number(nextConfig.max);
        if (Number.isFinite(max)) {
          state.max = max;
          root.setAttribute("data-token-max", String(state.max));
        }
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "step")) {
        const step = Number(nextConfig.step);
        if (Number.isFinite(step) && step > 0) {
          state.step = step;
          root.setAttribute("data-token-step", String(state.step));
        }
      } else if (nextConfig.autoStep) {
        const computed = computeStep(state.min, state.max, state.step || 1);
        state.step = computed;
        root.setAttribute("data-token-step", String(state.step));
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "specialLabels")) {
        try {
          state.specialLabels = { ...state.specialLabels, ...nextConfig.specialLabels };
        } catch (err) {
          console.warn("Failed updating special labels", err);
        }
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "helper")) {
        if (helper instanceof HTMLElement) {
          helper.textContent = String(nextConfig.helper || "");
        }
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "description")) {
        if (description instanceof HTMLElement) {
          description.textContent = String(nextConfig.description || "");
        }
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "status")) {
        if (status instanceof HTMLElement) {
          const message = String(nextConfig.status || "").trim();
          if (message) {
            status.hidden = false;
            status.textContent = message;
          } else {
            status.hidden = true;
            status.textContent = "";
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, "manualPlaceholder")) {
        if (manualInput instanceof HTMLInputElement) {
          manualInput.placeholder = String(nextConfig.manualPlaceholder);
        }
      }
      updateSliderRange();
      if (Object.prototype.hasOwnProperty.call(nextConfig, "value")) {
        applyValue(nextConfig.value, "configure");
      } else {
        applyValue(state.value, "configure");
      }
    };

    if (slider instanceof HTMLInputElement) {
      slider.addEventListener("input", () => {
        if (slider.disabled) {
          return;
        }
        const numeric = Number(slider.value);
        if (Number.isFinite(numeric)) {
          applyValue(String(Math.floor(numeric)), "slider");
        }
      });
    }

    if (manualInput instanceof HTMLInputElement) {
      const handleManual = () => {
        if (manualInput.disabled) {
          return;
        }
        applyValue(manualInput.value, "manual");
      };
      manualInput.addEventListener("input", handleManual);
      manualInput.addEventListener("change", handleManual);
    }

    const resetButton = root.querySelector("[data-token-reset]");
    if (resetButton instanceof HTMLButtonElement) {
      resetButton.addEventListener("click", (event) => {
        event.preventDefault();
        applyValue(state.defaultValue || "", "reset");
      });
    }

    if (state.disabled) {
      if (slider instanceof HTMLInputElement) {
        slider.disabled = true;
      }
      if (manualInput instanceof HTMLInputElement) {
        manualInput.disabled = true;
      }
    }

    updateSliderRange();
    applyValue(state.value, "init");

    const controller = {
      configure,
      getState() {
        const numeric = Number(state.value);
        return {
          raw: state.value,
          numeric: Number.isFinite(numeric) ? numeric : null,
          isBlank: !state.value,
          withinSlider:
            slider instanceof HTMLInputElement
              ? Number(slider.value) === clamp(Number(state.value), state.min, state.max)
              : true,
        };
      },
      setValue(value) {
        applyValue(value, "api");
      },
      onChange(listener) {
        if (typeof listener === "function") {
          listeners.add(listener);
          return () => listeners.delete(listener);
        }
        return () => undefined;
      },
    };

    controllers.set(root, controller);
    if (config && typeof config === "object") {
      controller.configure(config);
    }
    return controller;
  };

  const autoInit = () => {
    const nodes = document.querySelectorAll("[data-token-control]");
    nodes.forEach((node) => {
      init(node);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }

  window.__SERVE_LLM_TOKEN_CONTROL = { init };
})();`;
