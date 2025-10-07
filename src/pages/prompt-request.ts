import { ADMIN_ROUTE_PREFIX, BRIEF_FORM_ROUTE } from "../constants.js";
import { escapeHtml } from "../utils/html.js";

interface PromptPageOptions {
  adminPath?: string;
}

export function renderPromptRequestPage(options: PromptPageOptions = {}): string {
  const adminPath = options.adminPath ?? ADMIN_ROUTE_PREFIX;
  const title = "Configure Brief";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root {
    color-scheme: light;
    --font: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --bg: #f6f8fb;
    --surface: #ffffff;
    --surface-soft: rgba(255, 255, 255, 0.85);
    --border: #e2e8f0;
    --text: #0f172a;
    --muted: #475569;
    --subtle: #64748b;
    --accent: #1d4ed8;
    --accent-ring: rgba(29, 78, 216, 0.18);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: var(--font);
    background: radial-gradient(110% 120% at 50% 0%, #ffffff 0%, var(--bg) 60%, #edf2f9 100%);
    color: var(--text);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    min-height: 100vh;
    padding: clamp(32px, 6vw, 72px);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  a {
    color: var(--accent);
    text-decoration: none;
  }
  a:hover,
  a:focus-visible {
    text-decoration: underline;
    outline: none;
  }
  main {
    width: min(720px, 92vw);
    margin: 0 auto;
    padding: clamp(36px, 5vw, 48px);
    border-radius: 26px;
    background: linear-gradient(180deg, var(--surface) 0%, rgba(249, 250, 255, 0.92) 100%);
    border: 1px solid var(--border);
    box-shadow: 0 30px 60px rgba(15, 23, 42, 0.12);
    display: grid;
    gap: 24px;
  }
  h1 {
    font-size: clamp(1.8rem, 3vw, 2.2rem);
    margin: 0;
    letter-spacing: -0.015em;
    font-weight: 600;
  }
  p {
    margin: 0;
    color: var(--muted);
  }
  form {
    display: grid;
    gap: 20px;
  }
  label {
    font-weight: 600;
    color: var(--text);
    display: grid;
    gap: 8px;
  }
  textarea {
    resize: vertical;
    min-height: 170px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    padding: 16px;
    line-height: 1.6;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  }
  textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-ring);
    background: #fdfefe;
  }
  textarea::placeholder {
    color: var(--subtle);
    opacity: 0.85;
  }
  button {
    justify-self: start;
    background: linear-gradient(135deg, #1d4ed8, #1e3a8a);
    color: #f8fafc;
    border: 1px solid #1e3a8a;
    border-radius: 12px;
    padding: 13px 30px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 20px 32px rgba(29, 78, 216, 0.22);
    transition: transform 0.18s ease, filter 0.18s ease;
  }
  button:hover {
    transform: translateY(-1px);
    filter: brightness(1.03);
  }
  button:focus-visible {
    outline: 3px solid var(--accent-ring);
    outline-offset: 2px;
  }
  ul {
    margin: 8px 0 0;
    padding-left: 20px;
    color: var(--subtle);
    display: grid;
    gap: 10px;
  }
  li { margin: 0; }
  code {
    background: var(--surface-soft);
    border-radius: 6px;
    padding: 0 6px;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }
</style>
</head>
<body>
  <main>
    <h1>Provide an app brief to get started</h1>
    <p>This server generates a fully self-contained HTML response on each request. Add a concise product brief so the model knows what to build. You can refine or replace it later through the on-page instruction panel.</p>
    <form method="post" action="${BRIEF_FORM_ROUTE}">
      <label for="brief">App brief</label>
      <textarea id="brief" name="brief" placeholder="Example: You are a todo list web app with delightful animations and keyboard shortcuts." required></textarea>
      <button type="submit">Launch server</button>
    </form>
    <ul>
      <li>The brief is stored in memory while the process runs.</li>
      <li>Command-line usage: <code>npx serve-llm "You are a recipe planner …"</code>.</li>
      <li>Set <code>MODEL</code> or <code>PORT</code> env vars to override defaults.</li>
      <li>Need to inspect history or switch models? Visit <a href="${escapeHtml(adminPath)}">the admin panel</a> (link also lives in the floating instruction widget).</li>
    </ul>
  </main>
</body>
</html>`;
}
