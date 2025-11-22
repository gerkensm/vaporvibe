import { useEffect, useMemo, useState } from "react";

import "./TokenBudgetControl.css";

export interface TokenBudgetControlProps {
  label: string;
  description?: string;
  helper?: string;
  value: number | null;
  defaultValue?: number;
  min?: number;
  max?: number;
  units?: string;
  allowBlank?: boolean;
  disabled?: boolean;
  accent?: "output" | "reasoning";
  specialLabels?: Record<string, string>;
  emptyLabel?: string;
  defaultLabel?: string;
  onChange: (value: number | null) => void;
}

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (typeof min === "number") {
    next = Math.max(min, next);
  }
  if (typeof max === "number") {
    next = Math.min(max, next);
  }
  return next;
}

export function TokenBudgetControl({
  label,
  description,
  helper,
  value,
  defaultValue,
  min,
  max,
  units = "tokens",
  allowBlank = true,
  disabled = false,
  accent = "output",
  specialLabels,
  emptyLabel,
  defaultLabel,
  onChange,
}: TokenBudgetControlProps) {
  const [manual, setManual] = useState<string>(
    value === null || value === undefined ? "" : String(value)
  );

  useEffect(() => {
    const currentNumeric = manual === "" ? null : Number(manual);
    const incoming = value ?? null;
    if (incoming !== currentNumeric) {
      setManual(value === null || value === undefined ? "" : String(value));
    }
  }, [value, manual]);

  const effectiveValue = useMemo(() => {
    if (value === null || value === undefined) {
      return undefined;
    }
    return clamp(value, min, max);
  }, [value, min, max]);

  const formatDisplay = (input: number | null | undefined) => {
    if (input === null || input === undefined) {
      if (emptyLabel) return emptyLabel;
      if (defaultLabel && input === null) return defaultLabel;
      return allowBlank ? "Auto" : "Not set";
    }
    return `${input.toLocaleString()} ${units}`;
  };

  const handleSliderChange = (next: number) => {
    setManual(String(next));
    onChange(next);
  };

  const handleManualChange = (raw: string) => {
    setManual(raw);
    if (raw.trim() === "") {
      onChange(allowBlank ? null : defaultValue ?? null);
      return;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      onChange(clamp(parsed, min, max));
    }
  };

  const sliderAvailable =
    typeof min === "number" && typeof max === "number" && min < max;

  const accentClass = accent === "reasoning" ? "token-control--reasoning" : "";

  return (
    <div className={`token-control ${accentClass}`}>
      <div className="token-control__header">
        <div>
          <span className="token-control__label">{label}</span>
          {description && (
            <p className="token-control__description">{description}</p>
          )}
        </div>
        <span className="token-control__value">
          {formatDisplay(effectiveValue ?? null)}
        </span>
      </div>

      {sliderAvailable && (
        <input
          type="range"
          min={min}
          max={max}
          value={effectiveValue ?? defaultValue ?? min ?? 0}
          disabled={disabled}
          onChange={(event) => handleSliderChange(Number(event.target.value))}
        />
      )}

      <div className="token-control__manual">
        <input
          type="number"
          inputMode="numeric"
          placeholder={allowBlank ? "Leave blank for auto" : "Enter value"}
          value={manual}
          disabled={disabled}
          onChange={(event) => handleManualChange(event.target.value)}
        />
        <div className="token-control__badge">{units}</div>
      </div>

      {helper && <p className="token-control__helper">{helper}</p>}

      {specialLabels && sliderAvailable && (
        <div className="token-control__special">
          {Object.entries(specialLabels).map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === "" && allowBlank) {
                  setManual("");
                  onChange(null);
                  return;
                }
                const numeric = Number(key);
                if (Number.isFinite(numeric)) {
                  setManual(String(numeric));
                  onChange(clamp(numeric, min, max));
                }
              }}
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default TokenBudgetControl;
