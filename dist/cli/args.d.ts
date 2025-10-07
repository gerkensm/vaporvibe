import type { ModelProvider } from "../types.js";
export interface CliOptions {
    port?: number;
    model?: string;
    provider?: ModelProvider;
    maxOutputTokens?: number;
    brief?: string;
    reasoningMode?: string;
    reasoningTokens?: number;
    instructionPanel?: string;
    historyLimit?: number;
    historyMaxBytes?: number;
    host?: string;
    showHelp?: boolean;
}
export declare function parseCliArgs(argv: string[]): CliOptions;
