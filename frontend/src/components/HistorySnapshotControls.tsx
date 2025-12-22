import { useCallback, useEffect, useMemo, useState } from "react";
import type { DragEvent, MouseEvent } from "react";

import type { AdminStateResponse } from "../api/types";
import SnapshotImportForm from "./SnapshotImportForm";

interface HistorySnapshotControlsProps {
  exportJsonUrl: string;
  exportMarkdownUrl: string;
  onState: (state: AdminStateResponse) => void;
  onHistoryRefresh: () => void;
  forkActive: boolean;
  onDownloadTour: () => Promise<void> | void;
  tourLoading: boolean;
  tourDisabled?: boolean;
}

function HistorySnapshotControls({
  exportJsonUrl,
  exportMarkdownUrl,
  onState,
  onHistoryRefresh,
  forkActive,
  onDownloadTour,
  tourLoading,
  tourDisabled = false,
}: HistorySnapshotControlsProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [pendingDropFiles, setPendingDropFiles] = useState<File[] | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    if (forkActive) {
      setImportOpen(false);
      setIsDragActive(false);
      setPendingDropFiles(null);
    }
  }, [forkActive]);

  const toggleImport = useCallback(() => {
    setImportOpen((open) => !open);
  }, []);

  const handleContainerDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer?.types.includes("Files")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (!importOpen) {
        setImportOpen(true);
      }
      setIsDragActive(true);
    },
    [importOpen]
  );

  const handleContainerDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleContainerDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  }, []);

  const handleContainerDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.files?.length) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer.files);
    setPendingDropFiles(files);
    setImportOpen(true);
    setIsDragActive(false);
  }, []);

  const importHint = useMemo(() => {
    return importOpen
      ? "Drop a snapshot anywhere in this panel to load it."
      : "Drop a snapshot file here or click to import.";
  }, [importOpen]);

  const exportDisabled = forkActive;
  const tourButtonDisabled = exportDisabled || tourLoading || tourDisabled;

  const handleDisabledLink = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (forkActive) {
        event.preventDefault();
      }
    },
    [forkActive]
  );

  return (
    <div
      className={`history-snapshot-controls${isDragActive ? " history-snapshot-controls--drag" : ""}`}
      onDragEnter={handleContainerDragEnter}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
    >
      {/* Import Section - simple drop zone card */}
      <section className="export-cards">
        <h3 className="export-cards__heading">Import</h3>
        {importOpen ? (
          <SnapshotImportForm
            className="snapshot-import"
            context="admin"
            onState={onState}
            onHistoryRefresh={onHistoryRefresh}
            externalFiles={pendingDropFiles}
            onExternalFilesHandled={() => setPendingDropFiles(null)}
          />
        ) : (
          <button
            type="button"
            className="export-card export-card--dropzone"
            onClick={() => setImportOpen(true)}
          >
            <span className="export-card__icon" aria-hidden="true">📥</span>
            <span className="export-card__content">
              <span className="export-card__title">Import Snapshot</span>
              <span className="export-card__desc">
                Drop a snapshot file here or click to import a previous session.
              </span>
            </span>
          </button>
        )}
      </section>

      {/* Export Section - always visible cards */}
      <section className="export-cards">
        <h3 className="export-cards__heading">Export &amp; Share</h3>
        {forkActive && (
          <p className="export-cards__warning">
            Exports are disabled while an A/B comparison is active.
          </p>
        )}
        <div className="export-cards__grid">
          {/* Clickthrough Tour - featured card */}
          <button
            type="button"
            className="export-card export-card--featured"
            onClick={onDownloadTour}
            disabled={tourButtonDisabled}
          >
            <span className="export-card__icon" aria-hidden="true">▶️</span>
            <span className="export-card__content">
              <span className="export-card__title">
                {tourLoading ? "Generating…" : "Clickthrough Tour"}
              </span>
              <span className="export-card__desc">
                Interactive demo with walkthrough. Uses your model—may take 1–2 minutes.
              </span>
            </span>
          </button>

          {/* Backup Snapshot */}
          <a
            className="export-card"
            href={exportJsonUrl}
            download
            aria-disabled={exportDisabled}
            onClick={handleDisabledLink}
            tabIndex={exportDisabled ? -1 : 0}
          >
            <span className="export-card__icon" aria-hidden="true">📦</span>
            <span className="export-card__content">
              <span className="export-card__title">Backup Snapshot</span>
              <span className="export-card__desc">
                Save your entire session with images. Re-import later to continue where you left off.
              </span>
            </span>
          </a>

          {/* Copy as Prompt */}
          <a
            className="export-card"
            href={exportMarkdownUrl}
            download
            aria-disabled={exportDisabled}
            onClick={handleDisabledLink}
            tabIndex={exportDisabled ? -1 : 0}
          >
            <span className="export-card__icon" aria-hidden="true">📝</span>
            <span className="export-card__content">
              <span className="export-card__title">Export as Prompt</span>
              <span className="export-card__desc">
                Markdown file for coding agents. Build it out with Cursor, GitHub Copilot, or Windsurf.
              </span>
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}

export default HistorySnapshotControls;
