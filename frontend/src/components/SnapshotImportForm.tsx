import { useCallback, useEffect, useState } from "react";

import { submitHistoryImport } from "../api/admin";
import type { AdminStateResponse } from "../api/types";
import { AttachmentUploader } from "./AttachmentUploader";
import { useNotifications } from "./Notifications";

type AsyncStatus = "idle" | "loading" | "success" | "error";

type StatusMessage = { tone: "info" | "error"; message: string } | null;

type SnapshotPreview = {
  historyCount: number;
  attachmentCount: number;
  briefIncluded: boolean;
  provider?: string;
  model?: string;
};

interface SnapshotImportFormProps {
  onState: (state: AdminStateResponse) => void;
  onHistoryRefresh: () => void;
  context?: "admin" | "setup";
  className?: string;
  externalFiles?: File[] | null;
  onExternalFilesHandled?: () => void;
  standalone?: boolean;
}

type FileInfo = { name: string; size: number };

type SnapshotCandidate = Record<string, unknown> & {
  version?: number;
  history?: unknown;
  briefAttachments?: unknown;
  brief?: unknown;
  llm?: unknown;
};

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
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [preview, setPreview] = useState<SnapshotPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState<AsyncStatus>("idle");

  const resetStatus = useCallback(() => {
    setStatus(null);
    setSaving("idle");
  }, []);

  const validateSnapshot = useCallback((source: string) => {
    const trimmed = source.trim();
    if (!trimmed) {
      throw new Error("Paste or upload a snapshot JSON file first.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(
        `Failed to parse JSON: ${(error as Error).message ?? String(error)}`
      );
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Snapshot must be a JSON object.");
    }

    const candidate = parsed as SnapshotCandidate;
    if (candidate.version !== 1) {
      throw new Error("Snapshot version must equal 1.");
    }
    if (!Array.isArray(candidate.history)) {
      throw new Error("Snapshot must include a history array.");
    }

    const historyCount = candidate.history.length;
    const attachmentCount = Array.isArray(candidate.briefAttachments)
      ? candidate.briefAttachments.length
      : 0;
    const briefIncluded = Boolean(
      typeof candidate.brief === "string" && candidate.brief.trim().length > 0
    );

    const llm =
      candidate.llm && typeof candidate.llm === "object"
        ? (candidate.llm as Record<string, unknown>)
        : null;

    const provider =
      llm && typeof llm.provider === "string" ? (llm.provider as string) : undefined;
    const model =
      llm && typeof llm.model === "string" ? (llm.model as string) : undefined;

    return {
      snapshot: candidate,
      summary: {
        historyCount,
        attachmentCount,
        briefIncluded,
        provider,
        model,
      } as SnapshotPreview,
    };
  }, []);

  const handleFileSelect = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        setInputText(text);
        setSelectedFile({ name: file.name, size: file.size });
        const { summary } = validateSnapshot(text);
        setPreview(summary);
        setParseError(null);
        setStatus({
          tone: "info",
          message: `Loaded snapshot from ${file.name}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setPreview(null);
        setParseError(message);
        setStatus({ tone: "error", message });
        notify("error", message);
      }
    },
    [notify, validateSnapshot]
  );

  const handleUploadChange = useCallback(
    (files: File[]) => {
      if (files.length === 0) {
        setSelectedFile(null);
        setPreview(null);
        setParseError(null);
        resetStatus();
        return;
      }

      const [file] = files;
      resetStatus();
      void handleFileSelect(file);
    },
    [handleFileSelect, resetStatus]
  );

  const handlePreview = useCallback(() => {
    resetStatus();
    try {
      const { summary } = validateSnapshot(inputText);
      setPreview(summary);
      setParseError(null);
      setStatus({
        tone: "info",
        message: `Snapshot ready with ${summary.historyCount} entries`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPreview(null);
      setParseError(message);
      setStatus({ tone: "error", message });
      notify("error", message);
    }
  }, [inputText, notify, resetStatus, validateSnapshot]);

  useEffect(() => {
    if (!externalFiles || externalFiles.length === 0) {
      return;
    }
    resetStatus();
    handleUploadChange(externalFiles);
    onExternalFilesHandled?.();
  }, [externalFiles, handleUploadChange, onExternalFilesHandled, resetStatus]);

  const handleSubmit = useCallback(
    async (event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
      event?.preventDefault();
      setSaving("loading");
      setStatus(null);
      try {
        const { snapshot, summary } = validateSnapshot(inputText);
        const response = await submitHistoryImport(snapshot);
        if (!response.success) {
          throw new Error(response.message || "History import failed");
        }
        if (response.state) {
          onState(response.state);
        }
        onHistoryRefresh();
        setPreview(summary);
        setParseError(null);
        setSelectedFile(null);
        setInputText("");
        setStatus({ tone: "info", message: response.message });
        setSaving("success");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus({ tone: "error", message });
        notify("error", message);
        setSaving("error");
      }
    },
    [inputText, notify, onHistoryRefresh, onState, validateSnapshot]
  );

  const uploaderLabel =
    context === "setup"
      ? "Drop a saved session snapshot"
      : "Drop or paste a history snapshot";
  const uploaderHint =
    context === "setup"
      ? "Upload a previous history.json to jump back into that improvisation."
      : "Drop a saved history.json, paste it from the clipboard, or browse to upload.";

  const importButtonProps = standalone
    ? { type: "submit" as const, onClick: undefined }
    : { type: "button" as const, onClick: handleSubmit };

  const content = (
    <>
      {status ? (
        <div
          className={`admin-status admin-status--${
            status.tone === "error" ? "error" : "info"
          }`}
        >
          {status.message}
        </div>
      ) : null}

      <AttachmentUploader
        className="admin-import__uploader"
        name="snapshotUpload"
        accept="application/json,.json"
        multiple={false}
        label={uploaderLabel}
        hint={uploaderHint}
        browseLabel="Browse snapshot"
        pasteHint="or paste JSON from your clipboard"
        variant="history"
        emptyStatus="No snapshot file selected yet."
        onFilesChange={handleUploadChange}
      />

      {selectedFile ? (
        <p className="admin-import__file" aria-live="polite">
          Loaded snapshot: {selectedFile.name} · {selectedFile.size.toLocaleString()} bytes
        </p>
      ) : (
        <p className="admin-import__helper">
          You can also paste the snapshot JSON into the editor below.
        </p>
      )}

      <label className="admin-field snapshot-import__editor">
        <span className="admin-field__label">Snapshot JSON</span>
        <textarea
          className="snapshot-import__textarea"
          value={inputText}
          onChange={(event) => {
            setInputText(event.target.value);
            setSelectedFile(null);
            setPreview(null);
            setParseError(null);
            resetStatus();
          }}
          rows={10}
          spellCheck={false}
          placeholder="Paste the JSON snapshot here or drop a file above."
        />
        {parseError ? (
          <p className="admin-field__error" role="alert">
            {parseError}
          </p>
        ) : (
          <p className="admin-field__helper">
            You can paste the contents of an exported history snapshot to import without upload.
          </p>
        )}
      </label>

      <div className="admin-import__actions">
        <button type="button" className="admin-secondary" onClick={handlePreview}>
          Preview snapshot
        </button>
        <button
          className="admin-primary"
          disabled={saving === "loading"}
          {...importButtonProps}
        >
          {saving === "loading" ? "Importing…" : "Import snapshot"}
        </button>
      </div>

      {preview ? (
        <div className="admin-import__summary" aria-live="polite">
          <h3>Snapshot details</h3>
          <dl className="admin-import__preview">
            <div>
              <dt>History entries</dt>
              <dd>{preview.historyCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Attachments</dt>
              <dd>{preview.attachmentCount}</dd>
            </div>
            <div>
              <dt>Brief included</dt>
              <dd>{preview.briefIncluded ? "Yes" : "No"}</dd>
            </div>
            {preview.provider ? (
              <div>
                <dt>Provider</dt>
                <dd>
                  {preview.provider}
                  {preview.model ? ` · ${preview.model}` : ""}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </>
  );

  if (standalone) {
    return (
      <form className={`snapshot-import ${className}`.trim()} onSubmit={handleSubmit}>
        {content}
      </form>
    );
  }

  return (
    <div
      className={`snapshot-import ${className}`.trim()}
      role="form"
      aria-label="History snapshot import"
    >
      {content}
    </div>
  );
}

export default SnapshotImportForm;
