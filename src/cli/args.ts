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
  showHelp?: boolean;
}

const FLAG_MAP: Record<string, keyof CliOptions> = {
  port: "port",
  p: "port",
  model: "model",
  provider: "provider",
  maxTokens: "maxOutputTokens",
  "max-tokens": "maxOutputTokens",
  "max-output-tokens": "maxOutputTokens",
  reasoning: "reasoningMode",
  "reasoning-mode": "reasoningMode",
  reasoningMode: "reasoningMode",
  "reasoning-tokens": "reasoningTokens",
  reasoningTokens: "reasoningTokens",
  instructions: "instructionPanel",
  "instructions-panel": "instructionPanel",
};

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (token.startsWith("--")) {
      const [rawKey, rawValue] = token.slice(2).split("=", 2);
      if (rawKey === "help" || rawKey === "h") {
        options.showHelp = true;
        continue;
      }
      const key = FLAG_MAP[rawKey];
      if (!key) {
        positionals.push(token);
        continue;
      }
      const value = rawValue ?? argv[++i];
      if (value === undefined) {
        throw new Error(`Missing value for flag --${rawKey}`);
      }
      assignOption(options, key, value);
      continue;
    }

    if (token.startsWith("-")) {
      const rawKey = token.slice(1);
      if (rawKey === "h") {
        options.showHelp = true;
        continue;
      }
      const key = FLAG_MAP[rawKey];
      if (!key) {
        positionals.push(token);
        continue;
      }
      const value = argv[++i];
      if (value === undefined) {
        throw new Error(`Missing value for flag -${rawKey}`);
      }
      assignOption(options, key, value);
      continue;
    }

    positionals.push(token);
  }

  if (positionals.length > 0) {
    options.brief = positionals.join(" ").trim();
  }

  return options;
}

function assignOption(options: CliOptions, key: keyof CliOptions, value: string): void {
  if (key === "port" || key === "maxOutputTokens" || key === "reasoningTokens") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Expected a positive numeric value for ${String(key)}, received: ${value}`);
    }
    (options as Record<string, unknown>)[key] = parsed;
    return;
  }
  if (key === "reasoningMode" || key === "instructionPanel") {
    (options as Record<string, unknown>)[key] = value.trim();
    return;
  }
  (options as Record<string, unknown>)[key] = value;
}
