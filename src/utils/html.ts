export function ensureHtmlDocument(
  content: string,
  context: { method: string; path: string }
): string {
  const candidate = unwrapCodeFences(String(content ?? ""));
  const trimmed = candidate.trim();
  if (looksLikeHtmlDocument(trimmed)) {
    return trimmed;
  }

  const repaired = repairIncompleteHtml(trimmed);
  if (repaired) {
    return repaired;
  }

  const escaped = escapeHtml(trimmed);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Generated View</title>
<style>
  :root { --fg: #111; --bg: #fafafa; --muted:#666; --accent:#2563eb; }
  html,body { height:100%; }
  body { margin:0; font: 16px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:var(--fg); background:var(--bg); }
  .container{ max-width: 840px; margin: 0 auto; padding: 24px; }
  h1{ font-size: 22px; margin: 0 0 12px; }
  .card{ background:#fff; border:1px solid #eee; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .meta{ color: var(--muted); font-size: 13px; margin-top: 8px; }
  a.button, button, input[type=submit]{
    display:inline-block; padding:10px 14px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;
  }
  a.button.primary, button.primary, input[type=submit].primary { background: var(--accent); color:#fff; border-color: var(--accent); }
  pre{ white-space: pre-wrap; word-wrap: break-word; background:#f6f6f6; padding:12px; border-radius:8px; overflow:auto; }
</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Non-HTML response guarded</h1>
      <p>The model returned non-HTML. Wrapped for safety.</p>
      <div class="meta">Request: <code>${escapeHtml(context.method)} ${escapeHtml(context.path)}</code></div>
      <h3>Raw output</h3>
      <pre>${escaped}</pre>
      <form method="GET" action="/">
        <input type="submit" class="primary" value="Back to Home" />
      </form>
    </div>
  </div>
<script>
// No SPA; purely a guard page.
</script>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function unwrapCodeFences(input: string): string {
  const raw = String(input ?? "").trim();
  if (!raw) {
    return raw;
  }

  const sentinel = extractSentinelHtml(raw);
  if (sentinel) {
    return sentinel;
  }

  const fencePattern = /^```[^\n\r`]*\r?\n([\s\S]*?)\r?\n?```$/i;
  let result = raw;
  while (true) {
    const match = fencePattern.exec(result);
    if (!match) {
      break;
    }
    result = match[1].trim();
  }

  return extractEmbeddedHtml(result) ?? result;
}

function extractEmbeddedHtml(input: string): string | null {
  const sentinel = extractSentinelHtml(input);
  if (sentinel) {
    return sentinel;
  }

  const fenced = extractHtmlFromAnyFence(input);
  if (fenced) {
    return fenced;
  }

  return extractLooseHtmlDocument(input);
}

function extractSentinelHtml(input: string): string | null {
  const match = /-{3,}\s*BEGIN\s+HTML\s*-{3,}([\s\S]*?)-{3,}\s*END\s+HTML\s*-{3,}/i.exec(input);
  return match ? match[1].trim() : null;
}

function extractHtmlFromAnyFence(input: string): string | null {
  const fenceRegex = /```([^\n\r`]*)\r?\n([\s\S]*?)\r?\n?```/g;
  let match: RegExpExecArray | null;
  let fallback: string | null = null;

  while ((match = fenceRegex.exec(input)) !== null) {
    const language = match[1]?.trim() ?? "";
    const body = match[2]?.trim() ?? "";
    if (!body) {
      continue;
    }
    if (looksLikeHtmlDocument(body)) {
      return body;
    }
    if (!fallback && isHtmlishFence(language, body)) {
      fallback = body;
    }
  }

  return fallback;
}

function extractLooseHtmlDocument(input: string): string | null {
  const match = /<!doctype\s+html[^>]*>|<\s*html[\s>]/i.exec(input);
  if (!match) {
    return null;
  }
  const start = match.index;
  if (start === undefined) {
    return null;
  }
  const remainder = input.slice(start);
  const closing = /<\s*\/\s*html\s*>/i.exec(remainder);
  if (!closing) {
    return null;
  }
  const end = start + closing.index + closing[0].length;
  return input.slice(start, end).trim();
}

function isHtmlishFence(language: string, body: string): boolean {
  if (/html|doctype/i.test(language)) {
    return true;
  }
  if (/^<\s*!?doctype/i.test(language) || /^<\s*html/i.test(language)) {
    return true;
  }
  return startsLikeHtml(body);
}

function startsLikeHtml(value: string): boolean {
  const normalized = value.trimStart();
  return /^<!doctype\s+html/i.test(normalized) || /^<\s*html[\s>]/i.test(normalized);
}

function looksLikeHtmlDocument(content: string): boolean {
  return /<\s*html[\s>]/i.test(content) && /<\s*\/\s*html\s*>/i.test(content);
}

function repairIncompleteHtml(content: string): string | null {
  const hasHead = /<head[\s>]/i.test(content);
  const hasBody = /<body[\s>]/i.test(content);

  if (hasHead && hasBody && !/<\s*html[\s>]/i.test(content)) {
    return `<!DOCTYPE html>
<html lang="en">
${content}
</html>`;
  }
  return null;
}
