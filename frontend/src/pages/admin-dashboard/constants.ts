import type { CustomModelConfig } from "../../components";
import type { ProviderKey, TabKey } from "./types";

export const TAB_ORDER: readonly TabKey[] = ["provider", "brief", "runtime", "history"];

export const TAB_LABELS: Record<TabKey, string> = {
    brief: "Brief",
    provider: "Provider",
    runtime: "Runtime",
    history: "History",
};

export const ADMIN_ROUTE_PREFIX = "/vaporvibe";

export const SETUP_INTRO_STORAGE_KEY = "vaporvibe:setup:intro-seen:v1";

export const HISTORY_PAGE_SIZE = 20;

export const HISTORY_REFRESH_INTERVAL_MS = 8000;

export const HISTORY_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
    timeStyle: "medium",
});

export const PROVIDER_SORT_ORDER: ProviderKey[] = [
    "openai",
    "gemini",
    "anthropic",
    "grok",
    "groq",
];

export const DEFAULT_CUSTOM_MODEL_CONFIG: CustomModelConfig = {
    isMultimodal: false,
    supportsImageInput: false,
    supportsPDFInput: false,
    supportsReasoning: false,
    supportsReasoningMode: false,
};
