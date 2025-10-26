export const BRANCH_FIELD = "__vaporvibe_branch";

export function sanitizeBranchId(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function branchIdFromUrl(href: string): string | null {
  try {
    const current = new URL(href);
    return current.searchParams.get(BRANCH_FIELD);
  } catch {
    return null;
  }
}

interface ResolveActiveBranchOptions {
  href: string;
  frameBranchAttribute?: string | null;
}

export function resolveActiveBranchId(
  options: ResolveActiveBranchOptions
): string | null {
  const fromUrl = sanitizeBranchId(branchIdFromUrl(options.href));
  if (fromUrl) {
    return fromUrl;
  }
  return sanitizeBranchId(options.frameBranchAttribute);
}

export function applyBranchToUrl(
  branchId: string | null,
  url: URL
): void {
  if (!branchId) return;
  if (!url.searchParams.has(BRANCH_FIELD)) {
    url.searchParams.set(BRANCH_FIELD, branchId);
  }
}

export function ensureBranchField(
  branchId: string | null,
  form: HTMLFormElement,
  doc: Pick<Document, "createElement">
): void {
  if (!branchId) return;
  const existing = form.querySelector<HTMLInputElement>(
    `input[name="${BRANCH_FIELD}"]`
  );
  if (existing) {
    existing.value = branchId;
    return;
  }
  const marker = doc.createElement("input") as HTMLInputElement;
  marker.type = "hidden";
  marker.name = BRANCH_FIELD;
  marker.value = branchId;
  form.appendChild(marker);
}
