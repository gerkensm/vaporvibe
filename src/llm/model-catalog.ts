import type { ModelProvider, ReasoningMode } from "../types.js";

export interface NumericRange {
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly default?: number;
  readonly description?: string;
  readonly allowDisable?: boolean;
}

export interface ModelCostInfo {
  readonly currency: "USD";
  readonly unit: "1M tokens";
  readonly input?: number | null;
  readonly output?: number | null;
  readonly reasoning?: number | null;
  readonly notes?: string;
}

export interface ModelCompositeScores {
  readonly reasoning: number;
  readonly codingSkill: number;
  readonly responsiveness: number;
  readonly valueForMoney: number;
}

export interface ModelReasoningTokens extends NumericRange {
  readonly supported: boolean;
  readonly helper?: string;
}

export interface ModelMetadata {
  readonly value: string;
  readonly label: string;
  readonly tagline?: string;
  readonly description: string;
  readonly recommendedFor?: string;
  readonly highlights?: string[];
  readonly release?: string;
  readonly contextWindow?: number;
  readonly contextWindowUnit?: string;
  readonly featured?: boolean;
  readonly isMultimodal?: boolean;
  readonly supportsImageInput?: boolean;
  readonly supportsPDFInput?: boolean;
  readonly maxOutputTokens?: NumericRange;
  readonly reasoningTokens: ModelReasoningTokens;
  readonly reasoningModeNotes?: string;
  readonly documentationUrl?: string;
  readonly cost?: ModelCostInfo;
  readonly compositeScores?: ModelCompositeScores;
  readonly supportsReasoningMode?: boolean;
  readonly reasoningModes?: ReasoningMode[];
  readonly defaultReasoningMode?: ReasoningMode;
  readonly supportsMediaResolution?: boolean;
}

type RawModelReasoningTokens =
  | (NumericRange & {
    readonly helper?: string;
  })
  | null
  | undefined;

interface RawModelMetadata extends Omit<ModelMetadata, "reasoningTokens"> {
  readonly reasoningTokens?: RawModelReasoningTokens;
}

export interface ProviderMetadata {
  readonly provider: ModelProvider;
  readonly name: string;
  readonly shortName?: string;
  readonly tagline: string;
  readonly description: string;
  readonly placeholder: string;
  readonly defaultModel: string;
  readonly defaultReasoningMode: ReasoningMode;
  readonly reasoningModes: ReasoningMode[];
  readonly maxOutputTokens: NumericRange & { readonly default: number };
  readonly reasoningTokens?: (NumericRange & {
    readonly supported: boolean;
    readonly allowDisable?: boolean;
  }) & {
    readonly helper?: string;
  };
  readonly models: ModelMetadata[];
}

interface RawProviderMetadata extends Omit<ProviderMetadata, "models"> {
  readonly models: RawModelMetadata[];
}

const USD_PER_K = "USD";
const TOKENS_UNIT = "1M tokens";

function usdCost({
  input,
  output,
  reasoning,
  notes,
}: {
  input?: number | null;
  output?: number | null;
  reasoning?: number | null;
  notes?: string;
}): ModelCostInfo {
  return {
    currency: USD_PER_K,
    unit: TOKENS_UNIT,
    input,
    output,
    reasoning,
    notes,
  };
}

const MODEL_COMPOSITE_SCORES: Record<string, ModelCompositeScores> = {
  "grok:grok-code-fast-1": {
    reasoning: 49,
    codingSkill: 20.94,
    responsiveness: 57.85,
    valueForMoney: 71.23,
  },
  "groq:llama-3.3-70b-versatile": {
    reasoning: 28,
    codingSkill: 10.47,
    responsiveness: 68.49,
    valueForMoney: 55.96,
  },
  "groq:meta-llama/llama-4-maverick-17b-128e-instruct": {
    reasoning: 36,
    codingSkill: 28.53,
    responsiveness: 74.05,
    valueForMoney: 80.71,
  },
  "groq:meta-llama/llama-4-scout-17b-16e-instruct": {
    reasoning: 28,
    codingSkill: 30,
    responsiveness: 69.29,
    valueForMoney: 75.71,
  },
  "groq:moonshotai/kimi-k2-instruct-0905": {
    reasoning: 50,
    codingSkill: 17.8,
    responsiveness: 63.68,
    valueForMoney: 50.43,
  },
  "groq:openai/gpt-oss-120b": {
    reasoning: 58,
    codingSkill: 26.18,
    responsiveness: 70.95,
    valueForMoney: 85.87,
  },

  "openai:gpt-5": {
    reasoning: 68,
    codingSkill: 100,
    responsiveness: 24.21,
    valueForMoney: 51.93,
  },
  "openai:gpt-5-mini": {
    reasoning: 64,
    codingSkill: 58.64,
    responsiveness: 65,
    valueForMoney: 77.01,
  },
  "openai:gpt-5-nano": {
    reasoning: 51,
    codingSkill: 30.37,
    responsiveness: 18.31,
    valueForMoney: 100,
  },
  "openai:o3": {
    reasoning: 65,
    codingSkill: 98.43,
    responsiveness: 53.55,
    valueForMoney: 51.06,
  },
  "openai:gpt-5-mini-2025-08-07": {
    reasoning: 64,
    codingSkill: 58.64,
    responsiveness: 65,
    valueForMoney: 77.01,
  },
  "openai:gpt-5-nano-2025-08-07": {
    reasoning: 51,
    codingSkill: 30.37,
    responsiveness: 18.31,
    valueForMoney: 100,
  },
  "openai:gpt-5-2025-08-07": {
    reasoning: 68,
    codingSkill: 100,
    responsiveness: 24.21,
    valueForMoney: 51.93,
  },

  "gemini:gemini-2.5-pro": {
    reasoning: 60,
    codingSkill: 52.36,
    responsiveness: 39.61,
    valueForMoney: 44.12,
  },
  "gemini:gemini-2.5-flash": {
    reasoning: 54,
    codingSkill: 31.41,
    responsiveness: 56.97,
    valueForMoney: 65.94,
  },
  "gemini:gemini-2.5-flash-lite": {
    reasoning: 48,
    codingSkill: 12.57,
    responsiveness: 83.43,
    valueForMoney: 90.5,
  },
  "anthropic:claude-sonnet-4-5-20250929": {
    reasoning: 63,
    codingSkill: 53.4,
    responsiveness: 31.28,
    valueForMoney: 34.01,
  },
  "anthropic:claude-sonnet-4-20250514": {
    reasoning: 57,
    codingSkill: 39.79,
    responsiveness: 30.06,
    valueForMoney: 30.43,
  },
  "anthropic:claude-opus-4-1-20250805": {
    reasoning: 59,
    codingSkill: 41.88,
    responsiveness: 21.2,
    valueForMoney: 10,
  },
  "grok:grok-4-fast-reasoning": {
    reasoning: 60,
    codingSkill: 49.21,
    responsiveness: 42.4,
    valueForMoney: 92.26,
  },
  "openai:gpt-5.1": {
    reasoning: 70,
    codingSkill: 95,
    responsiveness: 35,
    valueForMoney: 52,
  },
  "openai:gpt-5.1-codex-max": {
    reasoning: 72,
    codingSkill: 100,
    responsiveness: 22,
    valueForMoney: 48,
  },
  "openai:gpt-5.1-codex-mini": {
    reasoning: 66,
    codingSkill: 88,
    responsiveness: 40,
    valueForMoney: 82,
  },
  "openai:gpt-4o": {
    reasoning: 62,
    codingSkill: 48,
    responsiveness: 52,
    valueForMoney: 42,
  },
  "gemini:gemini-3-pro-preview": {
    reasoning: 75,
    codingSkill: 85,
    responsiveness: 28,
    valueForMoney: 35,
  },
  "anthropic:claude-haiku-4-5": {
    reasoning: 58,
    codingSkill: 45,
    responsiveness: 72,
    valueForMoney: 88,
  },
  "grok:grok-3": {
    reasoning: 55,
    codingSkill: 42,
    responsiveness: 48,
    valueForMoney: 45,
  },
  "groq:qwen/qwen3-32b": {
    reasoning: 48,
    codingSkill: 35,
    responsiveness: 78,
    valueForMoney: 92,
  },
  "gemini:gemini-3-flash-preview": {
    reasoning: 65,
    codingSkill: 60,
    responsiveness: 70,
    valueForMoney: 85,
  },
  "openai:chatgpt-4o-latest": {
    reasoning: 64,
    codingSkill: 55,
    responsiveness: 60,
    valueForMoney: 45,
  },
  "openai:gpt-4o-mini": {
    reasoning: 58,
    codingSkill: 40,
    responsiveness: 80,
    valueForMoney: 90,
  },
  "openai:gpt-4.5-preview": {
    reasoning: 72,
    codingSkill: 75,
    responsiveness: 30,
    valueForMoney: 40,
  },

  "openai:gpt-4.1": {
    reasoning: 65,
    codingSkill: 55,
    responsiveness: 45,
    valueForMoney: 50,
  },

  "gemini:gemini-2.0-pro-exp": {
    reasoning: 65,
    codingSkill: 60,
    responsiveness: 60,
    valueForMoney: 50,
  },
  "gemini:gemini-2.0-flash": {
    reasoning: 50,
    codingSkill: 30,
    responsiveness: 60,
    valueForMoney: 60,
  },
  "groq:openai/gpt-oss-20b": {
    reasoning: 64,
    codingSkill: 55,
    responsiveness: 72,
    valueForMoney: 77,
  },
  "openai:gpt-5.1-codex": {
    reasoning: 70,
    codingSkill: 98,
    responsiveness: 30,
    valueForMoney: 45,
  },

  "openai:gpt-4.1-mini": {
    reasoning: 58,
    codingSkill: 45,
    responsiveness: 65,
    valueForMoney: 75,
  },
  "openai:gpt-4.1-nano": {
    reasoning: 45,
    codingSkill: 30,
    responsiveness: 80,
    valueForMoney: 90,
  },
  "openai:gpt-4": {
    reasoning: 60,
    codingSkill: 50,
    responsiveness: 30,
    valueForMoney: 35,
  },
  "openai:gpt-4-32k": {
    reasoning: 60,
    codingSkill: 50,
    responsiveness: 25,
    valueForMoney: 30,
  },
  "openai:gpt-4-turbo": {
    reasoning: 62,
    codingSkill: 52,
    responsiveness: 50,
    valueForMoney: 50,
  },
  "openai:gpt-4-turbo-2024-04-09": {
    reasoning: 62,
    codingSkill: 52,
    responsiveness: 50,
    valueForMoney: 50,
  },
  "openai:gpt-4-1106-preview": {
    reasoning: 62,
    codingSkill: 52,
    responsiveness: 50,
    valueForMoney: 50,
  },
  "openai:gpt-4-0125-preview": {
    reasoning: 62,
    codingSkill: 52,
    responsiveness: 50,
    valueForMoney: 50,
  },
  "openai:gpt-3.5-turbo": {
    reasoning: 40,
    codingSkill: 30,
    responsiveness: 90,
    valueForMoney: 95,
  },
  "openai:gpt-3.5-turbo-16k": {
    reasoning: 40,
    codingSkill: 30,
    responsiveness: 85,
    valueForMoney: 90,
  },
  "openai:o1": {
    reasoning: 90,
    codingSkill: 80,
    responsiveness: 10,
    valueForMoney: 40,
  },
  "openai:o1-2024-12-17": {
    reasoning: 92,
    codingSkill: 82,
    responsiveness: 12,
    valueForMoney: 42,
  },
  "openai:o1-preview": {
    reasoning: 85,
    codingSkill: 75,
    responsiveness: 20,
    valueForMoney: 50,
  },
  "openai:o1-mini": {
    reasoning: 75,
    codingSkill: 65,
    responsiveness: 60,
    valueForMoney: 80,
  },
  "openai:o4-mini": {
    reasoning: 80,
    codingSkill: 75,
    responsiveness: 70,
    valueForMoney: 85,
  },
  "anthropic:claude-3-7-sonnet-latest": {
    reasoning: 85,
    codingSkill: 82,
    responsiveness: 50,
    valueForMoney: 60,
  },
  "anthropic:claude-opus-4-20250514": {
    reasoning: 88,
    codingSkill: 80,
    responsiveness: 20,
    valueForMoney: 30,
  },
  "anthropic:claude-3-5-haiku-latest": {
    reasoning: 55,
    codingSkill: 50,
    responsiveness: 85,
    valueForMoney: 90,
  },
  "grok:grok-4-fast-non-reasoning": {
    reasoning: 60,
    codingSkill: 50,
    responsiveness: 95,
    valueForMoney: 80,
  },
  "grok:grok-4-0709": {
    reasoning: 65,
    codingSkill: 55,
    responsiveness: 70,
    valueForMoney: 70,
  },
  "grok:grok-3-mini": {
    reasoning: 50,
    codingSkill: 40,
    responsiveness: 90,
    valueForMoney: 85,
  },
  "openai:o3-mini": {
    reasoning: 82,
    codingSkill: 78,
    responsiveness: 65,
    valueForMoney: 85,
  },
};

function normalizeModelReasoningTokens(
  raw: RawModelReasoningTokens
): ModelReasoningTokens {
  if (raw && typeof raw === "object") {
    const helper = (raw as { helper?: string }).helper;
    const range = raw as NumericRange;
    const budgetKeys: Array<keyof NumericRange> = [
      "min",
      "max",
      "default",
      "description",
      "step",
      "allowDisable",
    ];
    const hasBudgetValue = budgetKeys.some((key) => range[key] !== undefined);
    if (hasBudgetValue) {
      return {
        supported: true,
        ...range,
        helper,
      };
    }
    return {
      supported: false,
      helper,
    };
  }
  return { supported: false };
}

function normalizeModelMetadata(model: RawModelMetadata): ModelMetadata {
  const { reasoningTokens: rawReasoningTokens, ...rest } = model;
  return {
    ...rest,
    reasoningTokens: normalizeModelReasoningTokens(rawReasoningTokens),
  };
}

function normalizeProviderMetadata(
  metadata: RawProviderMetadata
): ProviderMetadata {
  return {
    ...metadata,
    models: metadata.models.map((model) => normalizeModelMetadata(model)),
  };
}

function compositeScoresFor(key: string): ModelCompositeScores | undefined {
  return MODEL_COMPOSITE_SCORES[key];
}

const RAW_PROVIDER_METADATA: Record<ModelProvider, RawProviderMetadata> = {
  openai: {
    provider: "openai",
    name: "OpenAI",
    shortName: "OpenAI",
    tagline: "Flagship GPT and o-series models",
    description:
      "OpenAI’s studio is the crowd favorite for polished UX, rich reasoning, and plug-and-play integrations.",
    placeholder: "sk-...",
    defaultModel: "gpt-5.1",
    defaultReasoningMode: "none",
    reasoningModes: ["none", "low", "medium", "high"],
    maxOutputTokens: {
      default: 128_000,
      max: 1_047_576,
      min: 1_024,
      description:
        "Most GPT and o-series models support 128K outputs, while GPT-4.1 variants stretch up to roughly 1.05M tokens.",
    },
    models: [
      {
        value: "gpt-5.1",
        label: "GPT-5.1",
        tagline: "Smarter, faster, more conversational",
        description:
          "The next model in the GPT-5 series, balancing intelligence and speed. Features adaptive reasoning that dynamically adjusts thinking time based on task complexity.",
        recommendedFor:
          "Agentic workflows, coding tasks, and conversational applications requiring a balance of speed and intelligence.",
        highlights: [
          "Adaptive reasoning",
          "Faster on simple tasks",
          "More conversational tone",
        ],
        release: "2025-11-13",
        contextWindow: 400_000,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description: "GPT-5.1 supports up to 128K output tokens.",
        },
        supportsReasoningMode: true,
        reasoningModes: ["none", "low", "medium", "high"],
        cost: usdCost({ input: 1.25, output: 10 }),
        compositeScores: compositeScoresFor("openai:gpt-5.1"),
        reasoningModeNotes:
          "Supports 'none' for no reasoning (fastest), and low/medium/high for adaptive reasoning.",
      },
      {
        value: "gpt-5.1-codex",
        label: "GPT-5.1 Codex",
        tagline: "Legacy agentic coding",
        description:
          "Optimized for long-running, agentic coding tasks. Succeeded by GPT-5.1 Codex Max.",
        recommendedFor: "Legacy workflows requiring the original Codex model.",
        highlights: ["Legacy model", "Agentic coding", "Stable"],
        release: "2025-11-19",
        contextWindow: 400_000,
        contextWindowUnit: "tokens",
        featured: false,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description: "GPT-5.1 Codex supports up to 128K output tokens.",
        },
        supportsReasoningMode: true,
        reasoningModes: ["low", "medium", "high"],
        cost: usdCost({ input: 1.25, output: 10 }),
      },
      {
        value: "gpt-5.1-codex-mini",
        label: "GPT-5.1 Codex Mini",
        tagline: "Efficient agentic coding",
        description:
          "Smaller, more cost-effective version of GPT-5.1 Codex. Great for high-volume tasks.",
        recommendedFor: "High-volume coding tasks, automated code reviews.",
        highlights: ["Cost-effective", "Agentic capabilities", "High volume"],
        release: "2025-11-19",
        contextWindow: 400_000,
        contextWindowUnit: "tokens",
        featured: false,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description: "GPT-5.1 Codex Mini supports up to 128K output tokens.",
        },
        supportsReasoningMode: true,
        reasoningModes: ["low", "medium", "high"],
        cost: usdCost({ input: 0.25, output: 2.0 }),
      },
      {
        value: "gpt-5",
        label: "GPT-5",
        tagline: "Flagship creative director",
        description:
          "OpenAI’s crown jewel for frontier-quality UX, complex product orchestration, and imaginative storytelling.",
        recommendedFor:
          "When you want the most refined, high-touch experience and can afford premium tokens.",
        highlights: [
          "Deep reasoning with a playful voice",
          "Strong at long-form UX choreography",
          "Great at synthesizing research into tone",
        ],
        release: "2025",
        contextWindow: 400_000,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description: "OpenAI advertises up to 128K output tokens on GPT-5.",
        },
        supportsReasoningMode: true,
        cost: usdCost({ input: 1.25, output: 10 }),
        compositeScores: compositeScoresFor("openai:gpt-5"),
      },
      {
        value: "gpt-5-2025-08-07",
        label: "GPT-5 · 2025-08-07",
        tagline: "Latest GPT-5 tuning",
        description:
          "A tuned GPT-5 build with extra polish for autumn 2025 launches—refined voice, calmer pacing, and sharper visuals.",
        recommendedFor:
          "Campaigns that need the freshest GPT-5 tone with steady delivery.",
        highlights: [
          "Steadier layout pacing",
          "Warm, brand-ready storytelling",
          "Balances ambition with reliability",
        ],
        release: "Aug 2025",
        contextWindow: 400_000,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description: "OpenAI advertises up to 128K output tokens on GPT-5.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 1.25, output: 10 }),
      },
      {
        value: "gpt-5-mini",
        label: "GPT-5 Mini",
        tagline: "Agile product partner",
        description:
          "A nimble GPT-5 variant with most of the sparkle at a far friendlier price, perfect for daily prototyping.",
        recommendedFor:
          "Teams iterating quickly on flows and copy without burning through budgets.",
        highlights: [
          "Fast iteration",
          "Balanced creativity",
          "Budget-conscious",
        ],
        release: "2025",
        contextWindow: 400_000,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description:
            "Matches GPT-5’s 128K output ceiling in a smaller footprint.",
        },
        supportsReasoningMode: true,
        reasoningModes: ["none", "low", "medium", "high"],
        defaultReasoningMode: "medium",
        cost: usdCost({ input: 0.25, output: 2 }),
        compositeScores: compositeScoresFor("openai:gpt-5-mini"),
        reasoningModeNotes:
          "GPT-5 mini supports reasoning tokens for deeper analysis while maintaining fast performance.",
      },
      {
        value: "gpt-5-mini-2025-08-07",
        label: "GPT-5 Mini · 2025-08-07",
        tagline: "Fresh mini tuning",
        description:
          "The August 2025 refresh adds calmer pacing and smarter defaults for product microcopy.",
        recommendedFor:
          "Marketing and product teams who love GPT-5 Mini but want the latest tone tweaks.",
        highlights: [
          "Snappy microcopy",
          "Improved summarization",
          "Smoother transitions",
        ],
        release: "Aug 2025",
        contextWindow: 400_000,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description:
            "Matches GPT-5’s 128K output ceiling in a smaller footprint.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 0.25, output: 2 }),
      },
      {
        value: "gpt-5-nano",
        label: "GPT-5 Nano",
        tagline: "Ultra-light GPT",
        description:
          "Keeps the GPT house style while running lean—ideal for previews, quick validations, or budget-sensitive demos.",
        recommendedFor:
          "Internal stakeholders who need a feel for the experience without the full price tag.",
        highlights: [
          "Instant responses",
          "Small budget footprint",
          "Keeps the GPT-5 vibe",
        ],
        featured: true,
        release: "2025",
        contextWindow: 400_000,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description:
            "Shares GPT-5’s 128K output token limit in a nano-sized package.",
        },
        supportsReasoningMode: true,
        reasoningModes: ["none", "low", "medium", "high"],
        defaultReasoningMode: "medium",
        reasoningModeNotes:
          "GPT-5 nano supports reasoning tokens for deeper analysis while maintaining fast performance.",
        cost: usdCost({ input: 0.05, output: 0.4 }),
        compositeScores: compositeScoresFor("openai:gpt-5-nano"),
      },
      {
        value: "gpt-5-nano-2025-08-07",
        label: "GPT-5 Nano · 2025-08-07",
        tagline: "Nano refresh",
        description:
          "The August 2025 cut smooths tone shifts and keeps the nano build aligned with GPT-5’s new defaults.",
        recommendedFor:
          "Tiny experiments and fast-turn prototypes where tone still matters.",
        highlights: [
          "More expressive than older nanos",
          "Great for copy drafts",
          "Friendly on cost",
        ],
        release: "Aug 2025",
        contextWindow: 400_000,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description:
            "Shares GPT-5’s 128K output token limit in a nano-sized package.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 0.05, output: 0.4 }),
      },
      {
        value: "gpt-4.5-preview",
        label: "GPT-4.5 Preview",
        tagline: "Bridge between 4o and 5",
        description:
          "A playful glimpse at GPT-5 capabilities with GPT-4 pricing—excellent for concepting and iteration.",
        recommendedFor:
          "Teams who want to experiment with GPT-5 energy while staying close to GPT-4 budgets.",
        highlights: [
          "Notable reasoning upgrade",
          "Trendy visuals",
          "Still affordable",
        ],
        release: "2025",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        featured: false,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 16_384,
          max: 16_384,
          description: "OpenAI caps output at 16,384 tokens on this preview.",
        },
        cost: usdCost({ input: 75, output: 150 }),
        supportsReasoningMode: false,
        reasoningModeNotes:
          "Reasoning modes are not supported on this preview release.",
        reasoningTokens: {
          helper:
            "GPT-4.5 preview builds do not expose structured reasoning or thinking budgets.",
        },
      },
      {
        value: "gpt-4.5-preview-2025-02-27",
        label: "GPT-4.5 Preview · 2025-02-27",
        tagline: "Winter preview build",
        description:
          "The February drop keeps GPT-4.5 experimental flair with a slightly steadier tone for product teams.",
        recommendedFor:
          "Design sprints that want fresh ideas without unpredictable tone swings.",
        highlights: [
          "Improved rhythm",
          "Less variance",
          "Playful yet grounded",
        ],
        release: "Feb 2025",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 16_384,
          max: 16_384,
          description: "OpenAI caps output at 16,384 tokens on this preview.",
        },
        cost: usdCost({ input: 75, output: 150 }),
        supportsReasoningMode: false,
        reasoningModeNotes:
          "Reasoning modes are not supported on this preview release.",
        reasoningTokens: {
          helper:
            "GPT-4.5 preview builds do not expose structured reasoning or thinking budgets.",
        },
      },
      {
        value: "gpt-4o",
        label: "GPT-4o",
        tagline: "All-rounder with heart",
        description:
          "A beloved multi-modal model that balances wit, speed, and empathy—perfect for polished interactive demos.",
        recommendedFor:
          "Showcases that need reliable brilliance without GPT-5 pricing.",
        highlights: ["Expressive visuals", "Emotive copy", "Great latency"],
        release: "2024",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 16_384,
          max: 16_384,
          description: "Outputs top out at roughly 16K tokens for GPT-4o.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 2.5, output: 10 }),
        compositeScores: compositeScoresFor("openai:gpt-4o"),
        reasoningModeNotes: "Reasoning modes are not available for GPT-4o.",
      },
      {
        value: "chatgpt-4o-latest",
        label: "ChatGPT-4o Latest",
        tagline: "Consumer-grade delight",
        description:
          "A friendly, always-fresh cut of 4o that mirrors the public ChatGPT experience.",
        recommendedFor:
          "Onboarding flows and copy that need warmth and approachability.",
        highlights: [
          "Low-friction tone",
          "Great for help content",
          "Instantly familiar",
        ],
        release: "2024",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description:
            "Mirrors the ChatGPT front-end cap of 4,096 output tokens.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 2.5, output: 10 }),
        reasoningModeNotes:
          "Reasoning modes are not available for ChatGPT-4o Latest.",
      },
      {
        value: "gpt-4o-mini",
        label: "GPT-4o Mini",
        tagline: "Speedy charmer",
        description:
          "An energetic mini version of 4o—keeps the charm with near real-time responses.",
        recommendedFor:
          "Interactive prototypes and assistive flows where latency matters.",
        highlights: ["Super fast", "Still witty", "Budget friendly"],
        release: "2024",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        featured: false,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 16_384,
          max: 16_384,
          description: "Outputs top out around 16K tokens for GPT-4o Mini.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 0.15, output: 0.6 }),
        reasoningModeNotes:
          "Reasoning modes are not available for GPT-4o Mini.",
      },
      {
        value: "gpt-4.1",
        label: "GPT-4.1",
        tagline: "Reliable classic",
        description:
          "A dependable GPT-4 era pro that still shines for thoughtful UX and structured reasoning.",
        recommendedFor:
          "Enterprise flows or compliance-heavy demos where predictability is key.",
        highlights: ["Calm pacing", "Structured output", "Strong reasoning"],
        release: "2024",
        contextWindow: 1_047_576,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 32_768,
          max: 32_768,
          description: "Outputs cap at 32,768 tokens on GPT-4.1.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 2, output: 8 }),
      },
      {
        value: "gpt-4.1-mini",
        label: "GPT-4.1 Mini",
        tagline: "Lively GPT-4 blend",
        description:
          "Brings GPT-4 intuition into a bite-sized package for daily prototyping.",
        recommendedFor: "Teams who loved GPT-4 but want faster, cheaper spins.",
        highlights: ["Snappy responses", "Consistent tone", "Good structure"],
        release: "2024",
        contextWindow: 1_047_576,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 32_768,
          max: 32_768,
          description: "Outputs cap at 32,768 tokens on GPT-4.1 Mini.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 0.4, output: 1.6 }),
      },
      {
        value: "gpt-4.1-nano",
        label: "GPT-4.1 Nano",
        tagline: "Tiny yet thoughtful",
        description:
          "A micro budget GPT-4 variant for smoke tests and baseline flows.",
        recommendedFor:
          "Developers verifying pipelines or testing integrations.",
        highlights: ["Lightweight", "Predictable", "Surprisingly capable"],
        release: "2024",
        contextWindow: 1_047_576,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 32_768,
          max: 32_768,
          description: "Outputs cap at 32,768 tokens on GPT-4.1 Nano.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 0.1, output: 0.4 }),
      },
      {
        value: "gpt-4",
        label: "GPT-4",
        tagline: "The classic trailblazer",
        description:
          "The original GPT-4 model—still outstanding for deliberate, careful UX and prompts with nuance.",
        recommendedFor:
          "Legacy experiences or when teams need the well-known GPT-4 signature tone.",
        highlights: ["Trusted", "Careful", "Rich semantics"],
        release: "2023",
        contextWindow: 8_000,
        contextWindowUnit: "tokens",
        isMultimodal: false,
        supportsImageInput: false,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description: "Outputs are capped at roughly 4K tokens on GPT-4.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 30, output: 60 }),
      },
      {
        value: "gpt-4-32k",
        label: "GPT-4 32K",
        tagline: "Deep context classic",
        description:
          "Extends GPT-4’s sensibility to long briefs and knowledge dumps with the 32K context window.",
        recommendedFor:
          "Docs-heavy flows, research explainers, and meticulous prototypes.",
        highlights: ["Handles long docs", "Deliberate", "Stable"],
        release: "2023",
        contextWindow: 32_000,
        contextWindowUnit: "tokens",
        isMultimodal: false,
        supportsImageInput: false,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description:
            "Despite the 32K context, outputs land around 4K tokens.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 60, output: 120 }),
      },
      {
        value: "gpt-4-1106-preview",
        label: "GPT-4 1106 Preview",
        tagline: "Turbo-lean GPT-4",
        description:
          "A preview that unlocked the faster GPT-4 turbo era—good for production-ish experiences needing GPT-4 vibes.",
        recommendedFor: "Transitioning workloads from GPT-4 to turbo variants.",
        highlights: ["Balanced", "Cost aware", "Strong multi-turn"],
        release: "Nov 2023",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        isMultimodal: false,
        supportsImageInput: false,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description: "Preview builds cap output around 4K tokens.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 8, output: 24 }),
      },
      {
        value: "gpt-4-0125-preview",
        label: "GPT-4 0125 Preview",
        tagline: "Refined turbo",
        description:
          "A polished GPT-4 turbo build with better layout instincts and calmer energy.",
        recommendedFor: "Teams shipping to production with GPT-4 era APIs.",
        highlights: ["Stable output", "Better formatting", "Efficient"],
        release: "Jan 2024",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        isMultimodal: false,
        supportsImageInput: false,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description: "Preview builds cap output around 4K tokens.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 8, output: 24 }),
      },
      {
        value: "gpt-4-turbo",
        label: "GPT-4 Turbo",
        tagline: "Workhorse turbo",
        description:
          "OpenAI’s pragmatic, production-ready GPT-4 build. Fast, expressive, and still easy on spend.",
        recommendedFor:
          "Teams who want GPT-4 quality with guardrails and predictable costs.",
        highlights: ["Battle-tested", "Fast", "Great doc summarization"],
        release: "2023",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        featured: false,
        isMultimodal: false,
        supportsImageInput: false,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description: "Turbo responses cap around 4K tokens.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 10, output: 30 }),
      },
      {
        value: "gpt-4-turbo-2024-04-09",
        label: "GPT-4 Turbo · 2024-04-09",
        tagline: "Spring turbo update",
        description:
          "April’s turbo refresh brings smoother storytelling and calmer tone out of the box.",
        recommendedFor:
          "Brand-sensitive prototypes that still want GPT-4 turbo efficiency.",
        highlights: [
          "Softened tone",
          "Improved UX instincts",
          "Great reliability",
        ],
        release: "Apr 2024",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        isMultimodal: false,
        supportsImageInput: false,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description: "Turbo responses cap around 4K tokens.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 10, output: 30 }),
      },
      {
        value: "gpt-3.5-turbo",
        label: "GPT-3.5 Turbo",
        tagline: "Beloved budget classic",
        description:
          "The scrappy model that started it all—still fantastic for copy drafts, support flows, and quick tests.",
        recommendedFor:
          "Content-heavy flows and super fast idea validation on a shoestring.",
        highlights: [
          "Extremely affordable",
          "Quick",
          "Good enough for many demos",
        ],
        release: "2022",
        contextWindow: 16_385,
        contextWindowUnit: "tokens",
        featured: false,
        isMultimodal: false,
        supportsImageInput: false,
        supportsPDFInput: false,
        cost: usdCost({ input: 0.5, output: 1.5 }),
        supportsReasoningMode: false,
        reasoningTokens: {
          helper:
            "Reasoning modes and thinking budgets are not available for GPT-3.5 Turbo.",
        },
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description:
            "Completions cap out near 4,096 tokens on GPT-3.5 Turbo.",
        },
      },
      {
        value: "gpt-3.5-turbo-16k",
        label: "GPT-3.5 Turbo 16K",
        tagline: "Extended 3.5",
        description:
          "Extends the classic GPT-3.5 with a larger context window while keeping costs microscopic.",
        recommendedFor:
          "Support transcripts, content rewrites, and idea dumps that need more room.",
        highlights: ["Bigger context", "Tiny budget", "Great for support UX"],
        release: "2023",
        contextWindow: 16_385,
        contextWindowUnit: "tokens",
        isMultimodal: false,
        supportsImageInput: false,
        supportsPDFInput: false,
        cost: usdCost({ input: 1, output: 2 }),
        supportsReasoningMode: false,
        reasoningTokens: {
          helper:
            "Reasoning modes and token budgets are not supported on GPT-3.5 Turbo 16K.",
        },
        maxOutputTokens: {
          default: 16_384,
          max: 16_384,
          description:
            "The extended GPT-3.5 variant tops out around 16K output tokens.",
        },
      },
      {
        value: "o1",
        label: "o1",
        tagline: "Reasoning specialist",
        description:
          "OpenAI’s o-series focus on deliberate reasoning and step-by-step analysis with a calm, confident tone.",
        recommendedFor:
          "Complex flows, product calculators, and anything needing tight logic.",
        highlights: [
          "Transparent thinking",
          "Structured plans",
          "Confident voice",
        ],
        release: "2024",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 100_000,
          max: 100_000,
          description: "o1 responses top out around 100K tokens.",
        },
        supportsReasoningMode: true,
        cost: usdCost({ input: 15, output: 60 }),
        reasoningModeNotes: "Pair with reasoning mode for best effect.",
      },
      {
        value: "o1-2024-12-17",
        label: "o1 · 2024-12-17",
        tagline: "December reasoning update",
        description:
          "Adds steadier pacing and clearer explanations for year-end workflows.",
        recommendedFor:
          "Strategy decks and product planning demos that need trust-building clarity.",
        highlights: [
          "Sharper analysis",
          "Less rambling",
          "Great for exec readouts",
        ],
        release: "Dec 2024",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 100_000,
          max: 100_000,
          description: "o1 responses top out around 100K tokens.",
        },
        supportsReasoningMode: true,
        cost: usdCost({ input: 15, output: 60 }),
        compositeScores: compositeScoresFor("openai:o1"),
      },
      {
        value: "o1-preview",
        label: "o1 Preview",
        tagline: "Early o-series peek",
        description:
          "A lighter cut of o1 that still showcases transparent reasoning while being easier on spend.",
        recommendedFor:
          "Product walk-throughs where you want reasoning glimpses without premium costs.",
        highlights: ["Quick logic", "Clear steps", "Budget aware"],
        release: "2024",
        contextWindow: 32_768,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 32_768,
          max: 32_768,
          description: "Preview runs share the 32,768 output token limit.",
        },
        supportsReasoningMode: true,
        reasoningModeNotes:
          "Reasoning modes are available, but token limits are lower than o1.",
        compositeScores: compositeScoresFor("openai:o1-preview"),
      },
      {
        value: "o1-mini",
        label: "o1 Mini",
        tagline: "Compact reasoning",
        description:
          "Small but mighty—keeps o-series discipline in a budget package.",
        recommendedFor:
          "Assistants and calculators that need logical steps without premium costs.",
        highlights: ["Fast reasoning", "Friendly voice", "Great value"],
        release: "2024",
        contextWindow: 65_536,
        contextWindowUnit: "tokens",
        isMultimodal: false,
        supportsImageInput: false,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 65_536,
          max: 65_536,
          description: "o1 Mini caps output around 65K tokens.",
        },
        supportsReasoningMode: false,
        reasoningModeNotes: "Reasoning modes are not exposed for o1 Mini.",
        compositeScores: compositeScoresFor("openai:o1-mini"),
      },
      {
        value: "o3",
        label: "o3",
        tagline: "Frontier analyst",
        description:
          "The o-series model that takes on deeply technical and strategic reasoning with poise.",
        recommendedFor:
          "Executive summaries, policy reasoning, and complex planning.",
        highlights: ["High confidence", "Rich reasoning", "Structured reports"],
        release: "2025",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 100_000,
          max: 100_000,
          description: "o3 shares the 100K output ceiling with o1.",
        },
        supportsReasoningMode: true,
        cost: usdCost({ input: 2, output: 8 }),
        compositeScores: compositeScoresFor("openai:o3"),
      },
      {
        value: "o3-mini",
        label: "o3 Mini",
        tagline: "Accessible strategist",
        description:
          "Delivers thoughtful plans quickly, perfect for product squads doing structured brainstorming.",
        recommendedFor:
          "Sprint planning, growth experiments, and scenario analysis.",
        highlights: ["Speedy reasoning", "Clear action items", "Friendly tone"],
        release: "2025",
        contextWindow: 160_000,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 100_000,
          max: 100_000,
          description:
            "o3 Mini shares the 100K output ceiling with the full model.",
        },
        supportsReasoningMode: true,
        reasoningModeNotes:
          "Reasoning modes mirror the o3 defaults while keeping spend approachable.",
        compositeScores: compositeScoresFor("openai:o3-mini"),
      },
      {
        value: "o4-mini",
        label: "o4 Mini",
        tagline: "Early o4 energy",
        description:
          "Hints at the upcoming o4 capabilities with extra focus on debugging and code reasoning.",
        recommendedFor:
          "Technical prototypes, developer copilots, and architecture reviews.",
        highlights: [
          "Understands code",
          "Step-by-step fixes",
          "Keeps tone practical",
        ],
        release: "2025",
        contextWindow: 160_000,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 100_000,
          max: 100_000,
          description:
            "Early o4 Mini builds align with o3’s output ceiling while pricing continues to evolve.",
        },
        supportsReasoningMode: true,
        reasoningModeNotes:
          "Pricing is still stabilizing as o4 rolls out—confirm latest rates with OpenAI.",
        compositeScores: compositeScoresFor("openai:o4-mini"),
      },
    ],
  },
  gemini: {
    provider: "gemini",
    name: "Google Gemini",
    shortName: "Gemini",
    tagline: "Lightning-fast Flash and thoughtful Pro",
    description:
      "Gemini brings Google’s massive context windows and real-time search instincts to your creative studio.",
    placeholder: "AIza...",
    defaultModel: "gemini-3-flash-preview",
    defaultReasoningMode: "none",
    reasoningModes: ["none", "low", "medium", "high"],
    maxOutputTokens: {
      default: 65_536,
      max: 65_536,
      min: 1,
      description:
        "Gemini 2.5 responses cap at 65,536 output tokens, while earlier experimental builds follow their documented ceilings.",
    },
    reasoningTokens: {
      supported: true,
      min: 0,
      max: 32_768,
      default: -1,
      allowDisable: true,
      description:
        "Leave blank or -1 for Gemini’s dynamic thinking. Set 0 to disable where supported or raise the cap for deliberate runs.",
      helper:
        "Flash and Flash Lite support disabling reasoning with 0. Pro always thinks but lets you set a ceiling or use auto (-1).",
    },
    models: [

      {
        value: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        tagline: "Instant lightning",
        description:
          "Blazing-fast, multi-modal, and joyful—Flash is your go-to for interactive prototypes and rapid ideation.",
        recommendedFor:
          "Teams running constant iterations or live workshops with stakeholders.",
        highlights: [
          "Ultra-low latency",
          "Great image understanding",
          "Affordable",
        ],
        release: "2025",
        contextWindow: 1_048_576,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 65_536,
          max: 65_536,
          description: "Google documents a 65,536 token output cap on Flash.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 0.3, output: 2.5, reasoning: 2.5 }),
        reasoningModeNotes:
          "Output pricing already includes deliberate “thinking” tokens. Audio inputs are billed at $1.00 per 1M tokens.",
        reasoningTokens: {
          min: 0,
          max: 24_576,
          default: -1,
          description:
            "Use -1 for Gemini’s dynamic thinking, 0 to disable, or raise the ceiling up to 24,576 tokens.",
          allowDisable: true,
        },
        compositeScores: compositeScoresFor("gemini:gemini-2.5-flash"),
      },
      {
        value: "gemini-2.5-flash-lite",
        label: "Gemini 2.5 Flash Lite",
        tagline: "Pocket rocket",
        description:
          "A featherweight Flash build for real-time interactions and playful ideas with virtually no latency.",
        recommendedFor:
          "Moments where you want near-instant feedback or embed experiences on the web.",
        highlights: ["Blink-fast", "Great for chat", "Stretch your budget"],
        release: "2025",
        contextWindow: 1_048_576,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 65_536,
          max: 65_536,
          description: "Flash Lite shares the 65,536 token output cap.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 0.1, output: 0.4, reasoning: 0.4 }),
        reasoningModeNotes:
          "Output pricing includes thinking tokens. Audio inputs are billed at $0.30 per 1M tokens.",
        reasoningTokens: {
          min: 512,
          max: 24_576,
          default: 4_096,
          description:
            "Flash Lite defaults to no deliberate thinking. Enable reasoning to budget between 512 and 24,576 tokens.",
          allowDisable: true,
        },
        compositeScores: compositeScoresFor("gemini:gemini-2.5-flash-lite"),
      },
      {
        value: "gemini-3-flash-preview",
        label: "Gemini 3 Flash (Preview)",
        tagline: "Reasoning at Flash speed",
        description:
          "Gemini 3 Flash combines Gemini 3 Pro's reasoning capabilities with the Flash line's levels on latency, efficiency, and cost. Designed to tackle complex agentic workflows.",
        recommendedFor:
          "Complex agentic workflows, everyday tasks requiring reasoning, and latency-sensitive applications.",
        highlights: [
          "Reasoning + Speed",
          "Multimodal outputs",
          "Low latency",
        ],
        release: "Dec 2025",
        contextWindow: 1_048_576,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 65_536,
          max: 65_536,
          description: "Gemini 3 Flash supports up to 65,536 output tokens.",
        },
        supportsReasoningMode: true,
        reasoningModes: ["none", "low", "medium", "high"],
        defaultReasoningMode: "low",
        reasoningTokens: {
          helper:
            "Gemini 3 Flash uses 'Thinking Level' (mapped from Reasoning Effort) instead of a raw token budget.",
        },
        cost: usdCost({ input: 0.5, output: 3.0, notes: "Preview pricing" }),
        compositeScores: compositeScoresFor("gemini:gemini-3-flash-preview"),
        supportsMediaResolution: true,
        reasoningModeNotes:
          "Uses Thinking Level: Low (Minimal/Low), Medium, or High.",
      },
      {
        value: "gemini-3-pro-preview",
        label: "Gemini 3 Pro (Preview)",
        tagline: "Advanced reasoning & knowledge",
        description:
          "The first model in the Gemini 3 series, best for complex tasks requiring broad world knowledge and advanced reasoning across modalities.",
        recommendedFor:
          "Complex tasks, advanced reasoning, and broad knowledge requirements.",
        highlights: [
          "Advanced Reasoning",
          "Broad Knowledge",
          "Multimodal",
        ],
        release: "Preview",
        contextWindow: 1_048_576,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 65_536,
          max: 65_536,
          description: "Gemini 3 Pro supports up to 65,536 output tokens.",
        },
        supportsReasoningMode: true,
        reasoningModes: ["none", "low", "medium", "high"],
        defaultReasoningMode: "medium",
        supportsMediaResolution: true,
        reasoningTokens: {
          helper:
            "Gemini 3 Pro uses 'Thinking Level' (mapped from Reasoning Effort) instead of a raw token budget.",
        },
        cost: usdCost({
          input: 2.0,
          output: 12.0,
          notes: "Preview pricing (<200k input). >200k: $4/$18.",
        }),
        compositeScores: compositeScoresFor("gemini:gemini-3-pro-preview"),
        reasoningModeNotes:
          "Uses Thinking Level: Low (Minimal/Low), Medium, or High.",
      },
      {
        value: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        tagline: "Deliberate storyteller",
        description:
          "Takes Gemini’s expansive context and marries it with thoughtful reasoning and premium outputs.",
        recommendedFor:
          "Flagship demos, editorial experiences, and detailed planning workflows.",
        highlights: ["Massive context", "Calm narration", "Search-savvy"],
        release: "2025",
        contextWindow: 1_048_576,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 65_535,
          max: 65_535,
          description:
            "Pro runs share the 65_535 token output cap for standard calls.",
        },
        supportsReasoningMode: false,
        cost: usdCost({
          input: 2.0,
          output: 12.0,
          notes:
            "Pricing for prompts \u2264 200k tokens. For > 200k, costs are $4.00 input / $18.00 output per 1M tokens.",
        }),
        reasoningTokens: {
          min: 128,
          max: 32_768,
          default: -1,
          description:
            "Gemini Pro always engages deliberate thinking. Set -1 for dynamic budgeting or cap it up to 32,768 tokens.",
          allowDisable: false,
        },
        compositeScores: compositeScoresFor("gemini:gemini-2.5-pro"),
      },
      {
        value: "gemini-2.0-pro-exp",
        label: "Gemini 2.0 Pro",
        tagline: "Experimental deep thinker",
        description:
          "An experimental Pro build that leans into creative leaps and bold, exploratory reasoning.",
        recommendedFor:
          "Innovation sprints and creative labs chasing novel ideas.",
        highlights: ["Bold concepts", "Exploratory", "Great for brainstorming"],
        release: "2024",
        contextWindow: 1_048_576,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 65_535,
          max: 65_535,
          description:
            "Experimental Pro builds follow the 65,535 output token limit.",
        },
        supportsReasoningMode: false,
        reasoningModeNotes:
          "Experimental pricing fluctuates; confirm current rates in Google AI Studio before launching.",
      },
      {
        value: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        tagline: "Classic Flash energy",
        description:
          "The 2.0 release that made Flash famous—still an excellent choice for energetic experiences.",
        recommendedFor:
          "Marketing previews and education prototypes needing vivid storytelling.",
        highlights: ["Playful", "Responsive", "Generous context"],
        release: "2024",
        contextWindow: 1_048_576,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 8_192,
          max: 8_192,
          description: "Flash 2.0 caps output at 8,192 tokens.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 0.1, output: 0.4 }),
      },
    ],
  },
  anthropic: {
    provider: "anthropic",
    name: "Anthropic",
    shortName: "Claude",
    tagline: "Thoughtful Claude Sonnet & Opus",
    description:
      "Claude delivers deliberate reasoning with a gentle, human-centered tone that teams adore for narrative UX.",
    placeholder: "sk-ant-...",
    defaultModel: "claude-sonnet-4-5-20250929",
    defaultReasoningMode: "none",
    reasoningModes: ["none", "low", "medium", "high"],
    maxOutputTokens: {
      default: 64_000,
      max: 64_000,
      min: 1,
      description:
        "Claude responses comfortably scale to 64K tokens across the Sonnet and Opus tiers.",
    },
    reasoningTokens: {
      supported: true,
      min: 0,
      max: 64_000,
      default: 10_000,
      description:
        "Reserve a deliberate thinking budget for Claude’s chain-of-thought traces.",
      helper:
        "Claude shines with a reasoning allowance—set a ceiling or leave blank to stay near the default budget.",
    },
    models: [
      {
        value: "claude-sonnet-4-5-20250929",
        label: "Claude 4.5 Sonnet",
        tagline: "Warm strategic partner",
        description:
          "The everyday Claude adored by product strategists—empathetic, structured, and ready for complex narratives.",
        recommendedFor:
          "Story-driven flows, research synthesis, and collaborative planning.",
        highlights: [
          "Empathetic tone",
          "Great reasoning",
          "Reliable formatting",
        ],
        release: "Sep 2025",
        contextWindow: 200_000, // 1M token context available with the 'context-1m-2025-08-07' beta header
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 64_000,
          max: 64_000,
          description:
            "The latest Sonnet tier can emit up to roughly 128K tokens when needed.",
        },
        supportsReasoningMode: false,
        reasoningTokens: {
          min: 0,
          max: 64_000,
          default: 10_000,
          allowDisable: true,
          description:
            "Allocate up to 64K thinking tokens. Leave blank to lean on the default Claude pacing.",
          helper:
            "Claude Sonnet balances cost and depth—trim the budget for speed or boost it for complex flows.",
        },
        cost: usdCost({ input: 3, output: 15 }),
        compositeScores: compositeScoresFor(
          "anthropic:claude-sonnet-4-5-20250929"
        ),
      },
      {
        value: "claude-sonnet-4-20250514",
        label: "Claude Sonnet 4",
        tagline: "Balanced and expressive",
        description:
          "A spring 2025 Sonnet tune that feels especially collaborative with designers and researchers.",
        recommendedFor:
          "Workshops, customer journey design, and content strategy.",
        highlights: ["Conversational", "Structured", "Team player"],
        release: "May 2025",
        contextWindow: 200_000, // 1M token context available with the 'context-1m-2025-08-07' beta header
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 64_000,
          max: 64_000,
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 3, output: 15 }),
        reasoningTokens: {
          min: 0,
          max: 64_000,
          default: 8_000,
          allowDisable: true,
          description:
            "Sonnet 4 lets you reserve up to 64K thinking tokens. Use 0 to disable deliberate reasoning.",
          helper:
            "Dial the budget down when iterating quickly; raise it for heavy research syntheses.",
        },
        compositeScores: compositeScoresFor(
          "anthropic:claude-sonnet-4-20250514"
        ),
      },
      {
        value: "claude-3-7-sonnet-latest",
        label: "Claude 3.7 Sonnet",
        tagline: "Evolved storyteller",
        description:
          "The latest Sonnet cut that blends speed with Claude’s signature warmth and insight.",
        recommendedFor:
          "Customer journeys, service blueprints, and tone explorations.",
        highlights: ["Fast", "Grounded", "Warm"],
        release: "2025",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        featured: false,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 64_000,
          max: 64_000,
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 3, output: 15 }),
        compositeScores: compositeScoresFor(
          "anthropic:claude-3-7-sonnet-latest"
        ),
        reasoningTokens: {
          min: 0,
          max: 64_000,
          default: 8_000,
          allowDisable: true,
          description:
            "Reserve a Claude 3.7 thinking budget up to 64K tokens for especially tricky prompts.",
          helper:
            "Keep a modest allowance for day-to-day runs; boost it when you need richer step-by-step plans.",
        },
      },
      {
        value: "claude-opus-4-1-20250805",
        label: "Claude Opus 4.1",
        tagline: "Premium deep thinker",
        description:
          "Anthropic’s most capable model—patient, thorough, and brilliant at complex analysis.",
        recommendedFor:
          "Executive briefings, policy explorations, and nuanced decision support.",
        highlights: ["Exceptional reasoning", "Rich language", "Premium feel"],
        release: "Aug 2025",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 64_000,
          max: 64_000,
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 15, output: 75 }),
        reasoningTokens: {
          min: 0,
          max: 64_000,
          default: 15_000,
          allowDisable: false,
          description:
            "Opus thrives with a healthy thinking budget. Adjust the ceiling up to 64K tokens.",
          helper:
            "Opus favours deeper reasoning—leave the default for premium briefs or push higher for flagship demos.",
        },
        compositeScores: compositeScoresFor(
          "anthropic:claude-opus-4-1-20250805"
        ),
      },
      {
        value: "claude-opus-4-20250514",
        label: "Claude Opus 4",
        tagline: "Opus debut",
        description:
          "The original Opus release that set the bar for high-touch, trustworthy reasoning.",
        recommendedFor:
          "Policy explainers, legal prototypes, and thoughtful storytelling.",
        highlights: ["Deep insights", "Careful tone", "Great memory"],
        release: "May 2025",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 64_000,
          max: 64_000,
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 15, output: 75 }),
        reasoningTokens: {
          min: 0,
          max: 64_000,
          default: 12_000,
          allowDisable: false,
          description:
            "Cap Claude Opus 4’s deliberate reasoning between 0 and 64K tokens to match your latency budget.",
          helper:
            "Opus is happiest with deliberate thinking enabled—drop to 0 only when you absolutely need speed over depth.",
        },
      },
      {
        value: "claude-haiku-4-5",
        label: "Claude Haiku 4.5",
        tagline: "Lightning-fast extended thinking",
        description:
          "Anthropic’s most capable Haiku release—keeps the near-instant feel while unlocking extended thinking for tougher briefs.",
        recommendedFor:
          "Responsive agents, support automation, and product flows that still need credible reasoning.",
        highlights: ["Extended thinking", "Ultra fast", "Great value"],
        release: "Jul 2025",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 64_000,
          max: 64_000,
          description:
            "Haiku 4.5 supports outputs up to roughly 64K tokens while keeping latency low.",
        },
        supportsReasoningMode: false,
        reasoningTokens: {
          min: 0,
          max: 64_000,
          default: 6_000,
          allowDisable: true,
          description:
            "Allocate up to 64K thinking tokens when you need Haiku 4.5 to reason more deeply.",
          helper:
            "Leave the default for balanced latency; dial it up for heavier troubleshooting or synthesis tasks.",
        },
        cost: usdCost({ input: 1, output: 5 }),
        compositeScores: compositeScoresFor("anthropic:claude-haiku-4-5"),
      },
      {
        value: "claude-3-5-haiku-latest",
        label: "Claude 3.5 Haiku",
        tagline: "Playful productivity",
        description:
          "Haiku 3.5 keeps the quippy tone and cost efficiency for everyday flows.",
        recommendedFor:
          "Support flows, onboarding assistants, and content edits.",
        highlights: ["Charming", "Fast", "Affordable"],
        release: "2024",
        contextWindow: 8_192,
        contextWindowUnit: "tokens",
        featured: false,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: true,
        maxOutputTokens: {
          default: 8_192,
          max: 8_192,
          description: "Haiku 3.5 caps output around 8K tokens.",
        },
        supportsReasoningMode: false,
        cost: usdCost({ input: 0.8, output: 4 }),
        compositeScores: compositeScoresFor(
          "anthropic:claude-3-5-haiku-latest"
        ),
      },
    ],
  },
  grok: {
    provider: "grok",
    name: "xAI Grok",
    shortName: "Grok",
    tagline: "Fast frontier reasoning with a wink",
    description:
      "Grok thrives on realtime knowledge and tongue-in-cheek commentary while still tackling serious reasoning.",
    placeholder: "xai-...",
    defaultModel: "grok-4-fast-reasoning",
    defaultReasoningMode: "none",
    reasoningModes: ["none", "low", "medium", "high"],
    maxOutputTokens: {
      default: 128_000,
      max: 2_000_000,
      min: 1_024,
      description:
        "Most Grok tiers sit around 128K outputs, while the latest fast reasoning builds can stretch toward 2M tokens.",
    },
    reasoningTokens: {
      supported: false,
      helper:
        "xAI manages Grok's deliberate thinking budget automatically; the slider stays disabled.",
    },
    models: [
      {
        value: "grok-4-fast-reasoning",
        label: "Grok 4 Fast Reasoning",
        tagline: "Witty and analytical",
        description:
          "The sweet spot Grok: rapid reasoning, up-to-the-minute knowledge, and a playful narration style.",
        recommendedFor:
          "Real-time dashboards, cultural commentary, and playful explainers.",
        highlights: ["Realtime aware", "Great reasoning", "Fun personality"],
        release: "2025",
        contextWindow: 2_000_000,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 2_000_000,
          max: 2_000_000,
          description:
            "Fast reasoning runs can stretch toward two million output tokens.",
        },
        cost: usdCost({ input: 0.2, output: 0.5 }),
        supportsReasoningMode: true,
        compositeScores: compositeScoresFor("grok:grok-4-fast-reasoning"),
        reasoningModeNotes:
          "xAI exposes Grok's deliberate reasoning modes but auto-manages the thinking token budget—no manual slider is available.",
      },
      {
        value: "grok-4-fast-non-reasoning",
        label: "Grok 4 Fast Non-Reasoning",
        tagline: "Speed demon",
        description:
          "Drops the reasoning traces for extra speed—perfect when you just want Grok’s vibe, fast.",
        recommendedFor: "Chatty interfaces, live events, and commentary bots.",
        highlights: ["Ultra fast", "Realtime tone", "Lower cost"],
        release: "2025",
        contextWindow: 2_000_000,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 2_000_000,
          max: 2_000_000,
          description:
            "Shares the fast reasoning tier’s two million output ceiling, but without deliberate traces.",
        },
        reasoningModeNotes:
          "Deliberate reasoning is disabled to favor latency, so the reasoning tokens control remains unavailable.",
        supportsReasoningMode: false,
      },
      {
        value: "grok-4-0709",
        label: "Grok 4 0709",
        tagline: "Summer 4 build",
        description:
          "A summer build with steadier pacing and improved doc summarization.",
        recommendedFor:
          "Enterprise updates or editorial recaps with a Grok twist.",
        highlights: ["Improved summarization", "Friendly tone", "Fast"],
        release: "Jul 2025",
        contextWindow: 256_000,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 256_000,
          max: 256_000,
          description: "This summer build emits up to ~256K tokens.",
        },
        reasoningModeNotes:
          "Deliberate modes stay available, but xAI still manages the reasoning token budget for you.",
        supportsReasoningMode: true,
      },
      {
        value: "grok-3",
        label: "Grok 3",
        tagline: "Classic Grok attitude",
        description:
          "The model that introduced the world to Grok’s cheeky personality and real-time knowledge.",
        recommendedFor:
          "Social prototypes, commentary bots, and experimental interfaces.",
        highlights: ["Realtime context", "Playful", "Great for pop culture"],
        release: "2024",
        contextWindow: 131_072,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 131_072,
          max: 131_072,
          description:
            "Outputs land around 131,072 tokens for the Grok 3 family.",
        },
        cost: usdCost({ input: 3, output: 15 }),
        compositeScores: compositeScoresFor("grok:grok-3"),
        supportsReasoningMode: true,
        reasoningModeNotes:
          "Grok 3 offers optional deliberate traces, but the tokens budget stays provider-managed with no manual knob.",
      },
      {
        value: "grok-3-mini",
        label: "Grok 3 Mini",
        tagline: "Compact Grok charm",
        description:
          "Keeps Grok’s voice in a lighter, cheaper package ideal for embedded assistants.",
        recommendedFor: "In-product helpers and lightweight dashboards.",
        highlights: ["Tiny cost", "Still witty", "Great latency"],
        release: "2024",
        contextWindow: 131_072,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 131_072,
          max: 131_072,
          description: "Mini shares the 131,072 token output limit.",
        },
        cost: usdCost({ input: 0.3, output: 0.5 }),
        supportsReasoningMode: true,
        reasoningModeNotes:
          "Mini inherits Grok's deliberate reasoning options, but xAI still keeps the thinking budget automatic.",
        compositeScores: compositeScoresFor("grok:grok-3-mini"),
      },
      {
        value: "grok-code-fast-1",
        label: "Grok Code Fast 1",
        tagline: "Coder co-pilot",
        description:
          "A Grok flavor tuned for code reading and debugging with candid suggestions.",
        recommendedFor:
          "Developer tools, debugging explainers, and technical walkthroughs.",
        highlights: ["Understands repos", "Direct guidance", "Keeps the humor"],
        release: "2025",
        contextWindow: 256_000,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 256_000,
          max: 256_000,
          description:
            "Code Fast mirrors the 256K output limit of other Grok code tiers.",
        },
        reasoningModeNotes:
          "Developer-focused reasoning traces are available, but xAI still handles the token allotment automatically.",
        supportsReasoningMode: true,
        compositeScores: compositeScoresFor("grok:grok-code-fast-1"),
      },
    ],
  },
  groq: {
    provider: "groq",
    name: "Groq",
    shortName: "Groq",
    tagline: "Blazing fast inference via the LPU™ Inference Engine",
    description:
      "Groq provides the world's fastest inference for large language models, serving a variety of open-source models.",
    placeholder: "gsk_...",
    defaultModel: "llama-3.3-70b-versatile",
    defaultReasoningMode: "none",
    reasoningModes: ["none", "low", "medium", "high"],
    maxOutputTokens: {
      default: 8192,
      max: 1048576,
      min: 1024,
      description:
        "Max output tokens vary by model, with many supporting at least 8K.",
    },
    reasoningTokens: {
      supported: false,
      helper:
        "Groq's hosted open weights don't expose a manual reasoning-token budget—modes only.",
    },
    models: [
      {
        value: "llama-3.3-70b-versatile",
        label: "Llama 3.3 70B",
        tagline: "Meta's powerful and versatile 70B model.",
        description:
          "A highly capable model from the Llama 3.3 family, suitable for a wide range of complex reasoning and generation tasks.",
        recommendedFor:
          "Demanding applications requiring deep understanding and nuanced text generation.",
        release: "2024",
        contextWindow: 131_072,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 32_768,
          max: 32_768,
          description:
            "Groq caps completions at 32,768 tokens for Llama 3.3 70B.",
        },
        cost: usdCost({ input: 0.59, output: 0.79 }),
        compositeScores: compositeScoresFor("groq:llama-3.3-70b-versatile"),
        supportsReasoningMode: false,
        reasoningModeNotes:
          "Groq has not enabled deliberate reasoning efforts on the Llama 3.3 lineup yet.",
        reasoningTokens: {
          helper:
            "Groq auto-manages reasoning for Llama 3.3 models—no explicit modes or thinking budgets are exposed.",
        },
      },
      {
        value: "meta-llama/llama-4-maverick-17b-128e-instruct",
        label: "Llama 4 Maverick",
        tagline: "The next generation of Llama with a massive context window.",
        description:
          "Llama 4 Maverick is designed for handling extremely long contexts, making it ideal for document analysis and synthesis.",
        recommendedFor:
          "Processing and reasoning over large documents, codebases, or extensive conversation histories.",
        release: "2024",
        contextWindow: 131_072,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 8_192,
          max: 8_192,
          description:
            "Groq lists an 8,192 token completion budget for this preview build.",
        },
        cost: usdCost({ input: 0.2, output: 0.6 }),
        compositeScores: compositeScoresFor(
          "groq:meta-llama/llama-4-maverick-17b-128e-instruct"
        ),
        supportsReasoningMode: false,
        reasoningModeNotes:
          "Groq has not rolled out deliberate reasoning efforts on Maverick yet.",
        reasoningTokens: {
          helper:
            "Groq handles thinking internally for Maverick—no reasoning sliders or toggles are available.",
        },
      },
      {
        value: "meta-llama/llama-4-scout-17b-16e-instruct",
        label: "Llama 4 Scout",
        tagline: "Preview build tuned for analytical guardrails.",
        description:
          "Llama 4 Scout delivers Groq’s preview alignment work with a generous 131K context for structured evaluations.",
        recommendedFor:
          "Large-scale research, financial analysis, and legal document review.",
        release: "2024",
        contextWindow: 131_072,
        contextWindowUnit: "tokens",
        isMultimodal: true,
        supportsImageInput: true,
        supportsPDFInput: false,
        featured: true,
        maxOutputTokens: {
          default: 8_192,
          max: 8_192,
          description:
            "Groq quotes an 8,192 token completion limit for this Scout preview model.",
        },
        cost: usdCost({ input: 0.11, output: 0.34 }),
        compositeScores: compositeScoresFor(
          "groq:meta-llama/llama-4-scout-17b-16e-instruct"
        ),
        supportsReasoningMode: false,
        reasoningModeNotes:
          "Groq has not exposed deliberate reasoning controls on Scout yet.",
        reasoningTokens: {
          helper:
            "Groq auto-manages reasoning for Scout—no manual modes or token budgets at this time.",
        },
      },
      {
        value: "moonshotai/kimi-k2-instruct-0905",
        label: "Kimi K2 (0905)",
        tagline: "A strong model focused on reasoning and tool use.",
        description:
          "Kimi K2 shows strong performance in agentic tasks, long-context reasoning, and instruction following.",
        recommendedFor:
          "Workflows that require tool integration and complex reasoning chains.",
        release: "Sep 2025",
        contextWindow: 262_144,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 16_384,
          max: 16_384,
          description:
            "Groq documents a 16,384 token completion ceiling for Kimi K2.",
        },
        cost: usdCost({ input: 1, output: 3 }),
        compositeScores: compositeScoresFor(
          "groq:moonshotai/kimi-k2-instruct-0905"
        ),
        supportsReasoningMode: false,
        reasoningModeNotes:
          "Kimi K2 runs without Groq's deliberate reasoning switch—traces are not available yet.",
        reasoningTokens: {
          helper:
            "Groq does not expose reasoning controls for Kimi K2 at this time.",
        },
      },
      {
        value: "openai/gpt-oss-120b",
        label: "GPT-OSS 120B",
        tagline: "A powerful open-source model.",
        description:
          "A large, high-performing open-source model with excellent reasoning and instruction-following capabilities.",
        recommendedFor:
          "Advanced tasks requiring strong intelligence and coding skills.",
        release: "2024",
        contextWindow: 131_072,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 65_536,
          max: 65_536,
          description:
            "Groq sets a 65,536 token completion limit for GPT-OSS 120B.",
        },
        cost: usdCost({ input: 0.15, output: 0.75 }),
        compositeScores: compositeScoresFor("groq:openai/gpt-oss-120b"),
        supportsReasoningMode: true,
        reasoningModeNotes:
          "Supports Groq reasoning efforts (low, medium, high) with detailed traces, but the thinking budget is provider-managed.",
        reasoningModes: ["none", "low", "medium", "high"],
        reasoningTokens: {
          helper:
            "Groq handles the GPT-OSS thinking budget automatically—reasoning sliders stay hidden while modes remain available.",
        },
        defaultReasoningMode: "medium",
      },
      {
        value: "openai/gpt-oss-20b",
        label: "GPT-OSS 20B",
        tagline: "A capable and efficient open-source model.",
        description:
          "A smaller but still powerful open-source model that balances performance with efficiency.",
        recommendedFor:
          "General purpose tasks, prototyping, and balanced workloads.",
        release: "2024",
        contextWindow: 131_072,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 65_536,
          max: 65_536,
          description:
            "Groq lists a 65,536 token completion limit for GPT-OSS 20B.",
        },
        cost: usdCost({ input: 0.1, output: 0.5 }),
        compositeScores: compositeScoresFor("groq:openai/gpt-oss-20b"),
        supportsReasoningMode: true,
        reasoningModeNotes:
          "Enable Groq reasoning efforts (low, medium, high) to request traces—reasoning tokens remain auto-managed.",
        reasoningModes: ["none", "low", "medium", "high"],
        reasoningTokens: {
          helper:
            "Groq manages GPT-OSS thinking tokens internally, so only the reasoning mode toggle appears.",
        },
        defaultReasoningMode: "medium",
      },
      {
        value: "qwen/qwen3-32b",
        label: "Qwen 3 32B",
        tagline: "A powerful 32B model from Alibaba's Qwen family.",
        description:
          "The Qwen 3 32B model is a powerful and efficient open-source model from Alibaba, offering strong performance in multilingual and general-purpose tasks.",
        recommendedFor:
          "Multilingual applications, content generation, and balanced workloads where performance and cost are key.",
        release: "2024",
        contextWindow: 131_072,
        contextWindowUnit: "tokens",
        featured: true,
        isMultimodal: false,
        supportsImageInput: false,
        supportsPDFInput: false,
        maxOutputTokens: {
          default: 16_384,
          max: 16_384,
          description:
            "Groq supports up to 16,384 output tokens for Qwen 3 32B.",
        },
        cost: usdCost({ input: 0.25, output: 0.25 }),
        compositeScores: compositeScoresFor("groq:qwen/qwen3-32b"),
        supportsReasoningMode: true,
        reasoningModeNotes:
          "Supports 'default' and 'none' reasoning effort via the API, but does not expose qualitative low/medium/high modes.",
        reasoningModes: ["default", "none"],
        reasoningTokens: {
          helper:
            "Groq does not expose a manual thinking budget for Qwen models.",
        },
      },
    ],
  },
};

const PROVIDER_METADATA_ENTRIES = Object.entries(
  RAW_PROVIDER_METADATA
) as Array<[ModelProvider, RawProviderMetadata]>;

export const PROVIDER_METADATA: Record<ModelProvider, ProviderMetadata> =
  Object.fromEntries(
    PROVIDER_METADATA_ENTRIES.map(([provider, metadata]) => [
      provider,
      normalizeProviderMetadata(metadata),
    ])
  ) as Record<ModelProvider, ProviderMetadata>;

export type ProviderCatalog = typeof PROVIDER_METADATA;

export function getProviderMetadata(provider: ModelProvider): ProviderMetadata {
  return PROVIDER_METADATA[provider];
}

export function getModelMetadata(
  provider: ModelProvider,
  modelValue: string
): ModelMetadata | undefined {
  const metadata = PROVIDER_METADATA[provider];
  if (!metadata) {
    return undefined;
  }
  return metadata.models.find((model) => model.value === modelValue);
}

export function getModelOptions(
  provider: ModelProvider
): Array<{ value: string; label: string }> {
  const metadata = PROVIDER_METADATA[provider];
  if (!metadata) {
    return [];
  }
  return metadata.models.map((model) => ({
    value: model.value,
    label: model.label,
  }));
}

export function getFeaturedModels(provider: ModelProvider): ModelMetadata[] {
  const metadata = PROVIDER_METADATA[provider];
  if (!metadata) {
    return [];
  }
  const featured = metadata.models.filter((model) => model.featured);
  if (featured.length > 0) {
    return featured;
  }
  return metadata.models.slice(0, 4);
}
