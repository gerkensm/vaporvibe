import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import type { Logger } from "pino";
import { supportsImageInput } from "../llm/capabilities.js";
import { buildMessages } from "../llm/messages.js";
import type { LlmClient } from "../llm/client.js";
import { parseCookies } from "../utils/cookies.js";
import { readBody } from "../utils/body.js";
import type {
  BriefAttachment,
  HistoryEntry,
  ImageAspectRatio,
  ImageGenProvider,
  RestMutationRecord,
  RestQueryRecord,
  RuntimeConfig,
  ProviderSettings,
} from "../types.js";
import type { RequestContext } from "./server.js";
import { selectHistoryForPrompt } from "./history-utils.js";
import { SessionStore } from "./session-store.js";
import { createImageGenClient } from "../image-gen/factory.js";
import type { ImageGenResult } from "../image-gen/types.js";
import { getGeneratedImagePath } from "../image-gen/paths.js";
import {
  buildImageCacheKey,
  readImageCacheBase64,
  ensureImageCacheDir,
  writeImageCache,
} from "../image-gen/cache.js";
import { getCredentialStore } from "../utils/credential-store.js";

const BRANCH_FIELD = "__vaporvibe_branch";

function normalizeJsonResponse(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const fencedMatch = trimmed.match(/^```[\w-]*\s*\n([\s\S]*?)\n?```$/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const inlineFence = trimmed.match(/```[\w-]*\s*\n([\s\S]*?)\n?```/i);
  if (inlineFence) {
    return inlineFence[1].trim();
  }

  return trimmed;
}
interface RestEnvironmentSnapshot {
  brief: string | null;
  briefAttachments: BriefAttachment[];
  runtime: RuntimeConfig;
  llmClient: LlmClient | null;
  provider: ProviderSettings | null;
  providerReady: boolean;
  providerSelectionRequired: boolean;
}

interface RestApiControllerOptions {
  sessionStore: SessionStore;
  adminPath: string;
  getEnvironment(): RestEnvironmentSnapshot;
}

export class RestApiController {
  private readonly sessionStore: SessionStore;
  private readonly adminPath: string;
  private readonly getEnvironment: () => RestEnvironmentSnapshot;
  private readonly credentialStore = getCredentialStore();

  constructor(options: RestApiControllerOptions) {
    this.sessionStore = options.sessionStore;
    this.adminPath = options.adminPath;
    this.getEnvironment = options.getEnvironment;
  }

  async handle(context: RequestContext, reqLogger: Logger): Promise<boolean> {
    const { path } = context;
    if (!path.startsWith("/rest_api/")) {
      return false;
    }

    if (path.startsWith("/rest_api/image/")) {
      await this.handleImageGeneration(context, reqLogger);
      return true;
    }

    if (path.startsWith("/rest_api/mutation/")) {
      await this.handleMutation(context, reqLogger);
      return true;
    }

    if (path.startsWith("/rest_api/query/")) {
      await this.handleQuery(context, reqLogger);
      return true;
    }

    context.res.statusCode = 404;
    context.res.setHeader("Content-Type", "application/json; charset=utf-8");
    context.res.end(JSON.stringify({ success: false, error: "Unknown REST endpoint" }));
    return true;
  }

  private async handleImageGeneration(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { req, res, path, method, url } = context;
    if (path !== "/rest_api/image/generate") {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ success: false, error: "Not Found" }));
      return;
    }

    if (method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ success: false, error: "Method Not Allowed" }));
      return;
    }

    const env = this.getEnvironment();
    if (!env.provider || !env.provider.imageGeneration?.enabled) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ success: false, error: "Image generation disabled" }));
      return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const sid = this.sessionStore.getOrCreateSessionId(cookies, res);

    const body = await readBody(req);
    const data = body.data ?? {};
    const prompt =
      typeof data.prompt === "string" ? data.prompt.trim() : undefined;
    const ratio = this.normalizeAspectRatio(data.ratio);

    const rawQueryEntries = Array.from(url.searchParams.entries());
    let branchId = context.branchId;
    for (const [key, value] of rawQueryEntries) {
      if (key === BRANCH_FIELD && typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0 && !branchId) {
          branchId = trimmed;
        }
      }
    }

    const bodyBranch = extractBranchId(data[BRANCH_FIELD]);
    const normalizedBranchId =
      branchId || (bodyBranch ? bodyBranch.trim() : undefined);

    if (!prompt) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ success: false, error: "Missing prompt" }));
      return;
    }

    const provider: ImageGenProvider = env.provider.imageGeneration.provider;
    const modelId = env.provider.imageGeneration.modelId ?? "gpt-image-1.5";
    const cacheKey = buildImageCacheKey({ provider, modelId, prompt, ratio });
    const { filePath, route } = getGeneratedImagePath(cacheKey);

    await ensureImageCacheDir();
    if (existsSync(filePath)) {
      const cached = await readImageCacheBase64(cacheKey);
      this.sessionStore.recordGeneratedImage(
        sid,
        {
          id: randomUUID(),
          cacheKey,
          url: route,
          prompt,
          ratio,
          provider,
          modelId,
          mimeType: "image/png",
          base64: cached.base64,
          createdAt: new Date().toISOString(),
        },
        normalizedBranchId
      );
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ url: route }));
      reqLogger.debug({ provider, ratio, cache: true }, "Image cache hit");
      return;
    }

    const apiKey = await this.resolveImageApiKey(provider, env);
    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({ success: false, error: "Missing API key for image provider" })
      );
      return;
    }

    const client = createImageGenClient(provider);
    try {
      const result = await client.generateImage({
        prompt,
        ratio,
        apiKey,
        modelId,
      });
      const { base64, mimeType } = await this.persistImage(
        result,
        cacheKey,
        route
      );
      this.sessionStore.recordGeneratedImage(
        sid,
        {
          id: randomUUID(),
          cacheKey,
          url: route,
          prompt,
          ratio,
          provider,
          modelId,
          mimeType,
          base64,
          createdAt: new Date().toISOString(),
        },
        normalizedBranchId
      );
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ url: route }));
      reqLogger.info({ provider, ratio }, "Generated image cached");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reqLogger.error({ err: error, provider }, "Image generation failed");
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ success: false, error: message }));
    }
  }

  private async handleMutation(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { req, res, url, method, path } = context;
    const requestStart = Date.now();
    if (method !== "POST" && method !== "PUT" && method !== "PATCH") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST, PUT, PATCH");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ success: false, error: "Method Not Allowed" }));
      return;
    }

    const env = this.getEnvironment();
    if (!env.providerReady || env.providerSelectionRequired || !env.brief) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ success: false, error: "Model not ready" }));
      return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const sid = this.sessionStore.getOrCreateSessionId(cookies, res);

    const rawQueryEntries = Array.from(url.searchParams.entries());
    let branchId = context.branchId;
    for (const [key, value] of rawQueryEntries) {
      if (key === BRANCH_FIELD && typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0 && !branchId) {
          branchId = trimmed;
        }
      }
    }
    const query = sanitizeQuery(url);
    const parsedBody = await readBody(req);
    const bodySource = parsedBody.data ?? {};
    const bodyBranch = extractBranchId(bodySource[BRANCH_FIELD]);
    if (!branchId && bodyBranch) {
      branchId = bodyBranch;
    }
    const body = sanitizeBody(bodySource);

    const record: RestMutationRecord = {
      id: randomUUID(),
      path,
      method,
      query,
      body,
      createdAt: new Date().toISOString(),
    };

    const normalizedBranchId =
      branchId && branchId.trim().length > 0 ? branchId.trim() : undefined;

    this.sessionStore.appendMutationRecord(sid, record, normalizedBranchId);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ success: true }));
    reqLogger.debug({ path, method }, "Recorded REST mutation");

    this.sessionStore.appendRestHistoryEntry(sid, {
      type: "mutation",
      record,
      response: { success: true },
      durationMs: Date.now() - requestStart,
      branchId: normalizedBranchId,
    });
  }

  private async handleQuery(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { req, res, url, method, path } = context;
    const requestStart = Date.now();
    if (method !== "GET" && method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, POST");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ success: false, error: "Method Not Allowed" }));
      return;
    }

    const env = this.getEnvironment();
    if (
      !env.providerReady ||
      env.providerSelectionRequired ||
      !env.brief ||
      !env.llmClient
    ) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ success: false, error: "Model not ready" }));
      return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const sid = this.sessionStore.getOrCreateSessionId(cookies, res);

    const rawQueryEntries = Array.from(url.searchParams.entries());
    let branchId = context.branchId;
    for (const [key, value] of rawQueryEntries) {
      if (key === BRANCH_FIELD && typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0 && !branchId) {
          branchId = trimmed;
        }
      }
    }

    const query = sanitizeQuery(url);
    let bodyData: Record<string, unknown> = {};
    if (method === "POST") {
      const parsedBody = await readBody(req);
      const bodySource = parsedBody.data ?? {};
      const bodyBranch = extractBranchId(bodySource[BRANCH_FIELD]);
      if (!branchId && bodyBranch) {
        branchId = bodyBranch;
      }
      bodyData = sanitizeBody(bodySource);
    }

    const normalizedBranchId =
      branchId && branchId.trim().length > 0 ? branchId.trim() : undefined;

    const promptContext = this.preparePromptContext(
      sid,
      env.runtime,
      env.briefAttachments,
      env.llmClient,
      normalizedBranchId
    );

    const messages = buildMessages({
      brief: env.brief ?? "",
      briefAttachments: promptContext.attachments,
      omittedAttachmentCount: promptContext.omittedAttachmentCount,
      method,
      path,
      query,
      body: bodyData,
      prevHtml: promptContext.prevHtml,
      timestamp: new Date(),
      includeInstructionPanel: env.runtime.includeInstructionPanel,
      history: promptContext.historyForPrompt,
      historyTotal: promptContext.historyTotal,
      historyLimit: promptContext.historyLimit,
      historyMaxBytes: env.runtime.historyMaxBytes,
      historyBytesUsed: promptContext.historyBytesUsed,
      historyLimitOmitted: promptContext.historyLimitOmitted,
      historyByteOmitted: promptContext.historyByteOmitted,
      adminPath: this.adminPath,
      mode: "json-query",
      branchId: normalizedBranchId,
      imageGenerationEnabled: env.provider?.imageGeneration?.enabled ?? false,
      enableStandardLibrary: env.runtime.enableStandardLibrary,
    });

    try {
      const result = await env.llmClient.generateHtml(messages);
      const raw = result.html?.trim() ?? "";
      const normalized = normalizeJsonResponse(raw);
      let parsed: unknown;
      try {
        parsed = normalized.length > 0 ? JSON.parse(normalized) : {};
      } catch (error) {
        const failureRecord: RestQueryRecord = {
          id: randomUUID(),
          path,
          method,
          query,
          body: bodyData,
          createdAt: new Date().toISOString(),
          ok: false,
          response: null,
          rawResponse: raw,
          error:
            error instanceof Error
              ? error.message
              : "Invalid JSON from model",
        };
        this.sessionStore.appendQueryRecord(
          sid,
          failureRecord,
          normalizedBranchId
        );
        reqLogger.warn({ path }, "Model returned invalid JSON for query");
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(
          JSON.stringify({
            success: false,
            error: "Model response was not valid JSON",
          })
        );
        this.sessionStore.appendRestHistoryEntry(sid, {
          type: "query",
          record: failureRecord,
          rawResponse: raw,
          ok: false,
          error:
            error instanceof Error ? error.message : "Invalid JSON from model",
          durationMs: Date.now() - requestStart,
          usage: result.usage,
          reasoning: result.reasoning,
          branchId: normalizedBranchId,
        });
        return;
      }

      const successRecord: RestQueryRecord = {
        id: randomUUID(),
        path,
        method,
        query,
        body: bodyData,
        createdAt: new Date().toISOString(),
        ok: true,
        response: parsed,
        rawResponse: raw,
      };

      this.sessionStore.appendQueryRecord(
        sid,
        successRecord,
        normalizedBranchId
      );

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify(parsed));
      reqLogger.debug({ path, method }, "Served REST query response");
      this.sessionStore.appendRestHistoryEntry(sid, {
        type: "query",
        record: successRecord,
        response: parsed,
        rawResponse: raw,
        ok: true,
        durationMs: Date.now() - requestStart,
        usage: result.usage,
        reasoning: result.reasoning,
        branchId: normalizedBranchId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error from model";
      reqLogger.error({ err: error }, "REST query failed");
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ success: false, error: message }));
      const failureRecord: RestQueryRecord = {
        id: randomUUID(),
        path,
        method,
        query,
        body: bodyData,
        createdAt: new Date().toISOString(),
        ok: false,
        response: null,
        rawResponse: "",
        error: message,
      };
      this.sessionStore.appendQueryRecord(
        sid,
        failureRecord,
        normalizedBranchId
      );
      this.sessionStore.appendRestHistoryEntry(sid, {
        type: "query",
        record: failureRecord,
        ok: false,
        error: message,
        durationMs: Date.now() - requestStart,
        branchId: normalizedBranchId,
      });
    }
  }

  private normalizeAspectRatio(value: unknown): ImageAspectRatio {
    const allowed: ImageAspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];
    return allowed.includes(value as ImageAspectRatio)
      ? (value as ImageAspectRatio)
      : "1:1";
  }

  private async resolveImageApiKey(
    provider: ImageGenProvider,
    env: RestEnvironmentSnapshot
  ): Promise<string | null> {
    const llmClientKey =
      env.llmClient?.settings.provider === provider
        ? env.llmClient.settings.apiKey
        : undefined;
    const providerKey =
      env.provider?.provider === provider ? env.provider.apiKey : llmClientKey;
    if (providerKey && providerKey.trim().length > 0) {
      return providerKey.trim();
    }

    const storedKey = await this.credentialStore.getApiKey(provider);
    if (storedKey && storedKey.trim().length > 0) {
      return storedKey.trim();
    }

    return null;
  }

  private async persistImage(
    result: ImageGenResult,
    cacheKey: string,
    route: string
  ): Promise<{ base64: string; mimeType: string }> {
    const { buffer, mimeType } = await this.resolveImageBuffer(result);
    const base64 = buffer.toString("base64");
    await writeImageCache(cacheKey, base64);

    return { base64, mimeType: mimeType ?? this.getMimeTypeFromRoute(route) };
  }

  private async resolveImageBuffer(
    result: ImageGenResult
  ): Promise<{ buffer: Buffer; mimeType?: string }> {
    if (result.url.startsWith("data:")) {
      const match = result.url.match(/^data:(.*?);base64,(.+)$/i);
      const mimeType = match?.[1];
      const base64Payload = match?.[2];
      if (!base64Payload) {
        throw new Error("Invalid data URL from image generation provider");
      }
      return { buffer: Buffer.from(base64Payload, "base64"), mimeType };
    }

    const response = await fetch(result.url);
    if (!response.ok) {
      throw new Error(
        `Failed to download generated image (status ${response.status})`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = result.mimeType ?? response.headers.get("content-type") ?? undefined;
    return { buffer: Buffer.from(arrayBuffer), mimeType: mimeType ?? undefined };
  }

  private getMimeTypeFromRoute(route: string): string {
    if (route.endsWith(".jpg") || route.endsWith(".jpeg")) {
      return "image/jpeg";
    }
    if (route.endsWith(".webp")) {
      return "image/webp";
    }
    if (route.endsWith(".gif")) {
      return "image/gif";
    }
    return "image/png";
  }

  private preparePromptContext(
    sid: string,
    runtime: RuntimeConfig,
    attachments: BriefAttachment[],
    llmClient: LlmClient,
    branchId?: string
  ): {
    historyForPrompt: HistoryEntry[];
    historyTotal: number;
    historyLimit: number;
    historyBytesUsed: number;
    historyLimitOmitted: number;
    historyByteOmitted: number;
    prevHtml: string;
    attachments: BriefAttachment[];
    omittedAttachmentCount: number;
  } {
    const baseHistory = this.sessionStore.getHistory(sid);
    const fullHistory = branchId
      ? this.sessionStore.getHistoryForPrompt(sid, branchId)
      : baseHistory;
    const historyLimit = Math.max(1, runtime.historyLimit);
    const limitedHistory =
      historyLimit >= fullHistory.length
        ? fullHistory
        : fullHistory.slice(-historyLimit);
    const limitOmitted = fullHistory.length - limitedHistory.length;
    const selection = selectHistoryForPrompt(
      limitedHistory,
      runtime.historyMaxBytes
    );
    const historyForPrompt = selection.entries;
    const byteOmitted = limitedHistory.length - historyForPrompt.length;
    const prevHtml =
      historyForPrompt.at(-1)?.response.html ??
      limitedHistory.at(-1)?.response.html ??
      this.sessionStore.getPrevHtml(sid, branchId);

    const includeAttachments = supportsImageInput(
      llmClient.settings.provider,
      llmClient.settings.model,
    );
    const promptAttachments = includeAttachments
      ? attachments.map((attachment) => ({ ...attachment }))
      : [];
    const omittedAttachmentCount = includeAttachments
      ? 0
      : attachments.length;

    return {
      historyForPrompt,
      historyTotal: fullHistory.length,
      historyLimit,
      historyBytesUsed: selection.bytes,
      historyLimitOmitted: limitOmitted,
      historyByteOmitted: byteOmitted,
      prevHtml,
      attachments: promptAttachments,
      omittedAttachmentCount,
    };
  }
}

function sanitizeQuery(url: URL): Record<string, unknown> {
  const entries = Array.from(url.searchParams.entries());
  const filtered = entries.filter(
    ([key]) => key !== "__vaporvibe" && key !== BRANCH_FIELD
  );
  return Object.fromEntries(filtered);
}

function sanitizeBody(
  body: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body ?? {})) {
    if (key === "__vaporvibe" || key === BRANCH_FIELD) {
      continue;
    }
    if (Array.isArray(value)) {
      const filtered = value.filter(
        (item) => !(typeof item === "string" && item === "interceptor")
      );
      if (filtered.length === 1) {
        result[key] = filtered[0];
      } else if (filtered.length > 1) {
        result[key] = filtered;
      }
      continue;
    }
    if (value === "interceptor") {
      continue;
    }
    result[key] = value;
  }
  return result;
}

function extractBranchId(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    const match = value.find(
      (item) => typeof item === "string" && item.trim().length > 0
    );
    return typeof match === "string" ? match.trim() : undefined;
  }
  return undefined;
}
