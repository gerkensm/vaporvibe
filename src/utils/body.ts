import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";
import querystring from "node:querystring";
import type { RequestFile } from "../types.js";

export interface ParsedBody {
  raw: string;
  data: Record<string, unknown>;
  files: ParsedFile[];
}

export interface ParsedFile {
  fieldName: string;
  filename: string;
  mimeType: string;
  size: number;
  data: Buffer;
  base64?: string;
}

const DEFAULT_MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB safety cap to avoid ballooning prompts

export async function readBody(req: IncomingMessage): Promise<ParsedBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const buffer = Buffer.concat(chunks);
  const raw = buffer.toString("utf8");
  const type = (req.headers["content-type"] || "").split(";")[0]?.trim().toLowerCase();

  if (!raw) {
    return { raw: "", data: {}, files: [] };
  }

  if (type === "multipart/form-data") {
    const boundary = extractBoundary(req.headers["content-type"]);
    if (!boundary) {
      return { raw, data: {}, files: [] };
    }
    const parsed = parseMultipartFormData(buffer, boundary);
    return { raw, data: parsed.fields, files: parsed.files };
  }

  if (type === "application/json") {
    return { raw, data: safeJson(raw), files: [] };
  }

  if (type === "application/x-www-form-urlencoded") {
    return {
      raw,
      data: querystring.parse(raw) as Record<string, unknown>,
      files: [],
    };
  }

  return { raw, data: { _raw: raw }, files: [] };
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

function extractBoundary(contentType: string | string[] | undefined): string | undefined {
  if (!contentType) {
    return undefined;
  }
  const value = Array.isArray(contentType) ? contentType[0] : contentType;
  if (!value) {
    return undefined;
  }
  const match = /boundary=(?:"?)([^";]+)(?:"?)/i.exec(value);
  return match ? match[1] : undefined;
}

function parseMultipartFormData(
  buffer: Buffer,
  boundary: string,
): { fields: Record<string, unknown>; files: ParsedFile[] } {
  const boundaryMarker = `--${boundary}`;
  const segments = buffer.toString("latin1").split(boundaryMarker);
  const fields: Record<string, unknown> = {};
  const files: ParsedFile[] = [];

  for (const segment of segments) {
    if (!segment || segment === "--" || segment === "--\r\n") {
      continue;
    }
    let trimmed = segment;
    if (trimmed.startsWith("\r\n")) {
      trimmed = trimmed.slice(2);
    }
    if (trimmed.endsWith("\r\n")) {
      trimmed = trimmed.slice(0, -2);
    }
    if (!trimmed || trimmed === "--") {
      continue;
    }

    const separatorIndex = trimmed.indexOf("\r\n\r\n");
    if (separatorIndex === -1) {
      continue;
    }

    const headerText = trimmed.slice(0, separatorIndex);
    let contentText = trimmed.slice(separatorIndex + 4);
    if (contentText.endsWith("\r\n")) {
      contentText = contentText.slice(0, -2);
    }

    const headers = headerText.split("\r\n");
    let fieldName: string | undefined;
    let filename: string | undefined;
    let mimeType = "application/octet-stream";

    for (const header of headers) {
      const [rawKey, ...rawValue] = header.split(":");
      if (!rawKey || rawValue.length === 0) {
        continue;
      }
      const key = rawKey.trim().toLowerCase();
      const value = rawValue.join(":").trim();
      if (key === "content-disposition") {
        const nameMatch = /name="([^"]+)"/.exec(value);
        if (nameMatch) {
          fieldName = nameMatch[1];
        }
        const filenameMatch = /filename="([^"]*)"/.exec(value);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      } else if (key === "content-type") {
        if (value) {
          mimeType = value;
        }
      }
    }

    if (!fieldName) {
      continue;
    }

    const contentBuffer = Buffer.from(contentText, "latin1");

    if (filename) {
      files.push({
        fieldName,
        filename,
        mimeType,
        size: contentBuffer.length,
        data: contentBuffer,
        base64: contentBuffer.toString("base64"),
      });
    } else {
      appendFieldValue(fields, fieldName, contentBuffer.toString("utf8"));
    }
  }

  return { fields, files };
}

function appendFieldValue(
  fields: Record<string, unknown>,
  name: string,
  value: string,
): void {
  if (Object.prototype.hasOwnProperty.call(fields, name)) {
    const existing = fields[name];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      fields[name] = [existing as string, value];
    }
  } else {
    fields[name] = value;
  }
}

export function convertParsedFilesToRequestFiles(
  files: ParsedFile[],
  maxBytes: number = DEFAULT_MAX_FILE_BYTES
): RequestFile[] {
  return files.map((file) => {
    const safeMime =
      file.mimeType && file.mimeType.trim().length > 0
        ? file.mimeType
        : "application/octet-stream";
    const size = typeof file.size === "number" ? file.size : file.data.length;
    const max = Math.max(0, maxBytes);
    const buffer = max > 0 && file.data.length > max ? file.data.subarray(0, max) : file.data;
    const truncated = max > 0 && file.data.length > max;
    const base64 = buffer.toString("base64");
    return {
      id: crypto.randomUUID(),
      name: file.filename || file.fieldName || "upload",
      mimeType: safeMime,
      size,
      base64,
      fieldName: file.fieldName || undefined,
      truncated,
    };
  });
}
