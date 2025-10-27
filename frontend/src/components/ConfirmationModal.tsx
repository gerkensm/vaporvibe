import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

import "./ABTesting.css";

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmTone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmTone = "primary",
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const content = (
    <div className="ab-modal" role="presentation">
      <div className="ab-modal__backdrop" onClick={onCancel} />
      <div
        className="ab-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ab-modal-title"
      >
        <div className="ab-modal__header">
          <h2 id="ab-modal-title" className="ab-modal__title">
            {title}
          </h2>
          <button
            type="button"
            className="ab-modal__close"
            aria-label="Close confirmation dialog"
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        {description ? (
          <div className="ab-modal__description">{description}</div>
        ) : null}
        <div className="ab-modal__actions">
          <button
            type="button"
            className="ab-modal__button admin-secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`ab-modal__button ${
              confirmTone === "danger" ? "admin-danger" : "admin-primary"
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default ConfirmationModal;
