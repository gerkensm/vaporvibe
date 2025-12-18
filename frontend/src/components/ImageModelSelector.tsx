import { useMemo } from "react";
import type { AdminImageGenerationInfo } from "../api/types";
import "./ImageModelSelector.css";

type ImageProvider = "openai" | "gemini";

interface ImageModelOption {
    value: string;
    label: string;
    provider: ImageProvider;
}

const IMAGE_MODELS: ImageModelOption[] = [
    { value: "gpt-image-1.5", label: "GPT Image 1.5 (recommended)", provider: "openai" },
    { value: "dall-e-3", label: "DALL·E 3", provider: "openai" },
    { value: "gemini-3-pro-image-preview", label: "Nano Banana Pro (Gemini 3)", provider: "gemini" },
    { value: "gemini-2.5-flash-image", label: "Nano Banana (Gemini 2.5)", provider: "gemini" },
    { value: "imagen-4.0-fast-generate-001", label: "Imagen 4 (Fast)", provider: "gemini" },
    { value: "imagen-3.0-generate-002", label: "Imagen 3", provider: "gemini" },
];

const PROVIDER_INFO: Record<ImageProvider, { title: string; models: string }> = {
    openai: {
        title: "OpenAI",
        models: "GPT Image, DALL·E",
    },
    gemini: {
        title: "Google",
        models: "Imagen, Nano Banana",
    },
};

function getProviderFromModel(modelId: string): ImageProvider {
    const model = IMAGE_MODELS.find((m) => m.value === modelId);
    return model?.provider ?? "openai";
}

export interface ImageModelSelectorProps {
    enabled: boolean;
    modelId: string;
    apiKey: string;
    hasStoredKey: boolean;
    onEnabledChange: (enabled: boolean) => void;
    onModelChange: (modelId: string) => void;
    onApiKeyChange: (apiKey: string) => void;
}

export function ImageModelSelector({
    enabled,
    modelId,
    apiKey,
    hasStoredKey,
    onEnabledChange,
    onModelChange,
    onApiKeyChange,
}: ImageModelSelectorProps) {
    const currentProvider = useMemo(() => getProviderFromModel(modelId), [modelId]);

    const modelsForProvider = useMemo(
        () => IMAGE_MODELS.filter((m) => m.provider === currentProvider),
        [currentProvider]
    );

    const handleProviderChange = (provider: ImageProvider) => {
        const firstModel = IMAGE_MODELS.find((m) => m.provider === provider);
        if (firstModel) {
            onModelChange(firstModel.value);
        }
    };

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
                    {(["openai", "gemini"] as const).map((provider) => {
                        const info = PROVIDER_INFO[provider];
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
