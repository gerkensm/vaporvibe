import { escapeHtml } from "../utils/html.js";
import { getNavigationInterceptorScript } from "../utils/navigation-interceptor.js";

export interface OverlayDebugPageOptions {
  selectedEffectId?: string | null;
  seedMessage?: string | null;
}

const PAGE_STYLES = String.raw`
  :root {
    color-scheme: light;
    --bg: #eef2ff;
    --panel: #ffffff;
    --border: rgba(148, 163, 184, 0.4);
    --text: #0f172a;
    --muted: #475569;
    --accent: #4f46e5;
    --accent-strong: #312e81;
  }
  * {
    box-sizing: border-box;
  }
  body {
    margin: 0;
    font: 16px/1.5 "Inter", "SF Pro Display", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    padding: 48px 16px 64px;
    min-height: 100vh;
    background: radial-gradient(circle at top, rgba(79, 70, 229, 0.18), transparent 45%), var(--bg);
    color: var(--text);
  }
  .shell {
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .panel {
    background: var(--panel);
    border-radius: 24px;
    border: 1px solid var(--border);
    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
    padding: 32px;
  }
  h1 {
    font-size: 1.8rem;
    margin: 0 0 0.25em;
  }
  p.lede {
    margin: 0;
    color: var(--muted);
  }
  label {
    display: block;
    font-weight: 500;
    margin-bottom: 8px;
  }
  select,
  input[type="text"] {
    width: 100%;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: #f8fafc;
    font: inherit;
    color: var(--text);
  }
  select:focus,
  input[type="text"]:focus {
    outline: none;
    border-color: rgba(79, 70, 229, 0.8);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
  }
  .form-grid {
    display: grid;
    gap: 20px;
  }
  .effect-summary {
    font-size: 0.9rem;
    color: var(--muted);
    margin-top: 6px;
  }
  .actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 12px;
  }
  button {
    border: none;
    border-radius: 16px;
    padding: 12px 20px;
    font: inherit;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }
  button.primary {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 15px 30px rgba(79, 70, 229, 0.25);
  }
  button.secondary {
    background: rgba(15, 23, 42, 0.05);
    color: var(--accent-strong);
  }
  button:focus-visible {
    outline: 3px solid rgba(79, 70, 229, 0.35);
    outline-offset: 3px;
  }
  button:active {
    transform: translateY(1px) scale(0.99);
  }
  code {
    font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
    background: rgba(15, 23, 42, 0.08);
    padding: 2px 6px;
    border-radius: 8px;
    font-size: 0.85rem;
  }
  .notes {
    font-size: 0.95rem;
    color: var(--muted);
  }
  @media (max-width: 640px) {
    body {
      padding: 32px 14px;
    }
    .panel {
      padding: 24px;
    }
  }
`;

export function renderOverlayDebugPage(
  options: OverlayDebugPageOptions = {}
): string {
  const interceptorScript = getNavigationInterceptorScript();
  const selectedEffectId = options.selectedEffectId ?? "";
  const seedMessage = options.seedMessage ?? "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>VaporVibe Overlay Playground</title>
    <style>${PAGE_STYLES}</style>
  </head>
  <body>
    <main class="shell">
      <section class="panel">
        <h1>Overlay playground</h1>
        <p class="lede">
          Preview navigation overlay effects without involving an LLM request. This route wires directly into the interceptor for debugging.
        </p>
      </section>
      <section class="panel">
        <form id="overlayDebugForm" class="form-grid" autocomplete="off">
          <div>
            <label for="effectSelect">Overlay effect</label>
            <select id="effectSelect" name="effect" aria-describedby="effectSummary">
              <option value="">Random / heuristics</option>
            </select>
            <p class="effect-summary" id="effectSummary">Random mode lightly cycles intensity to mimic live requests.</p>
          </div>
          <div>
            <label for="messageInput">Custom status headline (optional)</label>
            <input
              id="messageInput"
              name="message"
              type="text"
              maxlength="120"
              placeholder="e.g. Syncing artifact manifest…"
              value="${escapeHtml(seedMessage)}"
            />
          </div>
          <div class="actions">
            <button type="submit" class="primary">Show overlay</button>
            <button type="button" class="secondary" data-action="hide">Hide overlay</button>
          </div>
        </form>
        <div class="notes">
          <p>
            The form calls <code>window.vaporvibeOverlayDebug.show()</code>, which the interceptor exposes in the browser.
            The dropdown is hydrated using <code>window.__vaporvibeOverlayEffects</code> once the script loads.
          </p>
          <p>
            You can also trigger previews manually:
            <code>window.dispatchEvent(new CustomEvent("vaporvibe:preview-overlay", { detail: { effectId: "token-rain" } }))</code>
          </p>
        </div>
      </section>
    </main>
    <script>
      (function () {
        const form = document.getElementById("overlayDebugForm");
        const effectSelect = document.getElementById("effectSelect");
        const effectSummary = document.getElementById("effectSummary");
        const messageInput = document.getElementById("messageInput");
        const hideButton = document.querySelector('[data-action="hide"]');
        const defaultEffect = ${JSON.stringify(selectedEffectId)};

        if (!form || !effectSelect || !effectSummary || !messageInput || !hideButton) {
          return;
        }

        const effectsById = new Map();

        function describeEffect(effectId) {
          if (!effectId) {
            effectSummary.textContent = "Random mode lightly cycles intensity to mimic live requests.";
            return;
          }
          const meta = effectsById.get(effectId);
          if (!meta) {
            effectSummary.textContent = "Unlisted effect id: " + effectId;
            return;
          }
          const tone = meta.intensity ? meta.intensity : "mixed";
          effectSummary.textContent = meta.label + " · " + tone + " energy";
        }

        function populateEffects(effects) {
          effectsById.clear();
          const fragment = document.createDocumentFragment();
          const baseOption = document.createElement("option");
          baseOption.value = "";
          baseOption.textContent = "Random / heuristics";
          fragment.appendChild(baseOption);

          effects.forEach((effect) => {
            if (!effect || typeof effect.id !== "string") return;
            effectsById.set(effect.id, effect);
            const option = document.createElement("option");
            option.value = effect.id;
            option.textContent = effect.label + (effect.intensity ? " · " + effect.intensity : "");
            fragment.appendChild(option);
          });

          effectSelect.innerHTML = "";
          effectSelect.appendChild(fragment);
          if (defaultEffect && effectsById.has(defaultEffect)) {
            effectSelect.value = defaultEffect;
          }
          describeEffect(effectSelect.value);
        }

        function hydrateEffectsFromGlobal() {
          const exported = window.__vaporvibeOverlayEffects;
          if (Array.isArray(exported) && exported.length > 0) {
            populateEffects(exported);
            return true;
          }
          return false;
        }

        hydrateEffectsFromGlobal();
        window.addEventListener("vaporvibe:overlay-effects-ready", (event) => {
          const detail = event && event.detail ? event.detail.effects : null;
          if (Array.isArray(detail) && detail.length > 0) {
            populateEffects(detail);
          } else {
            hydrateEffectsFromGlobal();
          }
        });

        effectSelect.addEventListener("change", () => {
          describeEffect(effectSelect.value);
        });

        form.addEventListener("submit", (event) => {
          event.preventDefault();
          const payload = {
            effectId: effectSelect.value || null,
            message: messageInput.value.trim() || undefined,
          };
          if (!window.vaporvibeOverlayDebug || typeof window.vaporvibeOverlayDebug.show !== "function") {
            alert("Interceptor script is still loading. Try again in a moment.");
            return;
          }
          window.vaporvibeOverlayDebug.show(payload);
        });

        hideButton.addEventListener("click", () => {
          if (window.vaporvibeOverlayDebug && typeof window.vaporvibeOverlayDebug.hide === "function") {
            window.vaporvibeOverlayDebug.hide();
          }
        });
      })();
    </script>
    ${interceptorScript}
  </body>
</html>`;
}
