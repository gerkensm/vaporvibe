import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const COMPACT_BREAKPOINT = 800;
const DEFAULT_SPLIT_PERCENT = 50;
const SPLITTER_GAP = 12;
const MIN_FRAME_WIDTH = 360;
const COMPACT_HYSTERESIS_PX = 32;

type BranchLabel = "A" | "B";

type BranchInfo = {
  branchId: string;
  label: BranchLabel;
  instructions: string;
};

type SplitterArrowState =
  | {
      icon: string;
      ariaLabel: string;
      title: string;
      disabled: boolean;
      onClick: () => void;
      pressed: boolean;
    }
  | { hidden: true };

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
  const [splitPercent, setSplitPercent] = useState(DEFAULT_SPLIT_PERCENT);
  const [viewMode, setViewMode] = useState<"split" | "a-full" | "b-full">(
    "split"
  );
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const framesRef = useRef<HTMLDivElement | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const lastSplitPercentRef = useRef(splitPercent);
  const splitRafRef = useRef<number | null>(null);
  const pendingSplitPercentRef = useRef<number | null>(null);
  const containerWidthRef = useRef<number>(0);

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

  const applySplitBounds = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    const width = containerWidthRef.current;
    if (!width) {
      return clamped;
    }
    const available = Math.max(0, width - SPLITTER_GAP);
    if (available <= 0) {
      return DEFAULT_SPLIT_PERCENT;
    }
    const minPercent = Math.min(50, (MIN_FRAME_WIDTH / available) * 100);
    const maxPercent = 100 - minPercent;
    if (minPercent >= maxPercent) {
      return DEFAULT_SPLIT_PERCENT;
    }
    if (clamped < minPercent) {
      return minPercent;
    }
    if (clamped > maxPercent) {
      return maxPercent;
    }
    return clamped;
  }, []);

  useEffect(() => {
    const updateFromWidth = (rawWidth?: number | null) => {
      if (typeof rawWidth !== "number" || Number.isNaN(rawWidth)) {
        return;
      }
      containerWidthRef.current = rawWidth;
      const minSideBySideWidth = Math.max(
        COMPACT_BREAKPOINT,
        MIN_FRAME_WIDTH * 2 + SPLITTER_GAP
      );
      setIsCompactLayout((previous) => {
        if (previous) {
          return rawWidth >= minSideBySideWidth + COMPACT_HYSTERESIS_PX
            ? false
            : true;
        }
        if (rawWidth <= minSideBySideWidth) {
          return true;
        }
        return false;
      });
      const bounded = applySplitBounds(lastSplitPercentRef.current);
      if (bounded !== lastSplitPercentRef.current) {
        lastSplitPercentRef.current = bounded;
        setSplitPercent(bounded);
      }
    };

    const container = framesRef.current;
    if (container && typeof ResizeObserver !== "undefined") {
      updateFromWidth(container.getBoundingClientRect().width);
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }
        updateFromWidth(entry.contentRect.width);
      });
      observer.observe(container);
      return () => {
        observer.disconnect();
      };
    }

    const handleWindowResize = () => {
      const width =
        container?.getBoundingClientRect().width ??
        (typeof window !== "undefined" ? window.innerWidth : undefined);
      updateFromWidth(width);
    };

    handleWindowResize();

    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleWindowResize);
      return () => {
        window.removeEventListener("resize", handleWindowResize);
      };
    }

    return;
  }, [applySplitBounds]);

  const commitSplitPercent = useCallback(
    (value: number) => {
      const bounded = applySplitBounds(value);
      setSplitPercent(bounded);
      lastSplitPercentRef.current = bounded;
    },
    [applySplitBounds]
  );

  const finishSplitAnimation = useCallback(() => {
    if (splitRafRef.current !== null) {
      cancelAnimationFrame(splitRafRef.current);
      splitRafRef.current = null;
    }
    if (pendingSplitPercentRef.current !== null) {
      commitSplitPercent(pendingSplitPercentRef.current);
      pendingSplitPercentRef.current = null;
    }
  }, [commitSplitPercent]);

  const scheduleSplitPercent = useCallback(
    (value: number) => {
      pendingSplitPercentRef.current = applySplitBounds(value);
      if (splitRafRef.current !== null) {
        return;
      }
      splitRafRef.current = window.requestAnimationFrame(() => {
        splitRafRef.current = null;
        if (pendingSplitPercentRef.current !== null) {
          commitSplitPercent(pendingSplitPercentRef.current);
          pendingSplitPercentRef.current = null;
        }
      });
    },
    [applySplitBounds, commitSplitPercent]
  );

  const setIframePointerInteractivity = useCallback((enabled: boolean) => {
    const container = framesRef.current;
    if (!container) {
      return;
    }
    const iframes = container.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      iframe.style.pointerEvents = enabled ? "" : "none";
    });
  }, []);

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
        scheduleSplitPercent(clamped);
      };

      finishSplitAnimation();
      updateFromClientX(event.clientX);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        updateFromClientX(moveEvent.clientX);
      };

      const handleMouseUp = () => {
        finishSplitAnimation();
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.classList.remove("is-resizing");
        setIframePointerInteractivity(true);
        resizeCleanupRef.current = null;
      };

      resizeCleanupRef.current = () => {
        finishSplitAnimation();
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.classList.remove("is-resizing");
        setIframePointerInteractivity(true);
      };

      document.body.classList.add("is-resizing");
      setIframePointerInteractivity(false);
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [
      finishSplitAnimation,
      scheduleSplitPercent,
      setIframePointerInteractivity,
      viewMode,
    ]
  );

  useEffect(() => {
    return () => {
      finishSplitAnimation();
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
      }
    };
  }, [finishSplitAnimation]);

  const showSplit = useCallback(() => {
    finishSplitAnimation();
    const previous = lastSplitPercentRef.current;
    const next =
      Number.isFinite(previous) && previous > 0 && previous < 100
        ? previous
        : DEFAULT_SPLIT_PERCENT;
    commitSplitPercent(next);
    setViewMode("split");
  }, [commitSplitPercent, finishSplitAnimation]);

  const showBranchFull = useCallback(
    (mode: "a-full" | "b-full") => {
      finishSplitAnimation();
      setViewMode(mode);
    },
    [finishSplitAnimation]
  );

  const snapSplitToCenter = useCallback(() => {
    finishSplitAnimation();
    commitSplitPercent(DEFAULT_SPLIT_PERCENT);
    setViewMode("split");
  }, [commitSplitPercent, finishSplitAnimation]);

  const isSplitView = viewMode === "split";
  const isAFocused = viewMode === "a-full";
  const isBFocused = viewMode === "b-full";

  const framesClassName = useMemo(() => {
    const classes = ["ab-workspace__frames"];
    if (!isSplitView) {
      classes.push("ab-workspace__frames--focus");
    }
    if (isCompactLayout) {
      classes.push("ab-workspace__frames--stacked");
    }
    return classes.join(" ");
  }, [isCompactLayout, isSplitView]);

  const framesStyle = useMemo(() => {
    if (!isSplitView || isCompactLayout) {
      return undefined;
    }
    return {
      gridTemplateColumns: `${splitPercent}% 12px ${100 - splitPercent}%`,
    };
  }, [isCompactLayout, isSplitView, splitPercent]);

  const isFrameAHidden = viewMode === "b-full";
  const isFrameBHidden = viewMode === "a-full";

  const frameAClassName = useMemo(() => {
    const classes = ["ab-workspace__frame", "ab-workspace__frame--a"];
    if (isFrameAHidden) {
      classes.push("ab-workspace__frame--hidden");
    }
    return classes.join(" ");
  }, [isFrameAHidden]);

  const frameBClassName = useMemo(() => {
    const classes = ["ab-workspace__frame", "ab-workspace__frame--b"];
    if (isFrameBHidden) {
      classes.push("ab-workspace__frame--hidden");
    }
    return classes.join(" ");
  }, [isFrameBHidden]);

  const leftArrowState: SplitterArrowState = useMemo(() => {
    if (isBFocused) {
      return {
        icon: "↔",
        ariaLabel: "Return to split view 50/50",
        title: "Return to split view 50/50",
        disabled: false,
        onClick: showSplit,
        pressed: true,
      };
    }
    if (isAFocused) {
      return { hidden: true };
    }
    return {
      icon: "‹",
      ariaLabel: "Expand Version B to full width",
      title: "Expand Version B to full width",
      disabled: false,
      onClick: () => showBranchFull("b-full"),
      pressed: false,
    };
  }, [isAFocused, isBFocused, showBranchFull, showSplit]);

  const rightArrowState: SplitterArrowState = useMemo(() => {
    if (isAFocused) {
      return {
        icon: "↔",
        ariaLabel: "Return to split view 50/50",
        title: "Return to split view 50/50",
        disabled: false,
        onClick: showSplit,
        pressed: true,
      };
    }
    if (isBFocused) {
      return { hidden: true };
    }
    return {
      icon: "›",
      ariaLabel: "Expand Version A to full width",
      title: "Expand Version A to full width",
      disabled: false,
      onClick: () => showBranchFull("a-full"),
      pressed: false,
    };
  }, [isAFocused, isBFocused, showBranchFull, showSplit]);

  const handleReload = useCallback(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const startKeepFlow = useCallback((branch: BranchInfo) => {
    setConfirmation({ type: "keep", branch });
  }, []);

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

  const branchAUrl = buildBranchUrl(normalizedSource, branchA.branchId);
  const branchBUrl = buildBranchUrl(normalizedSource, branchB.branchId);

  return (
    <div className="ab-workspace">
      <header className="ab-workspace__toolbar">
        <div className="ab-workspace__toolbar-info">
          <div className="ab-workspace__toolbar-title">
            A/B Comparison Mode ↔️
          </div>
          <p className="ab-workspace__toolbar-description">
            Review both branches, then keep the experience that delivers the
            strongest vibe.
          </p>
        </div>
        <div className="ab-workspace__toolbar-actions">
          <button
            type="button"
            className="ab-workspace__action admin-danger"
            onClick={startDiscardFlow}
          >
            Discard Both &amp; Go Back
          </button>
        </div>
      </header>

      <main className={framesClassName} ref={framesRef} style={framesStyle}>
        {!isSplitView ? (
          <button
            type="button"
            className={`ab-workspace__focus-arrow ${
              isAFocused
                ? "ab-workspace__focus-arrow--right"
                : "ab-workspace__focus-arrow--left"
            }`}
            aria-label="Return to split view 50/50"
            title="Return to split view 50/50"
            onClick={showSplit}
          >
            {isAFocused ? "‹" : "›"}
          </button>
        ) : null}
        <section
          className={frameAClassName}
          aria-label="Version A preview"
          aria-hidden={isFrameAHidden}
        >
          <header className="ab-workspace__frame-header">
            <div className="ab-workspace__frame-header-content">
              <span className="ab-workspace__badge">Version A</span>
              <div className="ab-workspace__frame-instructions-card">
                <span className="ab-workspace__frame-instructions-label">
                  Instructions
                </span>
                <p className="ab-workspace__frame-instructions">
                  {branchA.instructions.trim() ||
                    "No additional instructions provided."}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="ab-workspace__keep-button admin-primary"
              onClick={() => startKeepFlow(branchA)}
            >
              Select Version A
            </button>
          </header>
          <iframe
            key={branchA.branchId}
            src={branchAUrl}
            data-ab-workspace="true"
            data-vaporvibe-branch={branchA.branchId}
            title="Version A"
          />
        </section>
        {isSplitView && !isCompactLayout ? (
          <div className="ab-workspace__splitter">
            {"hidden" in leftArrowState ? null : (
              <button
                type="button"
                className="ab-workspace__splitter-arrow left"
                aria-label={leftArrowState.ariaLabel}
                aria-pressed={leftArrowState.pressed}
                title={leftArrowState.title}
                onClick={leftArrowState.onClick}
                disabled={leftArrowState.disabled}
              >
                {leftArrowState.icon}
              </button>
            )}
            <div
              className="ab-workspace__splitter-handle"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize comparison frames"
              onMouseDown={handleSplitterMouseDown}
              onDoubleClick={snapSplitToCenter}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (viewMode !== "split") {
                    showSplit();
                  } else {
                    snapSplitToCenter();
                  }
                }
                if (event.key === "Escape" && viewMode !== "split") {
                  event.preventDefault();
                  showSplit();
                }
              }}
              tabIndex={viewMode === "split" ? 0 : -1}
            />
            {"hidden" in rightArrowState ? null : (
              <button
                type="button"
                className="ab-workspace__splitter-arrow right"
                aria-label={rightArrowState.ariaLabel}
                aria-pressed={rightArrowState.pressed}
                title={rightArrowState.title}
                onClick={rightArrowState.onClick}
                disabled={rightArrowState.disabled}
              >
                {rightArrowState.icon}
              </button>
            )}
          </div>
        ) : null}
        <section
          className={frameBClassName}
          aria-label="Version B preview"
          aria-hidden={isFrameBHidden}
        >
          <header className="ab-workspace__frame-header">
            <div className="ab-workspace__frame-header-content">
              <span className="ab-workspace__badge">Version B</span>
              <div className="ab-workspace__frame-instructions-card">
                <span className="ab-workspace__frame-instructions-label">
                  Instructions
                </span>
                <p className="ab-workspace__frame-instructions">
                  {branchB.instructions.trim() ||
                    "No additional instructions provided."}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="ab-workspace__keep-button admin-primary"
              onClick={() => startKeepFlow(branchB)}
            >
              Select Version B
            </button>
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
          confirmation?.type === "keep" ? (
            <>
              <p>
                This will save the history from Version{" "}
                {confirmation.branch.label} and permanently discard Version{" "}
                {confirmation.branch.label === "A" ? "B" : "A"}.
              </p>
              <p className="ab-modal__note">
                Based on instruction: "
                {formatInstructionSnippet(confirmation.branch.instructions)}"
              </p>
            </>
          ) : undefined
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
            <div className="ab-workspace__overlay-message">
              {resolving.message}
            </div>
            {resolving.detail ? (
              <div className="ab-workspace__overlay-detail">
                {resolving.detail}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ABWorkspaceShell;
