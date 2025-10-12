import type { ModelProvider } from "../../types.js";
import { MODEL_INSPECTOR_STYLES } from "./model-inspector.js";
interface ModelSelectorOptions {
    provider: ModelProvider;
    providerLabel: string;
    selectedModel: string;
    selectId: string;
    customInputId: string;
    inputName: string;
    note?: string;
    hint?: string;
}
export declare function renderModelSelector(options: ModelSelectorOptions): string;
export declare const MODEL_SELECTOR_STYLES = "\n  .model-selector {\n    display: grid;\n    gap: 12px;\n  }\n  .model-custom {\n    display: grid;\n    gap: 12px;\n  }\n  .model-custom[hidden] {\n    display: none;\n  }\n  .model-note {\n    margin: -8px 0 0;\n    font-size: 0.85rem;\n    color: var(--subtle);\n  }\n  .model-hint {\n    margin: 0;\n    font-size: 0.85rem;\n    color: var(--subtle);\n  }\n";
export declare const MODEL_SELECTOR_RUNTIME: string;
export declare function renderModelSelectorDataScript(): string;
export { MODEL_INSPECTOR_STYLES };
