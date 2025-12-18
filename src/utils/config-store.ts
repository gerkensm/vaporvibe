import Conf from "conf";
import type {
    ImageGenProvider,
    ImageModelId,
    ModelProvider,
    ReasoningMode,
} from "../types.js";
import { logger } from "../logger.js";

interface ConfigSchema {
    imageGeneration: {
        enabled: boolean;
        provider: ImageGenProvider;
        modelId: ImageModelId;
    };
    llm: {
        provider: ModelProvider;
        model: string;
        maxOutputTokens: number;
        reasoningMode: ReasoningMode;
        reasoningTokens?: number;
        reasoningTokensEnabled?: boolean;
    };
}

/**
 * Persistent configuration store using platform-specific paths
 * - macOS: ~/Library/Application Support/VaporVibe/config.json
 * - Windows: %APPDATA%\VaporVibe\config.json
 * - Linux: ~/.config/vaporvibe/config.json
 */
class ConfigStore {
    private store: Conf<ConfigSchema>;

    constructor() {
        this.store = new Conf<ConfigSchema>({
            projectName: "vaporvibe",
            defaults: {
                imageGeneration: {
                    enabled: false,
                    provider: "openai",
                    modelId: "gpt-image-1.5",
                },
                llm: {
                    provider: "openai",
                    model: "gpt-4o",
                    maxOutputTokens: 4096,
                    reasoningMode: "none",
                },
            },
        });

        logger.debug(
            { path: this.store.path },
            "Config store initialized at platform-specific path"
        );
    }

    /**
     * Get image generation settings
     */
    getImageGeneration(): ConfigSchema["imageGeneration"] | undefined {
        return this.store.get("imageGeneration");
    }

    /**
     * Save image generation settings
     */
    setImageGeneration(config: ConfigSchema["imageGeneration"]): void {
        this.store.set("imageGeneration", config);
        logger.debug({ config }, "Saved image generation settings to config file");
    }

    /**
     * Get LLM provider/model settings
     */
    getLlmSettings(): ConfigSchema["llm"] | undefined {
        return this.store.get("llm");
    }

    /**
     * Save LLM provider/model settings
     */
    setLlmSettings(config: ConfigSchema["llm"]): void {
        this.store.set("llm", config);
        logger.debug({ config }, "Saved LLM settings to config file");
    }

    /**
     * Get the full config file path for debugging
     */
    getConfigPath(): string {
        return this.store.path;
    }

    /**
     * Clear all stored configuration
     */
    clear(): void {
        this.store.clear();
        logger.info("Cleared all stored configuration");
    }
}

/**
 * Singleton instance for global access
 */
let instance: ConfigStore | null = null;

export function getConfigStore(): ConfigStore {
    if (!instance) {
        instance = new ConfigStore();
    }
    return instance;
}
