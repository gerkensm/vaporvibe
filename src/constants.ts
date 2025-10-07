import type { ModelProvider } from "./types.js";

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
export const DEFAULT_MAX_OUTPUT_TOKENS = 128_000;
export const DEFAULT_OPENAI_MODEL = "gpt-5";
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929";
export const DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS = 64_000;
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_GROK_MODEL = "grok-4-fast-reasoning";
export const DEFAULT_HISTORY_LIMIT = 30;
export const DEFAULT_HISTORY_MAX_BYTES = 200_000;
export const LOOPBACK_HOST = "127.0.0.1";

export const DEFAULT_REASONING_TOKENS: Record<ModelProvider, number | undefined> = {
  openai: undefined,
  gemini: -1,
  anthropic: DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS,
  grok: undefined,
};

export const BRIEF_FORM_ROUTE = "/__set-brief";
export const SETUP_VERIFY_ROUTE = "/__setup/verify-key";
export const SETUP_ROUTE = "/__setup";
export const ADMIN_ROUTE_PREFIX = "/serve-llm";
export const LLM_RESULT_ROUTE_PREFIX = "/__serve-llm/result";
