import type { IncomingMessage, IncomingHttpHeaders } from "node:http";

interface MockRequestOptions {
  headers?: Record<string, string>;
  body?: Array<string | Buffer>;
}

export function createIncomingMessage({
  headers = {},
  body = [],
}: MockRequestOptions = {}): IncomingMessage {
  const normalized: IncomingHttpHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  const chunks = body.map((chunk) => (typeof chunk === "string" ? Buffer.from(chunk) : chunk));
  let index = 0;

  const request = {
    headers: normalized,
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (index < chunks.length) {
            return { value: chunks[index++], done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
  } as unknown as IncomingMessage;

  return request;
}
