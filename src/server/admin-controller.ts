import type { ServerResponse } from "node:http";
import type { Logger } from "pino";
import { ADMIN_ROUTE_PREFIX } from "../constants.js";
import {
  PROVIDER_CHOICES,
  PROVIDER_LABELS,
  PROVIDER_PLACEHOLDERS,
  PROVIDER_REASONING_CAPABILITIES,
  PROVIDER_REASONING_MODES,
  PROVIDER_TOKEN_GUIDANCE,
  DEFAULT_MODEL_BY_PROVIDER,
  DEFAULT_MAX_TOKENS_BY_PROVIDER,
  REASONING_MODE_CHOICES,
  getModelOptions,
  getModelMetadata,
  getFeaturedModels,
  PROVIDER_MODEL_METADATA,
  CUSTOM_MODEL_DESCRIPTION,
} from "../constants/providers.js";
import {
  HISTORY_LIMIT_MIN,
  HISTORY_LIMIT_MAX,
  HISTORY_MAX_BYTES_MIN,
  HISTORY_MAX_BYTES_MAX,
} from "../constants.js";
import type {
  BriefAttachment,
  HistoryEntry,
  ProviderSettings,
  ReasoningMode,
  ModelProvider,
  RestMutationRecord,
  RestQueryRecord,
} from "../types.js";
import { createLlmClient } from "../llm/factory.js";
import { verifyProviderApiKey } from "../llm/verification.js";
import { readBody } from "../utils/body.js";
import type { ParsedFile } from "../utils/body.js";
import { parseCookies } from "../utils/cookies.js";
import { maskSensitive } from "../utils/sensitive.js";
import {
  createHistorySnapshot,
  createPromptMarkdown,
} from "../utils/history-export.js";
import type { MutableServerState, RequestContext } from "./server.js";
import { SessionStore } from "./session-store.js";
import { getCredentialStore } from "../utils/credential-store.js";
import { processBriefAttachmentFiles } from "./brief-attachments.js";
import type {
  AdminActiveForkSummary,
  AdminBriefAttachment,
  AdminHistoryItem,
  AdminHistoryResponse,
  AdminProviderInfo,
  AdminRestItem,
  AdminRestMutationItem,
  AdminRestQueryItem,
  AdminRuntimeInfo,
  AdminStateResponse,
  AdminUpdateResponse,
} from "../types/admin-api.js";

const JSON_EXPORT_PATH = `${ADMIN_ROUTE_PREFIX}/history.json`;
const MARKDOWN_EXPORT_PATH = `${ADMIN_ROUTE_PREFIX}/history/prompt.md`;

interface AdminControllerOptions {
  state: MutableServerState;
  sessionStore: SessionStore;
}

interface HistorySnapshot {
  version: number;
  history: HistoryEntry[];
  brief?: string | null;
  briefAttachments?: BriefAttachment[] | null;
  runtime?: {
    historyLimit?: number;
    historyMaxBytes?: number;
    includeInstructionPanel?: boolean;
  } | null;
  llm?: (Partial<ProviderSettings> & { provider?: string | null }) | null;
}

export class AdminController {
  private readonly state: MutableServerState;
  private readonly sessionStore: SessionStore;
  private readonly credentialStore = getCredentialStore();

  constructor(options: AdminControllerOptions) {
    this.state = options.state;
    this.sessionStore = options.sessionStore;

    // Initialize credential store with current key if it came from UI
    if (
      this.state.provider.apiKey &&
      !this.isKeyFromEnvironment(this.state.provider.provider)
    ) {
      this.credentialStore
        .saveApiKey(this.state.provider.provider, this.state.provider.apiKey)
        .catch(() => {
          // Ignore errors - will use memory fallback
        });
    }
  }

  async handle(
    context: RequestContext,
    _requestStart: number,
    reqLogger: Logger
  ): Promise<boolean> {
    const { method, path } = context;
    if (!path.startsWith(ADMIN_ROUTE_PREFIX)) {
      if (path.startsWith("/api/admin")) {
        return this.handleApi(context, reqLogger);
      }
      return false;
    }

    const subPath = path.slice(ADMIN_ROUTE_PREFIX.length) || "/";

    if (method === "GET" && (subPath === "/" || subPath === "")) {
      return false;
    }

    if (method === "GET" && subPath === "/history.json") {
      this.handleHistoryJson(context);
      return true;
    }

    if (method === "GET" && subPath === "/history/prompt.md") {
      this.handlePromptMarkdown(context);
      return true;
    }

    if (method === "GET" && subPath === "/history/latest") {
      this.handleHistoryLatest(context);
      return true;
    }

    if (method === "GET" && subPath.startsWith("/history/")) {
      await this.handleHistoryResource(context, reqLogger);
      return true;
    }

    if (method === "POST" && subPath === "/update-provider") {
      await this.handleProviderUpdate(context, reqLogger);
      return true;
    }

    if (method === "POST" && subPath === "/verify-provider") {
      await this.handleProviderVerification(context, reqLogger);
      return true;
    }

    if (method === "POST" && subPath === "/update-runtime") {
      await this.handleRuntimeUpdate(context, reqLogger);
      return true;
    }

    if (method === "POST" && subPath === "/update-brief") {
      await this.handleBriefUpdate(context, reqLogger);
      return true;
    }

    if (method === "POST" && subPath === "/history/import") {
      await this.handleHistoryImport(context, reqLogger);
      return true;
    }

    return false;
  }

  private async handleApi(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<boolean> {
    const { method, path, req, res } = context;
    if (!path.startsWith("/api/admin")) {
      return false;
    }

    const subPath = path.slice("/api/admin".length) || "/";

    if (method === "POST" && subPath === "/forks/start") {
      await this.handleForkStart(context, reqLogger);
      return true;
    }

    if (method === "POST") {
      const commitMatch = subPath.match(/^\/forks\/([^/]+)\/commit\/([^/]+)$/);
      if (commitMatch) {
        const [, forkId, branchId] = commitMatch;
        await this.handleForkCommit(context, reqLogger, forkId, branchId);
        return true;
      }
      const discardMatch = subPath.match(/^\/forks\/([^/]+)\/discard$/);
      if (discardMatch) {
        const [, forkId] = discardMatch;
        await this.handleForkDiscard(context, reqLogger, forkId);
        return true;
      }
    }

    if (method === "GET" && (subPath === "/" || subPath === "/state")) {
      const state = await this.buildAdminStateResponse();
      this.respondJson(res, state);
      return true;
    }

    if (method === "POST" && subPath === "/provider") {
      const body = await readBody(req);
      try {
        const { message } = await this.applyProviderUpdate(
          body.data ?? {},
          reqLogger
        );
        const state = await this.buildAdminStateResponse();
        const payload: AdminUpdateResponse = {
          success: true,
          message,
          state,
        };
        this.respondJson(res, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reqLogger.error({ err: error }, "Failed to update provider via API");
        const payload: AdminUpdateResponse = {
          success: false,
          message,
        };
        this.respondJson(res, payload, 400);
      }
      return true;
    }

    if (method === "POST" && subPath === "/provider/verify") {
      const body = await readBody(req);
      try {
        const { message } = await this.applyProviderVerification(
          body.data ?? {},
          reqLogger
        );
        const state = await this.buildAdminStateResponse();
        const payload: AdminUpdateResponse = {
          success: true,
          message,
          state,
        };
        this.respondJson(res, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reqLogger.error({ err: error }, "Failed to verify provider key via API");
        const payload: AdminUpdateResponse = {
          success: false,
          message,
        };
        this.respondJson(res, payload, 400);
      }
      return true;
    }

    if (method === "POST" && subPath === "/runtime") {
      const body = await readBody(req);
      try {
        const { message } = this.applyRuntimeUpdate(body.data ?? {}, reqLogger);
        const state = await this.buildAdminStateResponse();
        const payload: AdminUpdateResponse = {
          success: true,
          message,
          state,
        };
        this.respondJson(res, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reqLogger.error({ err: error }, "Failed to update runtime via API");
        const payload: AdminUpdateResponse = {
          success: false,
          message,
        };
        this.respondJson(res, payload, 400);
      }
      return true;
    }

    if (method === "POST" && subPath === "/brief") {
      const body = await readBody(req);
      try {
        const { message } = this.applyBriefUpdate(
          body.data ?? {},
          body.files ?? [],
          reqLogger
        );
        const state = await this.buildAdminStateResponse();
        const payload: AdminUpdateResponse = {
          success: true,
          message,
          state,
        };
        this.respondJson(res, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reqLogger.error({ err: error }, "Failed to update brief via API");
        const payload: AdminUpdateResponse = {
          success: false,
          message,
        };
        this.respondJson(res, payload, 400);
      }
      return true;
    }

    if (method === "POST" && subPath === "/history/import") {
      if (this.sessionStore.hasAnyActiveFork()) {
        this.respondJson(
          res,
          {
            success: false,
            message: "Cannot import history while an A/B test is active",
          },
          409
        );
        return true;
      }
      const body = await readBody(req);
      const candidate = extractSnapshotCandidate(body.data);
      const fallbackRaw =
        typeof body.raw === "string" && body.raw.trim().length > 0
          ? body.raw
          : undefined;
      const snapshotInput = candidate ?? fallbackRaw;

      if (snapshotInput == null) {
        this.respondJson(
          res,
          {
            success: false,
            message: "History import failed: provide a snapshot payload.",
          },
          400
        );
        return true;
      }

      try {
        const entries = await this.importHistorySnapshot(snapshotInput, reqLogger);
        const state = await this.buildAdminStateResponse();
        const payload: AdminUpdateResponse = {
          success: true,
          message: describeHistoryImportResult(entries),
          state,
        };
        this.respondJson(res, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reqLogger.error({ err: error }, "Failed to import history snapshot via API");
        const payload: AdminUpdateResponse = {
          success: false,
          message,
        };
        this.respondJson(res, payload, 400);
      }
      return true;
    }

    if (method === "DELETE" && subPath === "/history") {
      if (this.sessionStore.hasAnyActiveFork()) {
        this.respondJson(
          res,
          {
            success: false,
            message: "Cannot clear history while an A/B test is active",
          },
          409
        );
        return true;
      }
      const removedCount = this.sessionStore.clearHistory();
      reqLogger.info({ removedCount }, "Purged admin history via API");
      const message =
        removedCount > 0
          ? `Deleted ${removedCount} history ${removedCount === 1 ? "entry" : "entries"}`
          : "History already empty";
      this.respondJson(res, {
        success: true,
        message,
      });
      return true;
    }

    if (method === "DELETE" && subPath.startsWith("/history/")) {
      const entryIdSegment = subPath.slice("/history/".length);
      if (!entryIdSegment) {
        this.respondJson(
          res,
          { success: false, message: "History deletion failed: missing entry id" },
          400
        );
        return true;
      }

      const entryId = decodeURIComponent(entryIdSegment);
      const target = this.getSortedHistoryEntries().find((item) => item.id === entryId);
      if (target?.forkInfo?.status === "in-progress") {
        this.respondJson(
          res,
          {
            success: false,
            message: "Cannot delete history entry while an A/B test is active",
          },
          409
        );
        return true;
      }

      const removed = this.sessionStore.removeHistoryEntry(entryId);
      if (!removed) {
        this.respondJson(
          res,
          { success: false, message: `History entry not found: ${entryId}` },
          404
        );
        return true;
      }

      reqLogger.info({ entryId }, "Deleted history entry via admin API");
      this.respondJson(res, {
        success: true,
        message: "History entry deleted",
      });
      return true;
    }

    if (method === "GET" && subPath === "/history") {
      const params = context.url.searchParams;
      const limitParam = params.get("limit");
      const offsetParam = params.get("offset");

      let limit = 20;
      try {
        if (limitParam !== null) {
          limit = Math.min(parsePositiveInt(limitParam, 20), 100);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.respondJson(
          res,
          { success: false, message: `Invalid limit: ${message}` },
          400
        );
        return true;
      }

      let offset = 0;
      if (offsetParam !== null && offsetParam !== "") {
        const parsedOffset = Number(offsetParam);
        if (!Number.isFinite(parsedOffset) || parsedOffset < 0) {
          this.respondJson(
            res,
            {
              success: false,
              message: `Invalid offset: ${String(offsetParam)}`,
            },
            400
          );
          return true;
        }
        offset = Math.floor(parsedOffset);
      }

      const payload = this.buildAdminHistoryResponse(limit, offset);
      this.respondJson(res, payload);
      return true;
    }

    this.respondJson(res, { success: false, message: "Not Found" }, 404);
    return true;
  }

  private async handleForkStart(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { req, res } = context;
    const body = await readBody(req);
    const instructionsA = String(body.data?.instructionsA ?? "").trim();
    const instructionsB = String(body.data?.instructionsB ?? "").trim();
    const baseEntryIdRaw = body.data?.baseEntryId;
    const baseEntryId =
      typeof baseEntryIdRaw === "string" && baseEntryIdRaw.trim().length > 0
        ? baseEntryIdRaw.trim()
        : undefined;

    if (!instructionsA || !instructionsB) {
      this.respondJson(
        res,
        {
          success: false,
          message: "Both instruction fields are required",
        },
        400
      );
      return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const sid = this.sessionStore.getOrCreateSessionId(cookies, res);

    try {
      const result = this.sessionStore.startFork(
        sid,
        baseEntryId,
        instructionsA,
        instructionsB
      );
      reqLogger.info({ forkId: result.forkId }, "Started A/B fork");
      this.respondJson(res, { success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /already active/i.test(message) ? 409 : 400;
      this.respondJson(
        res,
        {
          success: false,
          message,
        },
        status
      );
    }
  }

  private async handleForkCommit(
    context: RequestContext,
    reqLogger: Logger,
    forkId: string,
    branchId: string
  ): Promise<void> {
    const { req, res } = context;
    const cookies = parseCookies(req.headers.cookie);
    const sid = this.sessionStore.getOrCreateSessionId(cookies, res);

    try {
      this.sessionStore.resolveFork(sid, forkId, branchId);
      reqLogger.info({ forkId, branchId }, "Resolved A/B fork");
      this.respondJson(res, { success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /no active fork/i.test(message) ? 404 : 400;
      this.respondJson(
        res,
        {
          success: false,
          message,
        },
        status
      );
    }
  }

  private async handleForkDiscard(
    context: RequestContext,
    reqLogger: Logger,
    forkId: string
  ): Promise<void> {
    const { req, res } = context;
    const cookies = parseCookies(req.headers.cookie);
    const sid = this.sessionStore.getOrCreateSessionId(cookies, res);

    try {
      this.sessionStore.discardFork(sid, forkId);
      reqLogger.info({ forkId }, "Discarded A/B fork");
      this.respondJson(res, { success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /no active fork/i.test(message) ? 404 : 400;
      this.respondJson(
        res,
        {
          success: false,
          message,
        },
        status
      );
    }
  }

  private async computeProviderKeyStatuses(): Promise<
    Record<
      "openai" | "gemini" | "anthropic" | "grok" | "groq",
      { hasKey: boolean; verified: boolean }
    >
  > {
    const providers: Array<ProviderSettings["provider"]> = [
      "openai",
      "gemini",
      "anthropic",
      "grok",
      "groq",
    ];
    const result: Record<
      "openai" | "gemini" | "anthropic" | "grok" | "groq",
      { hasKey: boolean; verified: boolean }
    > = {
      openai: { hasKey: false, verified: false },
      gemini: { hasKey: false, verified: false },
      anthropic: { hasKey: false, verified: false },
      grok: { hasKey: false, verified: false },
      groq: { hasKey: false, verified: false },
    };

    for (const p of providers) {
      const storedKey = await this.credentialStore.getApiKey(p);
      const envKey = lookupEnvApiKey(p);
      const hasKey = Boolean(
        (storedKey && storedKey.trim().length > 0) ||
          (envKey && envKey.trim().length > 0)
      );

      const isCurrentProvider = p === this.state.provider.provider;
      const currentVerified = Boolean(
        isCurrentProvider &&
          this.state.providerReady &&
          this.state.provider.apiKey &&
          this.state.provider.apiKey.trim().length > 0
      );
      const previouslyVerified = Boolean(this.state.verifiedProviders[p]);
      const startupVerified = this.state.providersWithKeys.has(p) && hasKey;

      const verified = Boolean(
        currentVerified || previouslyVerified || startupVerified
      );

      result[p as "openai" | "gemini" | "anthropic" | "grok" | "groq"] = {
        hasKey,
        verified,
      };
    }

    return result;
  }

  private async buildAdminStateResponse(): Promise<AdminStateResponse> {
    const sortedHistory = this.getSortedHistoryEntries();
    const sessionCount = new Set(sortedHistory.map((entry) => entry.sessionId))
      .size;
    const attachments = (this.state.briefAttachments ?? []).map((attachment) =>
      this.toAdminBriefAttachment(attachment)
    );

    const activeForks: AdminActiveForkSummary[] = this.sessionStore
      .getActiveForkSummaries()
      .map(({ sessionId, fork }) => ({
        sessionId,
        forkId: fork.forkId,
        originEntryId: fork.originEntryId,
        createdAt: fork.createdAt,
        branches: fork.branches.map((branch) => ({
          branchId: branch.branchId,
          label: branch.label,
          instructions: branch.instructions,
          entryCount: branch.entryCount,
        })),
      }));

    const providerInfo: AdminProviderInfo = {
      provider: this.state.provider.provider,
      model: this.state.provider.model,
      maxOutputTokens: this.state.provider.maxOutputTokens,
      reasoningMode: this.state.provider.reasoningMode,
      reasoningTokensEnabled: this.state.provider.reasoningTokensEnabled,
      reasoningTokens: this.state.provider.reasoningTokens,
      apiKeyMask: maskSensitive(this.state.provider.apiKey),
    };

    const runtimeInfo: AdminRuntimeInfo = {
      historyLimit: this.state.runtime.historyLimit,
      historyMaxBytes: this.state.runtime.historyMaxBytes,
      includeInstructionPanel: this.state.runtime.includeInstructionPanel,
    };

    const providerKeyStatuses = await this.computeProviderKeyStatuses();
    const providers = Object.keys(PROVIDER_LABELS) as ModelProvider[];
    const modelOptions = Object.fromEntries(
      providers.map((provider) => [provider, getModelOptions(provider)])
    ) as Record<
      ModelProvider,
      Array<{ value: string; label: string; tagline?: string }>
    >;
    const featuredModels = Object.fromEntries(
      providers.map((provider) => [
        provider,
        getFeaturedModels(provider).map((model) => ({
          value: model.value,
          label: model.label,
          tagline: model.tagline,
        })),
      ])
    ) as Record<
      ModelProvider,
      Array<{ value: string; label: string; tagline?: string }>
    >;

    return {
      brief: this.state.brief,
      attachments,
      provider: providerInfo,
      runtime: runtimeInfo,
      providerReady: this.state.providerReady,
      providerSelectionRequired: this.state.providerSelectionRequired,
      providerLocked: this.state.providerLocked,
      totalHistoryCount: sortedHistory.length,
      sessionCount,
      exportJsonUrl: JSON_EXPORT_PATH,
      exportMarkdownUrl: MARKDOWN_EXPORT_PATH,
      providerKeyStatuses: providerKeyStatuses as Record<
        ModelProvider,
        { hasKey: boolean; verified: boolean }
      >,
      providerChoices: PROVIDER_CHOICES,
      providerLabels: PROVIDER_LABELS,
      providerPlaceholders: PROVIDER_PLACEHOLDERS,
      defaultModelByProvider: DEFAULT_MODEL_BY_PROVIDER,
      defaultMaxOutputTokens: DEFAULT_MAX_TOKENS_BY_PROVIDER,
      providerTokenGuidance: PROVIDER_TOKEN_GUIDANCE,
      reasoningModeChoices: REASONING_MODE_CHOICES,
      customModelDescription: CUSTOM_MODEL_DESCRIPTION,
      modelCatalog: PROVIDER_MODEL_METADATA,
      modelOptions,
      featuredModels,
      providerReasoningModes: PROVIDER_REASONING_MODES,
      providerReasoningCapabilities: PROVIDER_REASONING_CAPABILITIES,
      isForkActive: activeForks.length > 0,
      activeForks,
    };
  }

  private buildAdminHistoryResponse(
    limit: number,
    offset: number
  ): AdminHistoryResponse {
    const entries = this.getSortedHistoryEntries();
    const totalCount = entries.length;
    const slice = entries.slice(offset, offset + limit);
    const items = slice.map((entry) => this.toAdminHistoryItem(entry));
    const sessionCount = new Set(entries.map((entry) => entry.sessionId)).size;
    const nextOffset = offset + slice.length < totalCount ? offset + slice.length : null;

    return {
      items,
      totalCount,
      sessionCount,
      pagination: {
        limit,
        offset,
        nextOffset,
      },
    };
  }

  private handleHistoryJson(context: RequestContext): void {
    const { res } = context;
    if (this.sessionStore.hasAnyActiveFork()) {
      this.respondJson(
        res,
        {
          success: false,
          message: "Cannot export history while an A/B test is active",
        },
        409
      );
      return;
    }
    const history = this.sessionStore.exportHistory();
    const snapshot = createHistorySnapshot({
      history,
      brief: this.state.brief,
      briefAttachments: cloneAttachments(this.state.briefAttachments),
      runtime: this.state.runtime,
      provider: this.state.provider,
    });
    const payload = JSON.stringify(snapshot, null, 2);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=history.json");
    res.end(payload);
  }

  private handlePromptMarkdown(context: RequestContext): void {
    const { res } = context;
    if (this.sessionStore.hasAnyActiveFork()) {
      this.respondJson(
        res,
        {
          success: false,
          message: "Cannot export prompts while an A/B test is active",
        },
        409
      );
      return;
    }
    const history = this.sessionStore.exportHistory();
    const markdown = createPromptMarkdown({
      history,
      brief: this.state.brief,
      briefAttachments: cloneAttachments(this.state.briefAttachments),
      runtime: this.state.runtime,
      provider: this.state.provider,
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=prompt.md");
    res.end(markdown);
  }

  private respondJson(
    res: ServerResponse,
    payload: unknown,
    statusCode = 200
  ): void {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(payload));
  }

  private async handleHistoryResource(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { res, url, path } = context;
    const segments = path
      .slice(ADMIN_ROUTE_PREFIX.length)
      .split("/")
      .filter(Boolean);
    if (segments.length < 2) {
      this.respondNotFound(res);
      return;
    }
    const entryId = segments[1];
    const action = segments[2] ?? "view";

    const history = this.getSortedHistoryEntries();
    const entry = history.find((item) => item.id === entryId);
    if (!entry) {
      this.respondNotFound(res);
      return;
    }

    const filenameSafeId = entryId.replace(/[^a-z0-9-_]/gi, "-");
    const html = entry.response.html;

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    if (action === "download" || url.searchParams.get("download") === "1") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=history-${filenameSafeId}.html`
      );
    }

    res.end(html);
    reqLogger.debug({ entryId, action }, "Served history entry");
  }

  private async applyProviderUpdate(
    data: Record<string, unknown>,
    reqLogger: Logger
  ): Promise<{ message: string }> {
    const provider = sanitizeProvider(
      String(data.provider ?? this.state.provider.provider)
    );
    if (
      this.state.providerLocked &&
      provider !== this.state.provider.provider
    ) {
      throw new Error(
        "Provider selection is locked by configuration and cannot be changed."
      );
    }
    const model =
      typeof data.model === "string" && data.model.trim().length > 0
        ? data.model.trim()
        : this.state.provider.model;
    const rawMaxOutputTokens = parsePositiveInt(
      data.maxOutputTokens,
      this.state.provider.maxOutputTokens
    );
    const requestedReasoningMode = sanitizeReasoningMode(
      String(data.reasoningMode ?? this.state.provider.reasoningMode)
    );
    const reasoningCapability =
      PROVIDER_REASONING_CAPABILITIES[provider] || { tokens: false, mode: false };
    const modelMetadata = getModelMetadata(provider, model);
    const modelReasoningModes = modelMetadata?.reasoningModes;
    const providerReasoningModes = PROVIDER_REASONING_MODES[provider] ?? [];
    const providerSupportsModes = Boolean(reasoningCapability.mode);
    const modelSupportsModes = modelMetadata?.supportsReasoningMode === true;
    const availableReasoningModes = (() => {
      if (modelReasoningModes && modelReasoningModes.length > 0) {
        return modelReasoningModes;
      }
      if (!modelMetadata && providerSupportsModes) {
        return providerReasoningModes;
      }
      if (modelSupportsModes && providerSupportsModes) {
        return providerReasoningModes;
      }
      return [] as ReasoningMode[];
    })();
    const reasoningModesSupported = availableReasoningModes.some((mode) => mode !== "none");
    const providerGuidance = PROVIDER_TOKEN_GUIDANCE[provider]?.reasoningTokens;
    const modelReasoningTokens = modelMetadata?.reasoningTokens;
    const maxOutputTokens = clampMaxOutputTokensForModel(
      rawMaxOutputTokens,
      provider,
      model
    );
    const tokensSupported =
      Boolean(reasoningCapability.tokens) &&
      (modelMetadata ? Boolean(modelReasoningTokens?.supported) : true);
    const tokenGuidance =
      tokensSupported && modelMetadata && modelReasoningTokens?.supported
        ? modelReasoningTokens
        : tokensSupported
        ? providerGuidance
        : undefined;
    const toggleAllowed =
      Boolean(tokenGuidance?.allowDisable !== false) && tokensSupported;

    let normalizedReasoningMode = requestedReasoningMode;
    if (!reasoningModesSupported) {
      normalizedReasoningMode = "none";
    } else if (
      availableReasoningModes.length > 0 &&
      !availableReasoningModes.includes(normalizedReasoningMode)
    ) {
      if (availableReasoningModes.includes("default")) {
        normalizedReasoningMode = "default";
      } else if (availableReasoningModes.includes("low")) {
        normalizedReasoningMode = "low";
      } else {
        normalizedReasoningMode = availableReasoningModes[0];
      }
    }

    const previousTokensEnabled =
      this.state.provider.reasoningTokensEnabled !== false;
    let requestedTokensEnabled: boolean | undefined;
    if (toggleAllowed) {
      if (typeof data.reasoningTokensEnabled === "boolean") {
        requestedTokensEnabled = data.reasoningTokensEnabled;
      } else if (typeof data.reasoningTokensEnabled === "string") {
        const toggleRaw = data.reasoningTokensEnabled.trim().toLowerCase();
        requestedTokensEnabled = !["", "off", "false", "0"].includes(toggleRaw);
      }
    }

    const nextReasoningTokensEnabled = tokensSupported
      ? toggleAllowed
        ? requestedTokensEnabled ?? previousTokensEnabled
        : true
      : false;

    const fallbackTokens =
      this.state.provider.provider === provider &&
      typeof this.state.provider.reasoningTokens === "number"
        ? this.state.provider.reasoningTokens
        : tokenGuidance?.default;

    const parsedReasoningTokens =
      tokensSupported && nextReasoningTokensEnabled
        ? parseReasoningTokensValue(
            data.reasoningTokens,
            provider,
            fallbackTokens,
            tokenGuidance
          )
        : undefined;

    const sanitizedReasoningTokens =
      tokensSupported && nextReasoningTokensEnabled
        ? clampReasoningTokens(
            parsedReasoningTokens,
            provider,
            tokenGuidance
          )
        : undefined;
    if (
      reasoningModesSupported &&
      reasoningCapability.mode &&
      tokensSupported &&
      nextReasoningTokensEnabled &&
      normalizedReasoningMode === "none"
    ) {
      const fallbackMode = availableReasoningModes.find((mode) => mode !== "none");
      if (fallbackMode) {
        normalizedReasoningMode = fallbackMode;
      }
    }
    const storedReasoningTokensEnabled = tokensSupported
      ? toggleAllowed
        ? nextReasoningTokensEnabled
        : true
      : undefined;
    const finalReasoningTokens =
      storedReasoningTokensEnabled === true ? sanitizedReasoningTokens : undefined;

    if (storedReasoningTokensEnabled === false) {
      normalizedReasoningMode = "none";
    }

    const newApiKey = typeof data.apiKey === "string" ? data.apiKey.trim() : "";
    const previousProvider = this.state.provider.provider;

    let apiKeyCandidate = newApiKey;
    let keySourceIsUI = Boolean(newApiKey);

    if (!apiKeyCandidate) {
      if (
        provider === previousProvider &&
        typeof this.state.provider.apiKey === "string" &&
        this.state.provider.apiKey.length > 0
      ) {
        apiKeyCandidate = this.state.provider.apiKey;
        keySourceIsUI = !this.isKeyFromEnvironment(provider);
      } else {
        const storedKey = await this.credentialStore.getApiKey(provider);
        if (storedKey && storedKey.trim().length > 0) {
          apiKeyCandidate = storedKey;
          keySourceIsUI = true;
        } else {
          const envKey = lookupEnvApiKey(provider);
          if (envKey) {
            apiKeyCandidate = envKey;
            keySourceIsUI = false;
          }
        }
      }
    }

    const updatedSettings: ProviderSettings = {
      provider,
      model,
      maxOutputTokens,
      reasoningMode: normalizedReasoningMode,
      reasoningTokensEnabled: storedReasoningTokensEnabled,
      reasoningTokens: finalReasoningTokens,
      apiKey: apiKeyCandidate,
    };

    if (!updatedSettings.apiKey || updatedSettings.apiKey.trim().length === 0) {
      throw new Error("Missing API key for provider");
    }

    const trimmedKey = updatedSettings.apiKey.trim();
    const existingKey = this.state.provider.apiKey?.trim() ?? "";
    const isSameProvider = this.state.provider.provider === provider;
    const keyUnchanged = isSameProvider && trimmedKey === existingKey;

    if (!keyUnchanged) {
      const verification = await verifyProviderApiKey(provider, trimmedKey);
      if (!verification.ok) {
        throw new Error(
          verification.message || "Unable to verify provider credentials"
        );
      }
      reqLogger.info({ provider }, "Verified provider API key");
    } else {
      reqLogger.debug({ provider }, "Reusing previously verified API key");
    }

    const newClient = createLlmClient(updatedSettings);
    this.state.llmClient = newClient;
    this.state.provider = { ...updatedSettings };
    this.state.providerReady = true;
    this.state.providerSelectionRequired = false;
    this.state.providersWithKeys.add(provider);
    this.state.verifiedProviders[provider] = true;

    if (
      keySourceIsUI &&
      updatedSettings.apiKey &&
      updatedSettings.apiKey.trim().length > 0
    ) {
      reqLogger.debug(
        { provider: updatedSettings.provider },
        "Saving UI-entered API key to credential store"
      );
      await this.credentialStore
        .saveApiKey(updatedSettings.provider, updatedSettings.apiKey)
        .catch((err) => {
          reqLogger.error(
            { err },
            "Failed to save credential - will use memory storage"
          );
        });
    }

    this.applyProviderEnv(updatedSettings);
    reqLogger.info(
      { provider },
      "Updated LLM provider settings via admin interface"
    );

    return { message: "Provider configuration updated" };
  }

  private async applyProviderVerification(
    data: Record<string, unknown>,
    reqLogger: Logger
  ): Promise<{ message: string }> {
    const provider = sanitizeProvider(
      String(data.provider ?? this.state.provider.provider)
    );
    const apiKey =
      typeof data.apiKey === "string" ? data.apiKey.trim() : "";

    if (!apiKey) {
      throw new Error("Provide an API key to verify");
    }

    const verification = await verifyProviderApiKey(provider, apiKey);
    if (!verification.ok) {
      throw new Error(
        verification.message || "Unable to verify provider credentials"
      );
    }

    reqLogger.info({ provider }, "Verified provider API key");

    if (this.state.provider.provider === provider && !this.state.providerReady) {
      this.state.provider.apiKey = apiKey;
    }

    this.state.providersWithKeys.add(provider);
    this.state.verifiedProviders[provider] = true;

    if (!this.isKeyFromEnvironment(provider)) {
      await this.credentialStore
        .saveApiKey(provider, apiKey)
        .catch((err) => {
          reqLogger.error(
            { err },
            "Failed to save credential - will use memory storage"
          );
        });
    }

    const providerLabel = PROVIDER_LABELS[provider] ?? provider;
    return { message: `${providerLabel} key verified` };
  }

  private async handleProviderUpdate(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { req, res } = context;
    const body = await readBody(req);
    try {
      const { message } = await this.applyProviderUpdate(
        body.data ?? {},
        reqLogger
      );
      this.redirectWithMessage(res, message, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reqLogger.error({ err: error }, "Failed to update provider settings");
      this.redirectWithMessage(res, `Provider update failed: ${message}`, true);
    }
  }

  private async handleProviderVerification(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { req, res } = context;
    const body = await readBody(req);
    try {
      const { message } = await this.applyProviderVerification(
        body.data ?? {},
        reqLogger
      );
      this.redirectWithMessage(res, message, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reqLogger.error({ err: error }, "Failed to verify provider key");
      this.redirectWithMessage(
        res,
        `Provider key verification failed: ${message}`,
        true
      );
    }
  }

  private applyRuntimeUpdate(
    data: Record<string, unknown>,
    reqLogger: Logger
  ): { message: string } {
    const historyLimit = clampInt(
      parsePositiveInt(data.historyLimit, this.state.runtime.historyLimit),
      HISTORY_LIMIT_MIN,
      HISTORY_LIMIT_MAX
    );
    const historyMaxBytes = clampInt(
      parsePositiveInt(data.historyMaxBytes, this.state.runtime.historyMaxBytes),
      HISTORY_MAX_BYTES_MIN,
      HISTORY_MAX_BYTES_MAX
    );
    const instructionToggle = data.instructionPanel;
    let includeInstructionPanel: boolean;
    if (typeof instructionToggle === "string") {
      const normalized = instructionToggle.toLowerCase();
      includeInstructionPanel = normalized === "on" || normalized === "true";
    } else if (typeof instructionToggle === "boolean") {
      includeInstructionPanel = instructionToggle;
    } else {
      includeInstructionPanel = false;
    }

    this.state.runtime.historyLimit = historyLimit;
    this.state.runtime.historyMaxBytes = historyMaxBytes;
    this.state.runtime.includeInstructionPanel = includeInstructionPanel;

    reqLogger.info(
      { historyLimit, historyMaxBytes, includeInstructionPanel },
      "Updated runtime settings via admin interface"
    );

    return { message: "Runtime settings saved" };
  }

  private async handleRuntimeUpdate(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { req, res } = context;
    const body = await readBody(req);

    try {
      const { message } = this.applyRuntimeUpdate(body.data ?? {}, reqLogger);
      this.redirectWithMessage(res, message, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.redirectWithMessage(res, `Runtime update failed: ${message}`, true);
    }
  }

  private applyBriefUpdate(
    data: Record<string, unknown>,
    files: ParsedFile[],
    reqLogger: Logger
  ): { message: string } {
    const rawBrief =
      typeof data.brief === "string" ? data.brief.trim() : "";
    this.state.brief = rawBrief.length > 0 ? rawBrief : null;
    this.state.runtime.brief = this.state.brief ?? undefined;

    const removalValues = normalizeStringArray(data.removeAttachment);
    let currentAttachments = this.state.briefAttachments ?? [];
    let removedCount = 0;
    if (removalValues.length > 0 && currentAttachments.length > 0) {
      const removalSet = new Set(removalValues);
      const filtered = currentAttachments.filter(
        (attachment) => !removalSet.has(attachment.id)
      );
      removedCount = currentAttachments.length - filtered.length;
      currentAttachments = filtered;
    }

    const fileInputs = files.filter(
      (file) =>
        file.fieldName === "briefAttachments" &&
        typeof file.filename === "string" &&
        file.filename.trim().length > 0 &&
        file.size > 0
    );

    const processed = processBriefAttachmentFiles(fileInputs);
    for (const rejected of processed.rejected) {
      reqLogger.warn(
        { file: rejected.filename, mimeType: rejected.mimeType },
        "Rejected unsupported brief attachment"
      );
    }

    if (processed.accepted.length > 0) {
      currentAttachments = [...currentAttachments, ...processed.accepted];
    }

    this.state.briefAttachments = currentAttachments;

    const addedCount = processed.accepted.length;
    reqLogger.info(
      {
        hasBrief: Boolean(this.state.brief),
        attachments: this.state.briefAttachments.length,
        addedAttachments: addedCount,
        removedAttachments: removedCount,
      },
      "Updated brief via admin interface"
    );

    const statusParts: string[] = [];
    statusParts.push(this.state.brief ? "Brief updated" : "Brief cleared");
    if (addedCount > 0) {
      statusParts.push(`Added ${addedCount} attachment${addedCount === 1 ? "" : "s"}`);
    }
    if (removedCount > 0) {
      statusParts.push(
        `Removed ${removedCount} attachment${removedCount === 1 ? "" : "s"}`
      );
    }
    const statusMessage = statusParts.join(" · ");

    return { message: statusMessage };
  }

  private async handleBriefUpdate(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { req, res } = context;
    const body = await readBody(req);
    try {
      const { message } = this.applyBriefUpdate(
        body.data ?? {},
        body.files ?? [],
        reqLogger
      );
      this.redirectWithMessage(res, message, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.redirectWithMessage(res, `Brief update failed: ${message}`, true);
    }
  }

  private async handleHistoryImport(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { req, res } = context;
    const body = await readBody(req);
    const dataCandidate = extractSnapshotCandidate(body.data);
    const rawCandidate =
      typeof body.data.historyJson === "string"
        ? body.data.historyJson
        : typeof body.raw === "string"
          ? body.raw
          : undefined;
    const snapshotInput =
      dataCandidate ?? (typeof rawCandidate === "string" ? rawCandidate : undefined);

    if (snapshotInput == null || (typeof snapshotInput === "string" && !snapshotInput.trim())) {
      this.redirectWithMessage(
        res,
        "History import failed: no JSON provided",
        true
      );
      return;
    }
    try {
      const entries = await this.importHistorySnapshot(snapshotInput, reqLogger);
      this.redirectWithMessage(
        res,
        describeHistoryImportResult(entries),
        false
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reqLogger.error({ err: error }, "Failed to import history snapshot");
      this.redirectWithMessage(res, `History import failed: ${message}`, true);
    }
  }

  private async importHistorySnapshot(
    snapshotInput: unknown,
    reqLogger: Logger
  ): Promise<number> {
    let snapshot: HistorySnapshot;

    if (typeof snapshotInput === "string") {
      const trimmed = snapshotInput.trim();
      if (!trimmed) {
        throw new Error("History snapshot payload is empty");
      }
      try {
        snapshot = JSON.parse(trimmed) as HistorySnapshot;
      } catch (error) {
        throw new Error(
          `Invalid snapshot JSON: ${(error as Error).message ?? String(error)}`
        );
      }
    } else if (snapshotInput && typeof snapshotInput === "object") {
      snapshot = snapshotInput as HistorySnapshot;
    } else {
      throw new Error("Provide a history snapshot JSON payload");
    }

    if (snapshot.version !== 1) {
      throw new Error("Unsupported snapshot version");
    }
    if (!Array.isArray(snapshot.history)) {
      throw new Error("Snapshot history must be an array");
    }

    const previousProvider = this.state.provider.provider;
    const previousApiKey = this.state.provider.apiKey;

    const historyEntries = (snapshot.history as HistoryEntry[]).map((entry) => ({
      ...entry,
      createdAt: entry.createdAt,
      response: entry.response,
      briefAttachments: cloneAttachments(entry.briefAttachments),
    }));
    this.sessionStore.replaceHistory(historyEntries);

    if (typeof snapshot.brief === "string") {
      this.state.brief = snapshot.brief.trim() || null;
    } else if (snapshot.brief === null) {
      this.state.brief = null;
    }

    if (Array.isArray(snapshot.briefAttachments)) {
      this.state.briefAttachments = cloneAttachments(
        snapshot.briefAttachments as BriefAttachment[]
      );
    } else {
      const latestAttachments = historyEntries.at(-1)?.briefAttachments;
      this.state.briefAttachments = cloneAttachments(latestAttachments);
    }

    if (snapshot.runtime && typeof snapshot.runtime === "object") {
      const runtimeData = snapshot.runtime as Partial<{
        historyLimit: number;
        historyMaxBytes: number;
        includeInstructionPanel: boolean;
      }>;
      if (
        typeof runtimeData.historyLimit === "number" &&
        runtimeData.historyLimit > 0
      ) {
        this.state.runtime.historyLimit = runtimeData.historyLimit;
      }
      if (
        typeof runtimeData.historyMaxBytes === "number" &&
        runtimeData.historyMaxBytes > 0
      ) {
        this.state.runtime.historyMaxBytes = runtimeData.historyMaxBytes;
      }
      if (typeof runtimeData.includeInstructionPanel === "boolean") {
        this.state.runtime.includeInstructionPanel =
          runtimeData.includeInstructionPanel;
      }
    }

    if (snapshot.llm && typeof snapshot.llm === "object") {
      const summary = snapshot.llm as Partial<ProviderSettings> & {
        provider?: string;
      };
      if (summary.provider && typeof summary.provider === "string") {
        this.state.provider.provider = sanitizeProvider(summary.provider);
      }
      if (summary.model && typeof summary.model === "string") {
        this.state.provider.model = summary.model;
      }
      if (
        typeof summary.maxOutputTokens === "number" &&
        summary.maxOutputTokens > 0
      ) {
        this.state.provider.maxOutputTokens = summary.maxOutputTokens;
      }
      if (summary.reasoningMode && typeof summary.reasoningMode === "string") {
        this.state.provider.reasoningMode = sanitizeReasoningMode(
          summary.reasoningMode
        );
      }
      if (
        typeof summary.reasoningTokens === "number" &&
        summary.reasoningTokens > 0
      ) {
        this.state.provider.reasoningTokens = summary.reasoningTokens;
      } else if (summary.reasoningTokens === null) {
        this.state.provider.reasoningTokens = undefined;
      }
    }

    const nextProvider = this.state.provider.provider;
    let nextApiKey = previousApiKey;

    if (nextProvider !== previousProvider) {
      const storedKey = await this.credentialStore.getApiKey(nextProvider);
      if (storedKey && storedKey.trim().length > 0) {
        nextApiKey = storedKey.trim();
      } else {
        const envKey = lookupEnvApiKey(nextProvider);
        nextApiKey = envKey?.trim() ?? "";
      }
    }

    this.state.provider.apiKey = typeof nextApiKey === "string" ? nextApiKey : "";
    const refreshedSettings: ProviderSettings = { ...this.state.provider };
    this.state.provider = refreshedSettings;

    const hasKey =
      typeof refreshedSettings.apiKey === "string"
      && refreshedSettings.apiKey.trim().length > 0;

    if (hasKey) {
      this.state.llmClient = createLlmClient(refreshedSettings);
      this.state.providerReady = true;
      this.state.providersWithKeys.add(nextProvider);
      this.state.verifiedProviders[nextProvider] =
        this.state.verifiedProviders[nextProvider] ?? false;
      this.applyProviderEnv(refreshedSettings);
    } else {
      this.state.llmClient = null;
      this.state.providerReady = false;
      this.state.providersWithKeys.delete(nextProvider);
      delete this.state.verifiedProviders[nextProvider];
      this.applyProviderEnv(refreshedSettings);
    }

    this.state.providerSelectionRequired = !hasKey;

    if (nextProvider !== previousProvider) {
      this.state.providersWithKeys.delete(previousProvider);
      delete this.state.verifiedProviders[previousProvider];
    }

    reqLogger.info(
      { entries: historyEntries.length },
      "Imported history snapshot via admin console"
    );

    return historyEntries.length;
  }

  private handleHistoryLatest(context: RequestContext): void {
    const { res } = context;
    const entries = this.getSortedHistoryEntries();
    const sessionCount = new Set(entries.map((entry) => entry.sessionId)).size;
    const providerLabel = `${this.state.provider.provider} · ${this.state.provider.model}`;

    const history = this.buildAdminHistoryResponse(
      Math.min(this.state.runtime.historyLimit, 100),
      0,
    );

    const payload = {
      historyHtml: "",
      history,
      brief: this.state.brief ?? "",
      totalHistoryCount: history.totalCount,
      sessionCount,
      provider: {
        provider: this.state.provider.provider,
        model: this.state.provider.model,
        label: providerLabel,
      },
      runtime: {
        historyLimit: this.state.runtime.historyLimit,
        historyMaxBytes: this.state.runtime.historyMaxBytes,
      },
    };

    this.respondJson(res, payload);
  }

  private getSortedHistoryEntries(): HistoryEntry[] {
    return this.sessionStore
      .exportHistory()
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  private redirectWithMessage(
    res: ServerResponse,
    message: string,
    isError: boolean
  ): void {
    const target = isError
      ? `${ADMIN_ROUTE_PREFIX}?error=${encodeURIComponent(message)}`
      : `${ADMIN_ROUTE_PREFIX}?status=${encodeURIComponent(message)}`;
    this.redirect(res, target);
  }

  private redirect(res: ServerResponse, location: string): void {
    res.statusCode = 302;
    res.setHeader("Location", location);
    res.end();
  }

  private respondNotFound(res: ServerResponse): void {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not Found");
  }

  private toAdminBriefAttachment(
    attachment: BriefAttachment
  ): AdminBriefAttachment {
    const dataUrl = `data:${attachment.mimeType};base64,${attachment.base64}`;
    return {
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      dataUrl,
      isImage: attachment.mimeType.startsWith("image/"),
    };
  }

  private applyProviderEnv(settings: ProviderSettings): void {
    if (settings.provider === "openai") {
      process.env.OPENAI_API_KEY = settings.apiKey;
    } else if (settings.provider === "gemini") {
      process.env.GEMINI_API_KEY = settings.apiKey;
    } else if (settings.provider === "anthropic") {
      process.env.ANTHROPIC_API_KEY = settings.apiKey;
    } else if (settings.provider === "grok") {
      process.env.XAI_API_KEY = settings.apiKey;
    } else if (settings.provider === "groq") {
      process.env.GROQ_API_KEY = settings.apiKey;
    }
  }

  private isKeyFromEnvironment(
    provider: ProviderSettings["provider"]
  ): boolean {
    const envKey = lookupEnvApiKey(provider);
    return Boolean(envKey && envKey.trim().length > 0);
  }

  private toAdminHistoryItem(entry: HistoryEntry): AdminHistoryItem {
    const querySummary = summarizeRecord(entry.request.query);
    const bodySummary = summarizeRecord(entry.request.body);
    const usageSummary = entry.entryKind === "html" ? summarizeUsage(entry) : undefined;
    const reasoningSummaries = entry.reasoning?.summaries
      ? [...entry.reasoning.summaries]
      : undefined;
    const reasoningDetails = entry.reasoning?.details
      ? [...entry.reasoning.details]
      : undefined;
    const attachments = entry.briefAttachments?.length
      ? entry.briefAttachments.map((attachment) =>
          this.toAdminBriefAttachment(attachment)
        )
      : undefined;
    const restMutations =
      entry.entryKind === "html" && entry.restMutations?.length
        ? entry.restMutations.map(toAdminRestMutationItem)
        : undefined;
    const restQueries =
      entry.entryKind === "html" && entry.restQueries?.length
        ? entry.restQueries.map(toAdminRestQueryItem)
        : undefined;

    let restItem: AdminRestItem | undefined;
    if (entry.entryKind !== "html" && entry.rest) {
      let responseSummary: string | undefined;
      if ("response" in entry.rest) {
        try {
          responseSummary = JSON.stringify(entry.rest.response ?? null, null, 2);
        } catch {
          responseSummary = String(entry.rest.response ?? "");
        }
      }
      restItem = {
        type: entry.rest.type,
        request: entry.rest.request,
        responseSummary,
        ok: entry.rest.ok,
        error: entry.rest.error,
      };
    }

    return {
      id: entry.id,
      createdAt: entry.createdAt,
      method: entry.request.method,
      path: entry.request.path,
      durationMs: entry.durationMs,
      instructions: entry.request.instructions,
      querySummary,
      bodySummary,
      usageSummary,
      reasoningSummaries,
      reasoningDetails,
      html: entry.response.html,
      attachments,
      entryKind: entry.entryKind,
      rest: restItem,
      restMutations,
      restQueries,
      viewUrl: `${ADMIN_ROUTE_PREFIX}/history/${encodeURIComponent(
        entry.id
      )}/view`,
      downloadUrl: `${ADMIN_ROUTE_PREFIX}/history/${encodeURIComponent(
        entry.id
      )}/download`,
      deleteUrl: `/api/admin/history/${encodeURIComponent(entry.id)}`,
      forkInfo: entry.forkInfo
        ? {
            forkId: entry.forkInfo.forkId,
            branchId: entry.forkInfo.branchId,
            label: entry.forkInfo.label,
            status: entry.forkInfo.status,
          }
        : undefined,
    };
  }
}

function summarizeRecord(record: Record<string, unknown> | undefined): string {
  try {
    if (!record || Object.keys(record).length === 0) {
      return "{}";
    }
    const json = JSON.stringify(record);
    return json.length > 90 ? `${json.slice(0, 87)}…` : json;
  } catch {
    return "{}";
  }
}

function summarizeUnknown(value: unknown): string {
  if (value == null) {
    return "null";
  }
  if (typeof value === "string") {
    return value.length > 90 ? `${value.slice(0, 87)}…` : value;
  }
  try {
    const json = JSON.stringify(value);
    if (!json) return "{}";
    return json.length > 90 ? `${json.slice(0, 87)}…` : json;
  } catch {
    return String(value);
  }
}

function summarizeUsage(entry: HistoryEntry): string | undefined {
  const usage = entry.usage;
  if (!usage) return undefined;
  const parts: string[] = [];
  if (typeof usage.inputTokens === "number")
    parts.push(`in ${usage.inputTokens}`);
  if (typeof usage.outputTokens === "number")
    parts.push(`out ${usage.outputTokens}`);
  if (typeof usage.reasoningTokens === "number")
    parts.push(`reasoning ${usage.reasoningTokens}`);
  if (typeof usage.totalTokens === "number")
    parts.push(`total ${usage.totalTokens}`);
  if (parts.length === 0) return undefined;
  return parts.join(" · ");
}

function toAdminRestMutationItem(record: RestMutationRecord): AdminRestMutationItem {
  return {
    id: record.id,
    createdAt: record.createdAt,
    method: record.method,
    path: record.path,
    querySummary: summarizeRecord(record.query),
    bodySummary: summarizeRecord(record.body),
  };
}

function toAdminRestQueryItem(record: RestQueryRecord): AdminRestQueryItem {
  return {
    ...toAdminRestMutationItem(record),
    ok: record.ok,
    responseSummary: summarizeUnknown(record.response),
    error: record.error,
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  return [];
}

function cloneAttachments(
  attachments: BriefAttachment[] | undefined
): BriefAttachment[] {
  if (!attachments || attachments.length === 0) {
    return [];
  }
  return attachments.map((attachment) => ({ ...attachment }));
}

function extractSnapshotCandidate(
  data: unknown
): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, "snapshot")) {
    return record.snapshot;
  }
  if (Object.prototype.hasOwnProperty.call(record, "historyJson")) {
    return record.historyJson;
  }
  if (Object.keys(record).length === 0) {
    return undefined;
  }
  return record;
}

function describeHistoryImportResult(entries: number): string {
  if (!Number.isFinite(entries) || entries <= 0) {
    return "History snapshot imported (no entries)";
  }
  if (entries === 1) {
    return "Imported 1 history entry";
  }
  return `Imported ${entries} history entries`;
}

function clampMaxOutputTokensForModel(
  requested: number,
  provider: ModelProvider,
  model: string
): number {
  const providerGuidance = PROVIDER_TOKEN_GUIDANCE[provider]?.maxOutputTokens;
  const modelMetadata = getModelMetadata(provider, model);
  const modelGuidance = modelMetadata?.maxOutputTokens;

  const defaultValue =
    modelGuidance?.default ??
    providerGuidance?.default ??
    DEFAULT_MAX_TOKENS_BY_PROVIDER[provider] ??
    requested ??
    1024;

  let value = Number.isFinite(requested)
    ? Math.floor(requested)
    : Math.floor(defaultValue);

  const minCandidates = [
    providerGuidance?.min,
    modelGuidance?.min,
  ].filter((candidate): candidate is number =>
    typeof candidate === "number" && Number.isFinite(candidate)
  );
  if (minCandidates.length > 0) {
    value = Math.max(value, Math.max(...minCandidates));
  }

  const maxCandidates = [
    providerGuidance?.max,
    modelGuidance?.max,
  ].filter((candidate): candidate is number =>
    typeof candidate === "number" && Number.isFinite(candidate)
  );
  if (maxCandidates.length > 0) {
    value = Math.min(value, Math.min(...maxCandidates));
  }

  if (!Number.isFinite(value) || value <= 0) {
    value = Math.max(1, Math.floor(defaultValue));
  }

  return value;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === "string" && value.trim() === "") {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${String(value)}`);
  }
  return Math.floor(parsed);
}

function clampInt(value: number, min: number, max: number): number {
  let next = value;
  if (Number.isFinite(min)) {
    next = Math.max(next, min);
  }
  if (Number.isFinite(max)) {
    next = Math.min(next, max);
  }
  return next;
}

function parseReasoningTokensValue(
  value: unknown,
  provider: ProviderSettings["provider"],
  fallback?: number,
  _guidance?: { min?: number; max?: number }
): number | undefined {
  if (value === undefined || value === null || value === "") {
    if (typeof fallback === "number" && Number.isFinite(fallback)) {
      return Math.floor(fallback);
    }
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a numeric value, received: ${String(value)}`);
  }

  const rounded = Math.floor(parsed);
  if (provider === "gemini") {
    if (rounded < -1) {
      throw new Error(
        "Gemini reasoning tokens must be -1 (auto budget) or a non-negative integer."
      );
    }
    return rounded;
  }

  if (rounded < 0) {
    throw new Error(
      "Reasoning tokens must be zero or a positive integer for this provider."
    );
  }

  return rounded;
}

function clampReasoningTokens(
  value: number | undefined,
  provider: ProviderSettings["provider"],
  guidance?: { min?: number; max?: number }
): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  if (provider === "gemini" && value === -1) {
    return -1;
  }

  let next = Math.floor(value);
  if (guidance?.min != null) {
    next = Math.max(next, guidance.min);
  }
  if (guidance?.max != null) {
    next = Math.min(next, guidance.max);
  }

  return next;
}

function lookupEnvApiKey(
  provider: ProviderSettings["provider"]
): string | undefined {
  if (provider === "openai") {
    return process.env.OPENAI_API_KEY?.trim() || undefined;
  }
  if (provider === "gemini") {
    return process.env.GEMINI_API_KEY?.trim() || undefined;
  }
  if (provider === "anthropic") {
    return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
  }
  if (provider === "grok") {
    return (
      process.env.XAI_API_KEY?.trim() ||
      process.env.GROK_API_KEY?.trim() ||
      undefined
    );
  }
  if (provider === "groq") {
    return process.env.GROQ_API_KEY?.trim() || process.env.GROQ_KEY?.trim() || undefined;
  }
  return undefined;
}

function sanitizeProvider(value: string): ProviderSettings["provider"] {
  const normalized = value.toLowerCase();
  if (
    normalized === "gemini" ||
    normalized === "anthropic" ||
    normalized === "openai"
  ) {
    return normalized;
  }
  if (normalized === "grok" || normalized === "xai" || normalized === "x.ai") {
    return "grok";
  }
  if (normalized === "groq") {
    return "groq";
  }
  return "openai";
}

function sanitizeReasoningMode(value: string): ReasoningMode {
  const normalized = value.toLowerCase();
  if (
    normalized === "default" ||
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high"
  ) {
    return normalized as ReasoningMode;
  }
  return "none";
}
