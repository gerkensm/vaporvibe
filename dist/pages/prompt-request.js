import { BRIEF_FORM_ROUTE } from "../constants.js";
import { escapeHtml } from "../utils/html.js";
export function renderPromptRequestPage() {
    const title = "Configure Brief";
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { --bg: #0f172a; --panel: #111c36; --text: #f8fafc; --muted: #cbd5f5; --accent: #38bdf8; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: radial-gradient(circle at top, #1d2b4d, #0f172a 52%); color: var(--text); display: flex; justify-content: center; min-height: 100vh; }
  main { width: min(720px, 92vw); margin: 56px auto; padding: 40px; border-radius: 20px; background: var(--panel); box-shadow: 0 25px 40px rgba(15, 23, 42, 0.48); backdrop-filter: blur(20px); }
  h1 { font-size: 1.95rem; margin-bottom: 16px; letter-spacing: -0.01em; }
  p { color: var(--muted); line-height: 1.6; }
  form { margin-top: 28px; display: grid; gap: 16px; }
  label { font-weight: 600; color: var(--text); }
  textarea {
    resize: vertical;
    min-height: 160px;
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.24);
    background: rgba(15, 23, 42, 0.6);
    color: var(--text);
    font: inherit;
    padding: 16px;
    line-height: 1.6;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  textarea:focus {
    outline: none;
    border-color: rgba(96, 165, 250, 0.6);
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.35);
  }
  button {
    justify-self: start;
    background: linear-gradient(135deg, #38bdf8, #6366f1);
    color: var(--text);
    border: none;
    border-radius: 999px;
    padding: 12px 28px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 12px 20px rgba(56, 189, 248, 0.4);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  button:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 24px rgba(56, 189, 248, 0.46);
  }
  button:focus-visible {
    outline: 3px solid rgba(99, 102, 241, 0.45);
    outline-offset: 3px;
  }
  ul { margin: 24px 0 0; padding-left: 20px; color: var(--muted); }
  li { margin-bottom: 8px; }
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
    </ul>
  </main>
</body>
</html>`;
}
