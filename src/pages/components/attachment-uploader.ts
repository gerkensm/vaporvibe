import { escapeHtml } from "../../utils/html.js";

export const ATTACHMENT_UPLOADER_STYLES = `
    .attachment-uploader {
      display: grid;
      gap: 10px;
    }
    .attachment-uploader__dropzone {
      border: 2px dashed rgba(15, 23, 42, 0.18);
      border-radius: 16px;
      padding: 20px;
      display: grid;
      gap: 10px;
      justify-items: start;
      background: rgba(255, 255, 255, 0.7);
      transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
      cursor: pointer;
      outline: none;
    }
    .attachment-uploader__dropzone:focus-visible {
      border-color: var(--accent);
      box-shadow: 0 0 0 4px var(--ring);
    }
    .attachment-uploader[data-attachment-active="true"] .attachment-uploader__dropzone {
      border-color: var(--accent);
      background: rgba(29, 78, 216, 0.05);
      box-shadow: 0 16px 32px rgba(29, 78, 216, 0.15);
    }
    .attachment-uploader[data-attachment-error="true"] .attachment-uploader__dropzone {
      border-color: var(--error);
      background: rgba(185, 28, 28, 0.08);
    }
    .attachment-uploader__icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-size: 1.2rem;
      background: rgba(15, 23, 42, 0.08);
      color: var(--accent);
    }
    .attachment-uploader__title {
      font-weight: 600;
      font-size: 0.95rem;
      margin: 0;
      color: var(--text);
    }
    .attachment-uploader__hint {
      margin: 0;
      color: var(--subtle);
      font-size: 0.85rem;
    }
    .attachment-uploader__actions {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      font-size: 0.85rem;
      color: var(--muted);
    }
    .attachment-uploader__browse {
      border: none;
      border-radius: 999px;
      padding: 6px 14px;
      background: var(--accent);
      color: #fff;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .attachment-uploader__browse:hover,
    .attachment-uploader__browse:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 12px 20px rgba(29, 78, 216, 0.24);
      outline: none;
    }
    .attachment-uploader__status {
      margin: 0;
      font-size: 0.8rem;
      color: var(--muted);
    }
    .attachment-uploader__status[data-tone="ready"] {
      color: var(--success);
    }
    .attachment-uploader__status[data-tone="error"] {
      color: var(--error);
    }
    .attachment-uploader__clear {
      justify-self: start;
      border: none;
      background: transparent;
      color: var(--accent);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
    }
    .attachment-uploader__clear:hover,
    .attachment-uploader__clear:focus-visible {
      text-decoration: underline;
      outline: none;
    }
`;

export const ATTACHMENT_UPLOADER_RUNTIME = `(() => {
  const initialize = () => {
    const uploaders = Array.from(
      document.querySelectorAll('[data-attachment-root]'),
    );

    if (!uploaders.length) {
      return;
    }

    const toTokens = (accept) => {
      if (!accept) return [];
      return accept
        .split(',')
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length > 0);
    };

    const formatBytes = (value) => {
      if (!Number.isFinite(value) || value <= 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = value;
      let unit = 0;
      while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
      }
      const precision = size < 10 && unit > 0 ? 1 : 0;
      return size.toFixed(precision) + ' ' + units[unit];
    };

    const acceptsFile = (file, tokens) => {
      if (!tokens.length) return true;
      const type = (file.type || '').toLowerCase();
      const name = (file.name || '').toLowerCase();
      return tokens.some((token) => {
        if (!token) return false;
        if (token === '*') return true;
        if (token.startsWith('.')) {
          return name.endsWith(token);
        }
        if (token.endsWith('/*')) {
          const prefix = token.slice(0, -1);
          return type.startsWith(prefix);
        }
        return type === token;
      });
    };

    uploaders.forEach((root) => {
      if (!(root instanceof HTMLElement)) return;
      if (root.getAttribute('data-attachment-initialized') === 'true') {
        return;
      }
      root.setAttribute('data-attachment-initialized', 'true');
      const input = root.querySelector('[data-attachment-input]');
      const dropzone = root.querySelector('[data-attachment-dropzone]');
      const browseButton = root.querySelector('[data-attachment-browse]');
      const statusEl = root.querySelector('[data-attachment-status]');
      const clearButton = root.querySelector('[data-attachment-clear]');
      const emptyText = root.getAttribute('data-attachment-empty') || 'No files selected yet.';
      const acceptTokens = toTokens(root.getAttribute('data-attachment-accept') || (input && input.getAttribute('accept')) || '');

      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      const setStatus = (message, tone = 'idle') => {
        if (!(statusEl instanceof HTMLElement)) {
          return;
        }
        statusEl.textContent = message;
        statusEl.setAttribute('data-tone', tone);
      };

      const syncFromInput = () => {
        if (!(input instanceof HTMLInputElement)) {
          return;
        }
        const files = input.files ? Array.from(input.files) : [];
        if (files.length === 0) {
          setStatus(emptyText, 'idle');
          if (clearButton instanceof HTMLButtonElement) {
            clearButton.hidden = true;
          }
          return;
        }
        const summary = files
          .map((file) => file.name + ' (' + formatBytes(file.size) + ')')
          .join(', ');
        setStatus('Queued: ' + summary, 'ready');
        if (clearButton instanceof HTMLButtonElement) {
          clearButton.hidden = false;
        }
      };

      const addFiles = (fileList) => {
        const files = Array.from(fileList || []);
        if (!files.length) {
          return;
        }
        const accepted = files.filter((file) => acceptsFile(file, acceptTokens));
        if (!accepted.length) {
          root.setAttribute('data-attachment-error', 'true');
          setStatus('Those files are not supported. Use images or PDFs.', 'error');
          window.setTimeout(() => {
            root.removeAttribute('data-attachment-error');
            setStatus(emptyText, 'idle');
          }, 3000);
          return;
        }
        let transfer;
        try {
          transfer = new DataTransfer();
        } catch (error) {
          console.warn('DataTransfer not supported', error);
          return;
        }
        if (input.multiple && input.files?.length) {
          Array.from(input.files).forEach((existing) => {
            try {
              transfer.items.add(existing);
            } catch (error) {
              console.warn('Failed to retain existing file', error);
            }
          });
        }
        accepted.forEach((file) => {
          try {
            transfer.items.add(file);
          } catch (error) {
            console.warn('Failed to queue file', error);
          }
        });
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        syncFromInput();
      };

      if (browseButton instanceof HTMLButtonElement) {
        browseButton.addEventListener('click', (event) => {
          event.preventDefault();
          input.click();
        });
      }

      if (dropzone instanceof HTMLElement) {
        const activate = () => root.setAttribute('data-attachment-active', 'true');
        const deactivate = () => root.removeAttribute('data-attachment-active');
        dropzone.addEventListener('dragover', (event) => {
          event.preventDefault();
          activate();
        });
        dropzone.addEventListener('dragleave', deactivate);
        dropzone.addEventListener('dragend', deactivate);
        dropzone.addEventListener('drop', (event) => {
          event.preventDefault();
          deactivate();
          if (event.dataTransfer?.files?.length) {
            addFiles(event.dataTransfer.files);
          }
        });
        dropzone.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            input.click();
          }
        });
      }

      root.addEventListener('paste', (event) => {
        if (!event || typeof event !== 'object') {
          return;
        }
        const clipboard = event.clipboardData;
        if (!clipboard || !clipboard.files || clipboard.files.length === 0) {
          return;
        }
        const target = event.target;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target && target.getAttribute && target.getAttribute('contenteditable') === 'true')
        ) {
          return;
        }
        event.preventDefault();
        addFiles(clipboard.files);
      });

      input.addEventListener('change', () => {
        syncFromInput();
      });

      if (clearButton instanceof HTMLButtonElement) {
        clearButton.addEventListener('click', (event) => {
          event.preventDefault();
          input.value = '';
          syncFromInput();
        });
      }

      syncFromInput();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();`;

interface AttachmentUploaderOptions {
  inputName: string;
  inputId?: string;
  label?: string;
  hint?: string;
  browseLabel?: string;
  accept?: string;
  multiple?: boolean;
  emptyStatus?: string;
}

export function renderAttachmentUploader(
  options: AttachmentUploaderOptions,
): string {
  const {
    inputName,
    inputId,
    label = "Add attachments",
    hint = "Drop files, paste with Ctrl+V, or browse to upload.",
    browseLabel = "Browse files",
    accept = "image/*,application/pdf",
    multiple = true,
    emptyStatus = "No files selected yet.",
  } = options;

  const idAttr = inputId ? ` id="${escapeHtml(inputId)}"` : "";
  const multipleAttr = multiple ? " multiple" : "";

  return `<div
    class="attachment-uploader"
    data-attachment-root
    data-attachment-accept="${escapeHtml(accept)}"
    data-attachment-empty="${escapeHtml(emptyStatus)}"
  >
    <input
      type="file"
      name="${escapeHtml(inputName)}"
      accept="${escapeHtml(accept)}"${multipleAttr}${idAttr}
      data-attachment-input
      hidden
    />
    <div
      class="attachment-uploader__dropzone"
      data-attachment-dropzone
      role="button"
      tabindex="0"
      aria-label="${escapeHtml(label)}"
    >
      <div class="attachment-uploader__icon" aria-hidden="true">📎</div>
      <p class="attachment-uploader__title">${escapeHtml(label)}</p>
      <p class="attachment-uploader__hint">${escapeHtml(hint)}</p>
      <div class="attachment-uploader__actions">
        <button type="button" class="attachment-uploader__browse" data-attachment-browse>
          ${escapeHtml(browseLabel)}
        </button>
        <span>or paste images directly</span>
      </div>
    </div>
    <p class="attachment-uploader__status" data-attachment-status aria-live="polite">
      ${escapeHtml(emptyStatus)}
    </p>
    <button type="button" class="attachment-uploader__clear" data-attachment-clear hidden>
      Clear selection
    </button>
  </div>`;
}
