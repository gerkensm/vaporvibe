import { describe, expect, it } from "vitest";

import { readBody } from "../../src/utils/body.js";
import { createIncomingMessage } from "../test-utils/http.js";

describe("readBody", () => {
  it("returns empty payload when body is absent", async () => {
    const req = createIncomingMessage();

    const result = await readBody(req);

    expect(result).toEqual({ raw: "", data: {}, files: [] });
  });

  it("parses JSON bodies safely", async () => {
    const req = createIncomingMessage({
      headers: { "content-type": "application/json" },
      body: ['{"name":"Ada"}'],
    });

    const result = await readBody(req);

    expect(result.raw).toBe('{"name":"Ada"}');
    expect(result.data).toEqual({ name: "Ada" });
    expect(result.files).toEqual([]);
  });

  it("falls back to raw payload on invalid JSON", async () => {
    const req = createIncomingMessage({
      headers: { "content-type": "application/json" },
      body: ['{"name""Ada"}'],
    });

    const result = await readBody(req);

    expect(result.data).toEqual({ _raw: '{"name""Ada"}' });
  });

  it("parses urlencoded payloads", async () => {
    const req = createIncomingMessage({
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: ["name=Ada&city=London"],
    });

    const result = await readBody(req);

    expect(result.data).toEqual({ name: "Ada", city: "London" });
  });

  it("wraps plain text payloads", async () => {
    const req = createIncomingMessage({ body: ["hello"] });

    const result = await readBody(req);

    expect(result.data).toEqual({ _raw: "hello" });
  });

  it("supports multipart form data with files and repeated fields", async () => {
    const boundary = "----vaporvibe-boundary";
    const fileContent = "Line one\nLine two";
    const multipart = [
      `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="title"\r\n\r\n' +
        "Demo\r\n",
      `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="tag"\r\n\r\n' +
        "alpha\r\n",
      `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="tag"\r\n\r\n' +
        "beta\r\n",
      `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="upload"; filename="notes.txt"\r\n' +
        'Content-Type: text/plain\r\n\r\n' +
        `${fileContent}\r\n`,
      `--${boundary}--\r\n`,
    ].join("");

    const req = createIncomingMessage({
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body: [Buffer.from(multipart, "latin1")],
    });

    const result = await readBody(req);

    expect(result.data).toEqual({ title: "Demo", tag: ["alpha", "beta"] });
    expect(result.files).toHaveLength(1);
    const [file] = result.files;
    expect(file.fieldName).toBe("upload");
    expect(file.filename).toBe("notes.txt");
    expect(file.mimeType).toBe("text/plain");
    expect(file.size).toBe(Buffer.from(fileContent).length);
    expect(file.data.equals(Buffer.from(fileContent))).toBe(true);
  });
});
