export function maskSensitive(value: string | null | undefined): string {
  if (!value) {
    return "not set";
  }
  const length = value.length;
  if (length === 0) {
    return "not set";
  }
  const maskLength = Math.min(length, 8);
  const masked = "*".repeat(maskLength);
  if (length <= maskLength) {
    return masked;
  }
  return `${masked} (${length} chars)`;
}
