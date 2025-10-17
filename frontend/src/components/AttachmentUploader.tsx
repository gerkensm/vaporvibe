import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
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
  onFilesChange?: (files: File[]) => void;
  variant?: "default" | "creative";
  examples?: string[];
  captureDocumentPaste?: boolean;
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
  variant = "default",
  examples,
  captureDocumentPaste = false,
}: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isError, setIsError] = useState(false);
  const [status, setStatus] = useState<StatusState>({
    message: emptyStatus,
    tone: "idle",
  });
  const [showClear, setShowClear] = useState(false);
  const errorTimeoutRef = useRef<number | null>(null);
  const pasteHighlightTimeoutRef = useRef<number | null>(null);
  const tokens = useMemo(() => toTokens(accept), [accept]);
  const isCreative = variant === "creative";
  const creativeExamples = useMemo(() => {
    if (examples && examples.length > 0) {
      return examples;
    }
    if (!isCreative) return null;
    return ["Wireframes", "Mood boards", "Flow charts", "Screenshots"];
  }, [examples, isCreative]);
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

  const syncInputFromQueue = useCallback(
    (files: File[]) => {
      const input = inputRef.current;
      if (!input) return;

      if (files.length === 0) {
        input.value = "";
        return;
      }

      let transfer: DataTransfer | null = null;
      try {
        transfer = new DataTransfer();
      } catch (error) {
        console.warn("DataTransfer not supported", error);
      }

      if (!transfer) {
        // Fallback: leave existing selection in place
        return;
      }

      files.forEach((file) => {
        try {
          transfer!.items.add(file);
        } catch (error) {
          console.warn("Failed to queue file", error);
        }
      });

      input.files = transfer.files;
    },
    []
  );

  const updateQueue = useCallback(
    (nextFiles: File[]) => {
      setQueuedFiles(nextFiles);
      if (!nextFiles.length) {
        setStatus({ message: emptyStatus, tone: "idle" });
        setShowClear(false);
      } else {
        const summary = nextFiles
          .map((file) => `${file.name} (${formatBytes(file.size)})`)
          .join(", ");
        setStatus({ message: `Queued: ${summary}`, tone: "ready" });
        setShowClear(true);
      }
      latestOnFilesChange.current?.(nextFiles);
      syncInputFromQueue(nextFiles);
    },
    [emptyStatus, latestOnFilesChange, syncInputFromQueue]
  );

  const handleFiles = useCallback(
    (fileList: FileList | File[] | null | undefined) => {
      if (!fileList) return;
      const files = Array.from(fileList);
      if (!files.length) return;
      resetError();
      const accepted = files.filter((file) => acceptsFile(file, tokens));
      if (!accepted.length) {
        applyError("Those files are not supported for this uploader.");
        return;
      }
      if (multiple) {
        updateQueue([...queuedFiles, ...accepted]);
      } else {
        updateQueue([accepted[0]]);
      }
    },
    [applyError, multiple, queuedFiles, resetError, tokens, updateQueue]
  );

  const handleBrowse = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!event.target) return;
      resetError();
      const selected = event.target.files
        ? Array.from(event.target.files)
        : [];
      event.target.value = "";
      if (!selected.length) {
        updateQueue([]);
        return;
      }
      handleFiles(selected);
    },
    [handleFiles, resetError, updateQueue]
  );

  const handleClear = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    resetError();
    input.value = "";
    updateQueue([]);
  }, [resetError, updateQueue]);

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

  const handlePaste = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      if (clipboard.files && clipboard.files.length > 0) {
        event.preventDefault();
        handleFiles(clipboard.files);
      }
    },
    [handleFiles]
  );

  const rootClassName = useMemo(
    () =>
      [
        "attachment-uploader",
        isCreative ? "attachment-uploader--creative" : null,
        className,
      ]
        .filter(Boolean)
        .join(" "),
    [className, isCreative]
  );

  useEffect(() => {
    if (!captureDocumentPaste) return;
    if (typeof document === "undefined") return;

    const handleDocumentPaste = (event: ClipboardEvent) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      if (!clipboard.files || clipboard.files.length === 0) {
        return;
      }

      const files = Array.from(clipboard.files).filter((file) =>
        acceptsFile(file, tokens)
      );
      if (!files.length) {
        return;
      }

      event.preventDefault();
      handleFiles(files);
      setIsActive(true);
      if (pasteHighlightTimeoutRef.current) {
        window.clearTimeout(pasteHighlightTimeoutRef.current);
      }
      pasteHighlightTimeoutRef.current = window.setTimeout(() => {
        setIsActive(false);
        pasteHighlightTimeoutRef.current = null;
      }, 500);
    };

    document.addEventListener("paste", handleDocumentPaste);
    return () => {
      document.removeEventListener("paste", handleDocumentPaste);
      if (pasteHighlightTimeoutRef.current) {
        window.clearTimeout(pasteHighlightTimeoutRef.current);
        pasteHighlightTimeoutRef.current = null;
      }
    };
  }, [captureDocumentPaste, handleFiles, tokens]);

  return (
    <div
      ref={rootRef}
      className={rootClassName}
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
          const target = event.target as HTMLElement | null;
          if (target && target.closest("button")) {
            return;
          }
          event.preventDefault();
          handleBrowse();
        }}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDragEnd={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        {isCreative ? (
          <div className="attachment-uploader__art" aria-hidden="true">
            <span className="attachment-uploader__shape attachment-uploader__shape--canvas" />
            <span className="attachment-uploader__shape attachment-uploader__shape--photo" />
            <span className="attachment-uploader__shape attachment-uploader__shape--spark" />
          </div>
        ) : (
          <div className="attachment-uploader__icon" aria-hidden="true">
            📎
          </div>
        )}
        <div className="attachment-uploader__copy">
          <p className="attachment-uploader__title">{label}</p>
          <p className="attachment-uploader__hint">{hint}</p>
          {creativeExamples ? (
            <ul className="attachment-uploader__examples" aria-label="Suggested uploads">
              {creativeExamples.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="attachment-uploader__actions">
          <button
            type="button"
            className="attachment-uploader__browse"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
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
