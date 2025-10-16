import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";

import "./AttachmentUploader.css";

type Tone = "idle" | "ready" | "error";

type StatusState = {
  message: string;
  tone: Tone;
};

export interface AttachmentUploaderProps {
  name: string;
  id?: string;
  label?: string;
  hint?: string;
  browseLabel?: string;
  accept?: string;
  multiple?: boolean;
  emptyStatus?: string;
  className?: string;
  prefixActions?: ReactNode;
  onFilesChange?: (files: FileList | null) => void;
}

function toTokens(accept: string | undefined): string[] {
  if (!accept) return [];
  return accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
}

function acceptsFile(file: File, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return tokens.some((token) => {
    if (!token) return false;
    if (token === "*") return true;
    if (token.startsWith(".")) {
      return name.endsWith(token);
    }
    if (token.endsWith("/*")) {
      const prefix = token.slice(0, -1);
      return type.startsWith(prefix);
    }
    return type === token;
  });
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const precision = size < 10 && unit > 0 ? 1 : 0;
  return `${size.toFixed(precision)} ${units[unit]}`;
}

function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export function AttachmentUploader({
  name,
  id,
  label = "Add attachments",
  hint = "Drop files, paste with Ctrl+V, or browse to upload.",
  browseLabel = "Browse files",
  accept = "image/*,application/pdf",
  multiple = true,
  emptyStatus = "No files selected yet.",
  className,
  prefixActions,
  onFilesChange,
}: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isError, setIsError] = useState(false);
  const [status, setStatus] = useState<StatusState>({
    message: emptyStatus,
    tone: "idle",
  });
  const [showClear, setShowClear] = useState(false);
  const errorTimeoutRef = useRef<number | null>(null);
  const tokens = useMemo(() => toTokens(accept), [accept]);
  const latestOnFilesChange = useLatest(onFilesChange);

  const resetError = useCallback(() => {
    if (errorTimeoutRef.current) {
      window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    setIsError(false);
  }, []);

  const applyError = useCallback(
    (message: string) => {
      resetError();
      setIsError(true);
      setStatus({ message, tone: "error" });
      errorTimeoutRef.current = window.setTimeout(() => {
        setIsError(false);
        setStatus({ message: emptyStatus, tone: "idle" });
        errorTimeoutRef.current = null;
      }, 3000);
    },
    [emptyStatus, resetError]
  );

  const syncFromInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const files = input.files ? Array.from(input.files) : [];
    if (!files.length) {
      setStatus({ message: emptyStatus, tone: "idle" });
      setShowClear(false);
      latestOnFilesChange.current?.(null);
      return;
    }
    const summary = files
      .map((file) => `${file.name} (${formatBytes(file.size)})`)
      .join(", ");
    setStatus({ message: `Queued: ${summary}` , tone: "ready" });
    setShowClear(true);
    latestOnFilesChange.current?.(input.files);
  }, [emptyStatus, latestOnFilesChange]);

  const setFilesOnInput = useCallback(
    (files: File[]) => {
      const input = inputRef.current;
      if (!input) return;

      let transfer: DataTransfer | null = null;
      try {
        transfer = new DataTransfer();
      } catch (error) {
        console.warn("DataTransfer not supported", error);
      }

      if (!transfer) {
        // Fallback: replace files if DataTransfer is unavailable
        if (files.length === 0) {
          input.value = "";
          syncFromInput();
        } else if (!multiple && files[0]) {
          applyError("Your browser does not support multi-file clipboard uploads.");
        }
        return;
      }

      if (multiple && input.files?.length) {
        Array.from(input.files).forEach((existing) => {
          try {
            transfer!.items.add(existing);
          } catch (error) {
            console.warn("Failed to retain existing file", error);
          }
        });
      }

      files.forEach((file) => {
        try {
          transfer!.items.add(file);
        } catch (error) {
          console.warn("Failed to queue file", error);
        }
      });

      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      syncFromInput();
    },
    [applyError, multiple, syncFromInput]
  );

  const handleFiles = useCallback(
    (fileList: FileList | File[] | null | undefined) => {
      if (!fileList) return;
      const files = Array.from(fileList);
      if (!files.length) return;
      const accepted = files.filter((file) => acceptsFile(file, tokens));
      if (!accepted.length) {
        applyError("Those files are not supported. Use images or PDFs.");
        return;
      }
      setFilesOnInput(accepted);
    },
    [applyError, setFilesOnInput, tokens]
  );

  const handleBrowse = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!event.target) return;
      resetError();
      syncFromInput();
    },
    [resetError, syncFromInput]
  );

  const handleClear = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    resetError();
    input.value = "";
    syncFromInput();
  }, [resetError, syncFromInput]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsActive(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsActive(false);
      handleFiles(event.dataTransfer?.files);
    },
    [handleFiles]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleBrowse();
      }
    },
    [handleBrowse]
  );

  useEffect(() => resetError, [resetError]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handlePaste = (event: ClipboardEvent) => {
      if (!event || typeof event !== "object") return;
      const clipboard = event.clipboardData;
      if (!clipboard || !clipboard.files || clipboard.files.length === 0) {
        return;
      }
      const target = event.target as Element | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target && target.getAttribute && target.getAttribute("contenteditable") === "true")
      ) {
        return;
      }
      event.preventDefault();
      handleFiles(clipboard.files);
    };

    root.addEventListener("paste", handlePaste);
    return () => {
      root.removeEventListener("paste", handlePaste);
    };
  }, [handleFiles]);

  return (
    <div
      ref={rootRef}
      className={["attachment-uploader", className].filter(Boolean).join(" ")}
      data-attachment-active={isActive ? "true" : undefined}
      data-attachment-error={isError ? "true" : undefined}
    >
      <input
        ref={inputRef}
        type="file"
        name={name}
        id={id}
        accept={accept}
        multiple={multiple}
        hidden
        onChange={handleInputChange}
      />
      <div
        className="attachment-uploader__dropzone"
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={(event) => {
          event.preventDefault();
          handleBrowse();
        }}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDragEnd={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="attachment-uploader__icon" aria-hidden="true">
          📎
        </div>
        <p className="attachment-uploader__title">{label}</p>
        <p className="attachment-uploader__hint">{hint}</p>
        <div className="attachment-uploader__actions">
          <button
            type="button"
            className="attachment-uploader__browse"
            onClick={(event) => {
              event.preventDefault();
              handleBrowse();
            }}
          >
            {browseLabel}
          </button>
          <span>or paste images directly</span>
          {prefixActions}
        </div>
      </div>
      <p
        className="attachment-uploader__status"
        data-tone={status.tone}
        aria-live="polite"
      >
        {status.message}
      </p>
      {showClear && (
        <button
          type="button"
          className="attachment-uploader__clear"
          onClick={(event) => {
            event.preventDefault();
            handleClear();
          }}
        >
          Clear selection
        </button>
      )}
    </div>
  );
}

export default AttachmentUploader;
