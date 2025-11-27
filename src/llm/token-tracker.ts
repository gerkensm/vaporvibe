import type { LlmStreamObserver } from "./client.js";
import type { LlmUsageMetrics } from "../types.js";

export interface TokenDeltaPayload {
  produced: number;
  maxOutputTokens?: number;
}

const AVERAGE_CHARS_PER_TOKEN = 2;

function clampToInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function estimateTokenCount(text: string): number {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return 0;
  }
  return Math.max(1, Math.round(normalized.length / AVERAGE_CHARS_PER_TOKEN));
}

export function combineUsageTokenTotals(
  usage?: LlmUsageMetrics,
): number | undefined {
  if (!usage) return undefined;

  const output = Number.isFinite(usage.outputTokens)
    ? (usage.outputTokens as number)
    : undefined;
  const reasoning = Number.isFinite(usage.reasoningTokens)
    ? (usage.reasoningTokens as number)
    : undefined;

  if (output === undefined && reasoning === undefined) return undefined;
  if (output !== undefined && reasoning !== undefined) {
    return output + reasoning;
  }
  return output ?? reasoning;
}

export function createStreamingTokenTracker(
  observer?: LlmStreamObserver,
  maxOutputTokens?: number
): {
  addDelta(count: number): void;
  addFromText(text: string): void;
  addAbsolute(total: number): void;
  finalize(finalTotal?: number): void;
} {
  let produced = 0;
  let max = Number.isFinite(maxOutputTokens)
    ? Math.max(0, Math.floor(maxOutputTokens as number))
    : undefined;

  const emit = () => {
    if (!observer?.onTokenDelta) return;
    observer.onTokenDelta({ produced, maxOutputTokens: max });
  };

  const addDelta = (count: number) => {
    const delta = clampToInt(count);
    if (delta <= 0) return;
    produced += delta;
    emit();
  };

  const addFromText = (text: string) => {
    if (!text) return;
    const tokens = estimateTokenCount(text);
    addDelta(tokens);
  };

  const addAbsolute = (total: number) => {
    const normalized = clampToInt(total);
    if (max === undefined || normalized > max) {
      max = normalized;
    }
    if (normalized <= produced) return;
    produced = normalized;
    emit();
  };

  const finalize = (finalTotal?: number) => {
    if (Number.isFinite(finalTotal)) {
      addAbsolute(finalTotal as number);
    }
    if (max !== undefined && produced < max) {
      produced = max;
      emit();
      return;
    }
    emit();
  };

  return { addDelta, addFromText, addAbsolute, finalize };
}
