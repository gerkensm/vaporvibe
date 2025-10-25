import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  AttachmentUploader,
  ModelSelector,
  TokenBudgetControl,
} from "../components";
import type { CustomModelConfig } from "../components";
import HistoryExplorer from "../components/HistoryExplorer";
import HistorySnapshotControls from "../components/HistorySnapshotControls";
import ResumeSessionCallout from "../components/ResumeSessionCallout";
import {
  fetchAdminState,
  fetchAdminHistory,
  deleteHistoryEntry,
  deleteAllHistoryEntries,
  submitBriefUpdate,
  submitProviderUpdate,
  submitRuntimeUpdate,
  verifyProviderKey,
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
  DEFAULT_HISTORY_MAX_BYTES,
} from "../constants/runtime";
import { useNotifications } from "../components/Notifications";
import vaporvibeLogoUrl from "../assets/vaporvibe-icon-both.svg";

type AsyncStatus = "idle" | "loading" | "success" | "error";
type StatusMessage = { tone: "info" | "error"; message: string };
type NullableStatus = StatusMessage | null;

type QueuedAttachment = {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  isImage: boolean;
  previewUrl: string | null;
};

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

const DEFAULT_CUSTOM_MODEL_CONFIG: CustomModelConfig = {
  isMultimodal: false,
  supportsImageInput: false,
  supportsPDFInput: false,
  supportsReasoning: false,
  supportsReasoningMode: false,
};

const createDefaultCustomConfig = (): CustomModelConfig => ({
  ...DEFAULT_CUSTOM_MODEL_CONFIG,
});

const TAB_ORDER = ["provider", "brief", "runtime", "history"] as const;

type TabKey = (typeof TAB_ORDER)[number];

const TAB_LABELS: Record<TabKey, string> = {
  brief: "Brief",
  provider: "Provider",
  runtime: "Runtime",
  history: "History",
};

const ADMIN_ROUTE_PREFIX = "/vaporvibe";

const isAdminPath = (pathname: string) =>
  pathname === ADMIN_ROUTE_PREFIX ||
  pathname.startsWith(`${ADMIN_ROUTE_PREFIX}/`);

const normalizeAdminPath = (pathname: string) =>
  pathname.replace(/\/+$/, "") || "/";

const isTabKey = (value: string): value is TabKey =>
  (TAB_ORDER as readonly string[]).includes(value);

const getTabFromPath = (pathname: string): TabKey | null => {
  if (!isAdminPath(pathname)) {
    return null;
  }
  const normalized = normalizeAdminPath(pathname);
  const remainder = normalized.slice(ADMIN_ROUTE_PREFIX.length);
  if (!remainder || remainder === "") {
    return "provider";
  }
  const segments = remainder.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "provider";
  }
  const candidate = segments[0];
  return isTabKey(candidate) ? candidate : "provider";
};

const createTabPath = (tab: TabKey) =>
  tab === "provider" ? ADMIN_ROUTE_PREFIX : `${ADMIN_ROUTE_PREFIX}/${tab}`;

type AdminLocationState = {
  showLaunchPad?: boolean;
} | null;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

interface AdminDashboardProps {
  mode?: "auto" | "setup" | "admin";
}

const SETUP_INTRO_STORAGE_KEY = "vaporvibe:setup:intro-seen:v1";

export function AdminDashboard({ mode = "auto" }: AdminDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useNotifications();
  const [state, setState] = useState<AdminStateResponse | null>(null);
  const [briefDraft, setBriefDraft] = useState("");
  const [pendingUploads, setPendingUploads] = useState<QueuedAttachment[]>([]);
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
  const [historyPurgingAll, setHistoryPurgingAll] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const initial = getTabFromPath(location.pathname);
    return initial ?? "provider";
  });
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [historyLastRefreshMs, setHistoryLastRefreshMs] = useState<
    number | null
  >(null);
  const [setupStep, setSetupStep] = useState<"provider" | "brief">("provider");
  const [showLaunchPad, setShowLaunchPad] = useState(false);
  const [showIntroStep, setShowIntroStep] = useState(false);

  const needsProviderSetup = state
    ? !state.providerReady || state.providerSelectionRequired
    : false;
  const needsBriefSetup = state ? !needsProviderSetup && !state.brief : false;
  const enforceSetup = mode === "setup";
  const showSetupShell = needsProviderSetup || needsBriefSetup || enforceSetup;
  const attachments = state?.attachments ?? [];

  const previousShowSetupShellRef = useRef(showSetupShell);
  const launchPadRef = useRef<HTMLDivElement | null>(null);
  const previousSetupStepRef = useRef<"provider" | "brief" | null>(null);
  const previousIntroVisibilityRef = useRef(showIntroStep);

  const scrollSetupToTop = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, []);

  const handleStateUpdate = useCallback((snapshot: AdminStateResponse) => {
    setState(snapshot);
    setHistoryTotalCount(snapshot.totalHistoryCount);
    setHistorySessionCount(snapshot.sessionCount);
  }, []);

  const handleSnapshotHydrate = useCallback(
    (snapshot: AdminStateResponse) => {
      handleStateUpdate(snapshot);
      setBriefDraft(snapshot.brief ?? "");
      setAttachmentsToRemove(new Set());
      setPendingUploads((prev) => {
        prev.forEach((upload) => {
          if (upload.previewUrl) {
            URL.revokeObjectURL(upload.previewUrl);
          }
        });
        return [];
      });
      setUploaderKey((value) => value + 1);
    },
    [
      handleStateUpdate,
      setAttachmentsToRemove,
      setBriefDraft,
      setPendingUploads,
      setUploaderKey,
    ]
  );

  useEffect(() => {
    if (!showSetupShell) {
      setShowIntroStep(false);
      return;
    }
    if (typeof window === "undefined") {
      setShowIntroStep(false);
      return;
    }
    try {
      const storedValue = window.localStorage.getItem(SETUP_INTRO_STORAGE_KEY);
      setShowIntroStep(!storedValue);
    } catch (error) {
      console.error("Unable to read intro preference", error);
      setShowIntroStep(true);
    }
  }, [showSetupShell]);

  const handleIntroAcknowledge = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(SETUP_INTRO_STORAGE_KEY, "seen");
      } catch (error) {
        console.error("Unable to persist intro preference", error);
      }
    }
    setShowIntroStep(false);
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
        notify("error", message);
      } finally {
        if (append) {
          setHistoryLoadingMore(false);
        } else {
          setHistoryLoading(false);
        }
      }
    },
    [notify]
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
        const message = error instanceof Error ? error.message : String(error);
        setStatus({
          tone: "error",
          message,
        });
        notify("error", message);
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [handleStateUpdate, notify, showLaunchPad]);

  useEffect(() => {
    if (!state) return;
    if (mode !== "setup") return;
    if (!state.providerReady || !state.brief) return;
    if (location.pathname.startsWith("/vaporvibe")) {
      return;
    }
    navigate("/vaporvibe", { replace: true, state: { showLaunchPad: true } });
  }, [state, mode, navigate, location.pathname]);

  useEffect(() => {
    if (!state) return;
    if (!showLaunchPad) return;
    if (!state.providerReady || !state.brief) {
      setShowLaunchPad(false);
    }
  }, [state, showLaunchPad]);

  useEffect(() => {
    if (!showSetupShell) {
      previousIntroVisibilityRef.current = showIntroStep;
      return;
    }
    const wasVisible = previousIntroVisibilityRef.current;
    if (wasVisible && !showIntroStep) {
      scrollSetupToTop();
    }
    previousIntroVisibilityRef.current = showIntroStep;
  }, [showIntroStep, showSetupShell, scrollSetupToTop]);

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
    if (!showSetupShell || showIntroStep) {
      previousSetupStepRef.current = setupStep;
      return;
    }
    const previous = previousSetupStepRef.current;
    if (previous && previous !== setupStep) {
      scrollSetupToTop();
    }
    previousSetupStepRef.current = setupStep;
  }, [setupStep, showSetupShell, showIntroStep, scrollSetupToTop]);

  useEffect(() => {
    const routeTab = getTabFromPath(location.pathname);
    if (!routeTab) {
      return;
    }
    if (routeTab !== activeTab) {
      setActiveTab(routeTab);
    }
  }, [location.pathname, activeTab, setActiveTab]);

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

      if (pendingUploads.length > 0) {
        pendingUploads.forEach((upload) => {
          formData.append("briefAttachments", upload.file);
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
        setPendingUploads((prev) => {
          prev.forEach((upload) => {
            if (upload.previewUrl) {
              URL.revokeObjectURL(upload.previewUrl);
            }
          });
          return [];
        });
        setUploaderKey((value) => value + 1);
        setStatus({ tone: "info", message: response.message });
        setSubmitState("success");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus({
          tone: "error",
          message,
        });
        notify("error", message);
        setSubmitState("error");
      }
    },
    [
      attachmentsToRemove,
      briefDraft,
      handleStateUpdate,
      notify,
      pendingUploads,
      state,
    ]
  );

  useEffect(() => {
    const locationState = location.state as AdminLocationState;
    if (!locationState?.showLaunchPad) {
      return;
    }
    setShowLaunchPad(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const handleQueuedFilesChange = useCallback((files: File[]) => {
    setPendingUploads((previous) => {
      const previousById = new Map(previous.map((item) => [item.id, item]));
      const counts = new Map<string, number>();

      const next = files.map((file) => {
        const baseId = `${file.name}-${file.size}-${file.lastModified}`;
        const index = counts.get(baseId) ?? 0;
        counts.set(baseId, index + 1);
        const id = `${baseId}-${index}`;
        const rawType = file.type || "application/octet-stream";
        const normalizedType = rawType.toLowerCase();
        const isImage = normalizedType.startsWith("image/");
        const existing = previousById.get(id);
        const previewUrl = isImage
          ? existing?.previewUrl ?? URL.createObjectURL(file)
          : null;

        return {
          id,
          file,
          name: file.name,
          size: file.size,
          mimeType: rawType,
          isImage,
          previewUrl,
        } satisfies QueuedAttachment;
      });

      previousById.forEach((item, id) => {
        if (!next.some((candidate) => candidate.id === id) && item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });

      return next;
    });
  }, []);

  const pendingUploadsRef = useRef<QueuedAttachment[]>(pendingUploads);

  useEffect(() => {
    pendingUploadsRef.current = pendingUploads;
  }, [pendingUploads]);

  useEffect(() => {
    return () => {
      pendingUploadsRef.current.forEach((upload) => {
        if (upload.previewUrl) {
          URL.revokeObjectURL(upload.previewUrl);
        }
      });
    };
  }, []);

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

  const handleHistoryDelete = useCallback(
    async (entryId: string) => {
      try {
        const response = await deleteHistoryEntry(entryId);
        const message = response.message || "History entry deleted";
        if (!response.success) {
          throw new Error(message);
        }
        await loadHistory({ offset: 0, append: false, showMessage: false });
        setHistoryStatusMessage(message);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setHistoryStatusMessage(message);
        notify("error", message);
      }
    },
    [loadHistory, notify]
  );

  const handleHistoryDeleteAll = useCallback(async () => {
    if (historyPurgingAll) {
      return;
    }
    setHistoryPurgingAll(true);
    try {
      const response = await deleteAllHistoryEntries();
      const message = response.message || "History cleared";
      if (!response.success) {
        throw new Error(message);
      }
      await loadHistory({ offset: 0, append: false, showMessage: false });
      setHistoryStatusMessage(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHistoryStatusMessage(message);
      notify("error", message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setHistoryPurgingAll(false);
    }
  }, [historyPurgingAll, loadHistory, notify]);

  useEffect(() => {
    if (showSetupShell) {
      setActiveTab("brief");
      if (isAdminPath(location.pathname)) {
        const targetPath = createTabPath("brief");
        const currentPath = normalizeAdminPath(location.pathname);
        if (currentPath !== targetPath) {
          const search = location.search || "";
          navigate(`${targetPath}${search}`, { replace: true });
        }
      }
      setShowLaunchPad(false);
    }
  }, [showSetupShell, location.pathname, location.search, navigate]);

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

  const navigateToTab = useCallback(
    (tab: TabKey, options?: { replace?: boolean }) => {
      if (!isAdminPath(location.pathname)) {
        return;
      }
      const nextPath = createTabPath(tab);
      const currentPath = normalizeAdminPath(location.pathname);
      if (currentPath !== nextPath) {
        const search = location.search || "";
        navigate(`${nextPath}${search}`, { replace: options?.replace });
      } else if (options?.replace && location.search) {
        navigate(`${nextPath}${location.search}`, { replace: true });
      }
    },
    [location.pathname, location.search, navigate]
  );

  const handleTabClick = useCallback(
    (key: TabKey) => {
      setActiveTab(key);
      navigateToTab(key);
    },
    [navigateToTab]
  );

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const { key, currentTarget } = event;
      if (key === "ArrowRight" || key === "ArrowLeft") {
        event.preventDefault();
        const delta = key === "ArrowRight" ? 1 : -1;
        const nextIndex = (index + delta + TAB_ORDER.length) % TAB_ORDER.length;
        const nextKey = TAB_ORDER[nextIndex];
        setActiveTab(nextKey);
        navigateToTab(nextKey);
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
        const firstKey = TAB_ORDER[0];
        setActiveTab(firstKey);
        navigateToTab(firstKey);
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
        const lastKey = TAB_ORDER[lastIndex];
        setActiveTab(lastKey);
        navigateToTab(lastKey);
        const buttons =
          currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
            "[data-tab-key]"
          );
        const target = buttons?.[lastIndex];
        target?.focus();
      }
    },
    [navigateToTab]
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
              pendingUploads={pendingUploads}
              onToggleAttachment={handleToggleAttachment}
              onFilesChange={handleQueuedFilesChange}
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
              onDeleteEntry={handleHistoryDelete}
              onDeleteAll={handleHistoryDeleteAll}
              deletingAll={historyPurgingAll}
              hasMore={historyNextOffset != null}
              snapshotControls={
                <HistorySnapshotControls
                  exportJsonUrl={state.exportJsonUrl}
                  exportMarkdownUrl={state.exportMarkdownUrl}
                  onState={handleSnapshotHydrate}
                  onHistoryRefresh={handleHistoryRefresh}
                />
              }
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
      handleHistoryDelete,
      handleQueuedFilesChange,
      pendingUploads,
      providerSaving,
      providerStatus,
      runtimeSaving,
      runtimeStatus,
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
  const canLaunchApp = Boolean(state.providerReady && state.brief);
  const liveAppCtaTitle = canLaunchApp
    ? "Open the improvisational canvas in a new tab"
    : "Finish provider and brief setup to unlock the live app";

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
          The provider is verified and the brief is ready. Open the improvised
          app in a new tab or stay here to keep fine-tuning.
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
          Tips: adjust the brief anytime, swap providers in the tabs, and
          explore history to replay generated pages.
        </p>
      </div>
    </div>
  ) : null;

  if (showSetupShell) {
    if (showIntroStep) {
      return (
        <div className="admin-shell admin-shell--setup">
          <div className="setup-card setup-card--intro">
            <div className="setup-card__logo" aria-hidden="true">
              <div className="setup-card__logo-plate">
                <img src={vaporvibeLogoUrl} alt="" />
              </div>
            </div>
            <header className="setup-card__header">
              <span className="setup-card__step">Start here</span>
              <h1>Let's Spin Up a New Experience Together</h1>
              <p className="setup-card__description">
                VaporVibe spins up convincing web experiences from a short brief
                so you can pressure-test ideas without opening a code editor.
                Every run is a fresh take you can direct in real time.
              </p>
            </header>
            <div className="setup-card__intro-grid">
              <section className="setup-card__intro-panel">
                <h2>What VaporVibe does</h2>
                <ul className="setup-card__intro-list">
                  <li>
                    Improvises full, clickable prototypes using the model you
                    choose—perfect for pitching flows or exploring UX riffs.
                  </li>
                  <li>
                    Lets you remix on the fly: adjust the brief, swap models,
                    and relaunch within seconds to compare interpretations.
                  </li>
                  <li>
                    Keeps the workspace grounded with history, attachments, and
                    launch tools so you can share or revisit any run.
                  </li>
                </ul>
              </section>
              <section className="setup-card__intro-panel">
                <h2>What we need from you</h2>
                <ul className="setup-card__intro-list">
                  <li>
                    <strong>An API key</strong> for your preferred provider so
                    we can ask it to generate the experience securely.
                  </li>
                  <li>
                    <strong>A model selection</strong>—stick with a featured
                    pick or point us to a custom model tuned for your workflow.
                  </li>
                  <li>
                    <strong>Your brief and references</strong>: describe the
                    vibe, drop in a screenshot, napkin sketch, or PDF—anything
                    that sets the scene.
                  </li>
                </ul>
              </section>
            </div>
            <section className="setup-card__intro-panel setup-card__intro-panel--full">
              <h2>How we’ll use it</h2>
              <p>
                We send your brief, chosen model, and optional attachments
                straight to that provider’s API to produce each page. The
                responses live in your local history so you can replay, compare,
                or export them when you’re ready to share.
              </p>
              <p className="setup-card__intro-hint">
                Prefer to keep things lightweight? You can skip attachments and
                start with a short prompt—the wizard makes it easy to add more
                context later.
              </p>
            </section>
            <div className="setup-card__intro-actions">
              <button
                type="button"
                className="admin-primary"
                onClick={handleIntroAcknowledge}
              >
                Let’s get set up
              </button>
            </div>
          </div>
        </div>
      );
    }

    const providerButtonId = "setup-step-provider";
    const briefButtonId = "setup-step-brief";
    const heading =
      activeSetupStep === "provider"
        ? "Set up your canvas"
        : "Tell the model what to build";
    const description =
      activeSetupStep === "provider"
        ? "VaporVibe hosts a living web canvas improvised by your chosen provider. Verify a key so we can start riffing."
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
                pendingUploads={pendingUploads}
                onToggleAttachment={handleToggleAttachment}
                onFilesChange={handleQueuedFilesChange}
                uploaderKey={uploaderKey}
                onSubmit={handleBriefSubmit}
                extraContent={
                  <ResumeSessionCallout
                    onState={handleSnapshotHydrate}
                    onHistoryRefresh={handleHistoryRefresh}
                  />
                }
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
        <div className="admin-header__intro">
          <h1>vaporvibe Admin Console</h1>
          <p className="admin-subtitle">
            Fine-tune the brief, providers, runtime, and archives without
            restarting the server.
          </p>
        </div>
        <div className="admin-header__actions">
          <a
            href="/"
            target="_blank"
            rel="noreferrer noopener"
            className={`admin-live-cta${
              canLaunchApp ? "" : " admin-live-cta--disabled"
            }`}
            aria-disabled={canLaunchApp ? undefined : true}
            tabIndex={canLaunchApp ? 0 : -1}
            title={liveAppCtaTitle}
            onClick={(event) => {
              if (!canLaunchApp) {
                event.preventDefault();
              }
            }}
          >
            <span>Open Live App</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M5.5 3H13v7.5m0-7.5-7.75 7.75M3 13h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <span className="admin-live-cta__hint">
            {canLaunchApp
              ? "Launches the current improvisation in a new tab."
              : "Complete setup to unlock the live canvas."}
          </span>
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
  const { notify } = useNotifications();
  const provider = state.provider;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customModelConfigs, setCustomModelConfigs] = useState<
    Record<ProviderKey, CustomModelConfig>
  >({});
  const [customModelIds, setCustomModelIds] = useState<
    Record<ProviderKey, string>
  >({});
  const currentProvider = provider.provider as ProviderKey;

  useEffect(() => {
    setCustomModelConfigs((prev) => {
      if (prev[currentProvider]) {
        return prev;
      }
      return {
        ...prev,
        [currentProvider]: createDefaultCustomConfig(),
      };
    });
  }, [currentProvider]);

  useEffect(() => {
    const catalog = state.modelCatalog[currentProvider] ?? [];
    const isCurated = catalog.some(
      (item) => item.value === state.provider.model
    );
    const currentValue = state.provider.model ?? "";

    setCustomModelIds((prev) => {
      const existing = prev[currentProvider];
      if (isCurated) {
        if (existing !== undefined) {
          return prev;
        }
        return {
          ...prev,
          [currentProvider]: "",
        };
      }
      if (existing === currentValue) {
        return prev;
      }
      return {
        ...prev,
        [currentProvider]: currentValue,
      };
    });
  }, [currentProvider, state.modelCatalog, state.provider.model]);

  const currentCustomConfig =
    customModelConfigs[currentProvider] ?? DEFAULT_CUSTOM_MODEL_CONFIG;
  const currentCustomId = customModelIds[currentProvider] ?? "";

  const providerUnlockedMap = useMemo(() => {
    const entries = (
      Object.keys(state.providerKeyStatuses) as ProviderKey[]
    ).map((key) => {
      const status = state.providerKeyStatuses[key];
      const unlocked = Boolean(status?.verified || status?.hasKey);
      return [key, unlocked] as const;
    });
    return Object.fromEntries(entries) as Record<string, boolean>;
  }, [state.providerKeyStatuses]);
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
      const providerReasoningModes = state.providerReasoningModes[target] ?? [];
      const modelList = state.modelCatalog[target] ?? [];

      const resolvedModel =
        targetModel !== undefined
          ? targetModel
          : target === provider.provider
          ? state.provider.model
          : undefined;
      const hasModelSelection = resolvedModel !== undefined;
      const selectedModel =
        hasModelSelection && resolvedModel
          ? modelList.find((item) => item.value === resolvedModel)
          : undefined;

      const isCustomModel =
        hasModelSelection && (!selectedModel || resolvedModel === "");
      const customConfig = isCustomModel
        ? customModelConfigs[target] ?? DEFAULT_CUSTOM_MODEL_CONFIG
        : undefined;

      const modelReasoning = selectedModel?.reasoningTokens;
      const modelMaxTokens = selectedModel?.maxOutputTokens;
      const modelReasoningModes = selectedModel?.reasoningModes;

      const combinedMaxTokens = (() => {
        if (isCustomModel) {
          return undefined;
        }
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
        : Boolean(customConfig?.supportsReasoning && tokensSupportedByProvider);
      const reasoningTokensSupported =
        tokensSupportedByProvider && tokensSupportedByModel;
      const usingModelGuidance =
        reasoningTokensSupported &&
        Boolean(selectedModel && modelReasoning?.supported);

      const reasoningTokensGuidance = (() => {
        if (!reasoningTokensSupported) {
          return undefined;
        }
        if (usingModelGuidance) {
          return modelReasoning;
        }
        if (isCustomModel) {
          if (providerReasoning) {
            return {
              ...providerReasoning,
              min: undefined,
              max: undefined,
              supported: true,
              allowDisable:
                providerReasoning.allowDisable !== false
                  ? providerReasoning.allowDisable
                  : true,
            };
          }
          return { supported: true };
        }
        if (providerReasoning?.supported) {
          return providerReasoning;
        }
        return undefined;
      })();

      const reasoningToggleAllowed = reasoningTokensSupported
        ? isCustomModel
          ? true
          : reasoningTokensGuidance?.allowDisable !== false
        : false;

      const providerSupportsModes = Boolean(capability.mode);
      const customSupportsModes =
        Boolean(customConfig?.supportsReasoningMode) && providerSupportsModes;
      const modelSupportsModes = selectedModel?.supportsReasoningMode === true;

      const availableReasoningModes = (() => {
        if (modelReasoningModes && modelReasoningModes.length > 0) {
          return modelReasoningModes;
        }
        if (isCustomModel) {
          if (customSupportsModes && providerReasoningModes.length > 0) {
            return providerReasoningModes;
          }
          return ["none"] as string[];
        }
        if (
          providerSupportsModes &&
          ((modelSupportsModes && providerReasoningModes.length > 0) ||
            (!selectedModel && providerReasoningModes.length > 0))
        ) {
          return providerReasoningModes;
        }
        return undefined;
      })();

      const reasoningModesSupported = Boolean(
        availableReasoningModes?.some((mode) => mode !== "none")
      );
      const showReasoningModeControl = Boolean(
        availableReasoningModes?.some((mode) => mode !== "none")
      );

      const guidanceSource = (() => {
        if (usingModelGuidance) return "model" as const;
        if (reasoningTokensSupported && providerReasoning?.supported) {
          return "provider" as const;
        }
        if (isCustomModel && reasoningTokensSupported) {
          return "provider" as const;
        }
        return "none" as const;
      })();

      const providerReasoningGuidance = providerReasoning?.supported
        ? providerReasoning
        : undefined;

      return {
        defaultMax,
        maxTokensGuidance: combinedMaxTokens,
        reasoningTokensGuidance,
        reasoningTokensSupported,
        reasoningToggleAllowed,
        reasoningModesSupported,
        showReasoningModeControl,
        availableReasoningModes,
        modelMetadata: selectedModel,
        providerReasoningGuidance,
        guidanceSource,
        isCustomModel,
      } as const;
    },
    [
      provider.provider,
      state.provider.model,
      state.defaultMaxOutputTokens,
      state.modelCatalog,
      state.providerReasoningCapabilities,
      state.providerReasoningModes,
      state.providerTokenGuidance,
      customModelConfigs,
    ]
  );

  const sanitizeMaxOutputTokens = useCallback(
    (
      raw: number | null | undefined,
      target: ProviderKey,
      targetModel?: string
    ) => {
      const guidance = computeGuidance(target, targetModel);
      const fallbackBase =
        guidance.defaultMax ?? state.defaultMaxOutputTokens[target] ?? 1024;

      if (guidance.isCustomModel) {
        if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
          return Math.floor(raw);
        }
        return Math.max(1, Math.floor(fallbackBase));
      }

      const fallback = guidance.maxTokensGuidance?.default ?? fallbackBase;
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
        value = Math.max(1, Math.floor(fallbackBase));
      }
      return value;
    },
    [computeGuidance, state.defaultMaxOutputTokens]
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
      if (guidance.isCustomModel) {
        if (raw === null || raw === undefined) {
          return undefined;
        }
        const numeric = Number(raw);
        if (!Number.isFinite(numeric)) {
          return undefined;
        }
        let value = Math.floor(numeric);
        if (target === "gemini") {
          if (value < -1) {
            value = -1;
          }
        } else if (value < 0) {
          value = 0;
        }
        return value;
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
  const [verifying, setVerifying] = useState<AsyncStatus>("idle");
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
    setVerifying("idle");
  }, [
    provider.provider,
    provider.reasoningTokensEnabled,
    currentGuidance.reasoningTokensSupported,
    currentGuidance.reasoningToggleAllowed,
  ]);

  const providerUnlocked = providerUnlockedMap[currentProvider] ?? false;

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
  const availableReasoningModes = currentGuidance.availableReasoningModes;
  const reasoningModeChoices = useMemo(() => {
    if (!availableReasoningModes || availableReasoningModes.length === 0) {
      return state.reasoningModeChoices;
    }
    return state.reasoningModeChoices.filter((choice) =>
      availableReasoningModes.includes(choice.value)
    );
  }, [availableReasoningModes, state.reasoningModeChoices]);
  const safeReasoningMode = currentGuidance.reasoningModesSupported
    ? availableReasoningModes && availableReasoningModes.length > 0
      ? (() => {
          const currentMode = provider.reasoningMode ?? "none";
          if (
            availableReasoningModes.includes(currentMode) &&
            !(
              currentMode === "none" &&
              availableReasoningModes.includes("default")
            )
          ) {
            return currentMode;
          }
          if (availableReasoningModes.includes("default")) {
            return "default" as const;
          }
          const firstNonNone = availableReasoningModes.find(
            (mode) => mode !== "none"
          );
          if (firstNonNone) {
            return firstNonNone;
          }
          return availableReasoningModes[0];
        })()
      : provider.reasoningMode ?? "none"
    : "none";

  useEffect(() => {
    if (!currentGuidance.reasoningModesSupported) {
      if (provider.reasoningMode !== "none") {
        onState({
          ...state,
          provider: {
            ...state.provider,
            reasoningMode: "none",
          },
        });
      }
      return;
    }
    if (
      availableReasoningModes &&
      availableReasoningModes.length > 0 &&
      !availableReasoningModes.includes(provider.reasoningMode)
    ) {
      onState({
        ...state,
        provider: {
          ...state.provider,
          reasoningMode: safeReasoningMode,
        },
      });
    }
  }, [
    availableReasoningModes,
    currentGuidance.reasoningModesSupported,
    provider.reasoningMode,
    safeReasoningMode,
    onState,
    state,
  ]);

  const applyProviderDefaults = useCallback(
    (nextProvider: ProviderKey, hintedModel?: string) => {
      const desiredModel =
        hintedModel !== undefined
          ? hintedModel
          : state.defaultModelByProvider[nextProvider] ?? provider.model;
      const sanitizedMaxTokens = sanitizeMaxOutputTokens(
        state.defaultMaxOutputTokens[nextProvider] ?? provider.maxOutputTokens,
        nextProvider,
        desiredModel
      );
      const guidance = computeGuidance(nextProvider, desiredModel);

      const availableModes = guidance.availableReasoningModes ?? [];
      let nextReasoningMode = provider.reasoningMode ?? "none";
      if (!availableModes.includes(nextReasoningMode)) {
        if (availableModes.includes("default")) {
          nextReasoningMode = "default";
        } else if (availableModes.includes("low")) {
          nextReasoningMode = "low";
        } else if (availableModes.length > 0) {
          nextReasoningMode = availableModes[0];
        } else {
          nextReasoningMode = "none";
        }
      }

      const tokensSupported = guidance.reasoningTokensSupported;
      const allowToggle = guidance.reasoningToggleAllowed;
      const providerMatches = provider.provider === nextProvider;
      const nextReasoningEnabled = tokensSupported
        ? allowToggle
          ? providerMatches
            ? provider.reasoningTokensEnabled !== false
            : true
          : true
        : false;
      let nextReasoningTokens: number | undefined;
      if (tokensSupported) {
        const baseTokens = providerMatches
          ? provider.reasoningTokens
          : guidance.reasoningTokensGuidance?.default;
        const sanitized = sanitizeReasoningTokens(
          typeof baseTokens === "number" ? baseTokens : undefined,
          nextProvider,
          desiredModel
        );
        if (sanitized !== undefined) {
          nextReasoningTokens = sanitized;
        } else if (
          typeof guidance.reasoningTokensGuidance?.default === "number"
        ) {
          nextReasoningTokens = guidance.reasoningTokensGuidance.default;
        }
      }

      const providerChanged = provider.provider !== nextProvider;

      const updated: AdminStateResponse = {
        ...state,
        provider: {
          ...state.provider,
          provider: nextProvider,
          model: desiredModel,
          maxOutputTokens: sanitizedMaxTokens,
          reasoningMode: nextReasoningMode,
          reasoningTokens: tokensSupported ? nextReasoningTokens : undefined,
          reasoningTokensEnabled: tokensSupported
            ? nextReasoningEnabled
            : false,
        },
      };

      if (providerChanged) {
        const keyStatus = state.providerKeyStatuses[nextProvider];
        let nextMask = "not set";
        if (keyStatus?.verified) {
          nextMask = "verified key on file";
        } else if (keyStatus?.hasKey) {
          nextMask = "key stored securely";
        }
        updated.provider.apiKeyMask = nextMask;
      }

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

  const customConfigSignature = useMemo(
    () => JSON.stringify(currentCustomConfig),
    [currentCustomConfig]
  );
  const lastCustomConfigSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentGuidance.isCustomModel) {
      lastCustomConfigSignatureRef.current = customConfigSignature;
      return;
    }
    if (lastCustomConfigSignatureRef.current === customConfigSignature) {
      return;
    }
    lastCustomConfigSignatureRef.current = customConfigSignature;
    applyProviderDefaults(currentProvider, state.provider.model);
  }, [
    applyProviderDefaults,
    currentGuidance.isCustomModel,
    currentProvider,
    customConfigSignature,
    state.provider.model,
  ]);

  const handleCustomConfigChange = useCallback(
    (next: CustomModelConfig) => {
      setCustomModelConfigs((prev) => ({
        ...prev,
        [currentProvider]: next,
      }));
    },
    [currentProvider]
  );

  const handleCustomModelIdChange = useCallback(
    (nextId: string) => {
      setCustomModelIds((prev) => ({
        ...prev,
        [currentProvider]: nextId,
      }));
      applyProviderDefaults(currentProvider, nextId);
    },
    [applyProviderDefaults, currentProvider]
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

  const resolveApiKeyMask = useCallback(
    (status: { hasKey: boolean; verified: boolean } | undefined) => {
      if (status?.verified) {
        return "verified key on file";
      }
      if (status?.hasKey) {
        return "key stored securely";
      }
      return "not set";
    },
    []
  );

  const handleVerify = async () => {
    if (verifying === "loading") {
      return;
    }

    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      const message = "Enter an API key to verify.";
      onStatus({ tone: "error", message });
      notify("error", message);
      setVerifying("error");
      return;
    }

    setVerifying("loading");
    onStatus(null);
    try {
      const response = await verifyProviderKey({
        provider: provider.provider,
        apiKey: trimmedKey,
      });
      if (!response.success) {
        throw new Error(response.message || "Provider key verification failed");
      }
      if (response.state) {
        const serverState = response.state;
        const serverProvider = serverState.provider.provider;
        const currentProviderKey = provider.provider as ProviderKey;
        if (serverProvider === provider.provider) {
          onState(serverState);
        } else {
          const nextMask = resolveApiKeyMask(
            serverState.providerKeyStatuses[currentProviderKey]
          );
          onState({
            ...serverState,
            provider: {
              ...state.provider,
              apiKeyMask: nextMask,
            },
          });
        }
      }
      setApiKey("");
      onStatus({ tone: "info", message: response.message });
      setVerifying("success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onStatus({ tone: "error", message });
      notify("error", message);
      setVerifying("error");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaving("loading");
    onStatus(null);

    if (apiKey.trim()) {
      const message = "Verify the API key before saving.";
      onStatus({ tone: "error", message });
      notify("error", message);
      onSaving("error");
      return;
    }

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
      ? safeReasoningMode
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
      const message = error instanceof Error ? error.message : String(error);
      onStatus({
        tone: "error",
        message,
      });
      notify("error", message);
      onSaving("error");
    }
  };

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
          providerStatuses={state.providerKeyStatuses}
          providerUnlockedMap={providerUnlockedMap}
          customConfig={currentCustomConfig}
          customModelId={currentCustomId}
          customDescription={state.customModelDescription}
          disableProviderSelection={!canSelectProvider}
          onCustomConfigChange={handleCustomConfigChange}
          onCustomModelIdChange={handleCustomModelIdChange}
          onProviderChange={(nextProvider, nextModel) => {
            applyProviderDefaults(nextProvider as ProviderKey, nextModel);
          }}
          onModelChange={(nextModel) => {
            applyProviderDefaults(currentProvider, nextModel);
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

        <details
          className="admin-advanced"
          open={advancedOpen}
          onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
        >
          <summary className="admin-advanced__summary">
            <span className="admin-advanced__title">
              Advanced Model Settings
            </span>
            <span className="admin-advanced__hint">
              Tune output limits & reasoning
            </span>
            <span className="admin-advanced__chevron" aria-hidden="true" />
          </summary>
          <div className="admin-advanced__body">
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

            {currentGuidance.showReasoningModeControl ? (
              <label className="admin-field">
                <span className="admin-field__label">Reasoning mode</span>
                <select
                  name="reasoningMode"
                  value={safeReasoningMode}
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
                  {reasoningModeChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
                <p className="admin-field__helper">
                  {
                    reasoningModeChoices.find(
                      (choice) => choice.value === safeReasoningMode
                    )?.description
                  }
                </p>
              </label>
            ) : null}

            {currentGuidance.reasoningTokensSupported ? (
              <>
                {currentGuidance.reasoningToggleAllowed ? (
                  <label className="admin-field admin-field--row">
                    <span className="admin-field__label">Reasoning tokens</span>
                    <div className="admin-toggle">
                      <input
                        type="checkbox"
                        checked={effectiveReasoningEnabled}
                        onChange={(event) =>
                          handleReasoningToggle(event.target.checked)
                        }
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
                      This model always applies a deliberate reasoning
                      budget—adjust the cap below.
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
                  defaultValue={
                    currentGuidance.reasoningTokensGuidance?.default
                  }
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
            ) : null}
          </div>
        </details>

        <div className="admin-actions">
          {providerUnlocked ? (
            <>
              {apiKey.trim() ? (
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={handleVerify}
                  disabled={verifying === "loading"}
                >
                  {verifying === "loading" ? "Verifying…" : "Verify key"}
                </button>
              ) : null}
              <button
                type="submit"
                className="admin-primary"
                disabled={saving === "loading" || verifying === "loading"}
              >
                {saving === "loading" ? "Saving…" : "Save provider"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="admin-primary"
              onClick={handleVerify}
              disabled={verifying === "loading" || !apiKey.trim()}
            >
              {verifying === "loading" ? "Verifying…" : "Verify key"}
            </button>
          )}
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
  pendingUploads: QueuedAttachment[];
  onToggleAttachment: (id: string) => void;
  onFilesChange: (files: File[]) => void;
  uploaderKey: number;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  extraContent?: React.ReactNode;
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
  pendingUploads,
  onToggleAttachment,
  onFilesChange,
  uploaderKey,
  onSubmit,
  extraContent,
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
            Bring the vibe to life with visual cues—wireframes, napkin sketches,
            mood boards, brand palettes, flow diagrams, or product photos.
          </p>

          <AttachmentUploader
            key={uploaderKey}
            name="briefAttachments"
            label="Drop visual references"
            hint="Paste or upload sketches, storyboards, flow diagrams, or brand shots to steer the improvisation."
            variant="creative"
            captureDocumentPaste
            examples={[
              "Wireframes",
              "Mood boards",
              "Style guides",
              "Product photos",
            ]}
            onFilesChange={onFilesChange}
          />

          {pendingUploads.length > 0 && (
            <div className="admin-attachment-grid admin-attachment-grid--pending">
              {pendingUploads.map((upload) => (
                <PendingAttachmentCard key={upload.id} upload={upload} />
              ))}
            </div>
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

        {extraContent ? (
          <div className="brief-extra-slot">{extraContent}</div>
        ) : null}

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

interface PendingAttachmentCardProps {
  upload: QueuedAttachment;
}

function PendingAttachmentCard({ upload }: PendingAttachmentCardProps) {
  const sizeInKb = Math.max(1, Math.round(upload.size / 1024));

  return (
    <div className="admin-attachment-card admin-attachment-card--pending">
      <div className="admin-attachment-card__preview" aria-hidden="true">
        {upload.isImage && upload.previewUrl ? (
          <img src={upload.previewUrl} alt={upload.name} loading="lazy" />
        ) : (
          <span className="admin-attachment-card__icon">📄</span>
        )}
      </div>
      <div className="admin-attachment-card__meta">
        <span className="admin-attachment-card__name">{upload.name}</span>
        <span className="admin-attachment-card__details">
          {upload.mimeType} · {sizeInKb} KB
        </span>
      </div>
      <div className="admin-attachment-card__badge">Queued upload</div>
    </div>
  );
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
  const { notify } = useNotifications();
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
      const message = error instanceof Error ? error.message : String(error);
      onStatus({
        tone: "error",
        message,
      });
      notify("error", message);
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
              Once this threshold is exceeded, older entries will be trimmed (
              {HISTORY_MAX_BYTES_MIN.toLocaleString()}–
              {HISTORY_MAX_BYTES_MAX.toLocaleString()} bytes, default{" "}
              {DEFAULT_HISTORY_MAX_BYTES.toLocaleString()})
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

export default AdminDashboard;
