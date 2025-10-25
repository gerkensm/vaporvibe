import { useCallback, useState } from "react";
import type { DragEvent } from "react";

import type { AdminStateResponse } from "../api/types";
import SnapshotImportForm from "./SnapshotImportForm";

interface ResumeSessionCalloutProps {
  onState: (state: AdminStateResponse) => void;
  onHistoryRefresh: () => void;
}

function ResumeSessionCallout({
  onState,
  onHistoryRefresh,
}: ResumeSessionCalloutProps) {
  const [open, setOpen] = useState(false);
  const [pendingDropFiles, setPendingDropFiles] = useState<File[] | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleToggle = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!open) {
      setOpen(true);
    }
    setIsDragActive(true);
  }, [open]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.files?.length) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer.files);
    setPendingDropFiles(files);
    setOpen(true);
    setIsDragActive(false);
  }, []);

  return (
    <div
      className={`resume-import${open ? " resume-import--open" : ""}${
        isDragActive ? " resume-import--drag" : ""
      }`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <button
        type="button"
        className="resume-import__toggle"
        onClick={handleToggle}
        aria-expanded={open}
      >
        <span className="resume-import__text">
          <span className="resume-import__title">Resume a saved session</span>
          <span className="resume-import__hint">
            Optional: load an exported history snapshot to pick up where you left off.
          </span>
        </span>
        <span className="resume-import__chevron" aria-hidden="true" />
      </button>
      {open ? (
        <SnapshotImportForm
          context="setup"
          onState={onState}
          onHistoryRefresh={onHistoryRefresh}
          externalFiles={pendingDropFiles}
          onExternalFilesHandled={() => setPendingDropFiles(null)}
          standalone={false}
        />
      ) : null}
    </div>
  );
}

export default ResumeSessionCallout;
