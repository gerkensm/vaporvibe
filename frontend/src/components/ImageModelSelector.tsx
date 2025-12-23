import { useMemo } from "react";
import "./ImageModelSelector.css";

type ImageProvider = "openai" | "gemini" | "openrouter";

const PROVIDER_INFO: Record<string, { title: string; models: string }> = {
    openai: {
        title: "OpenAI",
        models: "GPT Image, DALL·E",
    },
    gemini: {
        title: "Google",
        models: "Imagen, Nano Banana",
    },
    openrouter: {
        title: "OpenRouter",
        models: "Any Model",
    },
};

export interface ImageModelSelectorProps {
    enabled: boolean;
    modelId: string;
    apiKey: string;
    hasStoredKey: boolean;
    catalog: Record<string, Array<{ value: string; label: string }>>;
    onEnabledChange: (enabled: boolean) => void;
    onModelChange: (modelId: string) => void;
    onApiKeyChange: (apiKey: string) => void;
}

export function ImageModelSelector({
    enabled,
    modelId,
    apiKey,
    hasStoredKey,
    catalog,
    onEnabledChange,
    onModelChange,
    onApiKeyChange,
}: ImageModelSelectorProps) {

    // Flatten catalog to find current provider easily
    const allModels = useMemo(() => {
        const models: Array<{ value: string; label: string; provider: string }> = [];
        Object.entries(catalog).forEach(([provider, items]) => {
            items.forEach((item) => {
                models.push({ ...item, provider });
            });
        });
        return models;
    }, [catalog]);

    const getProviderFromModel = (id: string): string => {
        const found = allModels.find(m => m.value === id);
        return found?.provider ?? "openai";
    };

    const currentProvider = useMemo(() => getProviderFromModel(modelId), [modelId, allModels]);

    const modelsForProvider = useMemo(
        () => catalog[currentProvider] || [],
        [catalog, currentProvider]
    );

    const handleProviderChange = (provider: string) => {
        const models = catalog[provider];
        if (models && models.length > 0) {
            onModelChange(models[0].value);
        }
    };

    const availableProviders = useMemo(() => Object.keys(catalog), [catalog]);

    return (
        <div className="image-model-selector">
            <div className="image-model-selector__header">
                <div>
                    <div className="image-model-selector__title-row">
                        <span className="image-model-selector__icon" aria-hidden="true">
                            🎨
                        </span>
                        <h3 className="image-model-selector__title">Image Generation</h3>
                    </div>
                    <p className="image-model-selector__tagline">
                        Bring your prototypes to life with AI-generated images
                    </p>
                </div>

                <label className="image-model-selector__toggle">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => onEnabledChange(e.target.checked)}
                    />
                    <span className="image-model-selector__toggle-track" />
                    <span className="image-model-selector__toggle-label">
                        {enabled ? "On" : "Off"}
                    </span>
                </label>
            </div>

            <div className={`image-model-selector__body${enabled ? "" : " is-disabled"}`}>
                <div className="image-model-selector__providers">
                    {availableProviders.map((provider) => {
                        const info = PROVIDER_INFO[provider] || { title: provider, models: "Custom" };
                        const isActive = currentProvider === provider;
                        return (
                            <button
                                key={provider}
                                type="button"
                                className={`image-model-selector__provider${isActive ? " is-active" : ""}`}
                                disabled={!enabled}
                                onClick={() => handleProviderChange(provider)}
                            >
                                <span className="image-model-selector__provider-title">
                                    {info.title}
                                </span>
                                <span className="image-model-selector__provider-models">
                                    {info.models}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="image-model-selector__model-select">
                    <label htmlFor="image-model">Model</label>
                    <select
                        id="image-model"
                        value={modelId}
                        onChange={(e) => onModelChange(e.target.value)}
                        disabled={!enabled}
                    >
                        {modelsForProvider.map((model) => (
                            <option key={model.value} value={model.value}>
                                {model.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="image-model-selector__api-key">
                    <label htmlFor="image-api-key">API key (optional)</label>
                    <input
                        id="image-api-key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => onApiKeyChange(e.target.value)}
                        placeholder={hasStoredKey ? "Key stored" : "Enter API key"}
                        disabled={!enabled}
                    />
                    <p className="image-model-selector__helper">
                        {hasStoredKey
                            ? "A key is already saved. Leave blank to keep it."
                            : "Leave blank to reuse your main provider key if compatible."}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ImageModelSelector;
