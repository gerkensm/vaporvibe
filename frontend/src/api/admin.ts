import type {
  AdminHistoryResponse,
  AdminStateResponse,
  AdminUpdateResponse,
} from "./types";

export class AdminApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.details = details;
  }
}

function parseErrorPayload(
  text: string,
  fallback: string
): { message: string; details?: unknown } {
  if (!text) {
    return { message: fallback };
  }
  try {
    const parsed = JSON.parse(text) as { message?: string };
    if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
      return { message: parsed.message, details: parsed };
    }
    return { message: fallback, details: parsed };
  } catch {
    return { message: text };
  }
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  errorFallback: string
): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();

  if (!response.ok) {
    const { message, details } = parseErrorPayload(
      text,
      `${errorFallback} (status ${response.status})`
    );
    throw new AdminApiError(response.status, message, details);
  }

  if (!text) {
    throw new AdminApiError(
      response.status,
      `Empty response (status ${response.status})`
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new AdminApiError(
      response.status,
      `Failed to parse JSON response: ${String(error)}`,
      text
    );
  }
}

export async function fetchAdminState(): Promise<AdminStateResponse> {
  return requestJson<AdminStateResponse>(
    "/api/admin/state",
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "same-origin",
    },
    "Failed to load admin state"
  );
}

export async function submitBriefUpdate(
  formData: FormData
): Promise<AdminUpdateResponse> {
  return requestJson<AdminUpdateResponse>(
    "/api/admin/brief",
    {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    },
    "Brief update failed"
  );
}

export interface ProviderUpdatePayload {
  provider: string;
  model: string;
  maxOutputTokens: number;
  reasoningMode: string;
  reasoningTokensEnabled?: boolean;
  reasoningTokens?: number | null;
  apiKey?: string;
}

export async function submitProviderUpdate(
  payload: ProviderUpdatePayload
): Promise<AdminUpdateResponse> {
  return requestJson<AdminUpdateResponse>(
    "/api/admin/provider",
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Provider update failed"
  );
}

export interface ProviderVerifyPayload {
  provider: string;
  apiKey: string;
}

export async function verifyProviderKey(
  payload: ProviderVerifyPayload
): Promise<AdminUpdateResponse> {
  return requestJson<AdminUpdateResponse>(
    "/api/admin/provider/verify",
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Provider key verification failed"
  );
}

export interface RuntimeUpdatePayload {
  historyLimit: number;
  historyMaxBytes: number;
  instructionPanel: boolean;
}

export async function submitRuntimeUpdate(
  payload: RuntimeUpdatePayload
): Promise<AdminUpdateResponse> {
  return requestJson<AdminUpdateResponse>(
    "/api/admin/runtime",
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Runtime update failed"
  );
}

export async function submitHistoryImport(
  snapshot: unknown
): Promise<AdminUpdateResponse> {
  return requestJson<AdminUpdateResponse>(
    "/api/admin/history/import",
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ snapshot }),
    },
    "History import failed"
  );
}

export async function fetchAdminHistory(params?: {
  offset?: number;
  limit?: number;
}): Promise<AdminHistoryResponse> {
  const query = new URLSearchParams();
  if (typeof params?.offset === "number") {
    query.set("offset", String(Math.max(0, Math.floor(params.offset))));
  }
  if (typeof params?.limit === "number") {
    query.set("limit", String(Math.max(1, Math.floor(params.limit))));
  }

  const endpoint = query.toString()
    ? `/api/admin/history?${query.toString()}`
    : "/api/admin/history";

  return requestJson<AdminHistoryResponse>(
    endpoint,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "same-origin",
    },
    "Failed to load history"
  );
}

export async function deleteHistoryEntry(
  id: string
): Promise<AdminUpdateResponse> {
  return requestJson<AdminUpdateResponse>(
    `/api/admin/history/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
      credentials: "same-origin",
    },
    "History deletion failed"
  );
}

export async function deleteAllHistoryEntries(): Promise<AdminUpdateResponse> {
  return requestJson<AdminUpdateResponse>(
    "/api/admin/history",
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
      credentials: "same-origin",
    },
    "History purge failed"
  );
}
