import type React from "react";
import { useCallback, useEffect, useState } from "react";

import { submitHistoryImport } from "../api/admin";
import type { AdminStateResponse } from "../api/types";
import { AttachmentUploader } from "./AttachmentUploader";
import { useNotifications } from "./Notifications";

type AsyncStatus = "idle" | "loading" | "success" | "error";

type StatusMessage = { tone: "info" | "error"; message: string } | null;

interface SnapshotImportFormProps {
  onState: (state: AdminStateResponse) => void;
  onHistoryRefresh: () => void;
  context?: "admin" | "setup";
  className?: string;
  externalFiles?: File[] | null;
  onExternalFilesHandled?: () => void;
  standalone?: boolean;
}

export function SnapshotImportForm({
  onState,
  onHistoryRefresh,
  context = "admin",
  className = "",
  externalFiles = null,
  onExternalFilesHandled,
  standalone = true,
}: SnapshotImportFormProps) {
  const { notify } = useNotifications();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState<AsyncStatus>("idle");

  const resetStatus = useCallback(() => {
    setStatus(null);
    setSaving("idle");
  }, []);

  const handleUploadChange = useCallback(
    (files: File[]) => {
      if (!files.length) {
        setSelectedFile(null);
        resetStatus();
        return;
      }

      const file = files[0];
      setSelectedFile(file);
      setStatus({
        tone: "info",
        message: `Loaded ${file.name} (${file.size.toLocaleString()} bytes)`,
      });
    },
    [resetStatus]
  );

  useEffect(() => {
    if (externalFiles?.length) {
      handleUploadChange(externalFiles);
      onExternalFilesHandled?.();
    }
  }, [externalFiles, handleUploadChange, onExternalFilesHandled]);

  const handleSubmit = useCallback(
    async (event?: React.FormEvent<HTMLFormElement> | React.MouseEvent) => {
      event?.preventDefault();
      if (!selectedFile) {
        const message = "Choose a snapshot file to import.";
        setStatus({ tone: "error", message });
        notify("error", message);
        return;
      }

      setSaving("loading");
      try {
        const response = await submitHistoryImport(selectedFile);
        if (response.state) {
          onState(response.state);
        }
        onHistoryRefresh();
        setStatus({ tone: "info", message: response.message });
        notify("info", response.message);
        setSaving("success");
        setSelectedFile(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus({ tone: "error", message });
        notify("error", message);
        setSaving("error");
      }
    },
    [notify, onHistoryRefresh, onState, selectedFile]
  );

  const uploaderLabel =
    context === "setup"
      ? "Drop a saved session snapshot"
      : "Drop or paste a snapshot file";
  const uploaderHint =
    context === "setup"
      ? "Upload a previous snapshot (.zip or .json) to jump back into that improvisation."
      : "Drop a saved snapshot (.zip recommended) or browse to upload.";

  const importButtonProps = standalone
    ? { type: "submit" as const, onClick: undefined }
    : { type: "button" as const, onClick: handleSubmit };

  const content = (
    <>
      {status ? (
        <div
          className={`admin-status admin-status--${status.tone === "error" ? "error" : "info"
            }`}
        >
          {status.message}
        </div>
      ) : null}

      <AttachmentUploader
        className="admin-import__uploader"
        name="snapshotUpload"
        accept="application/json,application/zip,.json,.zip"
        multiple={false}
        label={uploaderLabel}
        hint={uploaderHint}
        browseLabel="Browse snapshot"
        pasteHint="or paste a snapshot file"
        variant="history"
        emptyStatus="No snapshot file selected yet."
        onFilesChange={handleUploadChange}
      />

      {selectedFile ? (
        <p className="admin-import__file" aria-live="polite">
          Ready to import: {selectedFile.name} · {selectedFile.size.toLocaleString()} bytes
        </p>
      ) : (
        <p className="admin-import__helper">
          Drag a snapshot archive (.zip) or JSON export into this panel, or click browse to upload.
        </p>
      )}

      <div className="admin-import__actions">
        <button type="button" className="admin-secondary" onClick={resetStatus}>
          Reset
        </button>
        <button
          className="admin-primary"
          disabled={saving === "loading" || !selectedFile}
          {...importButtonProps}
        >
          {saving === "loading" ? "Importing…" : "Import snapshot"}
        </button>
      </div>
    </>
  );

  if (!standalone) {
    return content;
  }

  return (
    <form
      className={`admin-import ${className}`.trim()}
      method="post"
      onSubmit={handleSubmit}
      aria-live="polite"
    >
      {content}
    </form>
  );
}

export default SnapshotImportForm;
