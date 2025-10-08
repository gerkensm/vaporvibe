export function renderLoadingShell(options = {}) {
    const defaultMessage = "Summoning your adaptive canvas…";
    const message = options.message ?? defaultMessage;
    const accent = options.accent ?? "#1d4ed8";
    const originalPath = options.originalPath ?? "/";
    const resultRoutePrefix = options.resultRoutePrefix ?? "/__serve-llm/result";
    const statusMessages = [
        "Reticulating creative splines",
        "Searching the web for inspo",
        "Sketching wireframes in thin air",
        "Procrastinating... productively",
        "Auditing color palettes against vibes",
        "Consulting the prompt whisperer",
        "Contemplating AGI alignment",
        "Asking the model to phone a friend",
        "Baking semantic breadcrumbs",
        "Syncing narratives with UX atoms",
        "Coaxing latent space into a moodboard",
        "Listening for whispers from hidden layers",
        "Debating prompt tone with the alignment committee",
        "Sampling gradients from a transformer’s daydream",
        "Replaying vector memories for Easter eggs",
        "Translating embeddings into interface decisions",
        "Rehearsing a cold start apology just in case",
        "Sweeping stray tokens under the style guide",
        "Harmonizing typography with diffusion noise",
        "Downscaling hallucinations into viable features",
        "Spinning up a mirror world for copy edits",
        "Cross-checking vibes with a safety classifier",
        "Peeking at the model’s scratch pad doodles",
        "Asking guardrails to approve the hero gradient",
        "Bottling synthetic inspiration for later prompts",
        "Fending off rogue autocomplete suggestions",
        "Negotiating whitespace with a chain-of-thought",
        "Placing easter eggs in the latent manifold",
        "Queuing a parallel universe for user testing",
        "Assembling quick sketches from token confetti",
        "Greeting the moderation bot with a latte",
        "Letting the reward model tune microcopy warmth",
        "Patching prompt leaks with friendly regex",
        "Syncing color tokens with think tokens",
        "Refreshing the knowledge cutoff on interior design",
        "Scrubbing prompt engineering notes for clarity",
        "Asking the simulator to imagine delight",
        "Mapping tone of voice across embeddings",
        "Sketching onboarding with synthetic personas",
        "Tuning conversational guardrails to whisper mode",
        "Crossfading between reasoning modes for flair",
        "Bottling emergent behavior into hero copy",
        "Aligning call-to-action courage with log probabilities",
        "Consulting few-shot examples for tasteful animation",
        "Translating confidence intervals into layout rhythm",
        "Debugging an overenthusiastic summary subroutine",
        "Telling the model a bedtime brief for inspiration",
        "Running style transfer on yesterday’s feedback",
        "Reindexing the prompt library for serendipity",
        "Rerouting creative overflow to sandbox memory",
        "Chatting with the self-critique about polish",
        "Drafting accessibility notes with the safety net",
        "Letting the assistant sketch with synthetic chalk",
        "Sampling temperature curves for witty tooltips",
        "Polishing edge cases in the instruction buffer",
        "Teaching the fallback model a new dad joke",
        "Cross-referencing tone with long-term memory",
        "Capturing lightning in a latent bottle",
    ];
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Loading · serve-llm</title>
<style>
  :root {
    color-scheme: light;
    --bg: #f6f8fb;
    --bg-soft: #eef2f8;
    --text: #0f172a;
    --muted: #475569;
    --subtle: #64748b;
    --surface: rgba(255, 255, 255, 0.82);
    --surface-strong: rgba(255, 255, 255, 0.92);
    --border: rgba(148, 163, 184, 0.35);
    --shadow: 0 28px 60px rgba(15, 23, 42, 0.18);
  }
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(32px, 8vw, 64px);
    font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: radial-gradient(120% 120% at 50% 0%, #ffffff 0%, var(--bg) 55%, var(--bg-soft) 100%);
    color: var(--text);
    line-height: 1.6;
  }
  main { text-align: center; max-width: 520px; width: 100%; display: flex; flex-direction: column; gap: 24px; align-items: center; }
  h1 { font-size: clamp(1.5rem, 2.5vw + 1rem, 2.4rem); margin: 0; letter-spacing: -0.03em; }
  p { margin: 0; color: var(--muted); font-size: 1rem; }
  .stage {
    background: linear-gradient(180deg, var(--surface-strong) 0%, var(--surface) 100%);
    border-radius: 28px;
    border: 1px solid var(--border);
    padding: 18px;
    box-shadow: var(--shadow);
    display: grid;
    place-items: center;
  }
  .spinner { width: 72px; height: 72px; border-radius: 999px; border: 6px solid rgba(29, 78, 216, 0.15); border-top-color: ${accent}; animation: spin 1.1s linear infinite; }
  .pulse { width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(circle, rgba(29, 78, 216, 0.28), rgba(29, 78, 216, 0)); animation: pulse 2.4s ease-in-out infinite; display: grid; place-items: center; position: relative; }
  .pulse::after { content: ""; position: absolute; inset: -24px; border-radius: inherit; border: 1px solid rgba(29, 78, 216, 0.22); animation: ripple 2.4s ease-in-out infinite; }
  footer { font-size: 0.875rem; color: var(--subtle); display: flex; flex-direction: column; gap: 6px; }
  .hint { font-size: 0.9rem; color: var(--muted); max-width: 360px; }
  .status {
    font-size: 0.95rem;
    color: var(--muted);
    min-height: 1.2em;
  }
  @media (max-width: 540px) {
    body { padding: 24px; }
    main { gap: 20px; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(0.92); opacity: 0.6; }
    50% { transform: scale(1); opacity: 1; }
  }
  @keyframes ripple {
    0% { transform: scale(0.9); opacity: 0.55; }
    70% { transform: scale(1.15); opacity: 0; }
    100% { transform: scale(1.25); opacity: 0; }
  }
</style>
</head>
<body data-serve-llm-loading>
  <main>
    <div class="stage">
      <div class="pulse">
        <div class="spinner" role="status" aria-live="polite" aria-label="Generating the next view"></div>
      </div>
    </div>
    <h1>Generating your next view</h1>
    <p class="status" data-status>${message}</p>
    <p class="hint">Hold tight—we ask your configured model to compose a fresh canvas. This usually lands within a minute.</p>
    <footer>
      <span>serve-llm keeps the last brief and request context warm.</span>
      <span>We’ll swap in the live page as soon as it arrives.</span>
    </footer>
  </main>
  <script>
    (function() {
      var base = ${JSON.stringify(defaultMessage)};
      var provided = ${JSON.stringify(message)};
      var statuses = ${JSON.stringify(statusMessages)};
      var pool = statuses.filter(function(entry) { return entry !== provided; });
      // Fisher-Yates shuffle for randomness across sessions
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
      }
      var unique = [provided].concat(pool);
      var target = document.querySelector("[data-status]");
      var index = 0;
      if (target && unique.length > 1) {
        // Nudge an early change so short waits still show variety
        setTimeout(function() {
          index = (index + 1) % unique.length;
          target.textContent = unique[index];
        }, 900);
        setInterval(function() {
          index = (index + 1) % unique.length;
          target.textContent = unique[index];
        }, 3500);
      } else if (target && unique.length === 1) {
        target.textContent = unique[0] || base;
      }
    }());

    window.__serveLlmHydrateFromToken = function(token, path) {
      if (!token || typeof token !== "string") return;
      if (window.__serveLlmHydrateFromTokenBusy) return;
      window.__serveLlmHydrateFromTokenBusy = true;
      var prefix = ${JSON.stringify(resultRoutePrefix)};
      var originPath = typeof path === "string" && path.trim().length > 0 ? path : ${JSON.stringify(originalPath)};
      var requestUrl = prefix.replace(/\\/$/, "") + "/" + token.replace(/^\\/+/, "");
      fetch(requestUrl, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Accept": "text/html" },
      }).then(function(response) {
        if (!response.ok) {
          throw new Error("Unexpected status " + response.status);
        }
        return response.text();
      }).then(function(htmlString) {
        try {
          if (originPath) {
            history.replaceState(null, "", originPath);
          }
        } catch (historyError) {
          console.warn("Failed to update history state", historyError);
        }
        document.open("text/html", "replace");
        document.write(htmlString);
        document.close();
      }).catch(function(error) {
        console.error("serve-llm hydrate failed", error);
        window.__serveLlmHydrateError("We could not load the generated page. Reload and try again.");
      }).finally(function() {
        window.__serveLlmHydrateFromTokenBusy = false;
      });
    };

    window.__serveLlmHydrateError = function(message) {
      var container = document.querySelector("main");
      if (!container) return;
      container.innerHTML = '<h1>We hit a snag</h1><p>' + message + '</p><p class="hint">Retry the request, or check the server logs for additional detail.</p>';
    };
  </script>
`;
}
export function renderResultHydrationScript(token, path) {
    const tokenPayload = JSON.stringify(token).replace(/</g, "\\u003C");
    const pathPayload = JSON.stringify(path).replace(/</g, "\\u003C");
    return `<script>window.__serveLlmHydrateFromToken(${tokenPayload}, ${pathPayload});</script></body></html>`;
}
export function renderLoaderErrorScript(message) {
    const payload = JSON.stringify(message).replace(/</g, "\\u003C");
    return `<script>window.__serveLlmHydrateError(${payload});</script></body></html>`;
}
