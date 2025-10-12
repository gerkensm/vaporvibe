import type { ModelProvider } from "../../types.js";
import { escapeHtml } from "../../utils/html.js";
import {
  DEFAULT_MODEL_BY_PROVIDER,
  PROVIDER_LABELS,
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
    (option) => option.value === initialModel,
  );
  const selectValue = hasCuratedChoice ? initialModel : "__custom";
  const customValue = selectValue === "__custom" ? initialModel : "";
  const detailPanel = renderModelDetailPanel(provider, initialModel);
  const lineupMarkup = renderModelLineup(provider, initialModel);
  const providerLabelText = providerLabel || PROVIDER_LABELS[provider] || provider;

  const optionMarkup = modelOptions
    .map((option) => {
      const selectedAttr =
        selectValue === option.value ? " selected" : "";
      return `<option value="${escapeHtml(option.value)}"${selectedAttr}>${escapeHtml(
        option.label,
      )}</option>`;
    })
    .join("\n");

  const customAttributes = selectValue === "__custom" ? "" : " hidden";

  return `<div class="model-selector" data-model-selector data-provider="${escapeHtml(
    provider,
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

  const BENCHMARK_GROUPS = [
    {
      key: "analysis",
      label: "Complex planning",
      description:
        "Breaks down strategy, research, or operations briefs into confident next steps.",
      metrics: [
        "artificialAnalysisIntelligenceIndex",
        "terminalBenchHard",
        "telecomBench",
        "aaLcr",
      ],
    },
    {
      key: "knowledge",
      label: "Expert knowledge",
      description:
        "Answers advanced academic and professional questions without hand-holding.",
      metrics: ["humanitysLastExam", "mmluPro", "gpqaDiamond"],
    },
    {
      key: "automation",
      label: "Coding & automation",
      description:
        "Builds working code, notebooks, and workflow automations that actually run.",
      metrics: ["liveCodeBench", "sciCode", "humanEval", "ifBench"],
    },
    {
      key: "math",
      label: "Math & logic",
      description: "Solves contest-level math and logic puzzles without getting lost.",
      metrics: ["aime2025", "aime2024", "math500"],
    },
  ];

  const METRIC_TO_GROUP = {};
  BENCHMARK_GROUPS.forEach((group) => {
    group.metrics.forEach((metricKey) => {
      METRIC_TO_GROUP[metricKey] = group;
    });
  });

  const GLOSSARY_CATEGORY_DESCRIPTIONS = {
    "Streaming speed":
      "How quickly tokens flow once the model hits its stride.",
    "Response timing":
      "When the first chunk and full answer usually arrive.",
    Pricing: "Blended cost estimates pulled from provider pricing sheets.",
    "Other insights":
      "Extra catalog metrics that round out the performance story.",
  };

  const METRIC_CONFIG = {
    artificialAnalysisIntelligenceIndex: {
      label: "AAI Index",
      description: "Checks how polished the model's long-form analysis and writing feel.",
      direction: "higher",
      format: "score",
    },
    terminalBenchHard: {
      label: "Terminal tasks",
      description: "Measures success on tricky real-world command line jobs.",
      direction: "higher",
      format: "percent",
    },
    telecomBench: {
      label: "Telecom troubleshooting",
      description: "Replicates customer-support style problem solving across industries.",
      direction: "higher",
      format: "percent",
    },
    aaLcr: {
      label: "Instruction follow-through",
      description: "Tests how carefully the model sticks to multi-step instructions.",
      direction: "higher",
      format: "percent",
    },
    humanitysLastExam: {
      label: "Humanity's Last Exam",
      description: "A mashup of advanced academic questions to stress-test reasoning.",
      direction: "higher",
      format: "percent",
    },
    mmluPro: {
      label: "Graduate knowledge",
      description: "Graduate-level multiple choice questions across dozens of subjects.",
      direction: "higher",
      format: "percent",
    },
    gpqaDiamond: {
      label: "GPQA Diamond",
      description: "Deep science and engineering questions that require expert recall.",
      direction: "higher",
      format: "percent",
    },
    liveCodeBench: {
      label: "Live coding",
      description: "Interactive coding sessions that are automatically executed.",
      direction: "higher",
      format: "percent",
    },
    sciCode: {
      label: "SciCode",
      description: "Automates scientific notebooks and data analysis steps.",
      direction: "higher",
      format: "percent",
    },
    ifBench: {
      label: "Automation workflows",
      description: "Builds spreadsheet and operations automations without human edits.",
      direction: "higher",
      format: "percent",
    },
    aime2025: {
      label: "AIME 2025",
      description: "Recent contest math problems that demand creative reasoning.",
      direction: "higher",
      format: "percent",
    },
    aime2024: {
      label: "AIME 2024",
      description: "Another slice of competition math to gauge fresh reasoning gains.",
      direction: "higher",
      format: "percent",
    },
    math500: {
      label: "Math 500",
      description: "A grab bag of olympiad-style math questions.",
      direction: "higher",
      format: "percent",
    },
    humanEval: {
      label: "HumanEval",
      description: "Classic coding challenges such as writing small utility functions.",
      direction: "higher",
      format: "percent",
    },
    blendedCostUsdPer1MTokens: {
      label: "Blended cost",
      description: "Estimated spend for one million mixed prompt and response tokens.",
      direction: "lower",
      format: "usd",
      suffix: " per 1M tokens",
    },
    "throughput.medianTokensPerSecond": {
      label: "Streaming speed · median",
      description: "How quickly tokens stream once the answer is flowing.",
      direction: "higher",
      format: "tokens",
    },
    "throughput.p25TokensPerSecond": {
      label: "Streaming speed · steady",
      description: "A typical slower-but-steady pace (25th percentile).",
      direction: "higher",
      format: "tokens",
    },
    "throughput.p75TokensPerSecond": {
      label: "Streaming speed · brisk",
      description: "A typical brisk pace (75th percentile).",
      direction: "higher",
      format: "tokens",
    },
    "throughput.p5TokensPerSecond": {
      label: "Streaming speed · slowest runs",
      description: "The slowest outlier runs you might encounter (5th percentile).",
      direction: "higher",
      format: "tokens",
    },
    "throughput.p95TokensPerSecond": {
      label: "Streaming speed · fastest runs",
      description: "The fastest outlier runs when everything clicks (95th percentile).",
      direction: "higher",
      format: "tokens",
    },
    "latency.firstAnswerChunkSeconds": {
      label: "Time to first words · median",
      description: "How long you usually wait before anything appears on screen.",
      direction: "lower",
      format: "seconds",
    },
    "latency.firstAnswerTokenSeconds": {
      label: "Time to first token",
      description: "Time until the very first token starts streaming.",
      direction: "lower",
      format: "seconds",
    },
    "latency.p25FirstChunkSeconds": {
      label: "Time to first words · quick runs",
      description: "A faster-than-average wait before words appear (25th percentile).",
      direction: "lower",
      format: "seconds",
    },
    "latency.p75FirstChunkSeconds": {
      label: "Time to first words · slower runs",
      description: "A slower-than-average wait before words appear (75th percentile).",
      direction: "lower",
      format: "seconds",
    },
    "latency.p5FirstChunkSeconds": {
      label: "Time to first words · best case",
      description: "The quickest cases before words appear (5th percentile).",
      direction: "lower",
      format: "seconds",
    },
    "latency.p95FirstChunkSeconds": {
      label: "Time to first words · slowest case",
      description: "The longest you might wait before streaming begins (95th percentile).",
      direction: "lower",
      format: "seconds",
    },
    "latency.totalResponseSeconds": {
      label: "Total response time",
      description: "How long a complete answer usually takes from send to finish.",
      direction: "lower",
      format: "seconds",
    },
    "latency.reasoningTimeSeconds": {
      label: "Quiet reasoning time",
      description: "Average silent planning time before words start appearing.",
      direction: "lower",
      format: "seconds",
    },
  };

  let cachedInsightData = null;

  const computeInsightData = (catalog) => {
    const ranges = {};
    Object.keys(METRIC_CONFIG).forEach((key) => {
      ranges[key] = { min: null, max: null };
    });
    const allModels = [];
    Object.keys(catalog || {}).forEach((providerKey) => {
      const list = getArray(catalog[providerKey]);
      list.forEach((model) => {
        if (model && typeof model === "object") {
          allModels.push(model);
        }
      });
    });
    allModels.forEach((model) => {
      const benchmarks = model && model.benchmarks;
      Object.keys(METRIC_CONFIG).forEach((metricKey) => {
        const value = getMetricValue(benchmarks, metricKey);
        if (typeof value === "number" && Number.isFinite(value)) {
          const record = ranges[metricKey];
          if (record.min === null || value < record.min) {
            record.min = value;
          }
          if (record.max === null || value > record.max) {
            record.max = value;
          }
        }
      });
    });
    const groupStats = {};
    BENCHMARK_GROUPS.forEach((group) => {
      groupStats[group.key] = { min: null, max: null };
    });
    allModels.forEach((model) => {
      const benchmarks = model && model.benchmarks;
      BENCHMARK_GROUPS.forEach((group) => {
        const scores = group.metrics
          .map((metricKey) => normalizeMetric(metricKey, getMetricValue(benchmarks, metricKey), ranges))
          .filter((value) => typeof value === "number");
        if (!scores.length) {
          return;
        }
        const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
        const stat = groupStats[group.key];
        if (stat.min === null || avg < stat.min) {
          stat.min = avg;
        }
        if (stat.max === null || avg > stat.max) {
          stat.max = avg;
        }
      });
    });
    return { ranges, groupStats };
  };

  const getInsightData = (data) => {
    if (!cachedInsightData) {
      cachedInsightData = computeInsightData(data.catalog || {});
    }
    return cachedInsightData;
  };

  const getMetricValue = (benchmarks, key) => {
    if (!benchmarks || typeof benchmarks !== "object") {
      return null;
    }
    if (key.startsWith("throughput.")) {
      const parts = key.split(".");
      const prop = parts[1];
      const throughput = benchmarks.throughput || {};
      return typeof throughput[prop] === "number" ? throughput[prop] : null;
    }
    if (key.startsWith("latency.")) {
      const parts = key.split(".");
      const prop = parts[1];
      const latency = benchmarks.latency || {};
      return typeof latency[prop] === "number" ? latency[prop] : null;
    }
    const value = benchmarks[key];
    return typeof value === "number" ? value : null;
  };

  const getRangePosition = (key, rawValue, ranges) => {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return null;
    }
    const record = ranges[key];
    if (!record || record.min === null || record.max === null) {
      return null;
    }
    if (record.max === record.min) {
      return 1;
    }
    const relative = (rawValue - record.min) / (record.max - record.min);
    return Math.min(1, Math.max(0, relative));
  };

  const normalizeMetric = (key, rawValue, ranges) => {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return null;
    }
    const record = ranges[key];
    if (!record || record.min === null || record.max === null) {
      return null;
    }
    if (record.max === record.min) {
      return 1;
    }
    const config = METRIC_CONFIG[key] || {};
    const relative = (rawValue - record.min) / (record.max - record.min);
    const clamped = Math.min(1, Math.max(0, relative));
    return config.direction === "lower" ? 1 - clamped : clamped;
  };

  const formatNumber = (value, options) => {
    return new Intl.NumberFormat(undefined, options).format(value);
  };

  const formatPercent = (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—";
    }
    const percent = value * 100;
    const digits = percent >= 10 ? 0 : 1;
    const formatted = formatNumber(percent, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    return formatted + "%";
  };

  const formatSeconds = (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—";
    }
    if (value >= 90) {
      let minutes = Math.floor(value / 60);
      let seconds = Math.round(value % 60);
      if (seconds === 60) {
        minutes += 1;
        seconds = 0;
      }
      const parts = [];
      parts.push(minutes + "m");
      if (seconds > 0) {
        parts.push(seconds + "s");
      }
      return parts.join(" ");
    }
    if (value >= 10) {
      return Math.round(value) + "s";
    }
    const precise = Number(value.toFixed(1));
    return precise + "s";
  };

  const formatTokens = (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—";
    }
    const digits = value >= 10 ? 0 : 1;
    const formatted = formatNumber(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
    return formatted + " tok/s";
  };

  const formatTokensRange = (min, max) => {
    if (typeof min !== "number" || typeof max !== "number") {
      return "—";
    }
    const minText = formatTokens(min);
    const maxText = formatTokens(max);
    if (minText.endsWith("tok/s") && maxText.endsWith("tok/s")) {
      return minText.replace(" tok/s", "") + "–" + maxText;
    }
    return minText + " – " + maxText;
  };

  const formatUsd = (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—";
    }
    const digits = value >= 1 ? 2 : 3;
    return "$" + formatNumber(value, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };

  const formatMetricValue = (key, value) => {
    const config = METRIC_CONFIG[key] || {};
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—";
    }
    let base = "";
    switch (config.format) {
      case "percent":
        base = formatPercent(value);
        break;
      case "tokens":
        base = formatTokens(value);
        break;
      case "seconds":
        base = formatSeconds(value);
        break;
      case "usd":
        base = formatUsd(value);
        break;
      case "score":
        base = formatNumber(value, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
        break;
      default:
        base = formatNumber(value, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
        break;
    }
    if (config.suffix) {
      return base + config.suffix;
    }
    return base;
  };

  const formatMetricRange = (key, range) => {
    if (!range || range.min === null || range.max === null) {
      return null;
    }
    const minText = formatMetricValue(key, range.min);
    const maxText = formatMetricValue(key, range.max);
    if (minText === "—" || maxText === "—") {
      return null;
    }
    if (minText === maxText) {
      return minText;
    }
    return minText + " – " + maxText;
  };

  const formatOrdinal = (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    const rounded = Math.round(value);
    const remainder = rounded % 100;
    if (remainder >= 11 && remainder <= 13) {
      return rounded + "th";
    }
    switch (rounded % 10) {
      case 1:
        return rounded + "st";
      case 2:
        return rounded + "nd";
      case 3:
        return rounded + "rd";
      default:
        return rounded + "th";
    }
  };

  const describeScore = (score) => {
    const percentile = Math.round(score * 100);
    let label = "Early days";
    if (percentile >= 85) {
      label = "Top tier";
    } else if (percentile >= 70) {
      label = "Great";
    } else if (percentile >= 50) {
      label = "Solid";
    } else if (percentile >= 30) {
      label = "Developing";
    }
    return {
      label,
      percentile,
      ordinal: formatOrdinal(percentile),
    };
  };

  const createElement = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (typeof text === "string") {
      el.textContent = text;
    }
    return el;
  };

  const collectModelMetrics = (benchmarks, ranges) => {
    const results = [];
    Object.keys(METRIC_CONFIG).forEach((key) => {
      const config = METRIC_CONFIG[key] || {};
      const value = getMetricValue(benchmarks, key);
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return;
      }
      const normalized = normalizeMetric(key, value, ranges);
      const position = getRangePosition(key, value, ranges);
      const range = ranges[key];
      const valueText = formatMetricValue(key, value);
      const rangeText = formatMetricRange(key, range);
      const percentile =
        typeof normalized === "number" ? Math.round(normalized * 100) : null;
      const ordinal = percentile !== null ? formatOrdinal(percentile) : null;
      const percentileText =
        percentile !== null
          ? (ordinal || percentile + "th") + " percentile"
          : null;
      results.push({
        key,
        label: config.label,
        description: config.description,
        value,
        valueText,
        rangeText,
        percentile,
        percentileText,
        ordinal,
        normalized,
        position,
        direction: config.direction || "higher",
      });
    });
    return results;
  };

  const resolveMetricGroupLabel = (key) => {
    const group = METRIC_TO_GROUP[key];
    if (group) {
      return group.label;
    }
    if (key.startsWith("throughput.")) {
      return "Streaming speed";
    }
    if (key.startsWith("latency.")) {
      return "Response timing";
    }
    if (key === "blendedCostUsdPer1MTokens") {
      return "Pricing";
    }
    return null;
  };

  const buildMetricItem = (metric, options = {}) => {
    if (!metric) {
      return null;
    }
    const {
      compact = false,
      hideRange = false,
      hideDescription = false,
      hideGroupLabel = false,
      groupLabel,
      showDirection = false,
    } = options;
    const item = document.createElement("li");
    item.className = "insight-metric" + (compact ? " insight-metric--compact" : "");

    const header = createElement("div", "insight-metric__header");
    header.appendChild(createElement("p", "insight-metric__label", metric.label));
    if (!hideGroupLabel && groupLabel) {
      header.appendChild(createElement("span", "insight-metric__group", groupLabel));
    }
    if (metric.ordinal) {
      header.appendChild(createElement("span", "insight-metric__badge", metric.ordinal));
    }
    item.appendChild(header);

    if (!hideDescription) {
      item.appendChild(
        createElement("p", "insight-metric__description", metric.description),
      );
    }

    if (typeof metric.percentile === "number") {
      const meter = createElement("div", "insight-metric__meter");
      meter.setAttribute("role", "img");
      meter.setAttribute(
        "aria-label",
        metric.label +
          ": " +
          (metric.ordinal || metric.percentile + "th") +
          " percentile",
      );
      const fill = createElement("span");
      fill.style.setProperty("--value", String(metric.percentile));
      meter.appendChild(fill);
      item.appendChild(meter);
    }

    const valueLine = createElement("p", "insight-metric__value");
    valueLine.appendChild(createElement("strong", null, metric.valueText));
    if (metric.percentileText) {
      valueLine.appendChild(createElement("span", null, metric.percentileText));
    }
    if (!hideRange && metric.rangeText) {
      valueLine.appendChild(
        createElement("span", null, "Catalog: " + metric.rangeText),
      );
    }
    if (showDirection) {
      const directionText =
        metric.direction === "lower" ? "Lower = faster" : "Higher = stronger";
      valueLine.appendChild(
        createElement("span", "insight-metric__direction", directionText),
      );
    }
    item.appendChild(valueLine);
    return item;
  };

  const buildStrengthSection = (metadata, insightData, metricsByKey) => {
    const benchmarks = metadata && metadata.benchmarks;
    if (!benchmarks) {
      return null;
    }
    let hasGroups = false;
    const section = createElement(
      "section",
      "model-insight__section model-insight__section--strengths",
    );
    section.appendChild(createElement("h5", null, "Strength profile"));
    const list = createElement("ul", "model-insight__bars");
    BENCHMARK_GROUPS.forEach((group) => {
      const metricItems = group.metrics
        .map((metricKey) => metricsByKey[metricKey])
        .filter((metric) => metric && typeof metric.normalized === "number");
      if (!metricItems.length) {
        return;
      }
      hasGroups = true;
      const score =
        metricItems.reduce((sum, metric) => sum + metric.normalized, 0) /
        metricItems.length;
      const descriptor = describeScore(score);
      const stats = insightData.groupStats[group.key] || {};
      const minPercent =
        typeof stats.min === "number" ? Math.round(stats.min * 100) : null;
      const maxPercent =
        typeof stats.max === "number" ? Math.round(stats.max * 100) : null;
      const minLabel = minPercent !== null ? formatOrdinal(minPercent) : null;
      const maxLabel = maxPercent !== null ? formatOrdinal(maxPercent) : null;
      const rangeText =
        minLabel && maxLabel
          ? minLabel + " – " + maxLabel + " percentile across catalog"
          : "Catalog range coming soon";
      const li = createElement("li", "insight-bar");
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "insight-bar__toggle";
      toggle.setAttribute("aria-expanded", "false");
      const header = createElement("div", "insight-bar__header");
      header.appendChild(createElement("span", "insight-bar__label", group.label));
      header.appendChild(createElement("span", "insight-bar__rating", descriptor.label));
      toggle.appendChild(header);
      toggle.appendChild(createElement("p", "insight-bar__description", group.description));
      const meter = createElement("div", "insight-bar__meter");
      const ordinalLabel = descriptor.ordinal || descriptor.percentile + "th";
      meter.setAttribute(
        "aria-label",
        group.label + ": " + descriptor.label + " (" + ordinalLabel + " percentile)",
      );
      meter.setAttribute("role", "img");
      const fill = createElement("span");
      fill.style.setProperty("--value", String(descriptor.percentile));
      meter.appendChild(fill);
      toggle.appendChild(meter);
      toggle.appendChild(
        createElement(
          "p",
          "insight-bar__range",
          ordinalLabel + " percentile · " + rangeText,
        ),
      );
      const chevron = createElement("span", "insight-bar__chevron");
      toggle.appendChild(chevron);
      const evidenceId =
        "insight-" + group.key + "-" + Math.random().toString(36).slice(2, 8);
      toggle.setAttribute("aria-controls", evidenceId);
      li.appendChild(toggle);

      const evidence = createElement("div", "insight-bar__evidence");
      evidence.id = evidenceId;
      evidence.setAttribute("role", "group");
      evidence.setAttribute("aria-label", group.label + " benchmark details");
      evidence.setAttribute("hidden", "true");
      evidence.appendChild(
        createElement(
          "p",
          "insight-bar__evidence-title",
          "Benchmarks powering this score",
        ),
      );
      const metricList = document.createElement("ul");
      metricList.className = "insight-bar__metrics";
      metricItems.forEach((metric) => {
        const item = buildMetricItem(metric, {
          compact: true,
          hideRange: true,
          hideGroupLabel: true,
        });
        if (item) {
          metricList.appendChild(item);
        }
      });
      evidence.appendChild(metricList);
      li.appendChild(evidence);

      toggle.addEventListener("click", () => {
        const isExpanded = toggle.getAttribute("aria-expanded") === "true";
        if (isExpanded) {
          toggle.setAttribute("aria-expanded", "false");
          toggle.classList.remove("is-open");
          evidence.setAttribute("hidden", "true");
        } else {
          toggle.setAttribute("aria-expanded", "true");
          toggle.classList.add("is-open");
          evidence.removeAttribute("hidden");
        }
      });

      list.appendChild(li);
    });
    if (!hasGroups) {
      return null;
    }
    section.appendChild(list);
    return section;
  };

  const buildSpeedSection = (metricsByKey) => {
    if (!metricsByKey) {
      return null;
    }

    const getMetric = (key) => {
      const metric = metricsByKey[key];
      if (!metric || typeof metric.position !== "number") {
        return null;
      }
      return metric;
    };

    const slowest = getMetric("throughput.p5TokensPerSecond");
    const steady = getMetric("throughput.p25TokensPerSecond");
    const median = getMetric("throughput.medianTokensPerSecond");
    const brisk = getMetric("throughput.p75TokensPerSecond");
    const fastest = getMetric("throughput.p95TokensPerSecond");

    const firstWords = getMetric("latency.firstAnswerChunkSeconds");
    const firstP25 = getMetric("latency.p25FirstChunkSeconds");
    const firstP75 = getMetric("latency.p75FirstChunkSeconds");
    const firstP5 = getMetric("latency.p5FirstChunkSeconds");
    const firstP95 = getMetric("latency.p95FirstChunkSeconds");
    const totalResponse = getMetric("latency.totalResponseSeconds");
    const reasoningTime = metricsByKey["latency.reasoningTimeSeconds"];

    const hasStreamInsight = slowest || steady || median || brisk || fastest;
    const hasTimelineInsight = firstWords || totalResponse;

    if (!hasStreamInsight && !hasTimelineInsight) {
      return null;
    }

    const section = createElement(
      "section",
      "model-insight__section model-insight__section--speed",
    );
    section.appendChild(createElement("h5", null, "Speed & responsiveness"));
    const grid = createElement("div", "insight-speed__grid");

    const createBand = (className, startMetric, endMetric) => {
      if (!startMetric || !endMetric) {
        return null;
      }
      if (
        typeof startMetric.position !== "number" ||
        typeof endMetric.position !== "number"
      ) {
        return null;
      }
      const start = Math.min(startMetric.position, endMetric.position);
      const end = Math.max(startMetric.position, endMetric.position);
      if (end <= start) {
        return null;
      }
      const band = createElement("span", className);
      band.style.setProperty("--start", String(Number((start * 100).toFixed(1))));
      band.style.setProperty(
        "--size",
        String(Number(((end - start) * 100).toFixed(1))),
      );
      return band;
    };

    const createMarkerEntry = (metric, label, modifier) => {
      if (!metric || typeof metric.position !== "number") {
        return null;
      }
      const marker = createElement(
        "span",
        "insight-speed__marker" + (modifier ? " " + modifier : ""),
      );
      marker.style.setProperty(
        "--position",
        String(Number((metric.position * 100).toFixed(1))),
      );
      const ordinalText =
        metric.ordinal ||
        (typeof metric.percentile === "number"
          ? formatOrdinal(metric.percentile)
          : "");
      marker.title =
        label +
        ": " +
        metric.valueText +
        (ordinalText ? " · " + ordinalText : "");
      marker.setAttribute("aria-hidden", "true");
      marker.appendChild(createElement("span", "insight-speed__marker-dot"));
      return { marker, metric, label, modifier, ordinalText };
    };

    if (hasStreamInsight) {
      const streamCard = createElement(
        "article",
        "insight-speed__card insight-speed__card--stream",
      );
      streamCard.appendChild(
        createElement("h6", "insight-speed__title", "Streaming speed"),
      );

      const distribution = createElement("div", "insight-speed__distribution");
      const lane = createElement("div", "insight-speed__lane");
      lane.setAttribute(
        "aria-label",
        "Streaming speed percentiles compared to other models in the catalog.",
      );
      lane.setAttribute("role", "img");

      const outerBand = createBand(
        "insight-speed__band insight-speed__band--spread",
        slowest,
        fastest,
      );
      if (outerBand) {
        lane.appendChild(outerBand);
      }
      const typicalBand = createBand(
        "insight-speed__band insight-speed__band--core",
        steady,
        brisk,
      );
      if (typicalBand) {
        lane.appendChild(typicalBand);
      }

      const markers = [
        createMarkerEntry(
          slowest,
          "Slowest runs",
          "insight-speed__marker--slow",
        ),
        createMarkerEntry(
          median,
          "Median pace",
          "insight-speed__marker--median",
        ),
        createMarkerEntry(
          fastest,
          "Fastest runs",
          "insight-speed__marker--fast",
        ),
      ].filter(Boolean);
      markers.forEach((entry) => {
        lane.appendChild(entry.marker);
      });

      distribution.appendChild(lane);
      const axis = createElement("div", "insight-speed__axis");
      axis.appendChild(
        createElement("span", "insight-speed__axis-label", "Slower vs. catalog"),
      );
      axis.appendChild(
        createElement("span", "insight-speed__axis-label", "Faster"),
      );
      distribution.appendChild(axis);

      if (markers.length) {
        const markerList = createElement(
          "ul",
          "insight-speed__marker-details",
        );
        markers.forEach((entry) => {
          const detailClass = entry.modifier
            ? " " +
              entry.modifier.replace(
                "insight-speed__marker",
                "insight-speed__detail",
              )
            : "";
          const detail = createElement(
            "li",
            "insight-speed__detail" + detailClass,
          );
          detail.appendChild(
            createElement("span", "insight-speed__detail-swatch"),
          );
          const copy = createElement("div", "insight-speed__detail-copy");
          copy.appendChild(
            createElement("span", "insight-speed__detail-label", entry.label),
          );
          const valueRow = createElement("div", "insight-speed__detail-values");
          valueRow.appendChild(
            createElement(
              "strong",
              "insight-speed__detail-value",
              entry.metric.valueText,
            ),
          );
          if (entry.ordinalText) {
            valueRow.appendChild(
              createElement(
                "span",
                "insight-speed__detail-rank",
                entry.ordinalText,
              ),
            );
          }
          copy.appendChild(valueRow);
          detail.appendChild(copy);
          markerList.appendChild(detail);
        });
        distribution.appendChild(markerList);
      }
      streamCard.appendChild(distribution);

      const notes = [];
      notes.push(
        "Dots farther to the right mean this model streams tokens faster than catalog peers.",
      );
      if (median) {
        notes.push(
          "Streams around " + median.valueText + " once the reply is underway.",
        );
      }
      if (steady && brisk) {
        notes.push(
          "Most runs stay between " +
            formatTokensRange(steady.value, brisk.value) +
            ".",
        );
      }
      if (slowest && fastest) {
        notes.push(
          "Shaded bands show where slower outliers and fastest bursts tend to land.",
        );
        notes.push(
          "Outliers span " +
            formatTokensRange(slowest.value, fastest.value) +
            ".",
        );
      }
      if (notes.length) {
        const noteList = createElement("ul", "insight-speed__notes");
        notes.forEach((text) => {
          noteList.appendChild(createElement("li", "insight-speed__note", text));
        });
        streamCard.appendChild(noteList);
      }
      grid.appendChild(streamCard);
    }

    const buildTimelineRow = (label, metric, options = {}) => {
      if (!metric) {
        return null;
      }
      const row = createElement("div", "insight-timeline__row");
      row.appendChild(createElement("span", "insight-timeline__label", label));

      const track = createElement("div", "insight-timeline__track");
      track.setAttribute(
        "aria-label",
        label + " relative to other catalog models (lower is quicker).",
      );
      track.setAttribute("role", "img");

      const spreadBand = createBand(
        "insight-timeline__band insight-timeline__band--spread",
        options.spreadStart,
        options.spreadEnd,
      );
      if (spreadBand) {
        track.appendChild(spreadBand);
      }
      const coreBand = createBand(
        "insight-timeline__band insight-timeline__band--core",
        options.windowStart,
        options.windowEnd,
      );
      if (coreBand) {
        track.appendChild(coreBand);
      }

      if (
        options.reasoning &&
        typeof options.reasoning.value === "number" &&
        options.reasoning.value > 0.5 &&
        typeof metric.value === "number" &&
        metric.value > 0
      ) {
        const reasoningShare = Math.min(
          1,
          Math.max(0, options.reasoning.value / metric.value),
        );
        const reasoning = createElement(
          "span",
          "insight-timeline__reasoning",
        );
        reasoning.style.setProperty(
          "--size",
          String(
            Number((metric.position * reasoningShare * 100).toFixed(1)),
          ),
        );
        track.appendChild(reasoning);
      }

      const marker = createElement("span", "insight-timeline__marker");
      marker.style.setProperty(
        "--position",
        String(Number((metric.position * 100).toFixed(1))),
      );
      const ordinalText =
        metric.ordinal ||
        (typeof metric.percentile === "number"
          ? formatOrdinal(metric.percentile)
          : "");
      marker.title =
        label +
        ": " +
        metric.valueText +
        (ordinalText ? " · " + ordinalText : "");
      marker.setAttribute("aria-hidden", "true");
      track.appendChild(marker);

      row.appendChild(track);

      const valueWrap = createElement("div", "insight-timeline__value");
      valueWrap.appendChild(
        createElement("span", "insight-timeline__value-number", metric.valueText),
      );
      if (ordinalText) {
        valueWrap.appendChild(
          createElement("span", "insight-timeline__badge", ordinalText),
        );
      }
      row.appendChild(valueWrap);
      return row;
    };

    if (hasTimelineInsight) {
      const timelineCard = createElement(
        "article",
        "insight-speed__card insight-speed__card--timeline",
      );
      timelineCard.appendChild(
        createElement("h6", "insight-speed__title", "Response timeline"),
      );

      const body = createElement("div", "insight-timeline");
      const axis = createElement("div", "insight-timeline__axis");
      axis.appendChild(
        createElement(
          "span",
          "insight-timeline__axis-label",
          "Quicker than peers",
        ),
      );
      axis.appendChild(
        createElement(
          "span",
          "insight-timeline__axis-label",
          "Slower waits",
        ),
      );
      body.appendChild(axis);

      const firstRow = buildTimelineRow("First words", firstWords, {
        windowStart: firstP25,
        windowEnd: firstP75,
        spreadStart: firstP5,
        spreadEnd: firstP95,
        reasoning: reasoningTime,
      });
      if (firstRow) {
        body.appendChild(firstRow);
      }

      const totalRow = buildTimelineRow("Full reply", totalResponse, {});
      if (totalRow) {
        body.appendChild(totalRow);
      }

      timelineCard.appendChild(body);

      const notes = [];
      if (firstWords) {
        notes.push(
          "First words usually land in about " + formatSeconds(firstWords.value) + ".",
        );
      }
      if (firstP25 && firstP75) {
        notes.push(
          "Typical waits fall between " +
            formatSeconds(firstP25.value) +
            " and " +
            formatSeconds(firstP75.value) +
            ".",
        );
      }
      if (firstP5 && firstP95) {
        notes.push(
          "Edge cases range from " +
            formatSeconds(firstP5.value) +
            " to " +
            formatSeconds(firstP95.value) +
            ".",
        );
      }
      if (totalResponse) {
        let line =
          "Full replies wrap in roughly " +
          formatSeconds(totalResponse.value) +
          ".";
        if (reasoningTime && reasoningTime.value > 0.5) {
          line +=
            " Around " + formatSeconds(reasoningTime.value) +
            " of that is quiet planning time.";
        }
        notes.push(line);
      }
      notes.unshift(
        "Markers toward the left mean this model responds faster than the catalog average.",
      );
      if (notes.length) {
        const noteList = createElement("ul", "insight-speed__notes");
        notes.forEach((text) => {
          noteList.appendChild(createElement("li", "insight-speed__note", text));
        });
        timelineCard.appendChild(noteList);
      }
      grid.appendChild(timelineCard);
    }

    if (!grid.childElementCount) {
      return null;
    }
    section.appendChild(grid);
    return section;
  };

  const buildGlossarySection = (metrics) => {
    if (!Array.isArray(metrics) || !metrics.length) {
      return null;
    }
    const section = createElement(
      "section",
      "model-insight__section model-insight__section--glossary",
    );
    section.appendChild(createElement("h5", null, "Benchmark glossary"));
    const groups = new Map();
    metrics.forEach((metric) => {
      const label = resolveMetricGroupLabel(metric.key) || "Other insights";
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label).push(metric);
    });

    const describeGroup = (label, count) => {
      const benchGroup = BENCHMARK_GROUPS.find((group) => group.label === label);
      if (benchGroup) {
        return benchGroup.description;
      }
      const fallback = GLOSSARY_CATEGORY_DESCRIPTIONS[label];
      if (fallback) {
        return fallback;
      }
      return count === 1
        ? "Single insight sourced from the model catalog."
        : "Insights sourced from the model catalog.";
    };

    const formatCoverage = (items) => {
      const percentiles = items
        .map((metric) => metric.percentile)
        .filter((value) => typeof value === "number");
      if (!percentiles.length) {
        return "Catalog comparisons coming soon";
      }
      const min = Math.min(...percentiles);
      const max = Math.max(...percentiles);
      if (min === max) {
        return formatOrdinal(Math.round(min)) + " percentile placement";
      }
      return (
        formatOrdinal(Math.round(min)) +
        " – " +
        formatOrdinal(Math.round(max)) +
        " percentile placements"
      );
    };

    const list = createElement(
      "ul",
      "model-insight__bars model-insight__bars--glossary",
    );

    const renderGroup = (label) => {
      const items = groups.get(label);
      if (!items || !items.length) {
        return;
      }
      const normalizedValues = items
        .map((metric) => metric.normalized)
        .filter((value) => typeof value === "number");
      const average = normalizedValues.length
        ?
          normalizedValues.reduce((sum, value) => sum + value, 0) /
          normalizedValues.length
        : 0.5;
      const descriptor = describeScore(average);
      const li = createElement("li", "insight-bar insight-bar--glossary");
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "insight-bar__toggle insight-bar__toggle--glossary";
      toggle.setAttribute("aria-expanded", "false");

      const header = createElement("div", "insight-bar__header");
      header.appendChild(createElement("span", "insight-bar__label", label));
      header.appendChild(
        createElement("span", "insight-bar__rating", descriptor.label),
      );
      toggle.appendChild(header);

      const description = describeGroup(label, items.length);
      const countText =
        items.length === 1 ? "1 benchmark" : items.length + " benchmarks";
      toggle.appendChild(
        createElement(
          "p",
          "insight-bar__description",
          description + " · " + countText,
        ),
      );

      const meter = createElement(
        "div",
        "insight-bar__meter insight-bar__meter--glossary",
      );
      meter.setAttribute("role", "img");
      meter.setAttribute(
        "aria-label",
        label +
          ": " +
          descriptor.label +
          " (" +
          descriptor.ordinal +
          " percentile reach)",
      );
      const fill = createElement("span");
      fill.style.setProperty("--value", String(descriptor.percentile));
      meter.appendChild(fill);
      toggle.appendChild(meter);

      toggle.appendChild(
        createElement(
          "p",
          "insight-bar__range",
          descriptor.ordinal + " percentile · " + formatCoverage(items),
        ),
      );

      const chevron = createElement("span", "insight-bar__chevron");
      toggle.appendChild(chevron);

      const evidenceId =
        "glossary-" +
        label.toLowerCase().replace(/[^a-z0-9]+/g, "-") +
        "-" +
        Math.random().toString(36).slice(2, 8);
      toggle.setAttribute("aria-controls", evidenceId);
      li.appendChild(toggle);

      const evidence = createElement(
        "div",
        "insight-bar__evidence insight-bar__evidence--glossary",
      );
      evidence.id = evidenceId;
      evidence.setAttribute("role", "group");
      evidence.setAttribute("aria-label", label + " benchmarks");
      evidence.setAttribute("hidden", "true");
      evidence.appendChild(
        createElement(
          "p",
          "insight-bar__evidence-title",
          "Included benchmarks",
        ),
      );
      const metricList = document.createElement("ul");
      metricList.className = "insight-bar__metrics";
      items.forEach((metric) => {
        const item = buildMetricItem(metric, {
          compact: true,
          hideGroupLabel: true,
          showDirection: true,
        });
        if (item) {
          metricList.appendChild(item);
        }
      });
      evidence.appendChild(metricList);
      li.appendChild(evidence);
      list.appendChild(li);

      toggle.addEventListener("click", () => {
        const isExpanded = toggle.getAttribute("aria-expanded") === "true";
        if (isExpanded) {
          toggle.setAttribute("aria-expanded", "false");
          toggle.classList.remove("is-open");
          evidence.setAttribute("hidden", "true");
        } else {
          toggle.setAttribute("aria-expanded", "true");
          toggle.classList.add("is-open");
          evidence.removeAttribute("hidden");
        }
      });

      groups.delete(label);
    };

    const orderedLabels = [
      ...BENCHMARK_GROUPS.map((group) => group.label),
      "Streaming speed",
      "Response timing",
      "Pricing",
      "Other insights",
    ];
    orderedLabels.forEach(renderGroup);
    Array.from(groups.keys()).forEach((label) => {
      renderGroup(label);
    });

    if (!list.childElementCount) {
      return null;
    }
    section.appendChild(list);
    return section;
  };

  const populateInsightBody = (body, metadata, data) => {
    if (!(body instanceof HTMLElement)) {
      return;
    }
    body.innerHTML = "";
    if (!metadata || !metadata.benchmarks) {
      body.appendChild(
        createElement(
          "p",
          "model-insight__empty",
          "Performance data is only available for our curated models right now.",
        ),
      );
      return;
    }
    const insightData = getInsightData(data);
    const metrics = collectModelMetrics(metadata.benchmarks, insightData.ranges);
    const metricsByKey = {};
    metrics.forEach((metric) => {
      metricsByKey[metric.key] = metric;
    });
    const sections = [];
    const speed = buildSpeedSection(metricsByKey);
    if (speed) {
      sections.push(speed);
    }
    const strengths = buildStrengthSection(metadata, insightData, metricsByKey);
    if (strengths) {
      sections.push(strengths);
    }
    const glossary = buildGlossarySection(metrics);
    if (glossary) {
      sections.push(glossary);
    }
    if (!sections.length) {
      body.appendChild(
        createElement("p", "model-insight__empty", "Performance data coming soon."),
      );
      return;
    }
    sections.forEach((section) => body.appendChild(section));
  };

  const setupInsight = (detail, metadata, data) => {
    if (!(detail instanceof HTMLElement)) {
      return;
    }
    const trigger = detail.querySelector('[data-model-insight-trigger]');
    const overlay = detail.querySelector('[data-model-insight]');
    const closeButton = detail.querySelector('[data-model-insight-close]');
    const body = detail.querySelector('[data-model-insight-body]');
    if (
      !(trigger instanceof HTMLButtonElement) ||
      !(overlay instanceof HTMLElement) ||
      !(body instanceof HTMLElement)
    ) {
      return;
    }
    if (trigger.disabled) {
      return;
    }

    const host = overlay.parentElement;

    function restoreOverlay() {
      if (
        host instanceof HTMLElement &&
        overlay.parentElement !== host &&
        host.isConnected
      ) {
        host.appendChild(overlay);
      }
    }

    function closeOverlay() {
      overlay.setAttribute("hidden", "true");
      overlay.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("keydown", handleKeydown);
      document.body && document.body.classList.remove("model-insight-open");
      restoreOverlay();
    }

    function handleKeydown(event) {
      if (event.key === "Escape") {
        closeOverlay();
      }
    }

    function openOverlay() {
      populateInsightBody(body, metadata, data);
      if (document.body && overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
      }
      overlay.removeAttribute("hidden");
      overlay.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      document.addEventListener("keydown", handleKeydown);
      document.body && document.body.classList.add("model-insight-open");
      if (closeButton instanceof HTMLButtonElement) {
        setTimeout(() => {
          closeButton.focus();
        }, 0);
      }
    }

    overlay.__serveLlmCloseOverlay = closeOverlay;

    trigger.addEventListener("click", () => {
      if (overlay.hasAttribute("hidden")) {
        openOverlay();
      } else {
        closeOverlay();
      }
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeOverlay();
      }
    });

    if (closeButton instanceof HTMLButtonElement) {
      closeButton.addEventListener("click", (event) => {
        event.preventDefault();
        closeOverlay();
      });
    }
  };
  const updateDetail = (container, provider, value, rawValue, data) => {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    const catalog = getArray(data.catalog[provider]);
    const metadata = catalog.find((item) => item && item.value === value);
    const previousOverlay = container.querySelector('[data-model-insight]');
    if (
      previousOverlay &&
      typeof previousOverlay.__serveLlmCloseOverlay === "function"
    ) {
      try {
        previousOverlay.__serveLlmCloseOverlay();
      } catch (error) {
        console.error(error);
      }
    }
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
        '    <button type="button" class="model-detail__insight-trigger" data-model-insight-trigger aria-expanded="false">Performance snapshot</button>',
        '  </div>',
        '</div>',
        '<p class="model-detail__description" data-model-description></p>',
        '<dl class="model-detail__facts">',
        '  <div><dt>Context window</dt><dd data-model-context></dd></div>',
        '  <div><dt>Recommended for</dt><dd data-model-recommended></dd></div>',
        '  <div><dt>Highlights</dt><dd data-model-highlights></dd></div>',
        '  <div><dt>Release</dt><dd data-model-release></dd></div>',
        '</dl>',
        '<div class="model-insight" data-model-insight hidden>',
        '  <div class="model-insight__card" role="dialog" aria-modal="true" aria-label="Model performance snapshot">',
        '    <div class="model-insight__header">',
        '      <h4>Performance snapshot</h4>',
        '      <button type="button" class="model-insight__close" data-model-insight-close aria-label="Close snapshot">×</button>',
        '    </div>',
        '    <div class="model-insight__body" data-model-insight-body>',
        '      <p class="model-insight__empty">Loading metrics…</p>',
        '    </div>',
        '  </div>',
        '</div>',
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
        '  <div class="model-detail__meta">',
        '    <button type="button" class="model-detail__insight-trigger" data-model-insight-trigger aria-expanded="false" disabled title="Insights are available for curated models">Performance snapshot</button>',
        '  </div>',
        '</div>',
        '<p class="model-detail__description" data-model-description></p>',
        '<dl class="model-detail__facts">',
        '  <div><dt>Context window</dt><dd data-model-context>—</dd></div>',
        '  <div><dt>Recommended for</dt><dd data-model-recommended>Define your own sweet spot.</dd></div>',
        '  <div><dt>Highlights</dt><dd data-model-highlights>—</dd></div>',
        '  <div><dt>Cost</dt><dd data-model-cost>Cost info coming soon</dd></div>',
        '</dl>',
        '<div class="model-insight" data-model-insight hidden>',
        '  <div class="model-insight__card" role="dialog" aria-modal="true" aria-label="Model performance snapshot">',
        '    <div class="model-insight__header">',
        '      <h4>Performance snapshot</h4>',
        '      <button type="button" class="model-insight__close" data-model-insight-close aria-label="Close snapshot">×</button>',
        '    </div>',
        '    <div class="model-insight__body" data-model-insight-body>',
        '      <p class="model-insight__empty">Choose one of the curated models to view detailed benchmarks, speed, and cost insights.</p>',
        '    </div>',
        '  </div>',
        '</div>',
      ].join("");
      const name = detail.querySelector('[data-model-name]');
      const description = detail.querySelector('[data-model-description]');
      if (name) name.textContent = rawValue || value || "Custom model";
      if (description) {
        description.textContent = customModelDescription;
      }
    }
    setupInsight(detail, metadata, data);
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

export function renderModelSelectorDataScript(): string {
  const modelCatalogJson = serializeModelCatalogForClient();
  const modelDefaultsJson = JSON.stringify(DEFAULT_MODEL_BY_PROVIDER).replace(
    /</g,
    "\\u003c",
  );
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
