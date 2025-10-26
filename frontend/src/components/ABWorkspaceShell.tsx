import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import {
  discardAbFork,
  fetchAdminState,
  keepAbForkVersion,
} from "../api/admin";
import type { AdminActiveForkSummary } from "../api/types";
import { useNotifications } from "./Notifications";
import ConfirmationModal from "./ConfirmationModal";

import "./ABTesting.css";

const BRANCH_FIELD = "__vaporvibe_branch";

type BranchLabel = "A" | "B";

type BranchInfo = {
  branchId: string;
  label: BranchLabel;
  instructions: string;
};

type SplitterArrowState = {
  icon: string;
  ariaLabel: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
  pressed: boolean;
  ariaHidden?: boolean;
};

type ConfirmationState =
  | { type: "keep"; branch: BranchInfo }
  | { type: "discard" };

type ResolvingState =
  | { type: "keep"; branch: BranchInfo; message: string; detail?: string }
  | { type: "discard"; message: string; detail?: string };

interface ABWorkspaceShellProps {
  forkId: string;
  initialBranchA?: string;
  initialBranchB?: string;
  sourcePathParam?: string;
}

const sanitizePath = (input?: string | null): string => {
  if (!input) {
    return "/";
  }
  let decoded = input;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    decoded = input;
  }
  try {
    const url = new URL(decoded, window.location.origin);
    url.searchParams.delete(BRANCH_FIELD);
    url.searchParams.delete("__vaporvibe");
    return `${url.pathname}${url.search}` || "/";
  } catch {
    return decoded.startsWith("/") ? decoded : `/${decoded}`;
  }
};

const buildBranchUrl = (basePath: string, branchId: string): string => {
  const url = new URL(basePath, window.location.origin);
  url.searchParams.set("__vaporvibe", "interceptor");
  url.searchParams.set(BRANCH_FIELD, branchId);
  return `${url.pathname}${url.search}`;
};

function summarizeInstructions(branches: BranchInfo[]): string {
  return branches
    .map((branch) => {
      const snippet = branch.instructions.trim();
      const truncated =
        snippet.length > 80 ? `${snippet.slice(0, 77)}…` : snippet || "(no instructions)";
      return `${branch.label}: "${truncated}"`;
    })
    .join(" · ");
}

const formatInstructionSnippet = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "(no instructions provided)";
  }
  return trimmed.length > 90 ? `${trimmed.slice(0, 87)}…` : trimmed;
};

export function ABWorkspaceShell({
  forkId,
  initialBranchA,
  initialBranchB,
  sourcePathParam,
}: ABWorkspaceShellProps) {
  const { notify } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AdminActiveForkSummary | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(
    null
  );
  const [resolving, setResolving] = useState<ResolvingState | null>(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const [viewMode, setViewMode] = useState<"split" | "a-full" | "b-full">(
    "split"
  );
  const framesRef = useRef<HTMLDivElement | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  const normalizedSource = useMemo(
    () => sanitizePath(sourcePathParam),
    [sourcePathParam]
  );

  useEffect(() => {
    document.body.dataset.abTestActive = "true";
    return () => {
      delete document.body.dataset.abTestActive;
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
      }
    };
  }, []);

  useEffect(() => {
    if (viewMode !== "split" && resizeCleanupRef.current) {
      resizeCleanupRef.current();
    }
  }, [viewMode]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await fetchAdminState();
      const active = state.activeForks.find((fork) => fork.forkId === forkId);
      if (!active) {
        throw new Error("This A/B comparison is no longer active.");
      }
      setSummary(active);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load A/B fork details.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [forkId]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const branches: BranchInfo[] = useMemo(() => {
    if (!summary) {
      const fallback: BranchInfo[] = [];
      if (initialBranchA) {
        fallback.push({
          branchId: initialBranchA,
          label: "A",
          instructions: "",
        });
      }
      if (initialBranchB) {
        fallback.push({
          branchId: initialBranchB,
          label: "B",
          instructions: "",
        });
      }
      return fallback;
    }
    return summary.branches.map((branch) => ({
      branchId: branch.branchId,
      label: branch.label,
      instructions: branch.instructions,
    }));
  }, [initialBranchA, initialBranchB, summary]);

  const branchA = branches.find((branch) => branch.label === "A");
  const branchB = branches.find((branch) => branch.label === "B");

  const branchInstructionsSummary = useMemo(
    () => summarizeInstructions(branches),
    [branches]
  );

  const handleSplitterMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (viewMode !== "split") {
        return;
      }
      const container = framesRef.current;
      if (!container) {
        return;
      }
      event.preventDefault();

      const updateFromClientX = (clientX: number) => {
        const rect = container.getBoundingClientRect();
        const relativeX = clientX - rect.left;
        const nextPercent = (relativeX / rect.width) * 100;
        const clamped = Math.max(0, Math.min(100, nextPercent));
        setSplitPercent(clamped);
      };

      updateFromClientX(event.clientX);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        updateFromClientX(moveEvent.clientX);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.classList.remove("is-resizing");
        resizeCleanupRef.current = null;
      };

      resizeCleanupRef.current = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.classList.remove("is-resizing");
      };

      document.body.classList.add("is-resizing");
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [viewMode]
  );

  useEffect(() => {
    return () => {
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
      }
    };
  }, []);

  const showSplit = useCallback(() => {
    setSplitPercent(50);
    setViewMode("split");
  }, []);

  const showBranchFull = useCallback((mode: "a-full" | "b-full") => {
    setViewMode(mode);
  }, []);

  const framesClassName = useMemo(() => {
    let base = "ab-workspace__frames";
    if (viewMode === "a-full") {
      base += " show-a-full";
    } else if (viewMode === "b-full") {
      base += " show-b-full";
    }
    return base;
  }, [viewMode]);

  const leftArrowState: SplitterArrowState = useMemo(() => {
    if (viewMode === "b-full") {
      return {
        icon: "↔",
        ariaLabel: "Return to split view",
        title: "Return to split view",
        disabled: false,
        onClick: showSplit,
        pressed: true,
      };
    }
    return {
      icon: "‹",
      ariaLabel: "Expand Version B to full width",
      title: "Expand Version B to full width",
      disabled: viewMode === "a-full",
      ariaHidden: viewMode === "a-full",
      onClick: () => showBranchFull("b-full"),
      pressed: false,
    };
  }, [showBranchFull, showSplit, viewMode]);

  const rightArrowState: SplitterArrowState = useMemo(() => {
    if (viewMode === "a-full") {
      return {
        icon: "↔",
        ariaLabel: "Return to split view",
        title: "Return to split view",
        disabled: false,
        onClick: showSplit,
        pressed: true,
      };
    }
    return {
      icon: "›",
      ariaLabel: "Expand Version A to full width",
      title: "Expand Version A to full width",
      disabled: viewMode === "b-full",
      ariaHidden: viewMode === "b-full",
      onClick: () => showBranchFull("a-full"),
      pressed: false,
    };
  }, [showBranchFull, showSplit, viewMode]);

  const handleReload = useCallback(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const startKeepFlow = useCallback(
    (branch: BranchInfo) => {
      setConfirmation({ type: "keep", branch });
    },
    []
  );

  const startDiscardFlow = useCallback(() => {
    setConfirmation({ type: "discard" });
  }, []);

  const closeConfirmation = useCallback(() => {
    setConfirmation(null);
  }, []);

  const redirectToSource = useCallback(() => {
    const target = normalizedSource || "/";
    window.location.href = target;
  }, [normalizedSource]);

  const handleConfirmKeep = useCallback(async () => {
    if (!confirmation || confirmation.type !== "keep") {
      return;
    }
    const branch = confirmation.branch;
    setResolving({
      type: "keep",
      branch,
      message: "Merging history…",
      detail: `Bringing Version ${branch.label} back into the main timeline.`,
    });
    try {
      await keepAbForkVersion(forkId, branch.branchId);
      setResolving({
        type: "keep",
        branch,
        message: "Redirecting to the updated page…",
        detail: `Version ${branch.label} is now canonical.`,
      });
      window.setTimeout(() => {
        redirectToSource();
      }, 300);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to keep the selected version.";
      notify("error", message);
      setResolving(null);
    } finally {
      setConfirmation(null);
    }
  }, [confirmation, forkId, notify, redirectToSource]);

  const handleConfirmDiscard = useCallback(async () => {
    setResolving({
      type: "discard",
      message: "Discarding both versions…",
      detail: "We’ll return you to the page before the comparison.",
    });
    try {
      await discardAbFork(forkId);
      setResolving({
        type: "discard",
        message: "Redirecting back…",
        detail: "All comparison data cleared.",
      });
      window.setTimeout(() => {
        redirectToSource();
      }, 300);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to discard the comparison.";
      notify("error", message);
      setResolving(null);
    } finally {
      setConfirmation(null);
    }
  }, [forkId, notify, redirectToSource]);

  if (loading && !summary && !error) {
    return (
      <div className="ab-workspace ab-workspace--loading" role="status">
        <div className="ab-workspace__loading">
          <div className="ab-workspace__spinner" aria-hidden="true" />
          <p>Loading A/B comparison details…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ab-workspace ab-workspace--error">
        <div className="ab-workspace__error">
          <h1>A/B comparison unavailable</h1>
          <p>{error}</p>
          <button
            type="button"
            className="ab-workspace__action admin-primary"
            onClick={handleReload}
          >
            Retry
          </button>
          <button
            type="button"
            className="ab-workspace__action admin-secondary"
            onClick={redirectToSource}
          >
            Return to app
          </button>
        </div>
      </div>
    );
  }

  if (!branchA || !branchB) {
    return (
      <div className="ab-workspace ab-workspace--error">
        <div className="ab-workspace__error">
          <h1>Missing branch context</h1>
          <p>The server did not provide both branches for this comparison.</p>
          <button
            type="button"
            className="ab-workspace__action admin-secondary"
            onClick={redirectToSource}
          >
            Return to app
          </button>
        </div>
      </div>
    );
  }

  const createdAt = summary
    ? new Date(summary.createdAt).toLocaleString()
    : new Date().toLocaleString();

  const branchAUrl = buildBranchUrl(normalizedSource, branchA.branchId);
  const branchBUrl = buildBranchUrl(normalizedSource, branchB.branchId);

  return (
    <div className="ab-workspace">
      <header className="ab-workspace__toolbar">
        <div className="ab-workspace__toolbar-info">
          <div className="ab-workspace__toolbar-title">A/B Comparison Mode ↔️</div>
          <div className="ab-workspace__toolbar-meta">
            Comparing changes based on page from {createdAt}
          </div>
          <div className="ab-workspace__toolbar-summary">{branchInstructionsSummary}</div>
        </div>
        <div className="ab-workspace__toolbar-actions">
          <button
            type="button"
            className="ab-workspace__action admin-danger"
            onClick={startDiscardFlow}
          >
            Discard Both &amp; Go Back 🗑️
          </button>
        </div>
      </header>

      <main
        className={framesClassName}
        ref={framesRef}
        style={
          viewMode === "split"
            ? {
                gridTemplateColumns: `${splitPercent}fr 12px ${100 - splitPercent}fr`,
              }
            : undefined
        }
      >
        <section
          className="ab-workspace__frame ab-workspace__frame--a"
          aria-label="Version A preview"
        >
          <header className="ab-workspace__frame-header">
            <div className="ab-workspace__frame-header-top">
              <span className="ab-workspace__badge">Version A</span>
              <p className="ab-workspace__frame-instructions">
                {branchA.instructions.trim() || "No additional instructions provided."}
              </p>
            </div>
            <div className="ab-workspace__frame-actions">
              <button
                type="button"
                className="ab-workspace__keep-button admin-primary"
                onClick={() => startKeepFlow(branchA)}
              >
                Select Version A
              </button>
            </div>
          </header>
          <iframe
            key={branchA.branchId}
            src={branchAUrl}
            data-ab-workspace="true"
            data-vaporvibe-branch={branchA.branchId}
            title="Version A"
          />
        </section>
        <div className="ab-workspace__splitter">
          <button
            type="button"
            className="ab-workspace__splitter-arrow left"
            aria-label={leftArrowState.ariaLabel}
            aria-pressed={leftArrowState.pressed}
            title={leftArrowState.title}
            onClick={leftArrowState.onClick}
            disabled={leftArrowState.disabled}
            aria-hidden={leftArrowState.ariaHidden || undefined}
            tabIndex={leftArrowState.ariaHidden ? -1 : 0}
          >
            {leftArrowState.icon}
          </button>
          <div
            className="ab-workspace__splitter-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize comparison frames"
            onMouseDown={handleSplitterMouseDown}
          />
          <button
            type="button"
            className="ab-workspace__splitter-arrow right"
            aria-label={rightArrowState.ariaLabel}
            aria-pressed={rightArrowState.pressed}
            title={rightArrowState.title}
            onClick={rightArrowState.onClick}
            disabled={rightArrowState.disabled}
            aria-hidden={rightArrowState.ariaHidden || undefined}
            tabIndex={rightArrowState.ariaHidden ? -1 : 0}
          >
            {rightArrowState.icon}
          </button>
        </div>
        <section
          className="ab-workspace__frame ab-workspace__frame--b"
          aria-label="Version B preview"
        >
          <header className="ab-workspace__frame-header">
            <div className="ab-workspace__frame-header-top">
              <span className="ab-workspace__badge">Version B</span>
              <p className="ab-workspace__frame-instructions">
                {branchB.instructions.trim() || "No additional instructions provided."}
              </p>
            </div>
            <div className="ab-workspace__frame-actions">
              <button
                type="button"
                className="ab-workspace__keep-button admin-primary"
                onClick={() => startKeepFlow(branchB)}
              >
                Select Version B
              </button>
            </div>
          </header>
          <iframe
            key={branchB.branchId}
            src={branchBUrl}
            data-ab-workspace="true"
            data-vaporvibe-branch={branchB.branchId}
            title="Version B"
          />
        </section>
      </main>

      <ConfirmationModal
        open={confirmation?.type === "keep"}
        title={
          confirmation?.type === "keep"
            ? `Keep Version ${confirmation.branch.label}?`
            : ""
        }
        description={
          confirmation?.type === "keep"
            ? (
                <>
                  <p>
                    This will save the history from Version {confirmation.branch.label}
                    {" "}
                    and permanently discard Version
                    {" "}
                    {confirmation.branch.label === "A" ? "B" : "A"}.
                  </p>
                  <p className="ab-modal__note">
                    Based on instruction: "
                    {formatInstructionSnippet(confirmation.branch.instructions)}"
                  </p>
                </>
              )
            : undefined
        }
        confirmLabel={
          confirmation?.type === "keep"
            ? `Confirm & Keep Version ${confirmation.branch.label}`
            : ""
        }
        confirmTone="primary"
        onConfirm={handleConfirmKeep}
        onCancel={closeConfirmation}
      />

      <ConfirmationModal
        open={confirmation?.type === "discard"}
        title="Discard Both Versions?"
        description="This will permanently delete both A/B test versions and return you to the page you were on before starting the test."
        confirmLabel="Confirm & Discard Both"
        confirmTone="danger"
        onConfirm={handleConfirmDiscard}
        onCancel={closeConfirmation}
      />

      {resolving ? (
        <div className="ab-workspace__overlay" role="alert">
          <div className="ab-workspace__overlay-card">
            <div className="ab-workspace__overlay-spinner" aria-hidden="true" />
            <div className="ab-workspace__overlay-message">{resolving.message}</div>
            {resolving.detail ? (
              <div className="ab-workspace__overlay-detail">{resolving.detail}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ABWorkspaceShell;
