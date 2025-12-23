import type { ModelProvider } from "./types.js";
import { PROVIDER_METADATA } from "./llm/model-catalog.js";

export const INSTRUCTIONS_FIELD = "LLM_WEB_SERVER_INSTRUCTIONS";

export const AUTO_IGNORED_PATHS = new Set([
  "/favicon.ico",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
  "/site.webmanifest",
  "/manifest.json",
  "/browserconfig.xml",
  "/.well-known/appspecific/com.chrome.devtools.json",
  "/robots.txt",
  "/safari-pinned-tab.svg",
  "/asset-manifest.json",
  "/service-worker.js",
  "/sw.js",
]);

export const DEFAULT_PORT = 3000;
const OPENAI_METADATA = PROVIDER_METADATA.openai;
const GEMINI_METADATA = PROVIDER_METADATA.gemini;
const ANTHROPIC_METADATA = PROVIDER_METADATA.anthropic;
const GROK_METADATA = PROVIDER_METADATA.grok;
const GROQ_METADATA = PROVIDER_METADATA.groq;
const OPENROUTER_METADATA = PROVIDER_METADATA.openrouter;

export const DEFAULT_MAX_OUTPUT_TOKENS =
  OPENAI_METADATA.maxOutputTokens.default;
export const DEFAULT_OPENAI_MODEL = OPENAI_METADATA.defaultModel;
export const DEFAULT_ANTHROPIC_MODEL = ANTHROPIC_METADATA.defaultModel;
export const DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS =
  ANTHROPIC_METADATA.maxOutputTokens.default;
export const DEFAULT_GEMINI_MODEL = GEMINI_METADATA.defaultModel;
export const DEFAULT_GROK_MODEL = GROK_METADATA.defaultModel;
export const DEFAULT_GROQ_MODEL = GROQ_METADATA.defaultModel;
export const DEFAULT_OPENROUTER_MODEL = OPENROUTER_METADATA.defaultModel;
export const DEFAULT_HISTORY_LIMIT = 300;
export const DEFAULT_HISTORY_MAX_BYTES = 2_000_000;
export const HISTORY_LIMIT_MIN = 1;
export const HISTORY_LIMIT_MAX = 1_000;
export const HISTORY_MAX_BYTES_MIN = 102_400;
export const HISTORY_MAX_BYTES_MAX = 10_000_000;
export const LOOPBACK_HOST = "127.0.0.1";

export const DEFAULT_REASONING_TOKENS: Record<
  ModelProvider,
  number | undefined
> = {
  openai: OPENAI_METADATA.reasoningTokens?.default,
  gemini: GEMINI_METADATA.reasoningTokens?.default,
  anthropic: ANTHROPIC_METADATA.reasoningTokens?.default,
  grok: GROK_METADATA.reasoningTokens?.default,
  groq: GROQ_METADATA.reasoningTokens?.default,
  openrouter: OPENROUTER_METADATA.reasoningTokens?.default,
};

export const BRIEF_FORM_ROUTE = "/__set-brief";
export const SETUP_VERIFY_ROUTE = "/__setup/verify-key";
export const SETUP_ROUTE = "/__setup";
export const OVERLAY_DEBUG_ROUTE = "/__overlay-debug";
export const ADMIN_ROUTE_PREFIX = "/vaporvibe";
export const INSTRUCTIONS_PANEL_ROUTE = "/__vaporvibe/vaporvibe-instructions-panel.js";
export const LLM_RESULT_ROUTE_PREFIX = "/__vaporvibe/result";
export const LLM_REASONING_STREAM_ROUTE_PREFIX = "/__vaporvibe/reasoning";
