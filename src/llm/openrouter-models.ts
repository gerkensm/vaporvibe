import { OpenRouter } from "@openrouter/sdk";
import type { ModelProvider } from "../types.js";
import type { ModelMetadata } from "./model-catalog.js";
import { logger } from "../logger.js";

// ============================================================================
// OpenRouter Rankings Types & Fetching
// ============================================================================

/**
 * A single row from the OpenRouter rankings data.
 */
export interface OpenRouterRankingRow {
    date?: string;
    model_permaslug: string; // e.g. "openai/gpt-4o"
    variant?: string;
    variant_permaslug?: string;
    count?: number;
    total_prompt_tokens?: number;
    total_completion_tokens?: number;
    change?: number;
    [k: string]: unknown;
}

/**
 * Cached set of featured model IDs (top 10 by usage).
 */
let cachedFeaturedModelIds: Set<string> | null = null;
let lastRankingFetchTime: number = 0;

/**
 * Rankings cache TTL: 1 hour (rankings don't change as frequently).
 */
const RANKINGS_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Number of top models to mark as featured.
 */
const FEATURED_MODEL_COUNT = 10;

/**
 * Extracts a JSON array from HTML after a specific key like `"rankingData":`.
 * Uses bracket matching to find the complete array.
 */
/**
 * Robustly extracts a JSON array from HTML, handling potential escaping.
 * Supports standard JSON and escaped JSON (Next.js/React hydration data style).
 */
function extractJsonArray(html: string, startIdx: number, isEscaped: boolean): unknown[] {
    let depth = 0;
    let inString = false;

    for (let i = startIdx; i < html.length; i++) {
        const ch = html[i];
        const next = html[i + 1] || "";

        if (inString) {
            if (isEscaped) {
                // Inside escaped string, delimiter is \"
                if (ch === "\\" && next === "\\") {
                    i++; continue; // Skip \\
                }
                if (ch === "\\" && next === '"') {
                    inString = false;
                    i++; continue;
                }
            } else {
                // Standard JSON string, delimiter is "
                if (ch === "\\" && next === "\\") {
                    i++; continue; // Skip \\
                }
                if (ch === "\\" && next === '"') {
                    i++; continue; // Skip \"
                }
                if (ch === '"') {
                    inString = false;
                    continue;
                }
            }
        } else {
            // Not in string
            if (isEscaped) {
                if (ch === "\\" && next === '"') {
                    inString = true;
                    i++; continue;
                }
            } else {
                if (ch === '"') {
                    inString = true;
                    continue;
                }
            }

            if (ch === "[") depth++;
            if (ch === "]") depth--;
        }

        if (depth === 0) {
            const rawJson = html.slice(startIdx, i + 1);
            try {
                if (isEscaped) {
                    const unescaped = rawJson.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
                    return JSON.parse(unescaped);
                }
                return JSON.parse(rawJson);
            } catch (e) {
                // Keep going if parse fails (maybe premature end due to strict JSON rules)
                continue;
            }
        }
    }
    throw new Error("Unterminated array");
}

/**
 * Fetches ranking data from OpenRouter's rankings page.
 * Returns all `rankingData` blocks found in the page's inline JSON.
 */
export async function fetchOpenRouterRankingBlocks(options?: {
    signal?: AbortSignal;
}): Promise<unknown[][]> {
    const res = await fetch("https://openrouter.ai/rankings", {
        headers: {
            "user-agent":
                "Mozilla/5.0 (compatible; VaporVibe/1.0; +https://github.com/gerkensm/vaporvibe)",
            accept: "text/html,application/xhtml+xml",
        },
        signal: options?.signal,
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch rankings: ${res.status} ${res.statusText}`);
    }

    const html = await res.text();
    const key = "rankingData";
    const blocks: unknown[][] = [];
    let from = 0;

    while (true) {
        const idx1 = html.indexOf(`"${key}":`, from);
        const idx2 = html.indexOf(`\\"${key}\\":`, from);

        let idx = -1;
        let isEscaped = false;
        let offset = 0;

        // Find the first occurrence of either key format
        if (idx1 !== -1 && (idx2 === -1 || idx1 < idx2)) {
            idx = idx1;
            isEscaped = false;
            offset = key.length + 3; // "key":
        } else if (idx2 !== -1) {
            idx = idx2;
            isEscaped = true;
            offset = key.length + 5; // \"key\":
        }

        if (idx === -1) break;

        const startBracket = html.indexOf("[", idx + offset);
        if (startBracket !== -1) {
            try {
                const arr = extractJsonArray(html, startBracket, isEscaped);
                if (Array.isArray(arr)) {
                    blocks.push(arr);
                }
            } catch (e) {
                // Ignore parse errors for partial/invalid blocks
            }
        }

        from = idx + 10;
    }

    if (blocks.length === 0) {
        throw new Error(`No "${key}" arrays found in rankings HTML`);
    }

    return blocks;
}


/**
 * Helper to calculate total tokens for a ranking row.
 * OpenRouter leaderboard ranks by total tokens (completion + prompt).
 */
function getTotalTokens(row: OpenRouterRankingRow): number {
    const completion = Number(row.total_completion_tokens ?? 0);
    const prompt = Number(row.total_prompt_tokens ?? 0);
    return completion + prompt;
}

/**
 * Fetches the top N model IDs by total token usage from OpenRouter rankings.
 * Returns a Set of model IDs (e.g., "openai/gpt-4o").
 */
export async function fetchFeaturedModelIds(limit: number = FEATURED_MODEL_COUNT): Promise<Set<string>> {
    const blocks = await fetchOpenRouterRankingBlocks();

    // Pick the largest ranking data block (usually the main leaderboard)
    const biggest = blocks.reduce(
        (best, cur) => (cur.length > best.length ? cur : best),
        blocks[0]
    );
    const rows = biggest as OpenRouterRankingRow[];

    // Filter valid rows and sort by total tokens descending (matching OpenRouter leaderboard)
    const sorted = rows
        .filter((r) => typeof r?.model_permaslug === "string")
        .slice()
        .sort((a, b) => getTotalTokens(b) - getTotalTokens(a));

    const topIds = sorted.slice(0, limit).map((r) => r.model_permaslug);
    return new Set(topIds);
}

/**
 * Gets the set of featured model IDs, using cache if still valid.
 * Returns an empty set on failure to avoid blocking model fetching.
 */
async function getCachedFeaturedModelIds(): Promise<Set<string>> {
    const now = Date.now();

    if (cachedFeaturedModelIds && (now - lastRankingFetchTime) < RANKINGS_CACHE_TTL_MS) {
        return cachedFeaturedModelIds;
    }

    try {
        const featuredIds = await fetchFeaturedModelIds();
        cachedFeaturedModelIds = featuredIds;
        lastRankingFetchTime = now;
        logger.info(`Fetched OpenRouter rankings: ${featuredIds.size} featured models`);
        return featuredIds;
    } catch (error) {
        logger.warn(`Failed to fetch OpenRouter rankings: ${(error as Error).message}`);
        // Return existing cache if available, otherwise empty set
        return cachedFeaturedModelIds ?? new Set();
    }
}

// ============================================================================
// Model Caching
// ============================================================================

/**
 * Cached LLM models fetched from OpenRouter.
 */
let cachedLlmModels: ModelMetadata[] | null = null;
let lastLlmFetchTime: number = 0;
let cachedRawLlmModels: Map<string, any> | null = null;

/**
 * Cached image models fetched from OpenRouter.
 */
let cachedImageModels: ModelMetadata[] | null = null;
let lastImageFetchTime: number = 0;

/**
 * Cache TTL: 5 minutes
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetches and caches LLM models from OpenRouter.
 * 
 * @param apiKey - OpenRouter API key
 * @returns Array of LLM model metadata
 */
export async function fetchOpenRouterLlmModels(apiKey: string): Promise<ModelMetadata[]> {
    const now = Date.now();

    // Return cached models if still valid
    if (cachedLlmModels && (now - lastLlmFetchTime) < CACHE_TTL_MS) {
        logger.debug(`Returning cached OpenRouter LLM models (${cachedLlmModels.length} models)`);
        return cachedLlmModels;
    }

    try {
        const client = new OpenRouter({
            apiKey,
            httpReferer: "https://github.com/gerkensm/vaporvibe",
            xTitle: "VaporVibe (serve-llm)",
        });

        // Fetch models and rankings in parallel
        const [response, featuredIds] = await Promise.all([
            client.models.list(),
            getCachedFeaturedModelIds(),
        ]);
        const rawModels = response.data || [];

        // Cache raw models for debugging lookup
        cachedRawLlmModels = new Map(rawModels.map((m: any) => [m.id, m]));

        // Filter and transform to LLM models (exclude image-only models)
        const llmModels = rawModels
            .filter((model: any) => {
                // Exclude models that only support image output
                const outputModalities = model.architecture?.outputModalities || model.architecture?.output_modalities || [];
                const isImageOnly = outputModalities.includes("image") && !outputModalities.includes("text");
                return !isImageOnly;
            })
            .map((model: any) => {
                const isFeatured = Array.from(featuredIds).some(featuredId => {
                    if (featuredId === model.id) return true;
                    // Check for version/variant suffixes (e.g. "foo/bar" matching "foo/bar-2024" or "foo/bar:free")
                    // We check both directions because sometimes the ranking ID is versioned, sometimes the model ID is.
                    return featuredId.startsWith(model.id + "-") || featuredId.startsWith(model.id + ":") ||
                        model.id.startsWith(featuredId + "-") || model.id.startsWith(featuredId + ":");
                });
                return transformToModelMetadata(model, "openrouter", isFeatured);
            })
            .sort((a, b) => a.label.localeCompare(b.label));

        cachedLlmModels = llmModels;
        lastLlmFetchTime = now;

        const featuredCount = llmModels.filter(m => m.featured).length;
        logger.info(`Fetched ${llmModels.length} LLM models from OpenRouter (${featuredCount} featured)`);
        return llmModels;
    } catch (error) {
        logger.error(`Failed to fetch OpenRouter LLM models: ${(error as Error).message}`);

        // Return cached models if available, even if stale
        if (cachedLlmModels) {
            logger.warn("Returning stale cached OpenRouter LLM models due to fetch error");
            return cachedLlmModels;
        }

        // Return empty array as fallback
        return [];
    }
}

/**
 * Fetches and caches image models from OpenRouter.
 * 
 * Image models are those that include "image" in their output_modalities.
 * Uses both the standard JSON API and the RSS feed to discover "unlisted" models like Flux.
 * 
 * @param apiKey - OpenRouter API key
 * @returns Array of image model metadata
 */
export async function fetchOpenRouterImageModels(apiKey: string): Promise<ModelMetadata[]> {
    const now = Date.now();

    // Return cached models if still valid
    if (cachedImageModels && (now - lastImageFetchTime) < CACHE_TTL_MS) {
        logger.debug(`Returning cached OpenRouter image models (${cachedImageModels.length} models)`);
        return cachedImageModels;
    }

    try {
        const client = new OpenRouter({
            apiKey,
            httpReferer: "https://github.com/gerkensm/vaporvibe",
            xTitle: "VaporVibe (serve-llm)",
        });

        // Fetch standard models and unlisted models in parallel
        const [jsonResponse, unlistedModels] = await Promise.all([
            client.models.list(),
            fetchOpenRouterUnlistedModels(apiKey)
        ]);

        const rawModels = jsonResponse.data || [];

        // Filter standard models to image-capable ones
        const standardImageModels = rawModels
            .filter((model: any) => {
                const outputModalities = model.architecture?.outputModalities || model.architecture?.output_modalities || [];
                return outputModalities.includes("image");
            })
            .map((model: any) => transformToModelMetadata(model, "openrouter"));

        // Combine standard and unlisted models
        // Use a Map to deduplicate by ID (standard models win if there is an overlap)
        const combinedModelsMap = new Map<string, ModelMetadata>();

        // Add unlisted models first
        unlistedModels.forEach(m => combinedModelsMap.set(m.value, m));

        // Add standard models (overwriting any unlisted duplicates)
        standardImageModels.forEach(m => combinedModelsMap.set(m.value, m));

        const imageModels = Array.from(combinedModelsMap.values())
            .sort((a, b) => a.label.localeCompare(b.label));

        cachedImageModels = imageModels;
        lastImageFetchTime = now;

        logger.info(`Fetched ${imageModels.length} image models from OpenRouter (${standardImageModels.length} standard, ${imageModels.length - standardImageModels.length} unlisted)`);
        return imageModels;
    } catch (error) {
        logger.error(`Failed to fetch OpenRouter image models: ${(error as Error).message}`);

        // Return cached models if available, even if stale
        if (cachedImageModels) {
            logger.warn("Returning stale cached OpenRouter image models due to fetch error");
            return cachedImageModels;
        }

        // Return empty array as fallback
        return [];
    }
}

/**
 * Discovers "unlisted" models by parsing the official OpenRouter RSS feed.
 * These models are usable but omitted from the standard JSON API.
 */
async function fetchOpenRouterUnlistedModels(apiKey: string): Promise<ModelMetadata[]> {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/models?use_rss=true", {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://github.com/gerkensm/vaporvibe",
                "X-Title": "VaporVibe"
            }
        });

        if (!response.ok) {
            throw new Error(`OpenRouter RSS fetch failed with status ${response.status}`);
        }

        const xml = await response.text();
        const unlistedModels: ModelMetadata[] = [];

        // matches: <title><![CDATA[Provider: Model (slug)]]></title>
        // and: <link>https://openrouter.ai/slug[...params]</link>
        const itemRegex = /<item>[\s\S]*?<title><!\[CDATA\[.*? \(([^)]+)\)\]\]><\/title>[\s\S]*?<link>(https:\/\/openrouter\.ai\/[^<]+)<\/link>/g;
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
            const idFromTitle = match[1].trim();
            const link = match[2].trim();
            const modelSlug = link.replace("https://openrouter.ai/", "");

            // If ID from title is just a name, use the slug from link as ID
            const id = idFromTitle.includes("/") ? idFromTitle : modelSlug;

            // Include Flux and Riverflow models from the RSS feed
            if (id.includes("flux") || id.includes("riverflow")) {
                const name = id.split("/").pop()?.replace(/[-.]/g, " ") || id;
                unlistedModels.push({
                    value: id,
                    label: name.charAt(0).toUpperCase() + name.slice(1),
                    description: `${name} (Unlisted model discovered via RSS)`,
                    contextWindow: 128000 as any, // Cast to avoid NumericRange lint error
                    maxOutputTokens: 4096 as any,
                    reasoningTokens: { supported: false },
                    supportsReasoningMode: false,
                });
            }
        }

        return unlistedModels;
    } catch (error) {
        logger.warn(`Failed to fetch unlisted OpenRouter models via RSS: ${(error as Error).message}`);
        return [];
    }
}

/**
 * Transforms an OpenRouter model to our internal ModelMetadata format.
 */
function transformToModelMetadata(model: any, provider: ModelProvider, featured?: boolean): ModelMetadata {
    // Parse pricing information (prices are in USD per million tokens or per image)
    const promptCost = model.pricing?.prompt ? parseFloat(model.pricing.prompt) : undefined;
    const completionCost = model.pricing?.completion ? parseFloat(model.pricing.completion) : undefined;

    // Detect reasoning support
    // Architecture: "reasoning_effort" in supported_parameters usually implies configurable reasoning
    const supportedParams = model.supportedParameters || model.supported_parameters || [];
    const supportsReasoning = supportedParams.includes("reasoning_effort") || supportedParams.includes("reasoning");

    return {
        value: model.id,
        label: model.name || model.id,
        description: model.description || `${model.name} from OpenRouter`,
        contextWindow: model.context_length || model.contextLength,
        maxOutputTokens: model.top_provider?.max_completion_tokens || model.topProvider?.maxCompletionTokens,
        reasoningTokens: { supported: false }, // OpenRouter doesn't expose reasoning token support
        supportsReasoningMode: supportsReasoning,
        reasoningModes: supportsReasoning ? ["none", "low", "medium", "high"] : undefined,
        featured: featured || undefined,
        cost: (promptCost !== undefined || completionCost !== undefined) ? {
            currency: "USD",
            unit: "1M tokens",
            input: promptCost,
            output: completionCost,
        } : undefined,
    };
}

/**
 * Clears the cached models, forcing a fresh fetch on the next request.
 * Useful for testing or when API keys change.
 */
export function clearOpenRouterModelCache(): void {
    cachedLlmModels = null;
    cachedRawLlmModels = null;
    cachedImageModels = null;
    cachedFeaturedModelIds = null;
    lastLlmFetchTime = 0;
    lastImageFetchTime = 0;
    lastRankingFetchTime = 0;
    logger.debug("Cleared OpenRouter model cache (including rankings)");
}

/**
 * Retrieves the raw model object from OpenRouter for debugging.
 * Ensures the cache is populated if missing.
 */
export async function getOpenRouterModelRaw(apiKey: string, modelId: string): Promise<any | undefined> {
    if (!cachedRawLlmModels) {
        await fetchOpenRouterLlmModels(apiKey);
    }
    return cachedRawLlmModels?.get(modelId);
}
