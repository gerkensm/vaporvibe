import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AttachmentUploader,
  ModelSelector,
  TokenBudgetControl,
} from "../components";
import HistoryExplorer from "../components/HistoryExplorer";
import {
  fetchAdminState,
  fetchAdminHistory,
  submitBriefUpdate,
  submitProviderUpdate,
  submitRuntimeUpdate,
  type ProviderUpdatePayload,
} from "../api/admin";
import type {
  AdminBriefAttachment,
  AdminHistoryItem,
  AdminStateResponse,
} from "../api/types";

import "./AdminDashboard.css";
import {
  HISTORY_LIMIT_MIN,
  HISTORY_LIMIT_MAX,
  HISTORY_MAX_BYTES_MIN,
  HISTORY_MAX_BYTES_MAX,
} from "../constants/runtime";

type AsyncStatus = "idle" | "loading" | "success" | "error";
type StatusMessage = { tone: "info" | "error"; message: string };
type NullableStatus = StatusMessage | null;

type PendingPreview = { name: string; size: number };

const HISTORY_PAGE_SIZE = 20;
const HISTORY_REFRESH_INTERVAL_MS = 8000;
const HISTORY_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  timeStyle: "medium",
});

type ProviderKey = keyof AdminStateResponse["providerKeyStatuses"];

const PROVIDER_SORT_ORDER: ProviderKey[] = [
  "openai",
  "gemini",
  "anthropic",
  "grok",
  "groq",
];

const TAB_ORDER = [
  "brief",
  "provider",
  "runtime",
  "import",
  "export",
  "history",
] as const;

type TabKey = (typeof TAB_ORDER)[number];

const TAB_LABELS: Record<TabKey, string> = {
  brief: "Brief",
  provider: "Provider",
  runtime: "Runtime",
  import: "Import",
  export: "Exports",
  history: "History",
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function AdminDashboard() {
  const [state, setState] = useState<AdminStateResponse | null>(null);
  const [briefDraft, setBriefDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [attachmentsToRemove, setAttachmentsToRemove] = useState<Set<string>>(
    () => new Set()
  );
  const [uploaderKey, setUploaderKey] = useState(0);
  const [status, setStatus] = useState<NullableStatus>(null);
  const [providerStatus, setProviderStatus] = useState<NullableStatus>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<NullableStatus>(null);
  const [providerSaving, setProviderSaving] = useState<AsyncStatus>("idle");
  const [runtimeSaving, setRuntimeSaving] = useState<AsyncStatus>("idle");
  const [loadState, setLoadState] = useState<AsyncStatus>("idle");
  const [submitState, setSubmitState] = useState<AsyncStatus>("idle");
  const [historyItems, setHistoryItems] = useState<AdminHistoryItem[]>([]);
  const [historyTotalCount, setHistoryTotalCount] = useState<number>(0);
  const [historySessionCount, setHistorySessionCount] = useState<number>(0);
  const [historyNextOffset, setHistoryNextOffset] = useState<number | null>(
    null
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyStatusMessage, setHistoryStatusMessage] = useState<
    string | null
  >(null);
  const [activeTab, setActiveTab] = useState<TabKey>("brief");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [historyLastRefreshMs, setHistoryLastRefreshMs] = useState<
    number | null
  >(null);
  const [setupStep, setSetupStep] = useState<"provider" | "brief">("provider");
  const [showLaunchPad, setShowLaunchPad] = useState(false);

  const needsProviderSetup = state
    ? !state.providerReady || state.providerSelectionRequired
    : false;
  const needsBriefSetup = state ? !needsProviderSetup && !state.brief : false;
  const showSetupShell = needsProviderSetup || needsBriefSetup;
  const attachments = state?.attachments ?? [];

  const previousShowSetupShellRef = useRef(showSetupShell);
  const launchPadRef = useRef<HTMLDivElement | null>(null);

  const handleStateUpdate = useCallback((snapshot: AdminStateResponse) => {
    setState(snapshot);
    setHistoryTotalCount(snapshot.totalHistoryCount);
    setHistorySessionCount(snapshot.sessionCount);
  }, []);

  const loadHistory = useCallback(
    async (
      options: {
        offset?: number;
        limit?: number;
        append?: boolean;
        showMessage?: boolean;
      } = {}
    ) => {
      const {
        offset = 0,
        limit = HISTORY_PAGE_SIZE,
        append = false,
        showMessage = false,
      } = options;

      if (append) {
        setHistoryLoadingMore(true);
      } else {
        setHistoryLoading(true);
        setHistoryStatusMessage(null);
      }

      try {
        const payload = await fetchAdminHistory({ offset, limit });
        if (append) {
          setHistoryItems((prev) => [...prev, ...payload.items]);
        } else {
          setHistoryItems(payload.items);
        }
        setHistoryTotalCount(payload.totalCount);
        setHistorySessionCount(payload.sessionCount);
        setHistoryNextOffset(payload.pagination.nextOffset);
        setHistoryLastRefreshMs(Date.now());
        if (showMessage) {
          setHistoryStatusMessage(append ? null : "History refreshed");
        } else if (!append) {
          setHistoryStatusMessage(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setHistoryStatusMessage(message);
      } finally {
        if (append) {
          setHistoryLoadingMore(false);
        } else {
          setHistoryLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      setLoadState("loading");
      try {
        const snapshot = await fetchAdminState();
        if (!isMounted) return;
        handleStateUpdate(snapshot);
        setBriefDraft(snapshot.brief ?? "");
        setAttachmentsToRemove(new Set());
        setStatus(null);
        setLoadState("success");
      } catch (error) {
        if (!isMounted) return;
        setLoadState("error");
        setStatus({
          tone: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [handleStateUpdate, showLaunchPad]);

  useEffect(() => {
    if (!state) return;
    if (!showLaunchPad) return;
    if (!state.providerReady || !state.brief) {
      setShowLaunchPad(false);
    }
  }, [state, showLaunchPad]);

  useEffect(() => {
    if (needsProviderSetup) {
      setSetupStep("provider");
    } else if (needsBriefSetup) {
      setSetupStep("brief");
    } else {
      setSetupStep("provider");
    }
  }, [needsProviderSetup, needsBriefSetup]);

  useEffect(() => {
    if (!state) return;
    void loadHistory({ showMessage: false });
  }, [state, loadHistory]);

  const handleToggleAttachment = useCallback((id: string) => {
    setAttachmentsToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleBriefSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!state) return;
      setSubmitState("loading");
      setStatus(null);

      const formData = new FormData();
      formData.append("brief", briefDraft ?? "");

      attachmentsToRemove.forEach((id) => {
        formData.append("removeAttachment", id);
      });

      if (pendingFiles) {
        Array.from(pendingFiles).forEach((file) => {
          formData.append("briefAttachments", file);
        });
      }

      try {
        const response = await submitBriefUpdate(formData);
        if (!response.success) {
          throw new Error(response.message || "Brief update failed");
        }
        if (response.state) {
          handleStateUpdate(response.state);
          setBriefDraft(response.state.brief ?? "");
        }
        setAttachmentsToRemove(new Set());
        setPendingFiles(null);
        setUploaderKey((value) => value + 1);
        setStatus({ tone: "info", message: response.message });
        setSubmitState("success");
      } catch (error) {
        setStatus({
          tone: "error",
          message: error instanceof Error ? error.message : String(error),
        });
        setSubmitState("error");
      }
    },
    [attachmentsToRemove, briefDraft, handleStateUpdate, pendingFiles, state]
  );

  const pendingFilesList = useMemo<PendingPreview[]>(() => {
    if (!pendingFiles || pendingFiles.length === 0) {
      return [];
    }
    return Array.from(pendingFiles).map((file) => ({
      name: file.name,
      size: file.size,
    }));
  }, [pendingFiles]);

  const handleHistoryRefresh = useCallback(() => {
    void loadHistory({ offset: 0, append: false, showMessage: true });
  }, [loadHistory]);

  const handleHistoryLoadMore = useCallback(() => {
    if (historyNextOffset == null) return;
    void loadHistory({
      offset: historyNextOffset,
      append: true,
      showMessage: false,
    });
  }, [historyNextOffset, loadHistory]);

  useEffect(() => {
    if (showSetupShell) {
      setActiveTab("brief");
      setShowLaunchPad(false);
    }
  }, [showSetupShell]);

  useEffect(() => {
    const previouslyShowing = previousShowSetupShellRef.current;
    previousShowSetupShellRef.current = showSetupShell;

    if (typeof window === "undefined") {
      return;
    }

    if (previouslyShowing && !showSetupShell) {
      setShowLaunchPad(true);
    }
  }, [showSetupShell]);

  useEffect(() => {
    if (!state) return;
    if (activeTab !== "history") return;
    if (autoRefreshEnabled) {
      return;
    }
    void loadHistory({ offset: 0, append: false, showMessage: false });
  }, [activeTab, autoRefreshEnabled, state, loadHistory]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    if (!autoRefreshEnabled || activeTab !== "history") {
      return undefined;
    }
    void loadHistory({ offset: 0, append: false, showMessage: false });
    const timer = window.setInterval(() => {
      void loadHistory({ offset: 0, append: false, showMessage: false });
    }, HISTORY_REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [autoRefreshEnabled, activeTab, loadHistory]);

  const historyAutoStatus = useMemo(() => {
    if (activeTab !== "history") {
      return autoRefreshEnabled
        ? "Auto-refresh will resume on the History tab"
        : "Auto-refresh paused";
    }
    if (!autoRefreshEnabled) {
      return "Auto-refresh paused";
    }
    if (historyLoading || historyLoadingMore) {
      return "Refreshing…";
    }
    if (historyLastRefreshMs) {
      return `Last updated ${HISTORY_TIME_FORMATTER.format(
        new Date(historyLastRefreshMs)
      )}`;
    }
    return "Auto-refresh running";
  }, [
    activeTab,
    autoRefreshEnabled,
    historyLastRefreshMs,
    historyLoading,
    historyLoadingMore,
  ]);

  const handleTabClick = useCallback((key: TabKey) => {
    setActiveTab(key);
  }, []);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const { key, currentTarget } = event;
      if (key === "ArrowRight" || key === "ArrowLeft") {
        event.preventDefault();
        const delta = key === "ArrowRight" ? 1 : -1;
        const nextIndex = (index + delta + TAB_ORDER.length) % TAB_ORDER.length;
        const nextKey = TAB_ORDER[nextIndex];
        setActiveTab(nextKey);
        const buttons =
          currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
            "[data-tab-key]"
          );
        const nextButton = buttons?.[nextIndex];
        nextButton?.focus();
        return;
      }
      if (key === "Home") {
        event.preventDefault();
        setActiveTab(TAB_ORDER[0]);
        const buttons =
          currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
            "[data-tab-key]"
          );
        const target = buttons?.[0];
        target?.focus();
        return;
      }
      if (key === "End") {
        event.preventDefault();
        const lastIndex = TAB_ORDER.length - 1;
        setActiveTab(TAB_ORDER[lastIndex]);
        const buttons =
          currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
            "[data-tab-key]"
          );
        const target = buttons?.[lastIndex];
        target?.focus();
      }
    },
    []
  );

  const handleToggleAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled((prev) => !prev);
  }, []);

  const renderPanel = useCallback(
    (key: TabKey) => {
      if (!state) {
        return null;
      }

      switch (key) {
        case "brief":
          return (
            <BriefSection
              variant="admin"
              loadState={loadState}
              submitState={submitState}
              status={status}
              briefDraft={briefDraft}
              onBriefChange={setBriefDraft}
              attachments={attachments}
              attachmentsToRemove={attachmentsToRemove}
              pendingFilesList={pendingFilesList}
              onToggleAttachment={handleToggleAttachment}
              onFilesChange={setPendingFiles}
              uploaderKey={uploaderKey}
              onSubmit={handleBriefSubmit}
            />
          );
        case "provider": {
          const providerLocked = state.providerLocked;
          const canSelect = !providerLocked;
          return (
            <ProviderPanel
              variant="admin"
              state={state}
              saving={providerSaving}
              status={providerStatus}
              onStatus={setProviderStatus}
              onSaving={setProviderSaving}
              onState={handleStateUpdate}
              modelOptions={state.modelOptions}
              featuredModels={state.featuredModels}
              providerChoices={state.providerChoices}
              canSelectProvider={canSelect}
              providerLocked={providerLocked}
            />
          );
        }
        case "runtime":
          return (
            <RuntimePanel
              state={state}
              saving={runtimeSaving}
              status={runtimeStatus}
              onStatus={setRuntimeStatus}
              onSaving={setRuntimeSaving}
              onState={handleStateUpdate}
            />
          );
        case "history":
          return (
            <HistoryExplorer
              items={historyItems}
              totalCount={historyTotalCount}
              sessionCount={historySessionCount}
              loading={historyLoading}
              loadingMore={historyLoadingMore}
              statusMessage={historyStatusMessage}
              autoRefreshEnabled={autoRefreshEnabled}
              autoStatus={historyAutoStatus}
              onRefresh={handleHistoryRefresh}
              onToggleAutoRefresh={handleToggleAutoRefresh}
              onLoadMore={
                historyNextOffset != null ? handleHistoryLoadMore : undefined
              }
              hasMore={historyNextOffset != null}
            />
          );
        case "import":
          return <ImportPanel />;
        case "export":
          return (
            <ExportPanel
              exportJsonUrl={state.exportJsonUrl}
              exportMarkdownUrl={state.exportMarkdownUrl}
            />
          );
        default:
          return null;
      }
    },
    [
      attachments,
      attachmentsToRemove,
      briefDraft,
      handleBriefSubmit,
      handleHistoryLoadMore,
      handleHistoryRefresh,
      handleStateUpdate,
      historyItems,
      historyLoading,
      historyLoadingMore,
      historyNextOffset,
      historySessionCount,
      historyStatusMessage,
      historyTotalCount,
      pendingFilesList,
      providerSaving,
      providerStatus,
      runtimeSaving,
      runtimeStatus,
      setPendingFiles,
      setProviderSaving,
      setProviderStatus,
      setRuntimeSaving,
      setRuntimeStatus,
      setBriefDraft,
      status,
      loadState,
      submitState,
      state,
      uploaderKey,
    ]
  );

  const isLoading = loadState === "loading" && !state;
  const handleLaunchPadDismiss = useCallback(() => {
    setShowLaunchPad(false);
  }, []);

  useEffect(() => {
    if (!showLaunchPad) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const node = launchPadRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    node?.focus({ preventScroll: true });
    return () => {
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [showLaunchPad]);
  if (isLoading) {
    return (
      <div className="admin-shell admin-shell--setup">
        <header className="admin-header">
          <h1>Booting up the studio</h1>
          <p className="admin-subtitle">Loading configuration…</p>
        </header>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="admin-shell admin-shell--setup">
        <header className="admin-header">
          <h1>We couldn’t load the admin state</h1>
          <p className="admin-subtitle">
            {status?.message ??
              "Try refreshing the page or checking the server logs."}
          </p>
        </header>
      </div>
    );
  }

  const canSelectProvider = !state.providerLocked;
  const providerStepNumber = 1;
  const briefStepNumber = needsProviderSetup ? 2 : 1;

  const providerLabel =
    state.providerLabels[state.provider.provider] ?? state.provider.provider;
  const providerMetric = `${providerLabel} · ${state.provider.model}`;
  const historyLimitLabel = state.runtime.historyLimit.toLocaleString();
  const historyBytesLabel = state.runtime.historyMaxBytes.toLocaleString();

  const providerReady = !needsProviderSetup;
  const activeSetupStep = providerReady ? setupStep : "provider";

  const launchPad = showLaunchPad ? (
    <div
      className="launch-pad"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleLaunchPadDismiss();
        }
      }}
    >
      <div
        className="launch-pad__card"
        ref={launchPadRef}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            handleLaunchPadDismiss();
          }
        }}
      >
        <span className="launch-pad__pill">Setup complete</span>
        <h2>Launch your live canvas</h2>
        <p className="launch-pad__lead">
          The provider is verified and the brief is ready. Open the improvised app in a new tab or stay here to keep fine-tuning.
        </p>
        <div className="launch-pad__actions">
          <a
            className="launch-pad__primary"
            href="/"
            target="_blank"
            rel="noopener"
          >
            Open live app
          </a>
          <button
            type="button"
            className="launch-pad__secondary"
            onClick={handleLaunchPadDismiss}
          >
            Stay in admin
          </button>
        </div>
        <p className="launch-pad__hint">
          Tips: adjust the brief anytime, swap providers in the tabs, and explore history to replay generated pages.
        </p>
      </div>
    </div>
  ) : null;

  if (showSetupShell) {
    const providerButtonId = "setup-step-provider";
    const briefButtonId = "setup-step-brief";
    const heading =
      activeSetupStep === "provider"
        ? "Set up your canvas"
        : "Tell the model what to build";
    const description =
      activeSetupStep === "provider"
        ? "Serve-llm hosts a living web canvas improvised by your chosen provider. Verify a key so we can start riffing."
        : `Provider ready: ${providerMetric}. Share the tone, moments, and inspirations for the first render.`;

    const providerButtonClasses = ["setup-card__step-button"];
    if (activeSetupStep === "provider") providerButtonClasses.push("is-active");
    if (providerReady && activeSetupStep !== "provider")
      providerButtonClasses.push("is-complete");

    const briefButtonClasses = ["setup-card__step-button"];
    if (activeSetupStep === "brief") briefButtonClasses.push("is-active");
    if (!providerReady) briefButtonClasses.push("is-disabled");

    return (
      <div className="admin-shell admin-shell--setup">
        <div className="setup-card">
          <header className="setup-card__header">
            <span className="setup-card__step">
              {activeSetupStep === "provider" ? "Step 1 of 2" : "Step 2 of 2"}
            </span>
            <h1>{heading}</h1>
            <p className="setup-card__description">{description}</p>
          </header>

          <div
            className="setup-card__steps"
            role="tablist"
            aria-label="Setup steps"
          >
            <button
              id={providerButtonId}
              type="button"
              role="tab"
              aria-selected={activeSetupStep === "provider"}
              className={providerButtonClasses.join(" ")}
              onClick={() => setSetupStep("provider")}
              tabIndex={activeSetupStep === "provider" ? 0 : -1}
            >
              <span className="setup-card__step-number">1</span>
              <span className="setup-card__step-text">Provider</span>
              {providerReady && activeSetupStep !== "provider" ? (
                <span className="setup-card__step-check" aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </button>
            <button
              id={briefButtonId}
              type="button"
              role="tab"
              aria-selected={activeSetupStep === "brief"}
              className={briefButtonClasses.join(" ")}
              onClick={() => providerReady && setSetupStep("brief")}
              disabled={!providerReady}
              tabIndex={
                activeSetupStep === "brief" ? 0 : providerReady ? -1 : undefined
              }
            >
              <span className="setup-card__step-number">2</span>
              <span className="setup-card__step-text">Brief</span>
            </button>
          </div>

          <div
            className="setup-card__body"
            role="tabpanel"
            aria-labelledby={
              activeSetupStep === "provider" ? providerButtonId : briefButtonId
            }
          >
            {activeSetupStep === "provider" ? (
              <ProviderPanel
                variant="setup"
                stepNumber={providerStepNumber}
                state={state}
                saving={providerSaving}
                status={providerStatus}
                onStatus={setProviderStatus}
                onSaving={setProviderSaving}
                onState={handleStateUpdate}
                modelOptions={state.modelOptions}
                featuredModels={state.featuredModels}
                providerChoices={state.providerChoices}
                canSelectProvider={canSelectProvider}
                providerLocked={state.providerLocked}
              />
            ) : (
              <BriefSection
                variant="setup"
                stepNumber={briefStepNumber}
                loadState={loadState}
                submitState={submitState}
                status={status}
                briefDraft={briefDraft}
                onBriefChange={setBriefDraft}
                attachments={attachments}
                attachmentsToRemove={attachmentsToRemove}
                pendingFilesList={pendingFilesList}
                onToggleAttachment={handleToggleAttachment}
                onFilesChange={setPendingFiles}
                uploaderKey={uploaderKey}
                onSubmit={handleBriefSubmit}
              />
            )}
          </div>

          <footer
            className={`setup-card__footer${
              activeSetupStep === "brief" ? " setup-card__footer--between" : ""
            }`}
          >
            {activeSetupStep === "brief" ? (
              <button
                type="button"
                className="admin-secondary"
                onClick={() => setSetupStep("provider")}
              >
                Back to provider
              </button>
            ) : (
              <span className="setup-card__footer-note">
                {providerReady
                  ? "Provider verified. Jump to the brief when you're ready."
                  : "Verify a key to unlock the brief step."}
              </span>
            )}
            {providerReady && activeSetupStep === "provider" ? (
              <button
                type="button"
                className="admin-primary setup-card__next"
                onClick={() => setSetupStep("brief")}
              >
                Continue to brief
              </button>
            ) : activeSetupStep === "brief" ? (
              <span className="setup-card__footer-note">
                Provider: {providerMetric}
              </span>
            ) : null}
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      {launchPad}
      <header className="admin-header admin-header--hero">
        <div>
          <h1>serve-llm Admin Console</h1>
          <p className="admin-subtitle">
            Fine-tune the brief, providers, runtime, and archives without
            restarting the server.
          </p>
        </div>
        <div className="status-bar" role="status">
          <span className="status-pill" data-status="historyTotal">
            History entries: {historyTotalCount}
          </span>
          <span className="status-pill" data-status="sessions">
            Active sessions tracked: {historySessionCount}
          </span>
          <span className="status-pill" data-status="provider">
            Current provider: {providerMetric}
          </span>
          <span className="status-pill" data-status="historyLimit">
            History limit: {historyLimitLabel}
          </span>
          <span className="status-pill" data-status="historyBytes">
            Byte budget: {historyBytesLabel}
          </span>
        </div>
      </header>

      <section className="tabbed-card">
        <nav className="tabs" role="tablist" aria-label="Admin sections">
          {TAB_ORDER.map((key, index) => {
            const isActive = activeTab === key;
            const buttonId = `tab-${key}-button`;
            const panelId = `tab-${key}`;
            return (
              <button
                key={key}
                id={buttonId}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={panelId}
                className={`tab-button${isActive ? " active" : ""}`}
                tabIndex={isActive ? 0 : -1}
                data-tab-key={key}
                onClick={() => handleTabClick(key)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {TAB_LABELS[key]}
              </button>
            );
          })}
        </nav>

        <div className="tab-panels">
          {TAB_ORDER.map((key) => {
            const isActive = activeTab === key;
            const panelId = `tab-${key}`;
            const buttonId = `tab-${key}-button`;
            return (
              <section
                key={key}
                id={panelId}
                role="tabpanel"
                aria-labelledby={buttonId}
                className={`tab-panel${isActive ? "" : " tab-panel--hidden"}`}
                hidden={!isActive}
              >
                {renderPanel(key)}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}

interface ProviderPanelProps {
  state: AdminStateResponse;
  saving: AsyncStatus;
  status: NullableStatus;
  onStatus: (value: NullableStatus) => void;
  onSaving: (status: AsyncStatus) => void;
  onState: (state: AdminStateResponse) => void;
  modelOptions: AdminStateResponse["modelOptions"];
  featuredModels: AdminStateResponse["featuredModels"];
  providerChoices: AdminStateResponse["providerChoices"];
  variant?: "admin" | "setup";
  canSelectProvider: boolean;
  providerLocked: boolean;
  stepNumber?: number;
}

function ProviderPanel({
  state,
  saving,
  status,
  onStatus,
  onSaving,
  onState,
  modelOptions,
  featuredModels,
  providerChoices,
  variant = "admin",
  canSelectProvider,
  providerLocked,
  stepNumber,
}: ProviderPanelProps) {
  const provider = state.provider;
  const currentProvider = provider.provider as ProviderKey;
  const computeGuidance = useCallback(
    (target: ProviderKey, targetModel?: string) => {
      const providerDefaultMax = state.defaultMaxOutputTokens[target];
      const tokenGuidance = state.providerTokenGuidance[target];
      const providerMaxTokens = tokenGuidance?.maxOutputTokens;
      const capability = state.providerReasoningCapabilities[target] ?? {
        mode: false,
        tokens: false,
      };
      const providerReasoning = tokenGuidance?.reasoningTokens;
      const modelList = state.modelCatalog[target] ?? [];
      const selectedModel = targetModel
        ? modelList.find((item) => item.value === targetModel)
        : undefined;
      const modelReasoning = selectedModel?.reasoningTokens;
      const modelMaxTokens = selectedModel?.maxOutputTokens;

      const combinedMaxTokens = (() => {
        if (providerMaxTokens && modelMaxTokens) {
          return { ...providerMaxTokens, ...modelMaxTokens };
        }
        return modelMaxTokens ?? providerMaxTokens ?? undefined;
      })();

      const defaultMax =
        modelMaxTokens?.default ??
        combinedMaxTokens?.default ??
        providerDefaultMax;

      const tokensSupportedByProvider = Boolean(capability.tokens);
      const tokensSupportedByModel = selectedModel
        ? Boolean(modelReasoning?.supported)
        : true;
      const reasoningTokensSupported =
        tokensSupportedByProvider && tokensSupportedByModel;
      const usingModelGuidance =
        reasoningTokensSupported &&
        Boolean(selectedModel && modelReasoning?.supported);
      const reasoningTokensGuidance = usingModelGuidance
        ? modelReasoning
        : reasoningTokensSupported && providerReasoning?.supported
        ? providerReasoning
        : undefined;
      const reasoningToggleAllowed =
        reasoningTokensSupported &&
        reasoningTokensGuidance?.allowDisable !== false;
      const reasoningModesSupported = Boolean(capability.mode);
      const guidanceSource = reasoningTokensSupported
        ? usingModelGuidance
          ? "model"
          : providerReasoning?.supported
          ? "provider"
          : "none"
        : "none";
      const isCustomModel = Boolean(targetModel && !selectedModel);
      return {
        defaultMax,
        maxTokensGuidance: combinedMaxTokens,
        reasoningTokensGuidance,
        reasoningTokensSupported,
        reasoningToggleAllowed,
        reasoningModesSupported,
        modelMetadata: selectedModel,
        providerReasoningGuidance: providerReasoning,
        guidanceSource,
        isCustomModel,
      } as const;
    },
    [
      state.defaultMaxOutputTokens,
      state.modelCatalog,
      state.providerReasoningCapabilities,
      state.providerTokenGuidance,
    ]
  );

  const sanitizeMaxOutputTokens = useCallback(
    (
      raw: number | null | undefined,
      target: ProviderKey,
      targetModel?: string
    ) => {
      const guidance = computeGuidance(target, targetModel);
      const fallback =
        guidance.maxTokensGuidance?.default ?? guidance.defaultMax ?? 1024;
      let value: number;
      if (typeof raw === "number" && Number.isFinite(raw)) {
        value = Math.floor(raw);
      } else {
        value = Math.floor(fallback);
      }
      if (guidance.maxTokensGuidance?.min != null) {
        value = Math.max(value, guidance.maxTokensGuidance.min);
      }
      if (guidance.maxTokensGuidance?.max != null) {
        value = Math.min(value, guidance.maxTokensGuidance.max);
      }
      if (!Number.isFinite(value) || value <= 0) {
        value = Math.max(1, Math.floor(fallback));
      }
      return value;
    },
    [computeGuidance]
  );

  const sanitizeReasoningTokens = useCallback(
    (
      raw: number | null | undefined,
      target: ProviderKey,
      targetModel?: string
    ) => {
      const guidance = computeGuidance(target, targetModel);
      if (
        !guidance.reasoningTokensSupported ||
        !guidance.reasoningTokensGuidance
      ) {
        return undefined;
      }
      if (raw === null || raw === undefined) {
        return undefined;
      }
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) {
        return guidance.reasoningTokensGuidance?.default;
      }
      let value = Math.floor(numeric);
      if (target === "gemini") {
        if (value < -1) {
          value = -1;
        }
      } else if (value < 0) {
        value = 0;
      }
      if (guidance.reasoningTokensGuidance.min != null) {
        value = Math.max(value, guidance.reasoningTokensGuidance.min);
      }
      if (guidance.reasoningTokensGuidance.max != null) {
        value = Math.min(value, guidance.reasoningTokensGuidance.max);
      }
      if (!Number.isFinite(value)) {
        return guidance.reasoningTokensGuidance.default;
      }
      return value;
    },
    [computeGuidance]
  );

  const currentGuidance = useMemo(
    () => computeGuidance(currentProvider, state.provider.model),
    [computeGuidance, currentProvider, state.provider.model]
  );
  const [apiKey, setApiKey] = useState<string>("");
  const [reasoningTokensEnabled, setReasoningTokensEnabled] = useState<boolean>(
    provider.reasoningTokensEnabled !== false
  );
  const effectiveReasoningEnabled = currentGuidance.reasoningTokensSupported
    ? currentGuidance.reasoningToggleAllowed
      ? reasoningTokensEnabled
      : true
    : false;

  useEffect(() => {
    const defaultEnabled = currentGuidance.reasoningTokensSupported
      ? currentGuidance.reasoningToggleAllowed
        ? provider.reasoningTokensEnabled !== false
        : true
      : false;
    setReasoningTokensEnabled(defaultEnabled);
    setApiKey("");
  }, [
    provider.provider,
    provider.reasoningTokensEnabled,
    currentGuidance.reasoningTokensSupported,
    currentGuidance.reasoningToggleAllowed,
  ]);

  const reasoningGuidance = currentGuidance.reasoningTokensGuidance;
  const reasoningDescription = currentGuidance.reasoningTokensSupported
    ? reasoningGuidance?.description ??
      (currentGuidance.guidanceSource === "provider"
        ? "Using provider defaults for the reasoning budget."
        : "Reserve deliberate thinking tokens for this model when you need deeper analysis.")
    : "This model does not expose a manual reasoning budget.";
  const reasoningHelper = (() => {
    if (!currentGuidance.reasoningTokensSupported) {
      return "Reasoning budgets aren’t available for this model.";
    }
    if (!reasoningGuidance) {
      return "Using provider defaults for reasoning budgets.";
    }
    if (currentGuidance.guidanceSource === "provider") {
      if (currentGuidance.isCustomModel) {
        return (
          reasoningGuidance.helper ??
          "Custom model — falling back to provider defaults. Tune with care."
        );
      }
      return (
        reasoningGuidance.helper ??
        "This model reuses the provider’s default reasoning guidance."
      );
    }
    return (
      reasoningGuidance.helper ??
      "Less reasoning tokens = faster. More tokens unlock complex flows."
    );
  })();

  const applyProviderDefaults = useCallback(
    (nextProvider: ProviderKey, hintedModel?: string) => {
      const defaultModel =
        state.defaultModelByProvider[nextProvider] ??
        hintedModel ??
        provider.model;
      const sanitizedMaxTokens = sanitizeMaxOutputTokens(
        state.defaultMaxOutputTokens[nextProvider] ?? provider.maxOutputTokens,
        nextProvider,
        defaultModel
      );
      const guidance = computeGuidance(nextProvider, defaultModel);

      let nextReasoningMode = provider.reasoningMode ?? "none";
      if (!guidance.reasoningModesSupported) {
        nextReasoningMode = "none";
      } else if (nextProvider === "openai" && nextReasoningMode === "none") {
        nextReasoningMode = "low";
      }

      const tokensSupported = guidance.reasoningTokensSupported;
      const allowToggle = guidance.reasoningToggleAllowed;
      const nextReasoningEnabled = tokensSupported
        ? allowToggle
          ? provider.reasoningTokensEnabled !== false
          : true
        : false;
      let nextReasoningTokens: number | undefined;
      if (tokensSupported) {
        const baseTokens =
          provider.provider === nextProvider
            ? provider.reasoningTokens
            : guidance.reasoningTokensGuidance?.default;
        const sanitized = sanitizeReasoningTokens(
          typeof baseTokens === "number" ? baseTokens : undefined,
          nextProvider,
          defaultModel
        );
        if (sanitized !== undefined) {
          nextReasoningTokens = sanitized;
        } else if (
          typeof guidance.reasoningTokensGuidance?.default === "number"
        ) {
          nextReasoningTokens = guidance.reasoningTokensGuidance.default;
        }
      }

      const updated: AdminStateResponse = {
        ...state,
        provider: {
          ...state.provider,
          provider: nextProvider,
          model: defaultModel,
          maxOutputTokens: sanitizedMaxTokens,
          reasoningMode: nextReasoningMode,
          reasoningTokens: tokensSupported ? nextReasoningTokens : undefined,
          reasoningTokensEnabled: tokensSupported
            ? nextReasoningEnabled
            : false,
        },
      };

      onState(updated);
      setReasoningTokensEnabled(nextReasoningEnabled);
    },
    [
      state,
      onState,
      provider,
      sanitizeMaxOutputTokens,
      sanitizeReasoningTokens,
      computeGuidance,
    ]
  );

  const handleReasoningToggle = useCallback(
    (enabled: boolean) => {
      if (
        !currentGuidance.reasoningTokensSupported ||
        !currentGuidance.reasoningToggleAllowed
      ) {
        return;
      }
      setReasoningTokensEnabled(enabled);
      const nextTokenValue = enabled
        ? state.provider.reasoningTokens ??
          currentGuidance.reasoningTokensGuidance?.default
        : undefined;
      const sanitizedTokens = enabled
        ? sanitizeReasoningTokens(
            nextTokenValue,
            currentProvider,
            provider.model
          )
        : undefined;
      onState({
        ...state,
        provider: {
          ...state.provider,
          reasoningTokensEnabled: enabled,
          reasoningTokens: sanitizedTokens,
        },
      });
    },
    [
      state,
      onState,
      currentGuidance.reasoningTokensSupported,
      currentGuidance.reasoningToggleAllowed,
      currentGuidance.reasoningTokensGuidance,
      sanitizeReasoningTokens,
      currentProvider,
    ]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaving("loading");
    onStatus(null);

    const sanitizedMaxTokens = sanitizeMaxOutputTokens(
      provider.maxOutputTokens,
      currentProvider,
      provider.model
    );
    const effectiveReasoningEnabled = currentGuidance.reasoningTokensSupported
      ? currentGuidance.reasoningToggleAllowed
        ? reasoningTokensEnabled
        : true
      : false;
    const sanitizedReasoningTokens = effectiveReasoningEnabled
      ? sanitizeReasoningTokens(
          provider.reasoningTokens,
          currentProvider,
          provider.model
        )
      : undefined;
    const reasoningMode = currentGuidance.reasoningModesSupported
      ? provider.reasoningMode ?? "none"
      : "none";

    const payload: ProviderUpdatePayload = {
      provider: provider.provider,
      model: provider.model,
      maxOutputTokens: sanitizedMaxTokens,
      reasoningMode,
      apiKey: apiKey.trim() || undefined,
    };

    if (currentGuidance.reasoningTokensSupported) {
      payload.reasoningTokensEnabled = effectiveReasoningEnabled;
      if (effectiveReasoningEnabled) {
        if (sanitizedReasoningTokens !== undefined) {
          payload.reasoningTokens = sanitizedReasoningTokens;
        }
      } else {
        payload.reasoningTokens = null;
      }
    }

    try {
      const response = await submitProviderUpdate(payload);
      if (!response.success) {
        throw new Error(response.message || "Provider update failed");
      }
      if (response.state) {
        onState(response.state);
      }
      setApiKey("");
      onStatus({ tone: "info", message: response.message });
      onSaving("success");
    } catch (error) {
      onStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      onSaving("error");
    }
  };

  const keyStatusEntries = PROVIDER_SORT_ORDER.map((key) => ({
    key,
    label: state.providerLabels[key] ?? key,
    status: state.providerKeyStatuses[key],
  })).filter((item) => Boolean(item.status)) as Array<{
    key: string;
    label: string;
    status: { hasKey: boolean; verified: boolean };
  }>;

  const isSetup = variant === "setup";
  const heading = "Provider & model";
  const subtitle = isSetup
    ? providerLocked
      ? "This runtime ships with a predefined provider. Enter an API key to continue."
      : "Select your preferred provider, pick a model, and verify an API key to unlock the canvas."
    : "Choose your provider, model, and output budgets.";

  const cardClassName = `admin-card${isSetup ? " admin-card--setup" : ""}`;

  return (
    <section className={cardClassName}>
      <div className="admin-card__header">
        <div>
          <h2>{heading}</h2>
          <p className="admin-card__subtitle">{subtitle}</p>
        </div>
        {status && (
          <div
            className={`admin-status admin-status--${
              status.tone === "error" ? "error" : "info"
            }`}
          >
            {status.message}
          </div>
        )}
      </div>

      {providerLocked && !canSelectProvider && (
        <p className="admin-callout">
          Provider selection is locked by CLI or environment configuration. You
          can still adjust models and limits here.
        </p>
      )}

      {variant === "admin" && keyStatusEntries.length > 0 && (
        <div className="provider-status-grid" role="list">
          {keyStatusEntries.map(({ key, label, status: keyStatus }) => {
            const variantClass = keyStatus.verified
              ? "provider-status-chip--verified"
              : keyStatus.hasKey
              ? "provider-status-chip--pending"
              : "provider-status-chip--idle";
            const descriptor = keyStatus.verified
              ? "Verified"
              : keyStatus.hasKey
              ? "Key stored"
              : "No key";
            return (
              <span
                key={key}
                role="listitem"
                className={`provider-status-chip ${variantClass}`}
              >
                <span className="provider-status-chip__label">{label}</span>
                <span className="provider-status-chip__state">
                  {descriptor}
                </span>
              </span>
            );
          })}
        </div>
      )}

      <form className="admin-form" onSubmit={handleSubmit}>
        <ModelSelector
          provider={provider.provider}
          model={provider.model}
          providerChoices={providerChoices}
          modelOptions={modelOptions}
          modelCatalog={state.modelCatalog}
          featuredModels={featuredModels}
          providerLabels={state.providerLabels}
          providerPlaceholders={state.providerPlaceholders}
          defaultModelByProvider={state.defaultModelByProvider}
          providerTokenGuidance={state.providerTokenGuidance}
          providerReasoningCapabilities={state.providerReasoningCapabilities}
          customDescription={state.customModelDescription}
          disableProviderSelection={!canSelectProvider}
          onProviderChange={(nextProvider, nextModel) => {
            applyProviderDefaults(nextProvider as ProviderKey, nextModel);
          }}
          onModelChange={(nextModel) => {
            onState({
              ...state,
              provider: {
                ...state.provider,
                model: nextModel,
              },
            });
          }}
        />

        <label className="admin-field">
          <span className="admin-field__label">API key (optional)</span>
          <input
            type="password"
            placeholder={
              state.providerPlaceholders[provider.provider] ?? "sk-..."
            }
            autoComplete="new-password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <p className="admin-field__helper">
            Current key: {provider.apiKeyMask}. Leave blank to keep the existing
            key.
          </p>
        </label>

        <TokenBudgetControl
          label="Max output tokens"
          description={
            currentGuidance.maxTokensGuidance?.description ??
            state.providerTokenGuidance[provider.provider]?.maxOutputTokens
              ?.description ??
            "Give the model a ceiling for each response."
          }
          helper="Higher limits unlock richer layouts; smaller caps return faster."
          value={
            typeof provider.maxOutputTokens === "number"
              ? sanitizeMaxOutputTokens(
                  provider.maxOutputTokens,
                  currentProvider,
                  provider.model
                )
              : currentGuidance.defaultMax ?? null
          }
          defaultValue={
            currentGuidance.maxTokensGuidance?.default ??
            currentGuidance.defaultMax ??
            state.defaultMaxOutputTokens[provider.provider]
          }
          min={currentGuidance.maxTokensGuidance?.min}
          max={currentGuidance.maxTokensGuidance?.max}
          onChange={(next) => {
            const sanitized = sanitizeMaxOutputTokens(
              next,
              currentProvider,
              provider.model
            );
            onState({
              ...state,
              provider: {
                ...state.provider,
                maxOutputTokens: sanitized,
              },
            });
          }}
        />

        <label className="admin-field">
          <span className="admin-field__label">Reasoning mode</span>
          <select
            name="reasoningMode"
            value={
              currentGuidance.reasoningModesSupported
                ? provider.reasoningMode
                : "none"
            }
            disabled={!currentGuidance.reasoningModesSupported}
            onChange={(event) => {
              const nextMode = event.target.value;
              onState({
                ...state,
                provider: {
                  ...state.provider,
                  reasoningMode: nextMode as string,
                },
              });
            }}
          >
            {state.reasoningModeChoices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
          <p className="admin-field__helper">
            {currentGuidance.reasoningModesSupported
              ? state.reasoningModeChoices.find(
                  (choice) => choice.value === provider.reasoningMode
                )?.description
              : "This provider manages reasoning mode automatically."}
          </p>
        </label>

        {currentGuidance.reasoningTokensSupported ? (
          <>
            {currentGuidance.reasoningToggleAllowed ? (
              <label className="admin-field admin-field--row">
                <span className="admin-field__label">Reasoning tokens</span>
                <div className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={effectiveReasoningEnabled}
                    onChange={(event) => handleReasoningToggle(event.target.checked)}
                  />
                  <span>
                    {currentGuidance.guidanceSource === "provider"
                      ? "Enable manual reasoning budget (provider defaults)"
                      : "Enable manual reasoning budget"}
                  </span>
                </div>
              </label>
            ) : (
              <div className="admin-field">
                <span className="admin-field__label">Reasoning tokens</span>
                <p className="admin-field__helper">
                  This model always applies a deliberate reasoning budget—adjust the cap below.
                </p>
              </div>
            )}

            <TokenBudgetControl
              label="Reasoning budget"
              description={reasoningDescription}
              helper={reasoningHelper}
              value={
                effectiveReasoningEnabled
                  ? sanitizeReasoningTokens(
                      provider.reasoningTokens,
                      currentProvider,
                      provider.model
                    ) ??
                    currentGuidance.reasoningTokensGuidance?.default ??
                    null
                  : null
              }
              defaultValue={currentGuidance.reasoningTokensGuidance?.default}
              min={currentGuidance.reasoningTokensGuidance?.min}
              max={currentGuidance.reasoningTokensGuidance?.max}
              disabled={!effectiveReasoningEnabled}
              accent="reasoning"
              specialLabels={
                provider.provider === "gemini"
                  ? { "-1": "Auto-managed", "0": "Disabled" }
                  : undefined
              }
              onChange={(next) => {
                const sanitized = sanitizeReasoningTokens(
                  next,
                  currentProvider,
                  provider.model
                );
                onState({
                  ...state,
                  provider: {
                    ...state.provider,
                    reasoningTokens: sanitized,
                  },
                });
              }}
            />
          </>
        ) : (
          <div className="admin-field">
            <span className="admin-field__label">Reasoning tokens</span>
            <p className="admin-field__helper">
              This model doesn’t expose a manual reasoning budget; rely on prompts instead.
            </p>
          </div>
        )}

        <div className="admin-actions">
          <button
            type="submit"
            className="admin-primary"
            disabled={saving === "loading"}
          >
            {saving === "loading" ? "Saving…" : "Save provider"}
          </button>
        </div>
      </form>
    </section>
  );
}

interface BriefSectionProps {
  variant: "admin" | "setup";
  stepNumber?: number;
  loadState: AsyncStatus;
  submitState: AsyncStatus;
  status: NullableStatus;
  briefDraft: string;
  onBriefChange: (value: string) => void;
  attachments: AdminBriefAttachment[];
  attachmentsToRemove: Set<string>;
  pendingFilesList: PendingPreview[];
  onToggleAttachment: (id: string) => void;
  onFilesChange: (files: FileList | null) => void;
  uploaderKey: number;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

function BriefSection({
  variant,
  stepNumber,
  loadState,
  submitState,
  status,
  briefDraft,
  onBriefChange,
  attachments,
  attachmentsToRemove,
  pendingFilesList,
  onToggleAttachment,
  onFilesChange,
  uploaderKey,
  onSubmit,
}: BriefSectionProps) {
  const isSetup = variant === "setup";
  const title = "Brief";
  const subtitle = isSetup
    ? "Write a quick summary so the runtime knows the tone, audience, and core idea. You can revise it any time."
    : "Provide the model with guiding instructions. Attach imagery or PDFs for extra context.";

  const cardClassName = `admin-card${isSetup ? " admin-card--setup" : ""}`;

  return (
    <section className={cardClassName}>
      <div className="admin-card__header">
        <div>
          <h2>{title}</h2>
          <p className="admin-card__subtitle">{subtitle}</p>
        </div>
        <div className="admin-status admin-status--muted">
          {loadState === "loading" && "Loading…"}
          {loadState === "error" && "Unable to load state"}
        </div>
      </div>

      <form className="admin-form" onSubmit={onSubmit}>
        <label className="admin-field">
          <span className="admin-field__label">Brief instructions</span>
          <textarea
            value={briefDraft}
            onChange={(event) => onBriefChange(event.target.value)}
            placeholder="Describe the experience you want the model to improvise."
            rows={6}
          />
        </label>

        <div className="admin-field">
          <span className="admin-field__label">Attachments</span>
          <p className="admin-field__helper">
            Drop reference assets (images, PDFs) to guide styling, copy, or
            content.
          </p>

          <AttachmentUploader
            key={uploaderKey}
            name="briefAttachments"
            label="Drop reference files"
            hint="Images and PDFs are supported. Paste from clipboard or browse."
            onFilesChange={onFilesChange}
          />

          {pendingFilesList.length > 0 && (
            <ul className="admin-attachment-preview">
              {pendingFilesList.map((file) => (
                <li key={`${file.name}-${file.size}`}>
                  {file.name} ({Math.round(file.size / 1024)} KB)
                </li>
              ))}
            </ul>
          )}

          {attachments.length > 0 && (
            <div className="admin-attachment-grid">
              {attachments.map((attachment) => (
                <AttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  markedForRemoval={attachmentsToRemove.has(attachment.id)}
                  onToggle={() => onToggleAttachment(attachment.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="admin-actions">
          <button
            type="submit"
            className="admin-primary"
            disabled={submitState === "loading"}
          >
            {submitState === "loading"
              ? "Saving…"
              : isSetup
              ? "Save brief"
              : "Save brief"}
          </button>
          {status && (
            <span
              className={`admin-status admin-status--${
                status.tone === "error" ? "error" : "info"
              }`}
            >
              {status.message}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

interface AttachmentCardProps {
  attachment: AdminBriefAttachment;
  markedForRemoval: boolean;
  onToggle: () => void;
}

function AttachmentCard({
  attachment,
  markedForRemoval,
  onToggle,
}: AttachmentCardProps) {
  return (
    <button
      type="button"
      className={`admin-attachment-card${
        markedForRemoval ? " admin-attachment-card--marked" : ""
      }`}
      onClick={onToggle}
    >
      <div className="admin-attachment-card__preview" aria-hidden="true">
        {attachment.isImage ? (
          <img src={attachment.dataUrl} alt="" loading="lazy" />
        ) : (
          <span className="admin-attachment-card__icon">📄</span>
        )}
      </div>
      <div className="admin-attachment-card__meta">
        <span className="admin-attachment-card__name">{attachment.name}</span>
        <span className="admin-attachment-card__details">
          {attachment.mimeType} · {Math.round(attachment.size / 1024)} KB
        </span>
      </div>
      <div className="admin-attachment-card__badge">
        {markedForRemoval ? "Marked for removal" : "Keep"}
      </div>
    </button>
  );
}

interface RuntimePanelProps {
  state: AdminStateResponse;
  saving: AsyncStatus;
  status: NullableStatus;
  onStatus: (value: NullableStatus) => void;
  onSaving: (status: AsyncStatus) => void;
  onState: (state: AdminStateResponse) => void;
}

function RuntimePanel({
  state,
  saving,
  status,
  onStatus,
  onSaving,
  onState,
}: RuntimePanelProps) {
  const runtime = state.runtime;
  const [historyLimitValue, setHistoryLimitValue] = useState<string>(
    String(runtime.historyLimit)
  );
  const [historyMaxBytesValue, setHistoryMaxBytesValue] = useState<string>(
    String(runtime.historyMaxBytes)
  );
  const [includeInstructionPanel, setIncludeInstructionPanel] =
    useState<boolean>(runtime.includeInstructionPanel);
  const [runtimeErrors, setRuntimeErrors] = useState<{
    historyLimit?: string;
    historyMaxBytes?: string;
  }>({});

  useEffect(() => {
    setHistoryLimitValue(String(state.runtime.historyLimit));
    setHistoryMaxBytesValue(String(state.runtime.historyMaxBytes));
    setIncludeInstructionPanel(state.runtime.includeInstructionPanel);
  }, [
    state.runtime.historyLimit,
    state.runtime.historyMaxBytes,
    state.runtime.includeInstructionPanel,
  ]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaving("loading");
    onStatus(null);

    const nextErrors: {
      historyLimit?: string;
      historyMaxBytes?: string;
    } = {};

    const parsedHistoryLimit = Number.parseInt(historyLimitValue, 10);
    if (!Number.isFinite(parsedHistoryLimit)) {
      nextErrors.historyLimit = `Enter a whole number between ${HISTORY_LIMIT_MIN.toLocaleString()} and ${HISTORY_LIMIT_MAX.toLocaleString()}.`;
    }

    const parsedHistoryMaxBytes = Number.parseInt(historyMaxBytesValue, 10);
    if (!Number.isFinite(parsedHistoryMaxBytes)) {
      nextErrors.historyMaxBytes = `Enter a whole number between ${HISTORY_MAX_BYTES_MIN.toLocaleString()} and ${HISTORY_MAX_BYTES_MAX.toLocaleString()} bytes.`;
    }

    if (Object.keys(nextErrors).length > 0) {
      setRuntimeErrors(nextErrors);
      onSaving("idle");
      return;
    }

    const sanitizedHistoryLimit = clamp(
      parsedHistoryLimit,
      HISTORY_LIMIT_MIN,
      HISTORY_LIMIT_MAX
    );
    const sanitizedHistoryMaxBytes = clamp(
      parsedHistoryMaxBytes,
      HISTORY_MAX_BYTES_MIN,
      HISTORY_MAX_BYTES_MAX
    );

    const adjustments: string[] = [];
    if (sanitizedHistoryLimit !== parsedHistoryLimit) {
      adjustments.push(`History limit adjusted to ${sanitizedHistoryLimit}.`);
    }
    if (sanitizedHistoryMaxBytes !== parsedHistoryMaxBytes) {
      adjustments.push(
        `Byte budget adjusted to ${sanitizedHistoryMaxBytes.toLocaleString()} bytes.`
      );
    }

    setHistoryLimitValue(String(sanitizedHistoryLimit));
    setHistoryMaxBytesValue(String(sanitizedHistoryMaxBytes));
    setRuntimeErrors({});

    try {
      const response = await submitRuntimeUpdate({
        historyLimit: sanitizedHistoryLimit,
        historyMaxBytes: sanitizedHistoryMaxBytes,
        instructionPanel: includeInstructionPanel,
      });
      if (!response.success) {
        throw new Error(response.message || "Runtime update failed");
      }
      if (response.state) {
        onState(response.state);
      }
      const statusMessage =
        adjustments.length > 0
          ? `${response.message} ${adjustments.join(" ")}`
          : response.message;
      onStatus({ tone: "info", message: statusMessage });
      onSaving("success");
    } catch (error) {
      onStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      onSaving("error");
    }
  };

  return (
    <section className="admin-card">
      <div className="admin-card__header">
        <div>
          <h2>Runtime</h2>
          <p className="admin-card__subtitle">
            Tune how much history is retained and whether the instructions panel
            is shown.
          </p>
        </div>
        {status && (
          <div
            className={`admin-status admin-status--${
              status.tone === "error" ? "error" : "info"
            }`}
          >
            {status.message}
          </div>
        )}
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="admin-field">
          <span className="admin-field__label">History entries to retain</span>
          <input
            type="number"
            min={HISTORY_LIMIT_MIN}
            max={HISTORY_LIMIT_MAX}
            value={historyLimitValue}
            onChange={(event) => {
              setHistoryLimitValue(event.target.value);
              if (runtimeErrors.historyLimit) {
                setRuntimeErrors((prev) => ({
                  ...prev,
                  historyLimit: undefined,
                }));
              }
            }}
            aria-invalid={runtimeErrors.historyLimit ? "true" : "false"}
          />
          {runtimeErrors.historyLimit ? (
            <p className="admin-field__error" role="alert">
              {runtimeErrors.historyLimit}
            </p>
          ) : (
            <p className="admin-field__helper">
              Keep more entries to give the model additional context at the cost
              of longer prompts. ({HISTORY_LIMIT_MIN}–{HISTORY_LIMIT_MAX})
            </p>
          )}
        </label>

        <label className="admin-field">
          <span className="admin-field__label">
            History memory budget (bytes)
          </span>
          <input
            type="number"
            min={HISTORY_MAX_BYTES_MIN}
            max={HISTORY_MAX_BYTES_MAX}
            step={1024}
            value={historyMaxBytesValue}
            onChange={(event) => {
              setHistoryMaxBytesValue(event.target.value);
              if (runtimeErrors.historyMaxBytes) {
                setRuntimeErrors((prev) => ({
                  ...prev,
                  historyMaxBytes: undefined,
                }));
              }
            }}
            aria-invalid={runtimeErrors.historyMaxBytes ? "true" : "false"}
          />
          {runtimeErrors.historyMaxBytes ? (
            <p className="admin-field__error" role="alert">
              {runtimeErrors.historyMaxBytes}
            </p>
          ) : (
            <p className="admin-field__helper">
              Once this threshold is exceeded, older entries will be trimmed. (
              {HISTORY_MAX_BYTES_MIN.toLocaleString()}–
              {HISTORY_MAX_BYTES_MAX.toLocaleString()} bytes)
            </p>
          )}
        </label>

        <label className="admin-field admin-field--row">
          <span className="admin-field__label">Instructions panel</span>
          <div className="admin-toggle">
            <input
              type="checkbox"
              checked={includeInstructionPanel}
              onChange={(event) =>
                setIncludeInstructionPanel(event.target.checked)
              }
            />
            <span>Show the floating instructions helper</span>
          </div>
        </label>

        <div className="admin-actions">
          <button
            type="submit"
            className="admin-primary"
            disabled={saving === "loading"}
          >
            {saving === "loading" ? "Saving…" : "Save runtime"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ImportPanel() {
  return (
    <section className="admin-panel admin-panel--placeholder">
      <div className="admin-card__header">
        <div>
          <h2>Import history</h2>
          <p className="admin-card__subtitle">
            Restore a previous session snapshot to resume where you left off.
          </p>
        </div>
      </div>
      <p className="admin-placeholder">
        Import workflow is temporarily unavailable while the new admin
        experience is under construction.
      </p>
    </section>
  );
}

interface ExportPanelProps {
  exportJsonUrl: string;
  exportMarkdownUrl: string;
}

function ExportPanel({ exportJsonUrl, exportMarkdownUrl }: ExportPanelProps) {
  return (
    <section className="admin-panel admin-panel--exports">
      <div className="admin-card__header">
        <div>
          <h2>Exports</h2>
          <p className="admin-card__subtitle">
            Download the current session for safekeeping or handoff.
          </p>
        </div>
      </div>
      <div className="admin-actions admin-actions--stacked">
        <a
          className="admin-primary admin-primary--link"
          href={exportJsonUrl}
          download
        >
          Download JSON snapshot
        </a>
        <a
          className="admin-secondary admin-secondary--link"
          href={exportMarkdownUrl}
          download
        >
          Download prompt.md
        </a>
      </div>
    </section>
  );
}

export default AdminDashboard;
