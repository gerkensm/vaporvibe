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

type CollapsibleKey = "import" | "export";

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
  const [openSection, setOpenSection] = useState<CollapsibleKey | null>(null);
  const [pendingDropFiles, setPendingDropFiles] = useState<File[] | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const importOpen = openSection === "import";
  const exportOpen = openSection === "export";

  useEffect(() => {
    if (forkActive) {
      setOpenSection(null);
      setIsDragActive(false);
      setPendingDropFiles(null);
    }
  }, [forkActive]);

  const toggleSection = useCallback(
    (key: CollapsibleKey) => {
      setOpenSection((current) => (current === key ? null : key));
    },
    []
  );

  const handleContainerDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer?.types.includes("Files")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (!importOpen) {
        setOpenSection("import");
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
    setOpenSection("import");
    setIsDragActive(false);
  }, []);

  const importHint = useMemo(() => {
    return importOpen
      ? "Drop a snapshot anywhere in this panel to load it."
      : "Drop a snapshot file here or click to import.";
  }, [importOpen]);

  const exportHint = useMemo(() => {
    if (forkActive) {
      return "Exports are disabled while an A/B comparison is active.";
    }
    return exportOpen
      ? "Download the full history or prompt markdown."
      : "Save a snapshot for safekeeping or sharing.";
  }, [exportOpen, forkActive]);

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
      <section
        className={`history-snapshot-controls__section${importOpen ? " is-open" : ""}`}
        aria-expanded={importOpen}
      >
        <header className="history-snapshot-controls__header">
          <button
            type="button"
            className="history-snapshot-controls__toggle"
            onClick={() => toggleSection("import")}
            aria-expanded={importOpen}
          >
            <span className="history-snapshot-controls__label">
              <span className="history-snapshot-controls__title">Import snapshot</span>
              <span className="history-snapshot-controls__hint">{importHint}</span>
            </span>
            <span className="history-snapshot-controls__chevron" aria-hidden="true" />
          </button>
        </header>
        {importOpen ? (
          <SnapshotImportForm
            context="admin"
            onState={onState}
            onHistoryRefresh={onHistoryRefresh}
            externalFiles={pendingDropFiles}
            onExternalFilesHandled={() => setPendingDropFiles(null)}
          />
        ) : null}
      </section>

      <section
        className={`history-snapshot-controls__section${exportOpen ? " is-open" : ""}`}
        aria-expanded={exportOpen}
      >
        <header className="history-snapshot-controls__header">
          <button
            type="button"
            className="history-snapshot-controls__toggle"
            disabled={exportDisabled}
            onClick={() => toggleSection("export")}
            aria-expanded={exportOpen}
          >
            <span className="history-snapshot-controls__label">
              <span className="history-snapshot-controls__title">Export session</span>
              <span className="history-snapshot-controls__hint">{exportHint}</span>
            </span>
            <span className="history-snapshot-controls__chevron" aria-hidden="true" />
          </button>
        </header>
        {exportOpen ? (
          <div className="history-snapshot-controls__actions">
            <button
              type="button"
              className="admin-primary"
              onClick={onDownloadTour}
              disabled={tourButtonDisabled}
            >
              {tourLoading ? "Generating tour…" : "▶ Download Clickthrough Prototype"}
            </button>
            <a
              className="admin-primary admin-primary--link"
              href={exportJsonUrl}
              download
              aria-disabled={forkActive}
              onClick={handleDisabledLink}
              tabIndex={forkActive ? -1 : 0}
            >
              Download snapshot (.zip)
            </a>
            <a
              className="admin-secondary admin-secondary--link"
              href={exportMarkdownUrl}
              download
              aria-disabled={forkActive}
              onClick={handleDisabledLink}
              tabIndex={forkActive ? -1 : 0}
            >
              Download prompt.md
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default HistorySnapshotControls;
