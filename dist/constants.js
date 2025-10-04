export const INSTRUCTIONS_FIELD = "LLM_WEB_SERVER_INSTRUCTIONS";
export const AUTO_IGNORED_PATHS = new Set([
    "/favicon.ico",
    "/favicon.png",
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
    "/site.webmanifest",
    "/manifest.json",
    "/browserconfig.xml",
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
export const DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS = 4_096;
export const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
export const BRIEF_FORM_ROUTE = "/__set-brief";
