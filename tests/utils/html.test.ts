import { describe, expect, it } from "vitest";

import { ensureHtmlDocument, escapeHtml } from "../../src/utils/html.js";

describe("ensureHtmlDocument", () => {
  it("returns trimmed HTML when document detected", () => {
    const html = "   <html><body><h1>Hi</h1></body></html>   ";

    const result = ensureHtmlDocument(html, { method: "GET", path: "/" });

    expect(result).toBe("<html><body><h1>Hi</h1></body></html>");
  });

  it("unwraps fenced HTML blocks", () => {
    const fenced = "```html\n<html><body>Content</body></html>\n```";

    const result = ensureHtmlDocument(fenced, { method: "GET", path: "/" });

    expect(result).toBe("<html><body>Content</body></html>");
  });

  it("supports explicit sentinel markers", () => {
    const sentinel = "--- BEGIN HTML ---\n<html><body>Marked</body></html>\n--- END HTML ---";

    const result = ensureHtmlDocument(sentinel, { method: "GET", path: "/sentinel" });

    expect(result).toBe("<html><body>Marked</body></html>");
  });

  it("wraps non-html content in guard template", () => {
    const result = ensureHtmlDocument("<script>alert(\"x\")</script>", {
      method: "POST",
      path: "/danger",
    });

    expect(result.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(result).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(result).toContain("Request: <code>POST /danger</code>");
  });
});

describe("escapeHtml", () => {
  it("escapes all HTML meta characters", () => {
    const escaped = escapeHtml(`<&>"'`);

    expect(escaped).toBe("&lt;&amp;&gt;&quot;&#39;");
  });
});
