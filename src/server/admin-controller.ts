import type { ServerResponse } from "node:http";
import type { Logger } from "pino";
import { ADMIN_ROUTE_PREFIX } from "../constants.js";
import type {
  HistoryEntry,
  ProviderSettings,
  ReasoningMode,
} from "../types.js";
import { createLlmClient } from "../llm/factory.js";
import { readBody } from "../utils/body.js";
import { maskSensitive } from "../utils/sensitive.js";
import {
  createHistorySnapshot,
  createPromptMarkdown,
} from "../utils/history-export.js";
import {
  renderAdminDashboard,
  renderHistory,
} from "../pages/admin-dashboard.js";
import type {
  AdminHistoryItem,
  AdminProviderInfo,
  AdminRuntimeInfo,
} from "../pages/admin-dashboard.js";
import type { MutableServerState, RequestContext } from "./server.js";
import { SessionStore } from "./session-store.js";
import { getCredentialStore } from "../utils/credential-store.js";

const JSON_EXPORT_PATH = `${ADMIN_ROUTE_PREFIX}/history.json`;
const MARKDOWN_EXPORT_PATH = `${ADMIN_ROUTE_PREFIX}/history/prompt.md`;

interface AdminControllerOptions {
  state: MutableServerState;
  sessionStore: SessionStore;
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
      return false;
    }

    const subPath = path.slice(ADMIN_ROUTE_PREFIX.length) || "/";

    if (method === "GET" && (subPath === "/" || subPath === "")) {
      await this.renderDashboard(context, reqLogger);
      return true;
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

  private async renderDashboard(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { res, url } = context;
    const sortedHistory = this.getSortedHistoryEntries();
    const sessionCount = new Set(sortedHistory.map((entry) => entry.sessionId))
      .size;

    const historyItems = sortedHistory.map((entry) =>
      this.toAdminHistoryItem(entry)
    );

    const providerInfo: AdminProviderInfo = {
      provider: this.state.provider.provider,
      model: this.state.provider.model,
      maxOutputTokens: this.state.provider.maxOutputTokens,
      reasoningMode: this.state.provider.reasoningMode,
      reasoningTokens: this.state.provider.reasoningTokens,
      apiKeyMask: maskSensitive(this.state.provider.apiKey),
    };

    const runtimeInfo: AdminRuntimeInfo = {
      historyLimit: this.state.runtime.historyLimit,
      historyMaxBytes: this.state.runtime.historyMaxBytes,
      includeInstructionPanel: this.state.runtime.includeInstructionPanel,
    };

    const statusMessage = url.searchParams.get("status") ?? undefined;
    const errorMessage = url.searchParams.get("error") ?? undefined;

    const providerKeyStatuses = await this.computeProviderKeyStatuses();
    const html = renderAdminDashboard({
      brief: this.state.brief,
      provider: providerInfo,
      runtime: runtimeInfo,
      history: historyItems,
      totalHistoryCount: sortedHistory.length,
      sessionCount,
      statusMessage,
      errorMessage,
      exportJsonUrl: JSON_EXPORT_PATH,
      exportMarkdownUrl: MARKDOWN_EXPORT_PATH,
      historyEndpoint: `${ADMIN_ROUTE_PREFIX}/history/latest`,
      providerKeyStatuses,
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
    reqLogger.debug(
      { historyCount: sortedHistory.length },
      "Served admin dashboard"
    );
  }

  private async computeProviderKeyStatuses(): Promise<
    Record<
      "openai" | "gemini" | "anthropic" | "grok",
      { hasKey: boolean; verified: boolean }
    >
  > {
    const providers: Array<ProviderSettings["provider"]> = [
      "openai",
      "gemini",
      "anthropic",
      "grok",
    ];
    const result: Record<
      "openai" | "gemini" | "anthropic" | "grok",
      { hasKey: boolean; verified: boolean }
    > = {
      openai: { hasKey: false, verified: false },
      gemini: { hasKey: false, verified: false },
      anthropic: { hasKey: false, verified: false },
      grok: { hasKey: false, verified: false },
    };

    for (const p of providers) {
      const storedKey = await this.credentialStore.getApiKey(p);
      const envKey = lookupEnvApiKey(p);
      const hasKey = Boolean(
        (storedKey && storedKey.trim().length > 0) ||
          (envKey && envKey.trim().length > 0)
      );
      const verified =
        p === this.state.provider.provider &&
        Boolean(
          this.state.providerReady &&
            this.state.provider.apiKey &&
            this.state.provider.apiKey.trim().length > 0
        );
      result[p as "openai" | "gemini" | "anthropic" | "grok"] = {
        hasKey,
        verified,
      };
    }

    return result;
  }

  private handleHistoryJson(context: RequestContext): void {
    const { res } = context;
    const history = this.sessionStore.exportHistory();
    const snapshot = createHistorySnapshot({
      history,
      brief: this.state.brief,
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
    const history = this.sessionStore.exportHistory();
    const markdown = createPromptMarkdown({
      history,
      brief: this.state.brief,
      runtime: this.state.runtime,
      provider: this.state.provider,
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=prompt.md");
    res.end(markdown);
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

  private async handleProviderUpdate(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { req, res } = context;
    const body = await readBody(req);
    const data = body.data;

    const provider = sanitizeProvider(
      String(data.provider ?? this.state.provider.provider)
    );
    const model =
      typeof data.model === "string" && data.model.trim().length > 0
        ? data.model.trim()
        : this.state.provider.model;
    const maxOutputTokens = parsePositiveInt(
      data.maxOutputTokens,
      this.state.provider.maxOutputTokens
    );
    const reasoningMode = sanitizeReasoningMode(
      String(data.reasoningMode ?? this.state.provider.reasoningMode)
    );
    const reasoningTokens = parseOptionalPositiveInt(
      data.reasoningTokens,
      this.state.provider.reasoningTokens
    );
    const newApiKey = typeof data.apiKey === "string" ? data.apiKey.trim() : "";
    const previousProvider = this.state.provider.provider;

    let apiKeyCandidate = newApiKey;
    let keySourceIsUI = Boolean(newApiKey); // Track if this key came from UI input

    if (!apiKeyCandidate) {
      // Try current key if same provider
      if (
        provider === previousProvider &&
        typeof this.state.provider.apiKey === "string" &&
        this.state.provider.apiKey.length > 0
      ) {
        apiKeyCandidate = this.state.provider.apiKey;
        keySourceIsUI = !this.isKeyFromEnvironment(provider);
      } else {
        // Try stored credential (from previous UI input)
        const storedKey = await this.credentialStore.getApiKey(provider);
        if (storedKey && storedKey.trim().length > 0) {
          apiKeyCandidate = storedKey;
          keySourceIsUI = true;
        } else {
          // Fall back to environment variable
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
      reasoningMode,
      reasoningTokens: reasoningMode === "none" ? undefined : reasoningTokens,
      apiKey: apiKeyCandidate,
    };

    if (!updatedSettings.apiKey || updatedSettings.apiKey.trim().length === 0) {
      this.redirectWithMessage(res, "Missing API key for provider", true);
      return;
    }

    try {
      const newClient = createLlmClient(updatedSettings);
      this.state.llmClient = newClient;
      this.state.provider = { ...updatedSettings };
      this.state.providerReady = true;

      // Store UI-entered credentials securely (always save UI input, even if env vars exist)
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
        "Updated LLM provider settings via admin console"
      );
      this.redirectWithMessage(res, "Provider configuration updated", false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reqLogger.error({ err: error }, "Failed to update provider settings");
      this.redirectWithMessage(res, `Provider update failed: ${message}`, true);
    }
  }

  private async handleRuntimeUpdate(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { req, res } = context;
    const body = await readBody(req);
    const data = body.data;

    try {
      const historyLimit = parsePositiveInt(
        data.historyLimit,
        this.state.runtime.historyLimit
      );
      const historyMaxBytes = parsePositiveInt(
        data.historyMaxBytes,
        this.state.runtime.historyMaxBytes
      );
      const instructionPanelValue =
        typeof data.instructionPanel === "string"
          ? data.instructionPanel.toLowerCase()
          : "";
      const includeInstructionPanel =
        instructionPanelValue === "on" || instructionPanelValue === "true";

      this.state.runtime.historyLimit = historyLimit;
      this.state.runtime.historyMaxBytes = historyMaxBytes;
      this.state.runtime.includeInstructionPanel = includeInstructionPanel;
      reqLogger.info(
        { historyLimit, historyMaxBytes, includeInstructionPanel },
        "Updated runtime settings via admin console"
      );
      this.redirectWithMessage(res, "Runtime settings saved", false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.redirectWithMessage(res, `Runtime update failed: ${message}`, true);
    }
  }

  private async handleBriefUpdate(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { req, res } = context;
    const body = await readBody(req);
    const rawBrief =
      typeof body.data.brief === "string" ? body.data.brief.trim() : "";
    this.state.brief = rawBrief.length > 0 ? rawBrief : null;
    reqLogger.info(
      { hasBrief: Boolean(this.state.brief) },
      "Updated brief via admin console"
    );
    this.redirectWithMessage(
      res,
      this.state.brief ? "Brief updated" : "Brief cleared",
      false
    );
  }

  private async handleHistoryImport(
    context: RequestContext,
    reqLogger: Logger
  ): Promise<void> {
    const { req, res } = context;
    const body = await readBody(req);
    const raw =
      typeof body.data.historyJson === "string"
        ? body.data.historyJson.trim()
        : "";
    if (!raw) {
      this.redirectWithMessage(
        res,
        "History import failed: no JSON provided",
        true
      );
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Snapshot must be a JSON object");
      }
      if (parsed.version !== 1 || !Array.isArray(parsed.history)) {
        throw new Error("Unsupported snapshot format");
      }

      const historyEntries = (parsed.history as HistoryEntry[]).map(
        (entry) => ({
          ...entry,
          createdAt: entry.createdAt,
          response: entry.response,
        })
      );
      this.sessionStore.replaceHistory(historyEntries);

      if (typeof parsed.brief === "string") {
        this.state.brief = parsed.brief.trim() || null;
      }

      if (parsed.runtime && typeof parsed.runtime === "object") {
        const runtimeData = parsed.runtime as Partial<{
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

      if (parsed.llm && typeof parsed.llm === "object") {
        const summary = parsed.llm as Partial<ProviderSettings> & {
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
        if (
          summary.reasoningMode &&
          typeof summary.reasoningMode === "string"
        ) {
          this.state.provider.reasoningMode = sanitizeReasoningMode(
            summary.reasoningMode
          );
        }
        if (
          typeof summary.reasoningTokens === "number" &&
          summary.reasoningTokens > 0
        ) {
          this.state.provider.reasoningTokens = summary.reasoningTokens;
        }
      }

      const refreshedSettings: ProviderSettings = { ...this.state.provider };
      this.state.llmClient = createLlmClient(refreshedSettings);
      this.state.provider = refreshedSettings;
      this.state.providerReady = Boolean(
        refreshedSettings.apiKey && refreshedSettings.apiKey.trim().length > 0
      );
      this.applyProviderEnv(refreshedSettings);

      reqLogger.info(
        { entries: historyEntries.length },
        "Imported history snapshot via admin console"
      );
      this.redirectWithMessage(res, "History snapshot imported", false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reqLogger.error({ err: error }, "Failed to import history snapshot");
      this.redirectWithMessage(res, `History import failed: ${message}`, true);
    }
  }

  private handleHistoryLatest(context: RequestContext): void {
    const { res } = context;
    const entries = this.getSortedHistoryEntries();
    const historyItems = entries.map((entry) => this.toAdminHistoryItem(entry));
    const sessionCount = new Set(entries.map((entry) => entry.sessionId)).size;
    const providerLabel = `${this.state.provider.provider} · ${this.state.provider.model}`;

    const payload = {
      historyHtml: renderHistory(historyItems),
      brief: this.state.brief ?? "",
      totalHistoryCount: entries.length,
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

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(payload));
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

  private applyProviderEnv(settings: ProviderSettings): void {
    if (settings.provider === "openai") {
      process.env.OPENAI_API_KEY = settings.apiKey;
    } else if (settings.provider === "gemini") {
      process.env.GEMINI_API_KEY = settings.apiKey;
    } else if (settings.provider === "anthropic") {
      process.env.ANTHROPIC_API_KEY = settings.apiKey;
    } else if (settings.provider === "grok") {
      process.env.XAI_API_KEY = settings.apiKey;
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
    const usageSummary = summarizeUsage(entry);
    const reasoningSummaries = entry.reasoning?.summaries
      ? [...entry.reasoning.summaries]
      : undefined;
    const reasoningDetails = entry.reasoning?.details
      ? [...entry.reasoning.details]
      : undefined;

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
      viewUrl: `${ADMIN_ROUTE_PREFIX}/history/${encodeURIComponent(
        entry.id
      )}/view`,
      downloadUrl: `${ADMIN_ROUTE_PREFIX}/history/${encodeURIComponent(
        entry.id
      )}/download`,
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

function parseOptionalPositiveInt(
  value: unknown,
  fallback?: number
): number | undefined {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(
      `Expected a non-negative integer, received: ${String(value)}`
    );
  }
  return Math.floor(parsed);
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
  return "openai";
}

function sanitizeReasoningMode(value: string): ReasoningMode {
  const normalized = value.toLowerCase();
  if (
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high"
  ) {
    return normalized;
  }
  return "none";
}
