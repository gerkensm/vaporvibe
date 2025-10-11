import type { ModelProvider, ReasoningMode } from "../types.js";

export interface NumericRange {
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly default?: number;
  readonly description?: string;
}

export interface ModelCostInfo {
  readonly currency: "USD";
  readonly unit: "1M tokens";
  readonly input?: number | null;
  readonly output?: number | null;
  readonly reasoning?: number | null;
  readonly notes?: string;
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
  readonly maxOutputTokens?: NumericRange;
  readonly reasoningTokens?: NumericRange;
  readonly reasoningModeNotes?: string;
  readonly documentationUrl?: string;
  readonly cost?: ModelCostInfo;
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
  }) & {
    readonly helper?: string;
  };
  readonly models: ModelMetadata[];
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

export const PROVIDER_METADATA: Record<ModelProvider, ProviderMetadata> = {
  openai: {
    provider: "openai",
    name: "OpenAI",
    shortName: "OpenAI",
    tagline: "Flagship GPT and o-series models",
    description:
      "OpenAI’s studio is the crowd favorite for polished UX, rich reasoning, and plug-and-play integrations.",
    placeholder: "sk-...",
    defaultModel: "gpt-5",
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
        value: "gpt-5",
        label: "GPT-5",
        tagline: "Flagship creative director",
        description:
          "OpenAI’s crown jewel for frontier-quality UX, complex product orchestration, and imaginative storytelling.",
        recommendedFor: "When you want the most refined, high-touch experience and can afford premium tokens.",
        highlights: [
          "Deep reasoning with a playful voice",
          "Strong at long-form UX choreography",
          "Great at synthesizing research into tone"
        ],
        release: "2025",
        contextWindow: 272_000,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description: "OpenAI advertises up to 128K output tokens on GPT-5.",
        },
        cost: usdCost({ input: 1.25, output: 10 }),
      },
      {
        value: "gpt-5-2025-08-07",
        label: "GPT-5 · 2025-08-07",
        tagline: "Latest GPT-5 tuning",
        description:
          "A tuned GPT-5 build with extra polish for autumn 2025 launches—refined voice, calmer pacing, and sharper visuals.",
        recommendedFor: "Campaigns that need the freshest GPT-5 tone with steady delivery.",
        highlights: [
          "Steadier layout pacing",
          "Warm, brand-ready storytelling",
          "Balances ambition with reliability"
        ],
        release: "Aug 2025",
        contextWindow: 272_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description: "OpenAI advertises up to 128K output tokens on GPT-5.",
        },
        cost: usdCost({ input: 1.25, output: 10 }),
      },
      {
        value: "gpt-5-mini",
        label: "GPT-5 Mini",
        tagline: "Agile product partner",
        description:
          "A nimble GPT-5 variant with most of the sparkle at a far friendlier price, perfect for daily prototyping.",
        recommendedFor: "Teams iterating quickly on flows and copy without burning through budgets.",
        highlights: ["Fast iteration", "Balanced creativity", "Budget-conscious"],
        release: "2025",
        contextWindow: 272_000,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description: "Matches GPT-5’s 128K output ceiling in a smaller footprint.",
        },
        cost: usdCost({ input: 0.25, output: 2 }),
      },
      {
        value: "gpt-5-mini-2025-08-07",
        label: "GPT-5 Mini · 2025-08-07",
        tagline: "Fresh mini tuning",
        description:
          "The August 2025 refresh adds calmer pacing and smarter defaults for product microcopy.",
        recommendedFor: "Marketing and product teams who love GPT-5 Mini but want the latest tone tweaks.",
        highlights: ["Snappy microcopy", "Improved summarization", "Smoother transitions"],
        release: "Aug 2025",
        contextWindow: 272_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description: "Matches GPT-5’s 128K output ceiling in a smaller footprint.",
        },
        cost: usdCost({ input: 0.25, output: 2 }),
      },
      {
        value: "gpt-5-nano",
        label: "GPT-5 Nano",
        tagline: "Ultra-light GPT",
        description:
          "Keeps the GPT house style while running lean—ideal for previews, quick validations, or budget-sensitive demos.",
        recommendedFor: "Internal stakeholders who need a feel for the experience without the full price tag.",
        highlights: ["Instant responses", "Small budget footprint", "Keeps the GPT-5 vibe"],
        release: "2025",
        contextWindow: 272_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description: "Shares GPT-5’s 128K output token limit in a nano-sized package.",
        },
        cost: usdCost({ input: 0.05, output: 0.4 }),
      },
      {
        value: "gpt-5-nano-2025-08-07",
        label: "GPT-5 Nano · 2025-08-07",
        tagline: "Nano refresh",
        description:
          "The August 2025 cut smooths tone shifts and keeps the nano build aligned with GPT-5’s new defaults.",
        recommendedFor: "Tiny experiments and fast-turn prototypes where tone still matters.",
        highlights: ["More expressive than older nanos", "Great for copy drafts", "Friendly on cost"],
        release: "Aug 2025",
        contextWindow: 272_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description: "Shares GPT-5’s 128K output token limit in a nano-sized package.",
        },
        cost: usdCost({ input: 0.05, output: 0.4 }),
      },
      {
        value: "gpt-4.5-preview",
        label: "GPT-4.5 Preview",
        tagline: "Bridge between 4o and 5",
        description:
          "A playful glimpse at GPT-5 capabilities with GPT-4 pricing—excellent for concepting and iteration.",
        recommendedFor: "Teams who want to experiment with GPT-5 energy while staying close to GPT-4 budgets.",
        highlights: ["Notable reasoning upgrade", "Trendy visuals", "Still affordable"],
        release: "2025",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 16_384,
          max: 16_384,
          description: "OpenAI caps output at 16,384 tokens on this preview.",
        },
        cost: usdCost({ input: 75, output: 150 }),
        reasoningModeNotes: "Reasoning modes are not supported on this preview release.",
      },
      {
        value: "gpt-4.5-preview-2025-02-27",
        label: "GPT-4.5 Preview · 2025-02-27",
        tagline: "Winter preview build",
        description:
          "The February drop keeps GPT-4.5 experimental flair with a slightly steadier tone for product teams.",
        recommendedFor: "Design sprints that want fresh ideas without unpredictable tone swings.",
        highlights: ["Improved rhythm", "Less variance", "Playful yet grounded"],
        release: "Feb 2025",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 16_384,
          max: 16_384,
          description: "OpenAI caps output at 16,384 tokens on this preview.",
        },
        cost: usdCost({ input: 75, output: 150 }),
        reasoningModeNotes: "Reasoning modes are not supported on this preview release.",
      },
      {
        value: "gpt-4o",
        label: "GPT-4o",
        tagline: "All-rounder with heart",
        description:
          "A beloved multi-modal model that balances wit, speed, and empathy—perfect for polished interactive demos.",
        recommendedFor: "Showcases that need reliable brilliance without GPT-5 pricing.",
        highlights: ["Expressive visuals", "Emotive copy", "Great latency"],
        release: "2024",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 16_384,
          max: 16_384,
          description: "Outputs top out at roughly 16K tokens for GPT-4o.",
        },
        cost: usdCost({ input: 2.5, output: 10 }),
        reasoningModeNotes: "Reasoning modes are not available for GPT-4o.",
      },
      {
        value: "chatgpt-4o-latest",
        label: "ChatGPT-4o Latest",
        tagline: "Consumer-grade delight",
        description:
          "A friendly, always-fresh cut of 4o that mirrors the public ChatGPT experience.",
        recommendedFor: "Onboarding flows and copy that need warmth and approachability.",
        highlights: ["Low-friction tone", "Great for help content", "Instantly familiar"],
        release: "2024",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description: "Mirrors the ChatGPT front-end cap of 4,096 output tokens.",
        },
        cost: usdCost({ input: 2.5, output: 10 }),
        reasoningModeNotes: "Reasoning modes are not available for ChatGPT-4o Latest.",
      },
      {
        value: "gpt-4o-mini",
        label: "GPT-4o Mini",
        tagline: "Speedy charmer",
        description:
          "An energetic mini version of 4o—keeps the charm with near real-time responses.",
        recommendedFor: "Interactive prototypes and assistive flows where latency matters.",
        highlights: ["Super fast", "Still witty", "Budget friendly"],
        release: "2024",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 16_384,
          max: 16_384,
          description: "Outputs top out around 16K tokens for GPT-4o Mini.",
        },
        cost: usdCost({ input: 0.15, output: 0.6 }),
        reasoningModeNotes: "Reasoning modes are not available for GPT-4o Mini.",
      },
      {
        value: "gpt-4.1",
        label: "GPT-4.1",
        tagline: "Reliable classic",
        description:
          "A dependable GPT-4 era pro that still shines for thoughtful UX and structured reasoning.",
        recommendedFor: "Enterprise flows or compliance-heavy demos where predictability is key.",
        highlights: ["Calm pacing", "Structured output", "Strong reasoning"],
        release: "2024",
        contextWindow: 1_047_576,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 32_768,
          max: 32_768,
          description: "Outputs cap at 32,768 tokens on GPT-4.1.",
        },
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
        maxOutputTokens: {
          default: 32_768,
          max: 32_768,
          description: "Outputs cap at 32,768 tokens on GPT-4.1 Mini.",
        },
        cost: usdCost({ input: 0.4, output: 1.6 }),
      },
      {
        value: "gpt-4.1-nano",
        label: "GPT-4.1 Nano",
        tagline: "Tiny yet thoughtful",
        description:
          "A micro budget GPT-4 variant for smoke tests and baseline flows.",
        recommendedFor: "Developers verifying pipelines or testing integrations.",
        highlights: ["Lightweight", "Predictable", "Surprisingly capable"],
        release: "2024",
        contextWindow: 1_047_576,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 32_768,
          max: 32_768,
          description: "Outputs cap at 32,768 tokens on GPT-4.1 Nano.",
        },
        cost: usdCost({ input: 0.1, output: 0.4 }),
      },
      {
        value: "gpt-4",
        label: "GPT-4",
        tagline: "The classic trailblazer",
        description:
          "The original multi-modal darling—still outstanding for deliberate, careful UX and prompts with nuance.",
        recommendedFor: "Legacy experiences or when teams need the well-known GPT-4 signature tone.",
        highlights: ["Trusted", "Careful", "Rich semantics"],
        release: "2023",
        contextWindow: 8_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description: "Outputs are capped at roughly 4K tokens on GPT-4.",
        },
        cost: usdCost({ input: 30, output: 60 }),
      },
      {
        value: "gpt-4-32k",
        label: "GPT-4 32K",
        tagline: "Deep context classic",
        description:
          "Extends GPT-4’s sensibility to long briefs and knowledge dumps with the 32K context window.",
        recommendedFor: "Docs-heavy flows, research explainers, and meticulous prototypes.",
        highlights: ["Handles long docs", "Deliberate", "Stable"],
        release: "2023",
        contextWindow: 32_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description: "Despite the 32K context, outputs land around 4K tokens.",
        },
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
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description: "Preview builds cap output around 4K tokens.",
        },
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
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description: "Preview builds cap output around 4K tokens.",
        },
        cost: usdCost({ input: 8, output: 24 }),
      },
      {
        value: "gpt-4-turbo",
        label: "GPT-4 Turbo",
        tagline: "Workhorse turbo",
        description:
          "OpenAI’s pragmatic, production-ready GPT-4 build. Fast, expressive, and still easy on spend.",
        recommendedFor: "Teams who want GPT-4 quality with guardrails and predictable costs.",
        highlights: ["Battle-tested", "Fast", "Great doc summarization"],
        release: "2023",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description: "Turbo responses cap around 4K tokens.",
        },
        cost: usdCost({ input: 10, output: 30 }),
      },
      {
        value: "gpt-4-turbo-2024-04-09",
        label: "GPT-4 Turbo · 2024-04-09",
        tagline: "Spring turbo update",
        description:
          "April’s turbo refresh brings smoother storytelling and calmer tone out of the box.",
        recommendedFor: "Brand-sensitive prototypes that still want GPT-4 turbo efficiency.",
        highlights: ["Softened tone", "Improved UX instincts", "Great reliability"],
        release: "Apr 2024",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description: "Turbo responses cap around 4K tokens.",
        },
        cost: usdCost({ input: 10, output: 30 }),
      },
      {
        value: "gpt-3.5-turbo",
        label: "GPT-3.5 Turbo",
        tagline: "Beloved budget classic",
        description:
          "The scrappy model that started it all—still fantastic for copy drafts, support flows, and quick tests.",
        recommendedFor: "Content-heavy flows and super fast idea validation on a shoestring.",
        highlights: ["Extremely affordable", "Quick", "Good enough for many demos"],
        release: "2022",
        contextWindow: 16_385,
        contextWindowUnit: "tokens",
        featured: true,
        cost: usdCost({ input: 0.5, output: 1.5 }),
      },
      {
        value: "gpt-3.5-turbo-16k",
        label: "GPT-3.5 Turbo 16K",
        tagline: "Extended 3.5",
        description:
          "Extends the classic GPT-3.5 with a larger context window while keeping costs microscopic.",
        recommendedFor: "Support transcripts, content rewrites, and idea dumps that need more room.",
        highlights: ["Bigger context", "Tiny budget", "Great for support UX"],
        release: "2023",
        contextWindow: 16_385,
        contextWindowUnit: "tokens",
        cost: usdCost({ input: 1, output: 2 }),
      },
      {
        value: "o1",
        label: "o1",
        tagline: "Reasoning specialist",
        description:
          "OpenAI’s o-series focus on deliberate reasoning and step-by-step analysis with a calm, confident tone.",
        recommendedFor: "Complex flows, product calculators, and anything needing tight logic.",
        highlights: ["Transparent thinking", "Structured plans", "Confident voice"],
        release: "2024",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 100_000,
          max: 100_000,
          description: "o1 responses top out around 100K tokens.",
        },
        cost: usdCost({ input: 15, output: 60 }),
        reasoningModeNotes: "Pair with reasoning mode for best effect.",
      },
      {
        value: "o1-2024-12-17",
        label: "o1 · 2024-12-17",
        tagline: "December reasoning update",
        description:
          "Adds steadier pacing and clearer explanations for year-end workflows.",
        recommendedFor: "Strategy decks and product planning demos that need trust-building clarity.",
        highlights: ["Sharper analysis", "Less rambling", "Great for exec readouts"],
        release: "Dec 2024",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 100_000,
          max: 100_000,
          description: "o1 responses top out around 100K tokens.",
        },
        cost: usdCost({ input: 15, output: 60 }),
      },
      {
        value: "o1-preview",
        label: "o1 Preview",
        tagline: "Early o-series peek",
        description:
          "A lighter cut of o1 that still showcases transparent reasoning while being easier on spend.",
        recommendedFor: "Product walk-throughs where you want reasoning glimpses without premium costs.",
        highlights: ["Quick logic", "Clear steps", "Budget aware"],
        release: "2024",
        contextWindow: 32_768,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 32_768,
          max: 32_768,
          description: "Preview runs share the 32,768 output token limit.",
        },
        reasoningModeNotes: "Reasoning modes are available, but token limits are lower than o1.",
      },
      {
        value: "o1-mini",
        label: "o1 Mini",
        tagline: "Compact reasoning",
        description:
          "Small but mighty—keeps o-series discipline in a budget package.",
        recommendedFor: "Assistants and calculators that need logical steps without premium costs.",
        highlights: ["Fast reasoning", "Friendly voice", "Great value"],
        release: "2024",
        contextWindow: 65_536,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 65_536,
          max: 65_536,
          description: "o1 Mini caps output around 65K tokens.",
        },
        reasoningModeNotes: "Reasoning modes are not exposed for o1 Mini.",
      },
      {
        value: "o3",
        label: "o3",
        tagline: "Frontier analyst",
        description:
          "The o-series model that takes on deeply technical and strategic reasoning with poise.",
        recommendedFor: "Executive summaries, policy reasoning, and complex planning.",
        highlights: ["High confidence", "Rich reasoning", "Structured reports"],
        release: "2025",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 100_000,
          max: 100_000,
          description: "o3 shares the 100K output ceiling with o1.",
        },
        cost: usdCost({ input: 2, output: 8 }),
      },
      {
        value: "o3-mini",
        label: "o3 Mini",
        tagline: "Accessible strategist",
        description:
          "Delivers thoughtful plans quickly, perfect for product squads doing structured brainstorming.",
        recommendedFor: "Sprint planning, growth experiments, and scenario analysis.",
        highlights: ["Speedy reasoning", "Clear action items", "Friendly tone"],
        release: "2025",
        contextWindow: 160_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 100_000,
          max: 100_000,
          description: "o3 Mini shares the 100K output ceiling with the full model.",
        },
        reasoningModeNotes: "Reasoning modes mirror the o3 defaults while keeping spend approachable.",
      },
      {
        value: "o4-mini",
        label: "o4 Mini",
        tagline: "Early o4 energy",
        description:
          "Hints at the upcoming o4 capabilities with extra focus on debugging and code reasoning.",
        recommendedFor: "Technical prototypes, developer copilots, and architecture reviews.",
        highlights: ["Understands code", "Step-by-step fixes", "Keeps tone practical"],
        release: "2025",
        contextWindow: 160_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 100_000,
          max: 100_000,
          description: "Early o4 Mini builds align with o3’s output ceiling while pricing continues to evolve.",
        },
        reasoningModeNotes: "Pricing is still stabilizing as o4 rolls out—confirm latest rates with OpenAI.",
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
    defaultModel: "gemini-2.5-flash",
    defaultReasoningMode: "none",
    reasoningModes: ["none"],
    maxOutputTokens: {
      default: 128_000,
      max: 1_048_576,
      min: 1_024,
      description: "Flash models comfortably stream long outputs, with the family topping out around the 1,048,576-token mark.",
    },
    reasoningTokens: {
      supported: true,
      min: -1,
      max: 64_000,
      default: -1,
      description: "Set -1 to let Gemini auto-manage deliberate reasoning bursts.",
      helper: "Gemini uses a shared budget for deliberate reasoning. Leave blank for auto or set a ceiling.",
    },
    models: [
      {
        value: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        tagline: "Instant lightning",
        description:
          "Blazing-fast, multi-modal, and joyful—Flash is your go-to for interactive prototypes and rapid ideation.",
        recommendedFor: "Teams running constant iterations or live workshops with stakeholders.",
        highlights: ["Ultra-low latency", "Great image understanding", "Affordable"],
        release: "2025",
        contextWindow: 1_048_576,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 65_535,
          max: 65_535,
          description: "Google documents a 65,535 token output cap on Flash.",
        },
        cost: usdCost({ input: 0.3, output: 2.5, reasoning: 2.5 }),
        reasoningModeNotes:
          "Output pricing already includes deliberate “thinking” tokens. Audio inputs are billed at $1.00 per 1M tokens.",
      },
      {
        value: "gemini-2.5-flash-lite",
        label: "Gemini 2.5 Flash Lite",
        tagline: "Pocket rocket",
        description:
          "A featherweight Flash build for real-time interactions and playful ideas with virtually no latency.",
        recommendedFor: "Moments where you want near-instant feedback or embed experiences on the web.",
        highlights: ["Blink-fast", "Great for chat", "Stretch your budget"],
        release: "2025",
        contextWindow: 1_048_576,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 65_535,
          max: 65_535,
          description: "Flash Lite shares the 65,535 token output cap.",
        },
        cost: usdCost({ input: 0.1, output: 0.4, reasoning: 0.4 }),
        reasoningModeNotes:
          "Output pricing includes thinking tokens. Audio inputs are billed at $0.30 per 1M tokens.",
      },
      {
        value: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        tagline: "Deliberate storyteller",
        description:
          "Takes Gemini’s expansive context and marries it with thoughtful reasoning and premium outputs.",
        recommendedFor: "Flagship demos, editorial experiences, and detailed planning workflows.",
        highlights: ["Massive context", "Calm narration", "Search-savvy"],
        release: "2025",
        contextWindow: 1_048_576,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 65_535,
          max: 65_535,
          description: "Pro runs share the 65,535 token output cap for standard calls.",
        },
        cost: usdCost({ input: 1.25, output: 10 }),
        reasoningModeNotes:
          "Pricing shown is for prompts up to 200K tokens; requests above that tier increase to $2.50 input / $15 output per 1M tokens.",
      },
      {
        value: "gemini-2.0-pro-exp",
        label: "Gemini 2.0 Pro",
        tagline: "Experimental deep thinker",
        description:
          "An experimental Pro build that leans into creative leaps and bold, exploratory reasoning.",
        recommendedFor: "Innovation sprints and creative labs chasing novel ideas.",
        highlights: ["Bold concepts", "Exploratory", "Great for brainstorming"],
        release: "2024",
        contextWindow: 1_048_576,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 65_535,
          max: 65_535,
          description: "Experimental Pro builds follow the 65,535 output token limit.",
        },
        reasoningModeNotes: "Experimental pricing fluctuates; confirm current rates in Google AI Studio before launching.",
      },
      {
        value: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        tagline: "Classic Flash energy",
        description:
          "The 2.0 release that made Flash famous—still an excellent choice for energetic experiences.",
        recommendedFor: "Marketing previews and education prototypes needing vivid storytelling.",
        highlights: ["Playful", "Responsive", "Generous context"],
        release: "2024",
        contextWindow: 1_048_576,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 8_192,
          max: 8_192,
          description: "Flash 2.0 caps output at 8,192 tokens.",
        },
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
    reasoningModes: ["none"],
    maxOutputTokens: {
      default: 64_000,
      max: 200_000,
      min: 1_024,
      description:
        "Standard Claude responses land around 64K tokens, with Sonnet and Opus tiers stretching toward 200K when needed.",
    },
    reasoningTokens: {
      supported: true,
      min: 0,
      max: 128_000,
      default: 64_000,
      description: "Reserve a deliberate thinking budget for Claude’s chain-of-thought traces.",
      helper: "Claude shines with a reasoning allowance—set a ceiling or leave blank to stay near the default budget.",
    },
    models: [
      {
        value: "claude-sonnet-4-5-20250929",
        label: "Claude 4.5 Sonnet",
        tagline: "Warm strategic partner",
        description:
          "The everyday Claude adored by product strategists—empathetic, structured, and ready for complex narratives.",
        recommendedFor: "Story-driven flows, research synthesis, and collaborative planning.",
        highlights: ["Empathetic tone", "Great reasoning", "Reliable formatting"],
        release: "Sep 2025",
        contextWindow: 128_000,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 128_000,
          max: 128_000,
          description: "The latest Sonnet tier can emit up to roughly 128K tokens when needed.",
        },
        cost: usdCost({ input: 3, output: 15 }),
      },
      {
        value: "claude-sonnet-4-20250514",
        label: "Claude Sonnet 4",
        tagline: "Balanced and expressive",
        description:
          "A spring 2025 Sonnet tune that feels especially collaborative with designers and researchers.",
        recommendedFor: "Workshops, customer journey design, and content strategy.",
        highlights: ["Conversational", "Structured", "Team player"],
        release: "May 2025",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        cost: usdCost({ input: 3, output: 15 }),
      },
      {
        value: "claude-3-7-sonnet-latest",
        label: "Claude 3.7 Sonnet",
        tagline: "Evolved storyteller",
        description:
          "The latest Sonnet cut that blends speed with Claude’s signature warmth and insight.",
        recommendedFor: "Customer journeys, service blueprints, and tone explorations.",
        highlights: ["Fast", "Grounded", "Warm"],
        release: "2025",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        featured: true,
        cost: usdCost({ input: 3, output: 15 }),
      },
      {
        value: "claude-opus-4-1-20250805",
        label: "Claude Opus 4.1",
        tagline: "Premium deep thinker",
        description:
          "Anthropic’s most capable model—patient, thorough, and brilliant at complex analysis.",
        recommendedFor: "Executive briefings, policy explorations, and nuanced decision support.",
        highlights: ["Exceptional reasoning", "Rich language", "Premium feel"],
        release: "Aug 2025",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        featured: true,
        cost: usdCost({ input: 15, output: 75 }),
      },
      {
        value: "claude-opus-4-20250514",
        label: "Claude Opus 4",
        tagline: "Opus debut",
        description:
          "The original Opus release that set the bar for high-touch, trustworthy reasoning.",
        recommendedFor: "Policy explainers, legal prototypes, and thoughtful storytelling.",
        highlights: ["Deep insights", "Careful tone", "Great memory"],
        release: "May 2025",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        cost: usdCost({ input: 15, output: 75 }),
      },
      {
        value: "claude-3-5-haiku-latest",
        label: "Claude 3.5 Haiku",
        tagline: "Playful productivity",
        description:
          "Haiku is Claude’s zippy sidekick—quick responses, charming tone, and very friendly pricing.",
        recommendedFor: "Support flows, onboarding assistants, and content edits.",
        highlights: ["Charming", "Fast", "Affordable"],
        release: "2024",
        contextWindow: 8_192,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 8_192,
          max: 8_192,
          description: "Haiku 3.5 caps output around 8K tokens.",
        },
        cost: usdCost({ input: 0.8, output: 4 }),
      },
      {
        value: "claude-3-haiku-20240307",
        label: "Claude 3 Haiku",
        tagline: "Starter Haiku",
        description:
          "The original Haiku cut—still delightful for copy refreshes and casual customer support experiences.",
        recommendedFor: "Quick copy reviews, FAQ flows, and conversational UI tests.",
        highlights: ["Friendly", "Reliable", "Tiny cost"],
        release: "Mar 2024",
        contextWindow: 200_000,
        contextWindowUnit: "tokens",
        cost: usdCost({ input: 0.25, output: 1.25 }),
        reasoningModeNotes: "Haiku 3 focuses on speed and does not expose explicit reasoning budgets.",
        maxOutputTokens: {
          default: 4_096,
          max: 4_096,
          description: "Outputs are capped at roughly 4K tokens for Haiku 3.",
        },
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
    models: [
      {
        value: "grok-4-fast-reasoning",
        label: "Grok 4 Fast Reasoning",
        tagline: "Witty and analytical",
        description:
          "The sweet spot Grok: rapid reasoning, up-to-the-minute knowledge, and a playful narration style.",
        recommendedFor: "Real-time dashboards, cultural commentary, and playful explainers.",
        highlights: ["Realtime aware", "Great reasoning", "Fun personality"],
        release: "2025",
        contextWindow: 2_000_000,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 2_000_000,
          max: 2_000_000,
          description: "Fast reasoning runs can stretch toward two million output tokens.",
        },
        cost: usdCost({ input: 0.2, output: 0.5 }),
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
        maxOutputTokens: {
          default: 2_000_000,
          max: 2_000_000,
          description: "Shares the fast reasoning tier’s two million output ceiling, but without deliberate traces.",
        },
        reasoningModeNotes: "Deliberate reasoning is disabled to favor latency.",
      },
      {
        value: "grok-4-0709",
        label: "Grok 4 0709",
        tagline: "Summer 4 build",
        description:
          "A summer build with steadier pacing and improved doc summarization.",
        recommendedFor: "Enterprise updates or editorial recaps with a Grok twist.",
        highlights: ["Improved summarization", "Friendly tone", "Fast"],
        release: "Jul 2025",
        contextWindow: 256_000,
        contextWindowUnit: "tokens",
        maxOutputTokens: {
          default: 256_000,
          max: 256_000,
          description: "This summer build emits up to ~256K tokens.",
        },
        reasoningModeNotes: "Pricing varies by deployment tier; confirm in the xAI console.",
      },
      {
        value: "grok-3",
        label: "Grok 3",
        tagline: "Classic Grok attitude",
        description:
          "The model that introduced the world to Grok’s cheeky personality and real-time knowledge.",
        recommendedFor: "Social prototypes, commentary bots, and experimental interfaces.",
        highlights: ["Realtime context", "Playful", "Great for pop culture"],
        release: "2024",
        contextWindow: 131_072,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 131_072,
          max: 131_072,
          description: "Outputs land around 131,072 tokens for the Grok 3 family.",
        },
        cost: usdCost({ input: 3, output: 15 }),
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
        maxOutputTokens: {
          default: 131_072,
          max: 131_072,
          description: "Mini shares the 131,072 token output limit.",
        },
        cost: usdCost({ input: 0.3, output: 0.5 }),
      },
      {
        value: "grok-code-fast-1",
        label: "Grok Code Fast 1",
        tagline: "Coder co-pilot",
        description:
          "A Grok flavor tuned for code reading and debugging with candid suggestions.",
        recommendedFor: "Developer tools, debugging explainers, and technical walkthroughs.",
        highlights: ["Understands repos", "Direct guidance", "Keeps the humor"],
        release: "2025",
        contextWindow: 256_000,
        contextWindowUnit: "tokens",
        featured: true,
        maxOutputTokens: {
          default: 256_000,
          max: 256_000,
          description: "Code Fast mirrors the 256K output limit of other Grok code tiers.",
        },
        reasoningModeNotes: "Pricing for the code-tuned tier varies; check the latest xAI announcements.",
      },
    ],
  },
};

export type ProviderCatalog = typeof PROVIDER_METADATA;

export function getProviderMetadata(provider: ModelProvider): ProviderMetadata {
  return PROVIDER_METADATA[provider];
}

export function getModelMetadata(
  provider: ModelProvider,
  modelValue: string,
): ModelMetadata | undefined {
  const metadata = PROVIDER_METADATA[provider];
  if (!metadata) {
    return undefined;
  }
  return metadata.models.find((model) => model.value === modelValue);
}

export function getModelOptions(
  provider: ModelProvider,
): Array<{ value: string; label: string }> {
  const metadata = PROVIDER_METADATA[provider];
  if (!metadata) {
    return [];
  }
  return metadata.models.map((model) => ({ value: model.value, label: model.label }));
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
