import { OpenRouter } from "@openrouter/sdk";
import { ModelProvider, ReasoningMode } from "../types.js";
import type { ModelMetadata } from "./model-catalog.js";
import { logger } from "../logger.js";

/**
 * OpenRouter Model Metadata Fetcher
 * 
 * This module fetches model metadata from the OpenRouter API and normalizes it
 * into VaporVibe's internal ModelMetadata format.
 * 
 * ## Reasoning Support
 * 
 * OpenRouter provides a unified `reasoning` parameter that works across all
 * providers (Anthropic, OpenAI, Gemini, etc.). The API reports "reasoning" in
 * `supported_parameters` for models that support enhanced reasoning.
 * 
 * Per OpenRouter docs, you can use EITHER:
 * - `reasoning.effort` (low/medium/high) - qualitative control
 * - `reasoning.max_tokens` (token count) - quantitative control
 * 
 * **OpenRouter automatically converts between these** based on the upstream
 * provider's native API. For example:
 * - Anthropic: converts effort → budget_tokens (reasoning.max_tokens)
 * - OpenAI o1/o3: uses effort directly (reasoning_effort)
 * - Gemini 2.5: converts effort → thinking_budget
 * 
 * We use qualitative effort modes ("low", "medium", "high") for ALL models
 * since it's universally supported and simpler. This avoids hardcoding
 * model ID prefixes to determine quantitative vs qualitative support.
 * 
 * @see https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A single row from the OpenRouter rankings data.
 * Captures all available fields from the leaderboards.
 */
export interface OpenRouterRankingRow {
    date?: string;
    model_permaslug: string; // e.g. "openai/gpt-4o"
    variant?: string;
    variant_permaslug?: string; // e.g. "openai/gpt-4o:free"

    // Usage metrics (used for sorting)
    count?: number; // Request count
    total_prompt_tokens?: number;
    total_completion_tokens?: number;
    total_native_tokens_reasoning?: number;
    total_native_tokens_cached?: number;

    // Additional metrics
    total_tool_calls?: number;
    requests_with_tool_call_errors?: number;
    change?: number | null; // Rank change

    [k: string]: unknown;
}

/**
 * Map of model slug -> ranking row.
 */
export type OpenRouterRankingMap = Map<string, OpenRouterRankingRow>;

// ============================================================================
// Rankings Logic
// ============================================================================

/**
 * Handles fetching and parsing of OpenRouter ranking data.
 */
class OpenRouterRankings {
    private static cachedRankings: OpenRouterRankingRow[] | null = null;
    private static lastFetchTime: number = 0;
    private static readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

    /**
     * Fetches rankings and returns a map for quick lookup.
     */
    static async getRankingsMap(): Promise<OpenRouterRankingMap> {
        const rows = await this.getRankings();
        const map = new Map<string, OpenRouterRankingRow>();

        for (const row of rows) {
            // Index by model_permaslug (e.g. "openai/gpt-4o")
            if (row.model_permaslug) {
                // If variant exists (e.g. :free), keep the one with more usage
                const existing = map.get(row.model_permaslug);
                if (!existing || this.getTotalTokens(row) > this.getTotalTokens(existing)) {
                    map.set(row.model_permaslug, row);
                }
            }

            // Also index by variant_permaslug if available (e.g. "openai/gpt-4o:free")
            if (row.variant_permaslug) {
                map.set(row.variant_permaslug, row);
            }
        }

        return map;
    }

    /**
     * Gets the raw list of ranking rows, using cache if valid.
     */
    static async getRankings(): Promise<OpenRouterRankingRow[]> {
        const now = Date.now();
        if (this.cachedRankings && (now - this.lastFetchTime) < this.CACHE_TTL_MS) {
            return this.cachedRankings;
        }

        try {
            const rows = await this.fetchFromHtml();
            this.cachedRankings = rows;
            this.lastFetchTime = now;
            logger.info(`Fetched OpenRouter rankings: ${rows.length} rows`);
            return rows;
        } catch (error) {
            logger.warn(`Failed to fetch OpenRouter rankings: ${(error as Error).message}`);
            return this.cachedRankings || [];
        }
    }

    /**
     * Helper to calculate total tokens (prompt + completion).
     */
    static getTotalTokens(row: OpenRouterRankingRow): number {
        return (Number(row.total_completion_tokens) || 0) + (Number(row.total_prompt_tokens) || 0);
    }

    /**
     * Clears internal cache.
     */
    static clearCache() {
        this.cachedRankings = null;
        this.lastFetchTime = 0;
    }

    // --- Private HTML Parsing Logic ---

    private static async fetchFromHtml(): Promise<OpenRouterRankingRow[]> {
        const res = await fetch("https://openrouter.ai/rankings", {
            headers: {
                "user-agent": "Mozilla/5.0 (compatible; VaporVibe/1.0; +https://github.com/gerkensm/vaporvibe)",
                accept: "text/html,application/xhtml+xml",
            },
        });

        if (!res.ok) throw new Error(`Rankings fetch failed: ${res.status}`);

        const html = await res.text();
        const blocks = this.extractRankingBlocks(html);

        // Return the largest block (the main leaderboard)
        if (blocks.length === 0) return [];
        return blocks.reduce((a, b: any) => a.length > b.length ? a : b, []) as OpenRouterRankingRow[];
    }

    private static extractRankingBlocks(html: string): unknown[][] {
        const key = "rankingData";
        const blocks: unknown[][] = [];
        let from = 0;

        while (true) {
            // Locate "rankingData": or \"rankingData\":
            const idx1 = html.indexOf(`"${key}":`, from);
            const idx2 = html.indexOf(`\\"${key}\\":`, from);

            let idx = -1;
            let isEscaped = false;
            let offset = 0;

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
                    const arr = this.extractJsonArray(html, startBracket, isEscaped);
                    if (Array.isArray(arr)) blocks.push(arr);
                } catch { /* ignore parse errors */ }
            }
            from = idx + 10;
        }
        return blocks;
    }

    private static extractJsonArray(html: string, startIdx: number, isEscaped: boolean): unknown[] {
        let depth = 0;
        let inString = false;

        for (let i = startIdx; i < html.length; i++) {
            const ch = html[i];
            const next = html[i + 1] || "";

            if (inString) {
                if (isEscaped) {
                    if (ch === "\\" && next === "\\") { i++; continue; }
                    if (ch === "\\" && next === '"') { inString = false; i++; continue; }
                } else {
                    if (ch === "\\" && next === "\\") { i++; continue; }
                    if (ch === "\\" && next === '"') { i++; continue; }
                    if (ch === '"') { inString = false; continue; }
                }
            } else {
                if (isEscaped && ch === "\\" && next === '"') { inString = true; i++; continue; }
                else if (!isEscaped && ch === '"') { inString = true; continue; }

                if (ch === "[") depth++;
                if (ch === "]") depth--;
            }

            if (depth === 0) {
                const rawJson = html.slice(startIdx, i + 1);
                const jsonStr = isEscaped
                    ? rawJson.replace(/\\"/g, '"').replace(/\\\\/g, "\\")
                    : rawJson;
                return JSON.parse(jsonStr);
            }
        }
        throw new Error("Unterminated array");
    }
}

// ============================================================================
// Model Fetching & Caching
// ============================================================================

let cachedLlmModels: ModelMetadata[] | null = null;
let lastLlmFetchTime: number = 0;

let cachedImageModels: ModelMetadata[] | null = null;
let lastImageFetchTime: number = 0;

let cachedRawLlmModels: Map<string, any> | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches and caches LLM models from OpenRouter.
 * Sorts by usage (total tokens) and marks top models as featured.
 */
export async function fetchOpenRouterLlmModels(apiKey: string): Promise<ModelMetadata[]> {
    const now = Date.now();
    if (cachedLlmModels && (now - lastLlmFetchTime) < CACHE_TTL_MS) {
        return cachedLlmModels;
    }

    try {
        const client = new OpenRouter({
            apiKey,
            httpReferer: "https://github.com/gerkensm/vaporvibe",
            xTitle: "VaporVibe (serve-llm)",
        });

        // 1. Parallel fetch: Models API + Rankings
        const [response, rankingsMap] = await Promise.all([
            client.models.list(),
            OpenRouterRankings.getRankingsMap()
        ]);

        const rawModels = response.data || [];
        cachedRawLlmModels = new Map(rawModels.map((m: any) => [m.id, m]));

        // 2. Identify Featured Models (Top 20 by usage)
        const rankingList = Array.from(rankingsMap.values())
            .sort((a, b) => OpenRouterRankings.getTotalTokens(b) - OpenRouterRankings.getTotalTokens(a));

        const topFeaturedSlugs = new Set(
            rankingList.slice(0, 20).map(r => r.model_permaslug)
        );

        // 3. Transform & Attach Usage Data
        const llmModels = rawModels
            .filter((model: any) => !isImageOnlyModel(model))
            .map((model: any) => {
                // Find usage data via fuzzy match
                const usage = findUsageForModel(model.id, rankingsMap);
                const isFeatured = checkFeaturedStatus(model.id, topFeaturedSlugs);

                return transformToModelMetadata(model, "openrouter", isFeatured, usage);
            });

        // 4. Sort by Usage (Descending)
        // Fallback to alphabetical for models with 0 tokens
        llmModels.sort((a, b) => {
            const tokensA = (a.usage?.totalTokens || 0);
            const tokensB = (b.usage?.totalTokens || 0);

            if (tokensA !== tokensB) {
                return tokensB - tokensA;
            }
            return a.label.localeCompare(b.label);
        });

        cachedLlmModels = llmModels;
        lastLlmFetchTime = now;

        logger.info(`Fetched ${llmModels.length} LLM models from OpenRouter (Sorted by usage, ${topFeaturedSlugs.size} featured slugs)`);
        return llmModels;

    } catch (error) {
        logger.error(`Failed to fetch OpenRouter LLM models: ${(error as Error).message}`);
        return cachedLlmModels || [];
    }
}

/**
 * Fetches and caches image models.
 */
export async function fetchOpenRouterImageModels(apiKey: string): Promise<ModelMetadata[]> {
    const now = Date.now();
    if (cachedImageModels && (now - lastImageFetchTime) < CACHE_TTL_MS) {
        return cachedImageModels;
    }

    try {
        const client = new OpenRouter({ apiKey, httpReferer: "https://github.com/gerkensm/vaporvibe", xTitle: "VaporVibe" });

        const [jsonResponse, unlistedModels] = await Promise.all([
            client.models.list(),
            fetchOpenRouterUnlistedModels(apiKey)
        ]);

        const rawModels = jsonResponse.data || [];
        const standardImageModels = rawModels
            .filter((m: any) => isImageCapable(m))
            .map((m: any) => transformToModelMetadata(m, "openrouter"));

        // Merge standard + unlisted
        const map = new Map<string, ModelMetadata>();
        unlistedModels.forEach(m => map.set(m.value, m));
        standardImageModels.forEach(m => map.set(m.value, m));

        // Alphabetical sort for image models (usage data less critical here)
        const imageModels = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));

        cachedImageModels = imageModels;
        lastImageFetchTime = now;
        return imageModels;

    } catch (error) {
        logger.error(`Failed to fetch image models: ${(error as Error).message}`);
        return cachedImageModels || [];
    }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Finds ranking row for a model ID using fuzzy matching logic.
 */
function findUsageForModel(modelId: string, map: OpenRouterRankingMap): OpenRouterRankingRow | undefined {
    // 1. Exact match
    if (map.has(modelId)) return map.get(modelId);

    // 2. Fuzzy match against all keys in map
    // (This is O(N) but map size is small (~200), acceptable for now)
    for (const [slug, row] of map.entries()) {
        if (slug.startsWith(modelId + "-") || slug.startsWith(modelId + ":") ||
            modelId.startsWith(slug + "-") || modelId.startsWith(slug + ":")) {
            return row;
        }
    }
    return undefined;
}

/**
 * Checks if a model ID corresponds to a featured slug.
 */
function checkFeaturedStatus(modelId: string, featuredSlugs: Set<string>): boolean {
    if (featuredSlugs.has(modelId)) return true;
    for (const slug of featuredSlugs) {
        if (slug.startsWith(modelId + "-") || slug.startsWith(modelId + ":") ||
            modelId.startsWith(slug + "-") || modelId.startsWith(slug + ":")) {
            return true;
        }
    }
    return false;
}

function isImageOnlyModel(model: any): boolean {
    const modalities = model.architecture?.outputModalities || model.architecture?.output_modalities || [];
    return modalities.includes("image") && !modalities.includes("text");
}

function isImageCapable(model: any): boolean {
    const modalities = model.architecture?.outputModalities || model.architecture?.output_modalities || [];
    return modalities.includes("image");
}

function transformToModelMetadata(
    model: any,
    provider: ModelProvider,
    featured?: boolean,
    usage?: OpenRouterRankingRow
): ModelMetadata {
    const pricing = model.pricing;
    const supportedParams = model.supportedParameters || model.supported_parameters || [];

    // Reasoning Detection Logic
    // OpenRouter normalizes reasoning via the unified "reasoning" param.
    // Per OpenRouter docs, you can use EITHER:
    //   - reasoning.effort (low/medium/high) 
    //   - reasoning.max_tokens (token count)
    // OpenRouter automatically converts between them based on the upstream provider.
    // We use effort for ALL models since it's universally supported and simpler.
    let supportsReasoningMode = false;
    let reasoningModes: ReasoningMode[] | undefined = undefined;
    const reasoningTokens = { supported: false };

    const hasReasoning = supportedParams.includes("reasoning");
    const hasIncludeReasoning = supportedParams.includes("include_reasoning");

    if (hasReasoning) {
        // Model supports OpenRouter's unified reasoning param
        // Use qualitative effort modes - OpenRouter converts to max_tokens for Anthropic/Gemini
        supportsReasoningMode = true;
        reasoningModes = ["low", "medium", "high"];
    } else if (hasIncludeReasoning) {
        // Legacy toggle-only reasoning (include_reasoning without "reasoning")
        supportsReasoningMode = true;
        reasoningModes = ["default", "none"];
    }

    const contextWindow = model.context_length || model.contextLength || 0;
    let maxOutput = model.top_provider?.max_completion_tokens ||
        model.topProvider?.maxCompletionTokens;

    // Default heuristics if not provided by OpenRouter
    // Many providers report max_completion_tokens: null but still support large outputs.
    // For large-context models (> 32k), assume they can output up to their context size (capped at 64k).
    // For smaller models, use a conservative 4096 default.
    if (maxOutput === null || maxOutput === undefined) {
        if (model.id.includes("gemini-2.0-flash")) {
            maxOutput = 8192; // Gemini 2.0 Flash default output limit
        } else if (contextWindow > 32000) {
            // Large context models often support output = context (DeepSeek V3, etc.)
            maxOutput = Math.min(contextWindow, 64000);
        } else {
            maxOutput = Math.min(contextWindow || 4096, 4096);
        }
    }

    // Safety Cap Logic:
    // 1. If maxOutput mirrors contextWindow (common misreporting), cap at 64k.
    // 2. If maxOutput is very large (> 64k) but model is NOT a reasoning model, cap at 64k.
    // 3. For any model, never trust more than 128k completion tokens in this context.
    if (contextWindow > 128000) {
        if (maxOutput >= contextWindow || (!supportsReasoningMode && maxOutput > 64000)) {
            maxOutput = 64000;
        } else if (maxOutput > 128000) {
            maxOutput = 128000;
        }
    }

    // Specific heuristic for Anthropic Opus which OpenRouter sometimes misreports
    if (model.id.includes("claude-3-opus") && maxOutput > 4096) {
        maxOutput = 4096;
    }

    const metadata: ModelMetadata = {
        value: model.id,
        label: model.name || model.id,
        description: model.description || `${model.name} from OpenRouter`,
        contextWindow: contextWindow,
        maxOutputTokens: {
            min: 256,
            max: maxOutput,
            default: Math.min(maxOutput, 16384),
            step: 256,
        },

        // Reasoning tokens: use pre-calculated support
        reasoningTokens: reasoningTokens,
        supportsReasoningMode: supportsReasoningMode,
        reasoningModes: reasoningModes,
        featured: featured || undefined,

        // Pricing: Scale by 1,000,000 (OpenRouter gives per-token, we want per-1M)
        cost: (pricing) ? {
            currency: "USD",
            unit: "1M tokens",
            input: pricing.prompt ? parseFloat(pricing.prompt) * 1000000 : undefined,
            output: pricing.completion ? parseFloat(pricing.completion) * 1000000 : undefined,
        } : undefined,
    };

    // Attach usage data if available (dynamically added to keep types clean elsewhere)
    if (usage) {
        (metadata as any).usage = {
            totalTokens: (usage.total_prompt_tokens || 0) + (usage.total_completion_tokens || 0),
            totalPromptTokens: usage.total_prompt_tokens,
            totalCompletionTokens: usage.total_completion_tokens
        };
    }

    return metadata;
}

// RSS fetching function kept for completeness, assuming it works fine
async function fetchOpenRouterUnlistedModels(apiKey: string): Promise<ModelMetadata[]> {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/models?use_rss=true", {
            headers: { "Authorization": `Bearer ${apiKey}`, "X-Title": "VaporVibe" }
        });
        if (!response.ok) throw new Error(`Status ${response.status}`);

        const xml = await response.text();
        const unlisted: ModelMetadata[] = [];
        const regex = /<title><!\[CDATA\[.*? \(([^)]+)\)\]\]><\/title>[\s\S]*?<link>(https:\/\/openrouter\.ai\/[^<]+)<\/link>/g;
        let match;

        while ((match = regex.exec(xml)) !== null) {
            const idFromTitle = match[1].trim();
            const link = match[2].trim();
            const slug = link.replace("https://openrouter.ai/", "");
            const id = idFromTitle.includes("/") ? idFromTitle : slug;

            if (id.includes("flux") || id.includes("riverflow")) {
                const name = id.split("/").pop()?.replace(/[-.]/g, " ") || id;
                unlisted.push({
                    value: id,
                    label: name.charAt(0).toUpperCase() + name.slice(1),
                    description: `Unlisted model via RSS`,
                    contextWindow: 128000 as any,
                    maxOutputTokens: 4096 as any,
                    reasoningTokens: { supported: false },
                    supportsReasoningMode: false,
                });
            }
        }
        return unlisted;
    } catch (e) {
        logger.warn(`RSS fetch failed: ${(e as Error).message}`);
        return [];
    }
}

export function clearOpenRouterModelCache(): void {
    cachedLlmModels = null;
    cachedRawLlmModels = null;
    cachedImageModels = null;
    OpenRouterRankings.clearCache();
    lastLlmFetchTime = 0;
    lastImageFetchTime = 0;
    logger.debug("Cleared OpenRouter cache");
}

export async function getOpenRouterModelRaw(apiKey: string, modelId: string): Promise<any | undefined> {
    if (!cachedRawLlmModels) await fetchOpenRouterLlmModels(apiKey);
    return cachedRawLlmModels?.get(modelId);
}

// Export for backward compatibility if needed, though mostly internal now
export const fetchFeaturedModelIds = async (limit: number = 20) => {
    const map = await OpenRouterRankings.getRankingsMap();
    const sorted = Array.from(map.values())
        .sort((a, b: any) => OpenRouterRankings.getTotalTokens(b) - OpenRouterRankings.getTotalTokens(a));
    return new Set(sorted.slice(0, limit).map(r => r.model_permaslug));
};
