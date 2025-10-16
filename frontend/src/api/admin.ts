import type {
  AdminHistoryResponse,
  AdminStateResponse,
  AdminUpdateResponse,
} from "./types";

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error(`Empty response (status ${response.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${String(error)}`);
  }
}

export async function fetchAdminState(): Promise<AdminStateResponse> {
  const response = await fetch("/api/admin/state", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Failed to load admin state (status ${response.status})`);
  }

  return parseJson<AdminStateResponse>(response);
}

export async function submitBriefUpdate(
  formData: FormData
): Promise<AdminUpdateResponse> {
  const response = await fetch("/api/admin/brief", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `Brief update failed (status ${response.status})`;
    try {
      const parsed = JSON.parse(text) as AdminUpdateResponse;
      if (parsed?.message) {
        message = parsed.message;
      }
    } catch {
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  return parseJson<AdminUpdateResponse>(response);
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
  const response = await fetch("/api/admin/provider", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `Provider update failed (status ${response.status})`;
    try {
      const parsed = JSON.parse(text) as AdminUpdateResponse;
      if (parsed?.message) {
        message = parsed.message;
      }
    } catch {
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  return parseJson<AdminUpdateResponse>(response);
}

export interface RuntimeUpdatePayload {
  historyLimit: number;
  historyMaxBytes: number;
  instructionPanel: boolean;
}

export async function submitRuntimeUpdate(
  payload: RuntimeUpdatePayload
): Promise<AdminUpdateResponse> {
  const response = await fetch("/api/admin/runtime", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `Runtime update failed (status ${response.status})`;
    try {
      const parsed = JSON.parse(text) as AdminUpdateResponse;
      if (parsed?.message) {
        message = parsed.message;
      }
    } catch {
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  return parseJson<AdminUpdateResponse>(response);
}

export async function submitHistoryImport(
  snapshot: unknown
): Promise<AdminUpdateResponse> {
  const response = await fetch("/api/admin/history/import", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ snapshot }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `History import failed (status ${response.status})`;
    try {
      const parsed = JSON.parse(text) as AdminUpdateResponse;
      if (parsed?.message) {
        message = parsed.message;
      }
    } catch {
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  return parseJson<AdminUpdateResponse>(response);
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

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    credentials: "same-origin",
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `Failed to load history (status ${response.status})`;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed?.message) {
        message = parsed.message;
      }
    } catch {
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  return parseJson<AdminHistoryResponse>(response);
}
