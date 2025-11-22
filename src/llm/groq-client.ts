import OpenAI from "openai";
import type {
  ChatMessage,
  LlmReasoningTrace,
  LlmUsageMetrics,
  ProviderSettings,
  VerificationResult,
  ReasoningMode,
} from "../types.js";
import type {
  LlmClient,
  LlmResult,
  LlmGenerateOptions,
  LlmStreamObserver,
} from "./client.js";
import { logger } from "../logger.js";
import { supportsImageInput } from "./capabilities.js";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

const MAX_GROQ_IMAGE_ATTACHMENTS = 5;
const MAX_GROQ_IMAGE_BYTES = 4 * 1024 * 1024;

/** Models with Groq reasoning knobs on the Chat API */
const GROQ_REASONING_SUPPORTED_MODELS = new Set<string>([
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3-32b",
]);

/** GPT-OSS supports explicit effort low|medium|high on Chat */
const GROQ_MODEL_REASONING_EFFORT: Record<string, ReasoningMode[]> = {
  "openai/gpt-oss-20b": ["none", "low", "medium", "high"],
  "openai/gpt-oss-120b": ["none", "low", "medium", "high"],
  "qwen/qwen3-32b": ["none", "default"],
};

type ImageAttachment = {
  mimeType: string;
  base64: string;
  name: string;
  size: number;
};

export class GroqClient implements LlmClient {
  readonly settings: ProviderSettings;
  private readonly client: OpenAI;

  constructor(settings: ProviderSettings) {
    this.settings = settings;
    this.client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: GROQ_BASE_URL,
    });
    if (typeof settings.reasoningTokens === "number") {
      logger.info(
        `Groq does not expose a separate reasoning token budget; ignoring requested value ${settings.reasoningTokens}.`
      );
    }
  }

  async generateHtml(
    messages: ChatMessage[],
    options: LlmGenerateOptions = {}
  ): Promise<LlmResult> {
    // Convert your internal messages to Chat Completions messages
    const chatMessages = messages.map((m) =>
      toChatCompletionMessage(
        this.settings.model,
        m.content,
        m.role,
        m.attachments as any
      )
    );

    const request: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: this.settings.model,
      messages: chatMessages,
      stream: true,
      max_completion_tokens: this.settings.maxOutputTokens,
    };

    applyReasoningOptionsForChat(request, this.settings);

    const stream = this.client.chat.completions.stream(request);
    const htmlChunks: string[] = [];
    const observer = options.streamObserver;
    const streamingTracker: StreamingReasoningTracker = {
      summaryBuffer: "",
      detailBuffer: "",
    };
    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta;
      const content = delta?.content;
      if (Array.isArray(content)) {
        for (const part of content) {
          const text = (part as any)?.text;
          if (typeof text === "string") {
            htmlChunks.push(text);
          }
        }
      } else if (typeof content === "string") {
        htmlChunks.push(content);
      }
      const reasoningDelta = (delta as any)?.reasoning;
      if (reasoningDelta !== undefined) {
        processStreamingReasoningDelta(
          reasoningDelta,
          streamingTracker,
          observer
        );
      }
    }

    const resp = await stream.finalChatCompletion();

    const htmlFromStream = htmlChunks.join("");
    const html =
      htmlFromStream.length > 0 ? htmlFromStream : extractHtmlFromChat(resp);
    const usage = extractUsageFromChat(resp);
    const reasoningFromResponse = extractReasoningFromChat(
      resp,
      this.settings.reasoningMode,
      this.settings.model
    );

    const reasoning = mergeReasoningTraces(
      reasoningFromResponse,
      streamingTracker.summaryBuffer,
      streamingTracker.detailBuffer
    );
    logger.info(`Reasoning: ${JSON.stringify(reasoning)}`);

    return {
      html,
      usage,
      reasoning,
      raw: resp,
    };
  }
}

export async function verifyGroqApiKey(
  apiKey: string
): Promise<VerificationResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, message: "Enter a Groq API key to continue." };
  }
  const client = new OpenAI({
    apiKey: trimmed,
    baseURL: GROQ_BASE_URL,
  });
  try {
    await client.models.list();
    return { ok: true };
  } catch (error) {
    const status = extractStatus(error);
    if (status === 401 || status === 403) {
      return {
        ok: false,
        message: "Groq rejected that key. Confirm the value and try again.",
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Unable to reach Groq: ${message}` };
  }
}

/* ----------------------- helpers ----------------------- */

function toChatCompletionMessage(
  model: string,
  text: string,
  role: "system" | "user" | "assistant",
  attachments?: ImageAttachment[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  // If there are no attachments, send simple string content
  if (!attachments || attachments.length === 0) {
    return { role, content: text };
  }

  // Otherwise, send multi-part content: text + image_url parts (OpenAI-compatible)
  const parts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" } }
  > = [];

  if (text && text.length > 0) {
    parts.push({ type: "text", text });
  }

  const modelSupportsVision = supportsImageInput("groq", model);
  let imagesAdded = 0;

  for (const a of attachments) {
    const mimeType = (a.mimeType || "image/png").toLowerCase();
    if (mimeType.startsWith("image/") && modelSupportsVision) {
      if (imagesAdded >= MAX_GROQ_IMAGE_ATTACHMENTS) {
        logger.warn(
          `Skipping image attachment ${a.name} — Groq vision models accept at most ${MAX_GROQ_IMAGE_ATTACHMENTS} images per message.`
        );
        continue;
      }
      const imageBytes = getBase64ByteSize(a.base64);
      if (imageBytes === null) {
        logger.warn(
          `Skipping attachment ${a.name} — invalid base64 payload provided.`
        );
        continue;
      }
      if (imageBytes > MAX_GROQ_IMAGE_BYTES) {
        logger.warn(
          `Skipping image attachment ${a.name} (${imageBytes} bytes) — Groq vision models require base64 images under ${MAX_GROQ_IMAGE_BYTES} bytes.`
        );
        continue;
      }
      parts.push({
        type: "image_url",
        image_url: {
          url: buildImageDataUrl(mimeType, a.base64),
        },
      });
      imagesAdded += 1;
    } else {
      // Non-image attachments: inline a description so the model can see the data
      const desc = `Attachment ${a.name} (${a.mimeType}, ${a.size} bytes) encoded in Base64:`;
      parts.push({ type: "text", text: `${desc}\n${a.base64}` });
    }
  }

  // The OpenAI SDK accepts an array of content parts for multimodal
  if (parts.length === 0) {
    return { role, content: text };
  }
  return { role, content: parts as any };
}

function buildImageDataUrl(mimeType: string, base64: string): string {
  const safeMime =
    mimeType && mimeType.trim().length > 0 ? mimeType : "image/png";
  return `data:${safeMime};base64,${base64}`;
}

function getBase64ByteSize(base64: string): number | null {
  try {
    return Buffer.from(base64, "base64").byteLength;
  } catch (error) {
    logger.debug(
      `Failed to measure base64 payload size: ${(error as Error).message}`
    );
    return null;
  }
}

/* -------------------- extraction helpers -------------------- */

function extractHtmlFromChat(
  resp: OpenAI.Chat.Completions.ChatCompletion
): string {
  const choice = resp.choices?.[0];
  if (!choice) return "";

  // Content may be a simple string or an array of parts (for images etc.)
  const content = choice.message?.content as
    | string
    | Array<{ type?: string; text?: string }>;

  if (typeof content === "string") {
    const trimmed = content;
    if (trimmed) return trimmed;
  } else if (Array.isArray(content)) {
    const text = content
      .map((p) =>
        p?.type === "text" && typeof p?.text === "string" ? p.text : ""
      )
      .join("");
    return text;
  }

  // Fallback: try to read from tool calls or other deltas (unlikely here)
  return "";
}

function extractUsageFromChat(
  resp: OpenAI.Chat.Completions.ChatCompletion
): LlmUsageMetrics | undefined {
  const usage = resp.usage;
  if (!usage) return undefined;

  const metrics: LlmUsageMetrics = {};
  if (Number.isFinite(usage.prompt_tokens)) {
    metrics.inputTokens = Number(usage.prompt_tokens);
  }
  if (Number.isFinite(usage.completion_tokens)) {
    metrics.outputTokens = Number(usage.completion_tokens);
  }
  if (Number.isFinite(usage.total_tokens)) {
    metrics.totalTokens = Number(usage.total_tokens);
  }

  // Keep any vendor-specific extras
  const anyUsage: Record<string, unknown> = usage as any;
  const providerEntries = Object.entries(anyUsage).filter(
    ([, v]) => typeof v === "number" || typeof v === "string"
  );
  if (providerEntries.length > 0) {
    metrics.providerMetrics = Object.fromEntries(providerEntries);
  }

  if (
    metrics.inputTokens === undefined &&
    metrics.outputTokens === undefined &&
    metrics.totalTokens === undefined &&
    !metrics.providerMetrics
  ) {
    return undefined;
  }
  return metrics;
}

function extractReasoningFromChat(
  resp: OpenAI.Chat.Completions.ChatCompletion,
  mode: ProviderSettings["reasoningMode"],
  model: string
): LlmReasoningTrace | undefined {
  if (!mode || mode === "none") return undefined;
  const normalized = normalizeModelId(model);
  if (!GROQ_REASONING_SUPPORTED_MODELS.has(normalized)) return undefined;

  try {
    const details = new Set<string>();
    const summaries = new Set<string>();

    // 1) Some models will put structured reasoning in message fields (future-proof)
    const choice = resp.choices?.[0];
    const msg: any = choice?.message;

    // Groq Chat with include_reasoning may add a `reasoning` object or put reasoning parts in content.
    if (msg?.reasoning) {
      const r = msg.reasoning;
      if (typeof r.summary === "string" && r.summary) {
        summaries.add(r.summary);
      }
      if (typeof r.text === "string" && r.text) {
        details.add(r.text);
      }
      // If it’s nested arrays/objects, flatten conservatively:
      collectReasoningContent(r, { summaries, details }, "reasoning");
    }

    // 2) Many models still emit <think>…</think> blocks in the text; capture those too
    const mainText = extractHtmlFromChat(resp);
    if (mainText) {
      for (const block of extractThinkSections(mainText)) {
        details.add(block);
      }
    }

    // If nothing was found, stop here
    if (summaries.size === 0 && details.size === 0) {
      return undefined;
    }

    return {
      summaries: summaries.size ? Array.from(summaries) : undefined,
      details: details.size ? Array.from(details) : undefined,
      raw: msg?.reasoning ?? undefined,
    };
  } catch (err) {
    logger.warn(
      `Failed to capture Groq reasoning metadata (chat): ${(err as Error).message
      }`
    );
    return undefined;
  }
}

function extractThinkSections(text?: string): string[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const matches = text.match(/<think>[\s\S]*?<\/think>/gi);
  return (
    matches?.map((m) => m.replace(/<\/?think>/gi, "")).filter(Boolean) ?? []
  );
}

interface ReasoningAccumulator {
  summaries: Set<string>;
  details: Set<string>;
}

function collectReasoningContent(
  node: unknown,
  acc: ReasoningAccumulator,
  context: string
): void {
  if (node === null || node === undefined) return;

  if (typeof node === "string") {
    const text = node;
    if (!text) return;
    if (context.includes("summary")) acc.summaries.add(text);
    else acc.details.add(text);
    return;
  }

  if (Array.isArray(node)) {
    for (const entry of node) collectReasoningContent(entry, acc, context);
    return;
  }

  if (typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  const type =
    typeof record.type === "string" ? record.type.toLowerCase() : undefined;
  const nextContext = type
    ? type.includes("summary")
      ? "summary"
      : context
    : context;

  if (typeof record.text === "string") {
    const text = record.text;
    if (text) {
      if (nextContext.includes("summary")) acc.summaries.add(text);
      else acc.details.add(text);
    }
  }

  if (record.summary !== undefined) {
    collectReasoningContent(record.summary, acc, "summary");
  }
  if (record.reasoning !== undefined) {
    collectReasoningContent(record.reasoning, acc, nextContext || "reasoning");
  }
  if (record.details !== undefined) {
    collectReasoningContent(record.details, acc, nextContext || "reasoning");
  }
  if (record.content !== undefined) {
    collectReasoningContent(record.content, acc, nextContext || context);
  }
}

interface StreamingReasoningTracker {
  summaryBuffer: string;
  detailBuffer: string;
}

function processStreamingReasoningDelta(
  input: unknown,
  tracker: StreamingReasoningTracker,
  observer?: LlmStreamObserver
): void {
  if (input === null || input === undefined) return;
  const scratch: ReasoningAccumulator = {
    summaries: new Set<string>(),
    details: new Set<string>(),
  };
  collectReasoningContent(input, scratch, "reasoning");

  scratch.summaries.forEach((value) => {
    tracker.summaryBuffer += value;
    if (observer) {
      observer.onReasoningEvent({ kind: "summary", text: value });
    }
  });

  scratch.details.forEach((value) => {
    tracker.detailBuffer += value;
    if (observer) {
      observer.onReasoningEvent({ kind: "thinking", text: value });
    }
  });
}

function normalizeReasoningEntries(values: Iterable<string>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = typeof value === "string" ? value : "";
    if (!trimmed) continue;
    // Filter out strings that are just dots or whitespace (e.g. ".\n\n" or "...")
    if (/^[\s\.]+$/.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function mergeReasoningTraces(
  base: LlmReasoningTrace | undefined,
  streamingSummary: string,
  streamingDetail: string
): LlmReasoningTrace | undefined {
  // 1. Prepare streaming parts (normalized)
  const normStreamingSummary = normalizeReasoningEntries(
    streamingSummary ? [streamingSummary] : []
  );
  const normStreamingDetail = normalizeReasoningEntries(
    streamingDetail ? [streamingDetail] : []
  );

  // 2. Prepare base parts (normalized)
  const baseSummaries = normalizeReasoningEntries(base?.summaries ?? []);
  const baseDetails = normalizeReasoningEntries(base?.details ?? []);

  // 3. Merge Logic
  // If we have a substantial streaming detail, we prioritize it to avoid
  // the "final reasoning" fragment often seen with Groq.
  let finalDetails: string[] = [];

  if (normStreamingDetail.length > 0) {
    finalDetails = [...normStreamingDetail];
    // Only append base details if they are significantly different and not just a subset/noise
    for (const bd of baseDetails) {
      const isSubset = normStreamingDetail.some(sd => sd.includes(bd) || bd.includes(sd));
      if (!isSubset) {
        finalDetails.push(bd);
      }
    }
  } else {
    finalDetails = baseDetails;
  }

  // Same logic for summaries
  let finalSummaries: string[] = [];
  if (normStreamingSummary.length > 0) {
    finalSummaries = [...normStreamingSummary];
    for (const bs of baseSummaries) {
      const isSubset = normStreamingSummary.some(ss => ss.includes(bs) || bs.includes(ss));
      if (!isSubset) {
        finalSummaries.push(bs);
      }
    }
  } else {
    finalSummaries = baseSummaries;
  }

  if (!finalSummaries.length && !finalDetails.length) {
    return base;
  }

  return {
    summaries: finalSummaries.length ? finalSummaries : undefined,
    details: finalDetails.length ? finalDetails : undefined,
    raw: base?.raw,
  };
}

/* -------------------- reasoning options (Chat) -------------------- */

function applyReasoningOptionsForChat(
  request:
    | OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
    | OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
  settings: ProviderSettings
): void {
  const mode = settings.reasoningMode;
  // Clear any stale fields first
  delete (request as any).reasoning_effort;
  delete (request as any).include_reasoning;
  delete (request as any).reasoning_format;

  if (!mode || mode === "none") return;

  const normalizedModel = normalizeModelId(settings.model);
  if (!GROQ_REASONING_SUPPORTED_MODELS.has(normalizedModel)) return;
  const supportedModes = GROQ_MODEL_REASONING_EFFORT[normalizedModel] ?? [
    "none",
  ];
  const effectiveMode = supportedModes.includes(mode)
    ? mode
    : supportedModes.find((item) => item !== "none") ?? "none";

  if (effectiveMode === "none") {
    return;
  }

  if (normalizedModel === "qwen/qwen3-32b") {
    (request as any).reasoning_effort =
      effectiveMode === "default" ? "default" : "none";
    (request as any).reasoning_format = "parsed";
    if (effectiveMode !== "default") {
      delete (request as any).reasoning_effort;
      delete (request as any).reasoning_format;
    }
    return;
  }

  (request as any).reasoning_effort = effectiveMode;
  (request as any).include_reasoning = true;
}

/* -------------------- util -------------------- */

function normalizeModelId(model: string): string {
  return model.trim().toLowerCase();
}

function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const anyError = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  const statusValue = anyError.status ?? anyError.response?.status;
  if (typeof statusValue === "number") return statusValue;
  const maybeString =
    typeof statusValue === "string"
      ? Number.parseInt(statusValue, 10)
      : undefined;
  return Number.isFinite(maybeString) ? (maybeString as number) : undefined;
}
