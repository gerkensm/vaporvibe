export function ensureHtmlDocument(content, context) {
    const unwrapped = unwrapCodeFences(String(content ?? ""));
    const trimmed = unwrapped.trim();
    const looksHtml = /<\s*html[\s>]/i.test(trimmed) && /<\s*\/\s*html\s*>/i.test(trimmed);
    if (looksHtml) {
        return trimmed;
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
export function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
function unwrapCodeFences(input) {
    let result = input.trim();
    const fencePattern = /^```[a-z0-9_-]*\s*\r?\n([\s\S]*?)\r?\n?```$/i;
    while (true) {
        const match = fencePattern.exec(result);
        if (!match) {
            return result;
        }
        result = match[1].trim();
    }
}
