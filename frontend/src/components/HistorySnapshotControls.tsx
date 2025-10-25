import { useCallback, useMemo, useState } from "react";
import type { DragEvent } from "react";

import type { AdminStateResponse } from "../api/types";
import SnapshotImportForm from "./SnapshotImportForm";

interface HistorySnapshotControlsProps {
  exportJsonUrl: string;
  exportMarkdownUrl: string;
  onState: (state: AdminStateResponse) => void;
  onHistoryRefresh: () => void;
}

type CollapsibleKey = "import" | "export";

function HistorySnapshotControls({
  exportJsonUrl,
  exportMarkdownUrl,
  onState,
  onHistoryRefresh,
}: HistorySnapshotControlsProps) {
  const [openSection, setOpenSection] = useState<CollapsibleKey | null>(null);
  const [pendingDropFiles, setPendingDropFiles] = useState<File[] | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const importOpen = openSection === "import";
  const exportOpen = openSection === "export";

  const toggleSection = useCallback((key: CollapsibleKey) => {
    setOpenSection((current) => (current === key ? null : key));
  }, []);

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

  const hint = useMemo(
    () =>
      importOpen
        ? "Drop a snapshot anywhere in this panel to load it."
        : "Drop a history.json here or click to import.",
    [importOpen]
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
              <span className="history-snapshot-controls__hint">{hint}</span>
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
            onClick={() => toggleSection("export")}
            aria-expanded={exportOpen}
          >
            <span className="history-snapshot-controls__label">
              <span className="history-snapshot-controls__title">Export session</span>
              <span className="history-snapshot-controls__hint">
                {exportOpen
                  ? "Download the full history or prompt markdown."
                  : "Save a snapshot for safekeeping or sharing."}
              </span>
            </span>
            <span className="history-snapshot-controls__chevron" aria-hidden="true" />
          </button>
        </header>
        {exportOpen ? (
          <div className="history-snapshot-controls__actions">
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
        ) : null}
      </section>
    </div>
  );
}

export default HistorySnapshotControls;
