import type { IncomingMessage } from "node:http";
import querystring from "node:querystring";

export interface ParsedBody {
  raw: string;
  data: Record<string, unknown>;
}

export async function readBody(req: IncomingMessage): Promise<ParsedBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const type = (req.headers["content-type"] || "").split(";")[0]?.trim().toLowerCase();

  if (!raw) {
    return { raw: "", data: {} };
  }

  if (type === "application/json") {
    return { raw, data: safeJson(raw) };
  }

  if (type === "application/x-www-form-urlencoded") {
    return { raw, data: querystring.parse(raw) as Record<string, unknown> };
  }

  return { raw, data: { _raw: raw } };
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed } as Record<string, unknown>;
  } catch {
    return { _raw: value };
  }
}
