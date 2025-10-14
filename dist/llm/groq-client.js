import OpenAI from "openai";
import { logger } from "../logger.js";
import { supportsImageInput } from "./capabilities.js";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const MAX_GROQ_IMAGE_ATTACHMENTS = 5;
const MAX_GROQ_IMAGE_BYTES = 4 * 1024 * 1024;
/** Models with Groq reasoning knobs on the Chat API */
const GROQ_REASONING_SUPPORTED_MODELS = new Set([
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "qwen/qwen3-32b",
]);
/** GPT-OSS supports explicit effort low|medium|high on Chat */
const GROQ_GPT_OSS_MODELS = new Set([
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
]);
export class GroqClient {
    settings;
    client;
    constructor(settings) {
        this.settings = settings;
        this.client = new OpenAI({
            apiKey: settings.apiKey,
            baseURL: GROQ_BASE_URL,
        });
        if (typeof settings.reasoningTokens === "number") {
            logger.info(`Groq does not expose a separate reasoning token budget; ignoring requested value ${settings.reasoningTokens}.`);
        }
    }
    async generateHtml(messages) {
        // Convert your internal messages to Chat Completions messages
        const chatMessages = messages.map((m) => toChatCompletionMessage(this.settings.model, m.content, m.role, m.attachments));
        // Build a typed request. Setting stream:false as const narrows the return type to ChatCompletion.
        const request = {
            model: this.settings.model,
            messages: chatMessages,
            stream: false,
            max_completion_tokens: this.settings.maxOutputTokens,
        };
        applyReasoningOptionsForChat(request, this.settings);
        const resp = await this.client.chat.completions.create(request);
        const html = extractHtmlFromChat(resp);
        const usage = extractUsageFromChat(resp);
        const reasoning = extractReasoningFromChat(resp, this.settings.reasoningMode, this.settings.model);
        return {
            html,
            usage,
            reasoning,
            raw: resp,
        };
    }
}
export async function verifyGroqApiKey(apiKey) {
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
    }
    catch (error) {
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
function toChatCompletionMessage(model, text, role, attachments) {
    // If there are no attachments, send simple string content
    if (!attachments || attachments.length === 0) {
        return { role, content: text };
    }
    // Otherwise, send multi-part content: text + image_url parts (OpenAI-compatible)
    const parts = [];
    if (text && text.trim().length > 0) {
        parts.push({ type: "text", text });
    }
    const modelSupportsVision = supportsImageInput("groq", model);
    let imagesAdded = 0;
    for (const a of attachments) {
        const mimeType = (a.mimeType || "image/png").toLowerCase();
        if (mimeType.startsWith("image/") && modelSupportsVision) {
            if (imagesAdded >= MAX_GROQ_IMAGE_ATTACHMENTS) {
                logger.warn(`Skipping image attachment ${a.name} — Groq vision models accept at most ${MAX_GROQ_IMAGE_ATTACHMENTS} images per message.`);
                continue;
            }
            const imageBytes = getBase64ByteSize(a.base64);
            if (imageBytes === null) {
                logger.warn(`Skipping attachment ${a.name} — invalid base64 payload provided.`);
                continue;
            }
            if (imageBytes > MAX_GROQ_IMAGE_BYTES) {
                logger.warn(`Skipping image attachment ${a.name} (${imageBytes} bytes) — Groq vision models require base64 images under ${MAX_GROQ_IMAGE_BYTES} bytes.`);
                continue;
            }
            parts.push({
                type: "image_url",
                image_url: {
                    url: buildImageDataUrl(mimeType, a.base64),
                },
            });
            imagesAdded += 1;
        }
        else {
            // Non-image attachments: inline a description so the model can see the data
            const desc = `Attachment ${a.name} (${a.mimeType}, ${a.size} bytes) encoded in Base64:`;
            parts.push({ type: "text", text: `${desc}\n${a.base64}` });
        }
    }
    // The OpenAI SDK accepts an array of content parts for multimodal
    if (parts.length === 0) {
        return { role, content: text };
    }
    return { role, content: parts };
}
function buildImageDataUrl(mimeType, base64) {
    const safeMime = mimeType && mimeType.trim().length > 0 ? mimeType : "image/png";
    return `data:${safeMime};base64,${base64}`;
}
function getBase64ByteSize(base64) {
    try {
        return Buffer.from(base64, "base64").byteLength;
    }
    catch (error) {
        logger.debug(`Failed to measure base64 payload size: ${error.message}`);
        return null;
    }
}
/* -------------------- extraction helpers -------------------- */
function extractHtmlFromChat(resp) {
    const choice = resp.choices?.[0];
    if (!choice)
        return "";
    // Content may be a simple string or an array of parts (for images etc.)
    const content = choice.message?.content;
    if (typeof content === "string") {
        const trimmed = content.trim();
        if (trimmed)
            return trimmed;
    }
    else if (Array.isArray(content)) {
        const text = content
            .map((p) => p?.type === "text" && typeof p?.text === "string" ? p.text : "")
            .join("");
        if (text.trim())
            return text.trim();
    }
    // Fallback: try to read from tool calls or other deltas (unlikely here)
    return "";
}
function extractUsageFromChat(resp) {
    const usage = resp.usage;
    if (!usage)
        return undefined;
    const metrics = {};
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
    const anyUsage = usage;
    const providerEntries = Object.entries(anyUsage).filter(([, v]) => typeof v === "number" || typeof v === "string");
    if (providerEntries.length > 0) {
        metrics.providerMetrics = Object.fromEntries(providerEntries);
    }
    if (metrics.inputTokens === undefined &&
        metrics.outputTokens === undefined &&
        metrics.totalTokens === undefined &&
        !metrics.providerMetrics) {
        return undefined;
    }
    return metrics;
}
function extractReasoningFromChat(resp, mode, model) {
    if (!mode || mode === "none")
        return undefined;
    const normalized = normalizeModelId(model);
    if (!GROQ_REASONING_SUPPORTED_MODELS.has(normalized))
        return undefined;
    try {
        const details = new Set();
        const summaries = new Set();
        // 1) Some models will put structured reasoning in message fields (future-proof)
        const choice = resp.choices?.[0];
        const msg = choice?.message;
        // Groq Chat with include_reasoning may add a `reasoning` object or put reasoning parts in content.
        if (msg?.reasoning) {
            const r = msg.reasoning;
            if (typeof r.summary === "string" && r.summary.trim()) {
                summaries.add(r.summary.trim());
            }
            if (typeof r.text === "string" && r.text.trim()) {
                details.add(r.text.trim());
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
    }
    catch (err) {
        logger.warn(`Failed to capture Groq reasoning metadata (chat): ${err.message}`);
        return undefined;
    }
}
function extractThinkSections(text) {
    if (typeof text !== "string" || text.length === 0)
        return [];
    const matches = text.match(/<think>[\s\S]*?<\/think>/gi);
    return (matches?.map((m) => m.replace(/<\/?think>/gi, "").trim()).filter(Boolean) ??
        []);
}
function collectReasoningContent(node, acc, context) {
    if (node === null || node === undefined)
        return;
    if (typeof node === "string") {
        const text = node.trim();
        if (!text)
            return;
        if (context.includes("summary"))
            acc.summaries.add(text);
        else
            acc.details.add(text);
        return;
    }
    if (Array.isArray(node)) {
        for (const entry of node)
            collectReasoningContent(entry, acc, context);
        return;
    }
    if (typeof node !== "object")
        return;
    const record = node;
    const type = typeof record.type === "string" ? record.type.toLowerCase() : undefined;
    const nextContext = type
        ? type.includes("summary")
            ? "summary"
            : context
        : context;
    if (typeof record.text === "string") {
        const text = record.text.trim();
        if (text) {
            if (nextContext.includes("summary"))
                acc.summaries.add(text);
            else
                acc.details.add(text);
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
/* -------------------- reasoning options (Chat) -------------------- */
function applyReasoningOptionsForChat(request, settings) {
    const mode = settings.reasoningMode;
    // Clear any stale fields first
    delete request.reasoning_effort;
    delete request.include_reasoning;
    delete request.reasoning_format;
    if (!mode || mode === "none")
        return;
    const normalizedModel = normalizeModelId(settings.model);
    if (!GROQ_REASONING_SUPPORTED_MODELS.has(normalizedModel))
        return;
    const isGptOss = GROQ_GPT_OSS_MODELS.has(normalizedModel);
    // Decide effort
    const ossEffort = mode === "low" || mode === "medium" || mode === "high" ? mode : "medium";
    if (isGptOss) {
        // GPT-OSS: include_reasoning + low/medium/high
        request.reasoning_effort = ossEffort;
        request.include_reasoning = true;
    }
    else {
        // Qwen: prefer parsed reasoning format; effort mainly "default" or "none"
        request.reasoning_effort =
            mode === "none" ? "none" : "default";
        request.reasoning_format = "parsed";
    }
}
/* -------------------- util -------------------- */
function normalizeModelId(model) {
    return model.trim().toLowerCase();
}
function extractStatus(error) {
    if (!error || typeof error !== "object")
        return undefined;
    const anyError = error;
    const statusValue = anyError.status ?? anyError.response?.status;
    if (typeof statusValue === "number")
        return statusValue;
    const maybeString = typeof statusValue === "string"
        ? Number.parseInt(statusValue, 10)
        : undefined;
    return Number.isFinite(maybeString) ? maybeString : undefined;
}
