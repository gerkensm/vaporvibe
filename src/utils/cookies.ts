import type { ServerResponse } from "node:http";

export interface CookieOptions {
  maxAge?: number;
  domain?: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [rawKey, rawValue] = part.split("=", 2);
    if (!rawKey || rawValue === undefined) continue;
    const key = rawKey.trim();
    if (!key) continue;
    out[key] = decodeURIComponent(rawValue.trim());
  }
  return out;
}

export function setCookie(res: ServerResponse, name: string, value: string, options: CookieOptions = {}): void {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  const existing = res.getHeader("Set-Cookie");
  const cookieValue = parts.join("; ");
  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookieValue]);
  } else if (typeof existing === "string") {
    res.setHeader("Set-Cookie", [existing, cookieValue]);
  } else {
    res.setHeader("Set-Cookie", cookieValue);
  }
}
