import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import {
  ADMIN_ROUTE_PREFIX,
  AUTO_IGNORED_PATHS,
  BRIEF_FORM_ROUTE,
  INSTRUCTIONS_FIELD,
  INSTRUCTIONS_PANEL_ROUTE,
  SETUP_ROUTE,
  SETUP_VERIFY_ROUTE,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_GROK_MODEL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS,
  DEFAULT_REASONING_TOKENS,
  LLM_RESULT_ROUTE_PREFIX,
} from "../constants.js";
import {
  DEFAULT_MAX_TOKENS_BY_PROVIDER,
  PROVIDER_REASONING_CAPABILITIES,
} from "../constants/providers.js";
import type {
  BriefAttachment,
  ChatMessage,
  HistoryEntry,
  RuntimeConfig,
  ProviderSettings,
  ReasoningMode,
  ModelProvider,
} from "../types.js";
import type { LlmClient } from "../llm/client.js";
import { buildMessages } from "../llm/messages.js";
import { supportsImageInput } from "../llm/capabilities.js";
import { parseCookies } from "../utils/cookies.js";
import { readBody } from "../utils/body.js";
import { ensureHtmlDocument, escapeHtml } from "../utils/html.js";
import { SessionStore } from "./session-store.js";
import { renderSetupWizardPage } from "../pages/setup-wizard.js";
import {
  renderLoadingShell,
  renderResultHydrationScript,
  renderLoaderErrorScript,
} from "../pages/loading-shell.js";
import { getNavigationInterceptorScript } from "../utils/navigation-interceptor.js";
import { getInstructionsPanelScript } from "../utils/instructions-panel.js";
import { logger } from "../logger.js";
import { AdminController } from "./admin-controller.js";
import { verifyProviderApiKey } from "../llm/verification.js";
import { createLlmClient } from "../llm/factory.js";
import { getCredentialStore } from "../utils/credential-store.js";
import { processBriefAttachmentFiles } from "./brief-attachments.js";

type RequestLogger = Logger;

export interface ServerOptions {
  runtime: RuntimeConfig;
  provider: ProviderSettings;
  providerLocked: boolean;
  providerSelectionRequired: boolean;
  providersWithKeys: ModelProvider[];
  llmClient: LlmClient | null;
  sessionStore: SessionStore;
}

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  method: string;
  path: string;
}

export interface MutableServerState {
  brief: string | null;
  briefAttachments: BriefAttachment[];
  runtime: RuntimeConfig;
  provider: ProviderSettings;
  llmClient: LlmClient | null;
  providerReady: boolean;
  providerLocked: boolean;
  providerSelectionRequired: boolean;
  providersWithKeys: Set<ModelProvider>;
  verifiedProviders: Partial<Record<ModelProvider, boolean>>;
  pendingHtml: Map<string, PendingHtmlEntry>;
}

interface PendingHtmlEntry {
  html: string;
  expiresAt: number;
}

const PENDING_HTML_TTL_MS = 3 * 60 * 1000;

export function createServer(options: ServerOptions): http.Server {
  const {
    runtime,
    provider,
    providerLocked,
    providerSelectionRequired,
    providersWithKeys,
    llmClient,
    sessionStore,
  } = options;
  const runtimeState: RuntimeConfig = { ...runtime };
  const providerState: ProviderSettings = { ...provider };
  const state: MutableServerState = {
    brief: runtimeState.brief?.trim() || null,
    briefAttachments: [],
    runtime: runtimeState,
    provider: providerState,
    llmClient,
    providerReady: Boolean(
      llmClient &&
        providerState.apiKey &&
        providerState.apiKey.trim().length > 0
    ),
    providerLocked,
    providerSelectionRequired,
    providersWithKeys: new Set(providersWithKeys),
    verifiedProviders:
      providerState.apiKey && providerState.apiKey.trim().length > 0
        ? { [providerState.provider]: Boolean(llmClient) }
        : {},
    pendingHtml: new Map(),
  };
  const adminController = new AdminController({
    state,
    sessionStore,
  });

  return http.createServer(async (req, res) => {
    const requestStart = Date.now();
    const context = buildContext(req, res);
    const reqLogger = logger.child({
      method: context.method,
      path: context.path,
    });
    reqLogger.info(
      `Incoming request ${context.method} ${context.path} from ${
        req.socket.remoteAddress ?? "unknown"
      }`
    );

    if (shouldEarly404(context)) {
      reqLogger.warn(`Auto-ignored path ${context.url.href}`);
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
      return;
    }

    try {
      // Serve the interceptor client as a static asset to avoid inline parsing issues
      if (context.path === "/__serve-llm/interceptor.js") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.end(getNavigationInterceptorScript());
        reqLogger.info(
          `Served interceptor client in ${Date.now() - requestStart} ms`
        );
        return;
      }
      if (context.path === INSTRUCTIONS_PANEL_ROUTE) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.end(getInstructionsPanelScript());
        reqLogger.info(
          `Served instructions panel client in ${Date.now() - requestStart} ms`
        );
        return;
      }
      if (handlePendingHtmlRequest(context, state, reqLogger)) {
        reqLogger.info(
          `Pending render delivered with status ${res.statusCode} in ${
            Date.now() - requestStart
          } ms`
        );
        return;
      }

      if (
        !state.providerReady ||
        state.providerSelectionRequired ||
        !state.brief ||
        isSetupRequest(context.path)
      ) {
        await handleSetupFlow(context, state, reqLogger);
        reqLogger.info(
          `Setup flow completed with status ${res.statusCode} in ${
            Date.now() - requestStart
          } ms`
        );
        return;
      }

      if (context.path.startsWith(ADMIN_ROUTE_PREFIX)) {
        const handled = await adminController.handle(
          context,
          requestStart,
          reqLogger
        );
        if (handled) {
          reqLogger.info(
            `Admin route completed with status ${res.statusCode} in ${
              Date.now() - requestStart
            } ms`
          );
          return;
        }
      }

      await handleLlmRequest(
        context,
        state,
        sessionStore,
        reqLogger,
        requestStart
      );
      reqLogger.info(
        `Completed with status ${res.statusCode} in ${
          Date.now() - requestStart
        } ms`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);
      reqLogger.error(`Request handling failed: ${message}`);
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(renderErrorPage(error));
      reqLogger.warn(
        `Completed with error status ${res.statusCode} in ${
          Date.now() - requestStart
        } ms`
      );
    }
  });
}

function buildContext(
  req: IncomingMessage,
  res: ServerResponse
): RequestContext {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`
  );
  const method = (req.method ?? "GET").toUpperCase();
  return {
    req,
    res,
    url,
    method,
    path: url.pathname,
  };
}

function shouldEarly404(context: RequestContext): boolean {
  const { method, path } = context;
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }
  if (AUTO_IGNORED_PATHS.has(path)) {
    return true;
  }
  if (path.endsWith(".ico")) return true;
  if (path.endsWith(".png") && path.includes("apple-touch")) return true;
  if (path.endsWith(".webmanifest")) return true;
  return false;
}

function isSetupRequest(path: string): boolean {
  if (path.startsWith(SETUP_ROUTE)) {
    return true;
  }
  if (path === SETUP_VERIFY_ROUTE) {
    return true;
  }
  if (path === BRIEF_FORM_ROUTE) {
    return true;
  }
  return false;
}

async function handleSetupFlow(
  context: RequestContext,
  state: MutableServerState,
  reqLogger: RequestLogger
): Promise<void> {
  const { method, path, req, res, url } = context;
  let providerLabel = getProviderLabel(state.provider.provider);
  let providerName = providerLabel;
  const verifyAction = SETUP_VERIFY_ROUTE;
  const briefAction = BRIEF_FORM_ROUTE;
  const canSelectProvider = !state.providerLocked;
  let selectedProvider = state.provider.provider;

  if (method === "POST" && path === SETUP_VERIFY_ROUTE) {
    const body = await readBody(req);
    const apiKeyInput =
      typeof body.data.apiKey === "string" ? body.data.apiKey.trim() : "";
    let submittedModel =
      typeof body.data.model === "string" ? body.data.model.trim() : "";
    if (canSelectProvider) {
      const submittedProvider = parseProviderValue(body.data.provider);
      if (!submittedProvider) {
        const html = renderSetupWizardPage({
          step: "provider",
          providerLabel,
          providerName,
          verifyAction,
          briefAction,
          setupPath: SETUP_ROUTE,
          adminPath: ADMIN_ROUTE_PREFIX,
          providerReady: state.providerReady,
          canSelectProvider,
          selectedProvider,
          selectedModel: submittedModel || state.provider.model || "",
          providerSelectionRequired: state.providerSelectionRequired,
          providerKeyStatuses: buildProviderKeyStatuses(state),
          maxOutputTokens: state.provider.maxOutputTokens,
          reasoningMode: state.provider.reasoningMode ?? "none",
          reasoningTokensEnabled: state.provider.reasoningTokensEnabled !== false,
          reasoningTokens: getEffectiveReasoningTokens(state.provider),
          errorMessage: "Choose a provider before adding an API key.",
        });
        res.statusCode = 400;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
        return;
      }
      if (submittedProvider !== state.provider.provider) {
        await updateProviderSelection(state, submittedProvider, reqLogger);
        providerLabel = getProviderLabel(state.provider.provider);
        providerName = providerLabel;
        selectedProvider = state.provider.provider;
      } else {
        selectedProvider = submittedProvider;
      }
    }
    if (!submittedModel) {
      submittedModel = state.provider.model || "";
    }

    let submittedMaxTokens: number;
    try {
      submittedMaxTokens = parsePositiveInt(
        body.data.maxOutputTokens,
        state.provider.maxOutputTokens
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Max output tokens must be a positive integer.";
      const html = renderSetupWizardPage({
        step: "provider",
        providerLabel,
        providerName,
        verifyAction,
        briefAction,
        setupPath: SETUP_ROUTE,
        adminPath: ADMIN_ROUTE_PREFIX,
        providerReady: state.providerReady,
        canSelectProvider,
        selectedProvider,
        selectedModel: submittedModel,
        providerSelectionRequired: state.providerSelectionRequired,
        providerKeyStatuses: buildProviderKeyStatuses(state),
        maxOutputTokens: state.provider.maxOutputTokens,
        reasoningMode: state.provider.reasoningMode ?? "none",
        reasoningTokensEnabled: state.provider.reasoningTokensEnabled !== false,
        reasoningTokens: getEffectiveReasoningTokens(state.provider),
        errorMessage: message,
      });
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
      return;
    }

    const supportsMode = providerSupportsReasoningMode(state.provider.provider);
    const supportsTokens = providerSupportsReasoningTokens(
      state.provider.provider
    );

    let submittedReasoningMode: ReasoningMode = supportsMode
      ? sanitizeReasoningModeValue(
          body.data.reasoningMode,
          state.provider.reasoningMode ?? "none"
        )
      : "none";

    const toggleRaw =
      typeof body.data.reasoningTokensEnabled === "string"
        ? body.data.reasoningTokensEnabled.trim().toLowerCase()
        : "";
    const reasoningTokensEnabled =
      supportsTokens && !["", "off", "false", "0"].includes(toggleRaw);

    let submittedReasoningTokens: number | undefined;
    if (supportsTokens && reasoningTokensEnabled) {
      try {
        submittedReasoningTokens = parseReasoningTokensInput(
          body.data.reasoningTokens,
          state.provider.provider
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Reasoning tokens must be valid for the selected provider.";
        const html = renderSetupWizardPage({
          step: "provider",
          providerLabel,
          providerName,
          verifyAction,
          briefAction,
          setupPath: SETUP_ROUTE,
          adminPath: ADMIN_ROUTE_PREFIX,
          providerReady: state.providerReady,
          canSelectProvider,
          selectedProvider,
          selectedModel: submittedModel,
          providerSelectionRequired: state.providerSelectionRequired,
          providerKeyStatuses: buildProviderKeyStatuses(state),
          maxOutputTokens: state.provider.maxOutputTokens,
          reasoningMode: state.provider.reasoningMode ?? "none",
          reasoningTokensEnabled,
          reasoningTokens: getEffectiveReasoningTokens(state.provider),
          errorMessage: message,
        });
        res.statusCode = 400;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
        return;
      }
    }

    let adjustedReasoningTokens =
      supportsTokens && reasoningTokensEnabled
        ? submittedReasoningTokens
        : undefined;
    if (state.provider.provider === "anthropic") {
      if (typeof adjustedReasoningTokens === "number") {
        adjustedReasoningTokens = Math.min(
          adjustedReasoningTokens,
          DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS
        );
      } else {
        adjustedReasoningTokens = DEFAULT_REASONING_TOKENS.anthropic;
      }
    } else if (state.provider.provider === "gemini") {
      if (typeof adjustedReasoningTokens !== "number") {
        adjustedReasoningTokens = DEFAULT_REASONING_TOKENS.gemini;
      }
    }

    state.provider.maxOutputTokens = submittedMaxTokens;
    state.provider.reasoningMode = submittedReasoningMode;
    state.provider.reasoningTokens = adjustedReasoningTokens;
    state.provider.reasoningTokensEnabled = supportsTokens
      ? reasoningTokensEnabled
      : undefined;
    state.provider.model = submittedModel;

    // Try to get stored credential if no input provided
    const existingKey = state.provider.apiKey?.trim() ?? "";
    let finalApiKey = apiKeyInput || existingKey;
    const isUIEntry = Boolean(apiKeyInput); // Track if this came from UI input

    // If no key yet, try to load from secure storage
    if (!finalApiKey) {
      const stored = await getCredentialStore().getApiKey(
        state.provider.provider
      );
      if (stored) {
        finalApiKey = stored;
      }
    }
    if (!finalApiKey) {
      const html = renderSetupWizardPage({
        step: "provider",
        providerLabel,
        providerName,
        verifyAction,
        briefAction,
        setupPath: SETUP_ROUTE,
        adminPath: ADMIN_ROUTE_PREFIX,
        providerReady: state.providerReady,
        canSelectProvider,
        selectedProvider,
        selectedModel: state.provider.model || "",
        providerSelectionRequired: state.providerSelectionRequired,
      providerKeyStatuses: buildProviderKeyStatuses(state),
      maxOutputTokens: state.provider.maxOutputTokens,
      reasoningMode: state.provider.reasoningMode ?? "none",
      reasoningTokensEnabled: state.provider.reasoningTokensEnabled !== false,
      reasoningTokens: getEffectiveReasoningTokens(state.provider),
      errorMessage:
        "Add an API key or leave the field blank to reuse the stored key.",
    });
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
      return;
    }

    const reusingStoredKey =
      !apiKeyInput && state.providerReady && existingKey === finalApiKey;
    let verificationOk = false;
    let verificationMessage: string | undefined;
    if (reusingStoredKey) {
      verificationOk = true;
      reqLogger.debug(
        { provider: state.provider.provider },
        "Reusing previously verified API key"
      );
    } else {
      reqLogger.debug(
        { provider: state.provider.provider },
        "Setup wizard verifying API key"
      );
      const verification = await verifyProviderApiKey(
        state.provider.provider,
        finalApiKey
      );
      verificationOk = verification.ok;
      verificationMessage = verification.message;
    }

    if (verificationOk) {
      try {
        state.provider.apiKey = finalApiKey;
        applyProviderEnv(state.provider);

        // Store UI-entered credentials securely
        // Always save when user enters via UI, even if env vars exist (allows override)
        if (isUIEntry && finalApiKey) {
          reqLogger.debug(
            { provider: state.provider.provider },
            "Saving UI-entered API key to credential store"
          );
          await getCredentialStore()
            .saveApiKey(state.provider.provider, finalApiKey)
            .catch((err) => {
              reqLogger.error(
                { err },
                "Failed to save credential - will use memory storage"
              );
            });
        }

        if (
          !state.llmClient ||
          !reusingStoredKey ||
          state.llmClient.settings.provider !== state.provider.provider
        ) {
          state.llmClient = createLlmClient(state.provider);
        }
        state.providerReady = true;
        state.providerSelectionRequired = false;
        state.providersWithKeys.add(state.provider.provider);
        state.verifiedProviders[state.provider.provider] = true;
        reqLogger.info(
          { provider: state.provider.provider },
          reusingStoredKey
            ? "Using stored API key"
            : "API key verified via setup wizard"
        );
        res.statusCode = 303;
        const statusMessage = reusingStoredKey
          ? "Provider selected"
          : "API key verified";
        const redirectTarget = state.brief
          ? `${ADMIN_ROUTE_PREFIX}?status=Setup%20complete`
          : `${SETUP_ROUTE}?step=brief&status=${encodeURIComponent(
              statusMessage
            )}`;
        res.setHeader("Location", redirectTarget);
        res.end();
        return;
      } catch (error) {
        reqLogger.error(
          { err: error },
          "Failed to instantiate LLM client after verification"
        );
        state.providerReady = false;
        state.llmClient = null;
        state.verifiedProviders[state.provider.provider] = false;
        const message = error instanceof Error ? error.message : String(error);
        const html = renderSetupWizardPage({
          step: "provider",
          providerLabel,
          providerName,
          verifyAction,
          briefAction,
          setupPath: SETUP_ROUTE,
          adminPath: ADMIN_ROUTE_PREFIX,
          providerReady: false,
          canSelectProvider,
          selectedProvider,
          selectedModel: state.provider.model || "",
          providerSelectionRequired: state.providerSelectionRequired,
          providerKeyStatuses: buildProviderKeyStatuses(state),
          maxOutputTokens: state.provider.maxOutputTokens,
          reasoningMode: state.provider.reasoningMode ?? "none",
          reasoningTokensEnabled: state.provider.reasoningTokensEnabled !== false,
          reasoningTokens: getEffectiveReasoningTokens(state.provider),
          errorMessage: `Unable to configure provider: ${message}`,
        });
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
        return;
      }
    }

    reqLogger.warn(
      { provider: state.provider.provider },
      `API key verification failed: ${verificationMessage ?? "unknown error"}`
    );
    state.providerReady = false;
    state.llmClient = null;
    state.providerSelectionRequired = true;
    state.verifiedProviders[state.provider.provider] = false;
    const html = renderSetupWizardPage({
      step: "provider",
      providerLabel,
      providerName,
      verifyAction,
      briefAction,
      setupPath: SETUP_ROUTE,
      adminPath: ADMIN_ROUTE_PREFIX,
      providerReady: state.providerReady,
      canSelectProvider,
      selectedProvider,
    selectedModel: state.provider.model || "",
    providerSelectionRequired: state.providerSelectionRequired,
    providerKeyStatuses: buildProviderKeyStatuses(state),
    maxOutputTokens: state.provider.maxOutputTokens,
    reasoningMode: state.provider.reasoningMode ?? "none",
    reasoningTokensEnabled: state.provider.reasoningTokensEnabled !== false,
    reasoningTokens: getEffectiveReasoningTokens(state.provider),
    errorMessage:
      verificationMessage ??
      "We could not verify that key. Please try again.",
  });
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
    return;
  }

  if (method === "POST" && path === BRIEF_FORM_ROUTE) {
    const body = await readBody(req);
    const briefValue =
      typeof body.data.brief === "string" ? body.data.brief.trim() : "";
    reqLogger.debug(formatJsonForLog(body.data, "Brief submission"));
    if (!state.providerReady || state.providerSelectionRequired) {
      res.statusCode = 303;
      res.setHeader("Location", `${SETUP_ROUTE}?step=provider`);
      res.end();
      return;
    }
    if (!briefValue) {
      const html = renderSetupWizardPage({
        step: "brief",
        providerLabel,
        providerName,
        verifyAction,
        briefAction,
        setupPath: SETUP_ROUTE,
        adminPath: ADMIN_ROUTE_PREFIX,
        providerReady: state.providerReady,
        canSelectProvider,
        selectedProvider,
        selectedModel: state.provider.model || "",
        providerSelectionRequired: state.providerSelectionRequired,
      providerKeyStatuses: buildProviderKeyStatuses(state),
      maxOutputTokens: state.provider.maxOutputTokens,
      reasoningMode: state.provider.reasoningMode ?? "none",
      reasoningTokensEnabled: state.provider.reasoningTokensEnabled !== false,
      reasoningTokens: getEffectiveReasoningTokens(state.provider),
      errorMessage: "Add a short brief so we know where to begin.",
      briefValue: "",
    });
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
      reqLogger.warn(
        { status: res.statusCode },
        "Rejected brief submission due to empty brief"
      );
      return;
    }
    state.brief = briefValue;
    state.runtime.brief = briefValue;

    const fileInputs = (body.files ?? []).filter(
      (file) =>
        file.fieldName === "briefAttachments" &&
        typeof file.filename === "string" &&
        file.filename.trim().length > 0 &&
        file.size > 0,
    );
    const processed = processBriefAttachmentFiles(fileInputs);
    for (const rejected of processed.rejected) {
      reqLogger.warn(
        { file: rejected.filename, mimeType: rejected.mimeType },
        "Rejected unsupported brief attachment during setup",
      );
    }
    if (processed.accepted.length > 0) {
      state.briefAttachments = [
        ...(state.briefAttachments ?? []),
        ...processed.accepted,
      ];
    }

    reqLogger.info(
      {
        hasBrief: Boolean(state.brief),
        attachments: state.briefAttachments.length,
        addedAttachments: processed.accepted.length,
      },
      "Stored new application brief from prompt page",
    );
    const adminUrl = escapeHtml(ADMIN_ROUTE_PREFIX);
    const appUrl = escapeHtml("/");
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Redirecting…</title>
  <style>
    :root {
      color-scheme: light;
      font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f6f8fb;
      color: #0f172a;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 48px 24px;
    }
    main {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 32px;
      max-width: 420px;
      box-shadow: 0 24px 48px rgba(15, 23, 42, 0.12);
      text-align: center;
    }
    h1 {
      margin: 0 0 16px;
      font-size: 1.4rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    p {
      margin: 12px 0 0;
      line-height: 1.6;
      color: #475569;
    }
    .actions {
      margin-top: 24px;
      display: grid;
      gap: 12px;
    }
    a {
      color: #1d4ed8;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .primary {
      display: inline-block;
      padding: 10px 18px;
      border-radius: 12px;
      background: linear-gradient(135deg, #1d4ed8, #1e3a8a);
      color: #f8fafc;
      font-weight: 600;
      box-shadow: 0 16px 28px rgba(29, 78, 216, 0.18);
    }
    .secondary {
      display: inline-block;
      padding: 10px 18px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #1d4ed8;
      font-weight: 600;
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
    }
    .secondary:hover {
      background: #eff6ff;
    }
  </style>
</head>
<body>
  <main>
    <h1>Studio is ready</h1>
    <p>Your brief is live. Open the live canvas to see it in action, or head to the admin console to tune the experience.</p>
    <p>The canvas opens in a new tab so you can keep this page handy for controls.</p>
    <div class="actions">
      <a class="primary" href="${appUrl}" target="_blank" rel="noopener">Open the live canvas</a>
      <a class="secondary" href="${adminUrl}">Go to admin console</a>
    </div>
    <p>You can return to the console at any time via <a href="${adminUrl}">${adminUrl}</a>. Consider bookmarking it for later tweaks.</p>
  </main>
</body>
</html>`;
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
    return;
  }

  if (
    state.providerReady &&
    !state.providerSelectionRequired &&
    state.brief &&
    path.startsWith(SETUP_ROUTE)
  ) {
    res.statusCode = 303;
    res.setHeader("Location", ADMIN_ROUTE_PREFIX);
    res.end();
    return;
  }

  const requestedStep = url.searchParams.get("step");
  let step: "provider" | "brief";
  if (!state.providerReady || state.providerSelectionRequired) {
    step = "provider";
  } else if (!state.brief) {
    step = requestedStep === "provider" ? "provider" : "brief";
  } else {
    step = requestedStep === "provider" ? "provider" : "brief";
  }

  if (
    state.providerReady &&
    !state.providerSelectionRequired &&
    state.brief &&
    !requestedStep &&
    path === SETUP_ROUTE
  ) {
    res.statusCode = 303;
    res.setHeader("Location", ADMIN_ROUTE_PREFIX);
    res.end();
    return;
  }

  const html = renderSetupWizardPage({
    step,
    providerLabel,
    providerName,
    verifyAction,
    briefAction,
    setupPath: SETUP_ROUTE,
    adminPath: ADMIN_ROUTE_PREFIX,
    providerReady: state.providerReady,
    canSelectProvider,
    selectedProvider,
    selectedModel: state.provider.model || "",
    providerSelectionRequired: state.providerSelectionRequired,
    providerKeyStatuses: buildProviderKeyStatuses(state),
    maxOutputTokens: state.provider.maxOutputTokens,
    reasoningMode: state.provider.reasoningMode ?? "none",
    reasoningTokensEnabled: state.provider.reasoningTokensEnabled !== false,
    reasoningTokens: getEffectiveReasoningTokens(state.provider),
    statusMessage: url.searchParams.get("status") ?? undefined,
  });
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
  reqLogger.debug({ step }, "Served setup wizard page");
}

function cleanupPendingHtml(state: MutableServerState): void {
  const now = Date.now();
  for (const [token, entry] of state.pendingHtml.entries()) {
    if (entry.expiresAt <= now) {
      state.pendingHtml.delete(token);
    }
  }
}

async function handleLlmRequest(
  context: RequestContext,
  state: MutableServerState,
  sessionStore: SessionStore,
  reqLogger: RequestLogger,
  requestStart: number
): Promise<void> {
  const { req, res, url, method, path } = context;
  const llmClient = state.llmClient;
  if (!llmClient) {
    throw new Error("LLM client not configured");
  }
  const originalPath = `${url.pathname}${url.search}`;

  const cookies = parseCookies(req.headers.cookie);
  const sid = sessionStore.getOrCreateSessionId(cookies, res);

  const rawQueryEntries = Array.from(url.searchParams.entries());
  const isInterceptorQuery = rawQueryEntries.some(
    ([key, value]) => key === "__serve-llm" && value === "interceptor"
  );
  const query = Object.fromEntries(
    rawQueryEntries.filter(([key]) => key !== "__serve-llm")
  );
  if (Object.keys(query).length > 0) {
    reqLogger.debug(formatJsonForLog(query, "Query parameters"));
  }

  let bodyData: Record<string, unknown> = {};
  let isInterceptorBody = false;
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const parsed = await readBody(req);
    bodyData = parsed.data ?? {};
    const interceptorMarker = bodyData["__serve-llm"];
    const hasInterceptorMarker =
      interceptorMarker === "interceptor" ||
      (Array.isArray(interceptorMarker) &&
        interceptorMarker.includes("interceptor"));
    if (hasInterceptorMarker) {
      isInterceptorBody = true;
      delete bodyData["__serve-llm"];
    }
    if (parsed.raw) {
      reqLogger.debug(formatJsonForLog(bodyData, "Request body"));
    }
  }

  const fullHistory = sessionStore.getHistory(sid);
  const historyLimit = Math.max(1, state.runtime.historyLimit);
  const limitedHistory =
    historyLimit >= fullHistory.length
      ? fullHistory
      : fullHistory.slice(-historyLimit);
  const limitOmitted = fullHistory.length - limitedHistory.length;
  const selection = selectHistoryForPrompt(
    limitedHistory,
    state.runtime.historyMaxBytes
  );
  const historyForPrompt = selection.entries;
  const byteOmitted = limitedHistory.length - historyForPrompt.length;
  const prevHtml =
    historyForPrompt.at(-1)?.response.html ??
    limitedHistory.at(-1)?.response.html ??
    sessionStore.getPrevHtml(sid);

  reqLogger.debug(
    {
      historyTotal: fullHistory.length,
      historyLimit,
      historyIncluded: historyForPrompt.length,
      historyBytesUsed: selection.bytes,
      historyLimitOmitted: limitOmitted,
      historyByteOmitted: byteOmitted,
      historyMaxBytes: state.runtime.historyMaxBytes,
    },
    "History context prepared"
  );

  const totalBriefAttachments = state.briefAttachments ?? [];
  const includeAttachments = supportsImageInput(
    llmClient.settings.provider,
    llmClient.settings.model,
  );
  const promptAttachments = includeAttachments
    ? totalBriefAttachments.map((attachment) => ({ ...attachment }))
    : [];
  const omittedAttachmentCount = includeAttachments
    ? 0
    : totalBriefAttachments.length;

  const messages = buildMessages({
    brief: state.brief ?? "",
    briefAttachments: promptAttachments,
    omittedAttachmentCount,
    method,
    path,
    query,
    body: bodyData,
    prevHtml,
    timestamp: new Date(),
    includeInstructionPanel: state.runtime.includeInstructionPanel,
    history: historyForPrompt,
    historyTotal: fullHistory.length,
    historyLimit,
    historyMaxBytes: state.runtime.historyMaxBytes,
    historyBytesUsed: selection.bytes,
    historyLimitOmitted: limitOmitted,
    historyByteOmitted: byteOmitted,
    adminPath: ADMIN_ROUTE_PREFIX,
  });
  reqLogger.debug(`LLM prompt:\n${formatMessagesForLog(messages)}`);

  const interceptorHeader = req.headers["x-serve-llm-request"];
  const isInterceptorHeader = Array.isArray(interceptorHeader)
    ? interceptorHeader.includes("interceptor")
    : interceptorHeader === "interceptor";
  const isInterceptorRequest =
    isInterceptorHeader || isInterceptorQuery || isInterceptorBody;
  const shouldStreamBody = method !== "HEAD" && !isInterceptorRequest;
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (shouldStreamBody) {
    const providerLabel = getProviderLabel(llmClient.settings.provider);
    const loadingMessage = `Asking ${providerLabel} (${llmClient.settings.model}) to refresh this page.`;
    res.write(
      renderLoadingShell({
        message: loadingMessage,
        originalPath,
        resultRoutePrefix: LLM_RESULT_ROUTE_PREFIX,
      })
    );
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }
  }

  try {
    const result = await llmClient.generateHtml(messages);
    const durationMs = Date.now() - requestStart;
    reqLogger.debug(
      `LLM response preview [${llmClient.settings.provider}]:\n${truncate(
        result.html,
        500
      )}`
    );
    const rawHtml = ensureHtmlDocument(result.html, { method, path });

    // Inject navigation interceptor script before </body> to enable smooth client-side navigation
    let safeHtml = rawHtml.replace(
      /(<\/body\s*>)/i,
      `<script id="serve-llm-interceptor-script" src="/__serve-llm/interceptor.js"></script>$1`
    );

    if (state.runtime.includeInstructionPanel) {
      const instructionsScriptTag = `<script id="serve-llm-instructions-panel-script" src="${INSTRUCTIONS_PANEL_ROUTE}"></script>`;
      if (/<\/body\s*>/i.test(safeHtml)) {
        safeHtml = safeHtml.replace(
          /(<\/body\s*>)/i,
          `${instructionsScriptTag}$1`
        );
      } else {
        safeHtml = `${safeHtml}${instructionsScriptTag}`;
      }
    }

    sessionStore.setPrevHtml(sid, safeHtml);

    const instructions = extractInstructions(bodyData);
    const historyEntry: HistoryEntry = {
      id: randomUUID(),
      sessionId: sid,
      createdAt: new Date().toISOString(),
      durationMs,
      brief: state.brief ?? "",
      briefAttachments: totalBriefAttachments.map((attachment) => ({
        ...attachment,
      })),
      request: {
        method,
        path,
        query,
        body: bodyData,
        instructions,
      },
      response: { html: safeHtml },
      llm: {
        provider: llmClient.settings.provider,
        model: llmClient.settings.model,
        maxOutputTokens: llmClient.settings.maxOutputTokens,
        reasoningMode: llmClient.settings.reasoningMode,
        reasoningTokens: llmClient.settings.reasoningTokens,
      },
      usage: result.usage,
      reasoning: result.reasoning,
    };

    sessionStore.appendHistoryEntry(sid, historyEntry);

    if (isInterceptorRequest) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(safeHtml);
      return;
    }

    cleanupPendingHtml(state);
    const token = randomUUID();
    state.pendingHtml.set(token, {
      html: safeHtml,
      expiresAt: Date.now() + PENDING_HTML_TTL_MS,
    });
    const pendingPath = `${LLM_RESULT_ROUTE_PREFIX}/${token}`;

    if (shouldStreamBody) {
      res.write(renderResultHydrationScript(token, originalPath));
    } else {
      // For HEAD requests we expose the target via header so clients can follow-up with GET.
      res.setHeader("Link", `<${pendingPath}>; rel="render"`);
    }
    res.end();
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    reqLogger.error(`LLM generation failed: ${message}`);
    if (isInterceptorRequest && !res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(renderErrorPage(error));
      return;
    }
    if (shouldStreamBody) {
      res.write(
        renderLoaderErrorScript(
          "The model response took too long or failed. Please retry in a moment."
        )
      );
    } else if (!res.headersSent) {
      res.statusCode = 500;
    }
    res.end();
  }
}

function renderErrorPage(error: unknown): string {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ""}`
      : String(error);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>500 - Server Error</title>
<style>
  body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; }
  main { max-width: 840px; margin: 10vh auto; padding: 32px; background: rgba(15, 23, 42, 0.7); border-radius: 18px; box-shadow: 0 24px 40px rgba(15, 23, 42, 0.45); backdrop-filter: blur(10px); }
  h1 { margin-top: 0; font-size: 1.8rem; }
  pre { background: rgba(8, 47, 73, 0.65); padding: 16px 20px; border-radius: 12px; line-height: 1.45; overflow-x: auto; }
  a { color: #38bdf8; }
</style>
</head>
<body>
  <main>
    <h1>Something went wrong</h1>
    <p>The server failed while generating the latest view. You can retry the last action or reload from the home page.</p>
    <pre>${escapeHtml(message)}</pre>
    <form method="get" action="/">
      <button type="submit">Back to safety</button>
    </form>
  </main>
</body>
</html>`;
}

function extractInstructions(
  body: Record<string, unknown>
): string | undefined {
  const value = body?.[INSTRUCTIONS_FIELD];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    const first = value.find(
      (item) => typeof item === "string" && item.trim().length > 0
    );
    return typeof first === "string" ? first.trim() : undefined;
  }
  return undefined;
}

function applyProviderEnv(settings: ProviderSettings): void {
  const key = settings.apiKey?.trim();
  if (!key) {
    return;
  }
  if (settings.provider === "openai") {
    process.env.OPENAI_API_KEY = key;
    return;
  }
  if (settings.provider === "gemini") {
    process.env.GEMINI_API_KEY = key;
    return;
  }
  if (settings.provider === "grok") {
    process.env.XAI_API_KEY = key;
    return;
  }
  if (settings.provider === "groq") {
    process.env.GROQ_API_KEY = key;
    return;
  }
  process.env.ANTHROPIC_API_KEY = key;
}

function getEnvApiKeyForProvider(provider: ModelProvider): string | undefined {
  if (provider === "openai") {
    return (
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_APIKEY ||
      process.env.OPENAI_KEY ||
      undefined
    );
  }
  if (provider === "gemini") {
    return (
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENAI_KEY ||
      undefined
    );
  }
  if (provider === "grok") {
    return (
      process.env.XAI_API_KEY ||
      process.env.GROK_API_KEY ||
      process.env.XAI_KEY ||
      undefined
    );
  }
  if (provider === "groq") {
    return process.env.GROQ_API_KEY || process.env.GROQ_KEY || undefined;
  }
  return (
    process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY || undefined
  );
}

function getProviderLabel(provider: ProviderSettings["provider"]): string {
  if (provider === "openai") {
    return "OpenAI";
  }
  if (provider === "gemini") {
    return "Gemini";
  }
  if (provider === "grok") {
    return "xAI (Grok)";
  }
  if (provider === "groq") {
    return "Groq";
  }
  return "Anthropic";
}

function providerSupportsReasoningMode(
  provider: ProviderSettings["provider"]
): boolean {
  return Boolean(PROVIDER_REASONING_CAPABILITIES[provider]?.mode);
}

function providerSupportsReasoningTokens(
  provider: ProviderSettings["provider"]
): boolean {
  return Boolean(PROVIDER_REASONING_CAPABILITIES[provider]?.tokens);
}

async function updateProviderSelection(
  state: MutableServerState,
  provider: ProviderSettings["provider"],
  reqLogger: RequestLogger
): Promise<void> {
  if (state.provider.provider === provider) {
    return;
  }
  const previous = state.provider.provider;
  state.verifiedProviders[previous] =
    state.providerReady && Boolean(state.provider.apiKey?.trim());
  let reasoningMode: ReasoningMode = "none";
  let reasoningTokens: number | undefined;

  if (provider === "openai") {
    reasoningMode =
      state.provider.provider === "openai"
        ? state.provider.reasoningMode ?? "low"
        : "low";
  } else if (provider === "anthropic") {
    reasoningMode = "none";
    if (
      state.provider.provider === "anthropic" &&
      typeof state.provider.reasoningTokens === "number"
    ) {
      reasoningTokens = Math.min(
        state.provider.reasoningTokens,
        DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS
      );
    } else {
      reasoningTokens = DEFAULT_REASONING_TOKENS.anthropic;
    }
  } else if (provider === "gemini") {
    if (
      state.provider.provider === "gemini" &&
      typeof state.provider.reasoningTokens === "number"
    ) {
      reasoningTokens = state.provider.reasoningTokens;
    } else {
      reasoningTokens = DEFAULT_REASONING_TOKENS.gemini;
    }
  } else if (provider === "grok") {
    reasoningMode = "none";
  } else if (provider === "groq") {
    reasoningMode = "none";
  }

  const envKey = getEnvApiKeyForProvider(provider)?.trim() ?? "";

  // Try to get stored credential if no env key
  let providerKey = envKey;
  if (!providerKey) {
    try {
      const stored = await getCredentialStore().getApiKey(provider);
      if (stored) {
        providerKey = stored;
      }
    } catch {
      // Ignore credential retrieval errors
    }
  }

  const verified =
    Boolean(state.verifiedProviders[provider]) && providerKey.length > 0;

  state.provider = {
    provider,
    apiKey: providerKey,
    model: getDefaultModelForProvider(provider),
    maxOutputTokens: getDefaultMaxTokensForProvider(provider),
    reasoningMode,
    reasoningTokens,
  };
  if (providerKey) {
    state.providersWithKeys.add(provider);
  } else {
    state.providersWithKeys.delete(provider);
  }
  state.providerReady = verified;
  state.verifiedProviders[provider] = verified;
  state.providerSelectionRequired = true;
  state.llmClient = null;
  reqLogger.info(
    { from: previous, to: provider },
    "Wizard switched provider selection"
  );
}

function getDefaultModelForProvider(
  provider: ProviderSettings["provider"]
): string {
  if (provider === "openai") {
    return DEFAULT_OPENAI_MODEL;
  }
  if (provider === "gemini") {
    return DEFAULT_GEMINI_MODEL;
  }
  if (provider === "grok") {
    return DEFAULT_GROK_MODEL;
  }
  if (provider === "groq") {
    return DEFAULT_GROQ_MODEL;
  }
  return DEFAULT_ANTHROPIC_MODEL;
}

function getDefaultMaxTokensForProvider(
  provider: ProviderSettings["provider"]
): number {
  const mappedDefault = DEFAULT_MAX_TOKENS_BY_PROVIDER[provider as ModelProvider];
  if (typeof mappedDefault === "number") {
    return mappedDefault;
  }
  if (provider === "anthropic") {
    return DEFAULT_ANTHROPIC_MAX_OUTPUT_TOKENS;
  }
  return DEFAULT_MAX_OUTPUT_TOKENS;
}

function getEffectiveReasoningTokens(
  provider: ProviderSettings
): number | undefined {
  const tokensEnabled = provider.reasoningTokensEnabled ?? true;
  if (!tokensEnabled) {
    return undefined;
  }
  const tokens = provider.reasoningTokens;
  if (typeof tokens === "number") {
    return tokens;
  }
  if (!tokensEnabled) {
    return undefined;
  }
  return DEFAULT_REASONING_TOKENS[provider.provider];
}

function buildProviderKeyStatuses(
  state: MutableServerState
): Record<ModelProvider, { hasKey: boolean; verified: boolean }> {
  const providers: ModelProvider[] = [
    "openai",
    "gemini",
    "anthropic",
    "grok",
    "groq",
  ];
  return providers.reduce<
    Record<ModelProvider, { hasKey: boolean; verified: boolean }>
  >(
    (acc, provider) => {
      const isCurrent = state.provider.provider === provider;
      const hasKeyInState = isCurrent
        ? Boolean(state.provider.apiKey?.trim())
        : state.providersWithKeys.has(provider);
      const hasKey = hasKeyInState;
      const verifiedFlag = Boolean(state.verifiedProviders[provider]);
      const verified =
        hasKey &&
        (isCurrent ? state.providerReady && verifiedFlag : verifiedFlag);
      acc[provider] = { hasKey, verified };
      return acc;
    },
    {
      openai: { hasKey: false, verified: false },
      gemini: { hasKey: false, verified: false },
      anthropic: { hasKey: false, verified: false },
      grok: { hasKey: false, verified: false },
      groq: { hasKey: false, verified: false },
    }
  );
}

function parseProviderValue(
  value: unknown
): ProviderSettings["provider"] | undefined {
  if (!value || typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "openai") return "openai";
  if (normalized === "gemini") return "gemini";
  if (normalized === "anthropic") return "anthropic";
  if (normalized === "grok" || normalized === "xai" || normalized === "x.ai")
    return "grok";
  if (normalized === "groq") return "groq";
  return undefined;
}

function sanitizeReasoningModeValue(
  value: unknown,
  fallback: ReasoningMode
): ReasoningMode {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "low" ||
      normalized === "medium" ||
      normalized === "high"
    ) {
      return normalized;
    }
    if (normalized === "none") {
      return "none";
    }
  }
  return fallback;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${String(value)}`);
  }
  return Math.floor(parsed);
}

function parseOptionalPositiveInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(
      `Expected a non-negative integer, received: ${String(value)}`
    );
  }
  return Math.floor(parsed);
}

function parseReasoningTokensInput(
  value: unknown,
  provider: ProviderSettings["provider"]
): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a numeric value, received: ${String(value)}`);
  }
  const rounded = Math.floor(parsed);
  if (provider === "gemini") {
    if (rounded < -1) {
      throw new Error(
        "Reasoning tokens must be -1 (dynamic) or a non-negative integer."
      );
    }
    return rounded;
  }
  if (rounded < 0) {
    throw new Error("Reasoning tokens must be zero or a positive integer.");
  }
  return rounded;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
}

function formatMessagesForLog(messages: ChatMessage[]): string {
  return messages
    .map((message) => {
      const preview = truncate(message.content, 1_000);
      let attachmentNote = "";
      if (message.attachments?.length) {
        const names = message.attachments
          .map((attachment) => `${attachment.name} (${attachment.mimeType})`)
          .join(", ");
        attachmentNote = `\n[ATTACHMENTS: ${names}]`;
      }
      return `[${message.role.toUpperCase()}]\n${preview}${attachmentNote}`;
    })
    .join("\n\n");
}

function formatJsonForLog(payload: unknown, label?: string): string {
  const prefix = label ? `${label}:\n` : "";
  try {
    return `${prefix}${JSON.stringify(payload, null, 2)}`;
  } catch {
    return `${prefix}${String(payload)}`;
  }
}

function selectHistoryForPrompt(
  history: HistoryEntry[],
  maxBytes: number
): { entries: HistoryEntry[]; bytes: number } {
  if (history.length === 0) {
    return { entries: [], bytes: 0 };
  }
  const budget = maxBytes > 0 ? maxBytes : Number.POSITIVE_INFINITY;
  const reversed: HistoryEntry[] = [];
  let bytes = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    const size = estimateHistoryEntrySize(entry);
    if (reversed.length > 0 && bytes + size > budget) {
      break;
    }
    reversed.push(entry);
    bytes += size;
  }
  const entries = reversed.reverse();
  return { entries, bytes };
}

function estimateHistoryEntrySize(entry: HistoryEntry): number {
  const fragments: string[] = [
    entry.brief ?? "",
    entry.request.method,
    entry.request.path,
    JSON.stringify(entry.request.query ?? {}, null, 2),
    JSON.stringify(entry.request.body ?? {}, null, 2),
    entry.request.instructions ?? "",
    entry.response.html ?? "",
  ];
  if (entry.usage) {
    fragments.push(JSON.stringify(entry.usage, null, 2));
  }
  if (entry.briefAttachments?.length) {
    for (const attachment of entry.briefAttachments) {
      fragments.push(attachment.base64);
      fragments.push(attachment.name);
      fragments.push(attachment.mimeType);
    }
  }
  if (entry.reasoning?.summaries?.length) {
    fragments.push(entry.reasoning.summaries.join("\n"));
  }
  if (entry.reasoning?.details?.length) {
    fragments.push(entry.reasoning.details.join("\n"));
  }
  let bytes = 0;
  for (const fragment of fragments) {
    bytes += Buffer.byteLength(fragment, "utf8");
  }
  // Add a cushion for labels and formatting noise in prompts.
  return bytes + 1024;
}
function handlePendingHtmlRequest(
  context: RequestContext,
  state: MutableServerState,
  reqLogger: RequestLogger
): boolean {
  const { path, method, res } = context;
  if (!path.startsWith(LLM_RESULT_ROUTE_PREFIX)) {
    return false;
  }

  cleanupPendingHtml(state);

  if (method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Allow", "GET");
    res.end("Method Not Allowed");
    return true;
  }

  const token = path.slice(LLM_RESULT_ROUTE_PREFIX.length).replace(/^\/+/, "");
  if (!token) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return true;
  }

  const entry = state.pendingHtml.get(token);
  if (!entry) {
    reqLogger.warn({ token }, "No pending HTML found for token");
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return true;
  }

  state.pendingHtml.delete(token);
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.end(entry.html);
  return true;
}
