import {
  navigationOverlayDecorationsMarkup,
  navigationOverlayEffectStyles,
  navigationOverlayEffects,
  navigationOverlayMiniGameMarkup,
} from "./scripts/navigation-overlay-effects";

const REST_MUTATION_PREFIX = "/rest_api/mutation/";
const REST_QUERY_PREFIX = "/rest_api/query/";

function isRestApiPath(pathname: string): boolean {
  return (
    pathname.startsWith(REST_MUTATION_PREFIX) ||
    pathname.startsWith(REST_QUERY_PREFIX)
  );
}

function emitRestApiEvent(
  target: Element | null,
  detail: { method: string; url: string }
): void {
  if (!target) return;
  try {
    const event = new CustomEvent("serve-llm:rest-api-request", {
      bubbles: true,
      detail,
    });
    target.dispatchEvent(event);
  } catch {
    // ignore dispatch failures
  }
}

const overlayEffectClassNames = navigationOverlayEffects.map(
  (effect) => `effect-${effect.id}`
);

const overlayMarkup = [
  "<style>",
  "  :root { --accent:#1d4ed8; --muted:#475569; --subtle:#64748b; }",
  "  @keyframes serve-llm-spin { to { transform: rotate(360deg); } }",
  "  @keyframes serve-llm-pulse { 0%,100%{ transform: scale(0.92); opacity: 0.6;} 50%{ transform: scale(1); opacity: 1;} }",
  "  .liquidGlass-wrapper { position: relative; overflow: hidden; box-shadow: 0 6px 6px rgba(0,0,0,0.2), 0 0 20px rgba(0,0,0,0.1); border: 1px solid rgba(148,163,184,0.35); }",
  "  .liquidGlass-wrapper, .liquidGlass-wrapper > div { border-radius: 22px; }",
  "  .liquidGlass-effect { position: absolute; inset: 0; z-index: 0; backdrop-filter: blur(7px); filter: url(#glass-distortion); overflow:hidden; }",
  "  .liquidGlass-tint { position: absolute; inset: 0; z-index: 1; background: rgba(255,255,255,0.50); }",
  "  .liquidGlass-shine { position: absolute; inset: 0; z-index: 2; box-shadow: inset 2px 2px 1px 0 rgba(255,255,255,0.5), inset -1px -1px 1px 1px rgba(255,255,255,0.5); }",
  "  .serve-llm-stage { position: relative; z-index: 4; display: grid; place-items: center; gap: 12px; text-align: center; max-width: 520px; width: calc(100% - 32px); padding: 18px; }",
  "  .serve-llm-pulse { width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(circle, rgba(29, 78, 216, 0.28), rgba(29, 78, 216, 0)); display:grid; place-items:center; animation: serve-llm-pulse 2.4s ease-in-out infinite; }",
  "  .serve-llm-spinner { width: 72px; height: 72px; border-radius: 50%; border: 6px solid rgba(29, 78, 216, 0.2); border-top-color: var(--accent); animation: serve-llm-spin 1.1s linear infinite; }",
  "  .serve-llm-title { font: 600 1.1rem/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#0f172a; }",
  "  .serve-llm-status { font: 400 0.95rem/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--muted); min-height:1.2em; }",
  "  .serve-llm-hint { font: 400 0.9rem/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--subtle); }",
  navigationOverlayEffectStyles
    .split("\n")
    .map((line) => (line ? `  ${line}` : ""))
    .join("\n"),
  "</style>",
  '<div class="liquidGlass-wrapper">',
  navigationOverlayDecorationsMarkup,
  '  <div class="liquidGlass-effect"></div>',
  '  <div class="liquidGlass-tint"></div>',
  '  <div class="liquidGlass-shine"></div>',
  '  <div class="serve-llm-stage">',
  '    <div class="serve-llm-pulse"><div class="serve-llm-spinner" role="status" aria-live="polite" aria-label="Generating the next view"></div></div>',
  '    <div class="serve-llm-title">Generating your next view</div>',
  '    <div class="serve-llm-status" data-serve-llm-status></div>',
  '    <div class="serve-llm-hint">Hold tight—we ask your configured model to compose a fresh canvas.</div>',
  navigationOverlayMiniGameMarkup,
  "  </div>",
  "</div>",
  '<svg style="position:absolute; width:0; height:0; overflow:hidden">',
  '  <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">',
  '    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="1" seed="12" result="turbulence" />',
  '    <feGaussianBlur in="turbulence" stdDeviation="5" result="softMap" />',
  '    <feSpecularLighting in="softMap" surfaceScale="3.5" specularConstant="0.9" specularExponent="85" lighting-color="white" result="specLight">',
  '      <fePointLight x="-160" y="-180" z="260" />',
  "    </feSpecularLighting>",
  '    <feComposite in="specLight" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litImage" />',
  '    <feDisplacementMap in="SourceGraphic" in2="softMap" scale="50" xChannelSelector="R" yChannelSelector="G" />',
  "  </filter>",
  "</svg>",
].join("\n");

const statusMessages = [
  "Reticulating creative splines",
  "Searching the web for inspo",
  "Sketching wireframes in thin air",
  "Procrastinating... productively",
  "Auditing color palettes against vibes",
  "Consulting the prompt whisperer",
  "Coaxing latent space into a moodboard",
  "Sampling temperature curves for witty tooltips",
  "Polishing edge cases in the instruction buffer",
];

(() => {
  const globalScope = window as Window & {
    serveLlmInterceptorAttached?: boolean;
  };

  if (globalScope.serveLlmInterceptorAttached) return;
  globalScope.serveLlmInterceptorAttached = true;

  const overlayEffectsConfig = navigationOverlayEffects;

  const interceptorScriptId = "serve-llm-interceptor-script";
  const currentScript = document.currentScript as HTMLScriptElement | null;
  if (currentScript && !currentScript.id) {
    currentScript.id = interceptorScriptId;
  }

  let overlay: HTMLElement | null = null;
  let overlayMotionNode: HTMLElement | null = null;
  let currentOverlayEffect: string | null = null;
  let dvdFrameRef: number | null = null;
  let dvdLastTick: number | null = null;
  const dvdPosition = { x: 0, y: 0, vx: 0.2, vy: 0.18 };
  let overlayStatusTimeout: number | null = null;
  let overlayStatusInterval: number | null = null;

  function ensureOverlayMotionNode(): HTMLElement | null {
    if (!overlay) return null;
    if (!overlayMotionNode || !overlay.contains(overlayMotionNode)) {
      overlayMotionNode = overlay.querySelector<HTMLElement>(
        ".liquidGlass-wrapper"
      );
    }
    return overlayMotionNode;
  }

  function stopDvdAnimation(): void {
    if (dvdFrameRef != null) cancelAnimationFrame(dvdFrameRef);
    dvdFrameRef = null;
    dvdLastTick = null;
  }

  function dvdFrame(timestamp: number): void {
    const motionNode = ensureOverlayMotionNode();
    if (!overlay || !motionNode || !overlay.classList.contains("effect-dvd-bounce")) {
      if (motionNode) motionNode.style.transform = "";
      stopDvdAnimation();
      return;
    }

    if (dvdLastTick === null) {
      dvdLastTick = timestamp;
      dvdFrameRef = requestAnimationFrame(dvdFrame);
      return;
    }

    const delta = timestamp - dvdLastTick;
    dvdLastTick = timestamp;

    const boundsWidth = overlay.clientWidth;
    const boundsHeight = overlay.clientHeight;
    const nodeWidth = motionNode.offsetWidth;
    const nodeHeight = motionNode.offsetHeight;
    const maxX = Math.max(boundsWidth - nodeWidth, 0);
    const maxY = Math.max(boundsHeight - nodeHeight, 0);

    dvdPosition.x += dvdPosition.vx * delta;
    dvdPosition.y += dvdPosition.vy * delta;

    if (dvdPosition.x <= 0) {
      dvdPosition.x = 0;
      dvdPosition.vx = Math.abs(dvdPosition.vx);
    } else if (dvdPosition.x >= maxX) {
      dvdPosition.x = maxX;
      dvdPosition.vx = -Math.abs(dvdPosition.vx);
    }

    if (dvdPosition.y <= 0) {
      dvdPosition.y = 0;
      dvdPosition.vy = Math.abs(dvdPosition.vy);
    } else if (dvdPosition.y >= maxY) {
      dvdPosition.y = maxY;
      dvdPosition.vy = -Math.abs(dvdPosition.vy);
    }

    motionNode.style.transform = `translate3d(${dvdPosition.x.toFixed(2)}px,${dvdPosition.y.toFixed(2)}px,0)`;
    dvdFrameRef = requestAnimationFrame(dvdFrame);
  }

  function startDvdAnimation(): void {
    const motionNode = ensureOverlayMotionNode();
    if (!overlay || !motionNode) return;

    stopDvdAnimation();

    const boundsWidth = overlay.clientWidth;
    const boundsHeight = overlay.clientHeight;
    const nodeWidth = motionNode.offsetWidth;
    const nodeHeight = motionNode.offsetHeight;
    const maxX = Math.max(boundsWidth - nodeWidth, 0);
    const maxY = Math.max(boundsHeight - nodeHeight, 0);

    dvdPosition.x = maxX > 0 ? Math.random() * maxX : 0;
    dvdPosition.y = maxY > 0 ? Math.random() * maxY : 0;
    dvdPosition.vx = (Math.random() > 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.08);
    dvdPosition.vy = (Math.random() > 0.5 ? 1 : -1) * (0.16 + Math.random() * 0.07);
    dvdLastTick = null;

    motionNode.style.transform = `translate3d(${dvdPosition.x.toFixed(2)}px,${dvdPosition.y.toFixed(2)}px,0)`;
    dvdFrameRef = requestAnimationFrame(dvdFrame);
  }

  function clearOverlayEffect(): void {
    if (!overlay) return;

    overlayEffectClassNames.forEach((className) => {
      overlay?.classList.remove(className);
    });

    const motionNode = ensureOverlayMotionNode();
    if (motionNode) motionNode.style.transform = "";

    overlay.removeAttribute("data-serve-llm-effect");

    stopDvdAnimation();
    currentOverlayEffect = null;
  }

  function applyOverlayEffectById(effectId: string | null): void {
    if (!overlayEffectsConfig.length || !overlay) return;

    clearOverlayEffect();
    if (!effectId) return;

    const effect = overlayEffectsConfig.find((candidate) => candidate.id === effectId);
    if (!effect) return;

    overlay.classList.add(`effect-${effect.id}`);
    overlay.setAttribute("data-serve-llm-effect", effect.id);
    currentOverlayEffect = effect.id;

    if (typeof console !== "undefined" && typeof console.debug === "function") {
      try {
        console.debug("serve-llm overlay effect", effect.id);
      } catch (error) {
        console.debug("serve-llm overlay effect", effect.id, error);
      }
    }

    if (effect.behavior === "dvdBounce") startDvdAnimation();
  }

  function maybeApplyRandomEffect(): void {
    if (!overlayEffectsConfig.length) {
      applyOverlayEffectById(null);
      return;
    }

    const chance = 0.3;

    if (Math.random() > chance) {
      applyOverlayEffectById(null);
      return;
    }

    const chosen = overlayEffectsConfig[
      Math.floor(Math.random() * overlayEffectsConfig.length)
    ];
    applyOverlayEffectById(chosen ? chosen.id : null);
  }

  function createOverlay(): void {
    if (document.getElementById("serve-llm-overlay")) return;

    overlay = document.createElement("div");
    overlay.id = "serve-llm-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      zIndex: "2147483647",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      opacity: "0",
      transition: "opacity 0.2s ease-in-out",
      pointerEvents: "none",
    } satisfies Partial<CSSStyleDeclaration>);
    overlay.innerHTML = overlayMarkup;
    overlayMotionNode = overlay.querySelector<HTMLElement>(
      ".liquidGlass-wrapper"
    );
    document.body.appendChild(overlay);
  }

  function shuffleStatuses(messages: string[]): string[] {
    const scrambled = [...messages];
    for (let i = scrambled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = scrambled[i];
      scrambled[i] = scrambled[j];
      scrambled[j] = temp;
    }
    return scrambled;
  }

  function showOverlay(): void {
    if (!overlay || !document.getElementById("serve-llm-overlay")) {
      createOverlay();
    }
    if (!overlay) return;

    overlay.style.pointerEvents = "auto";
    ensureOverlayMotionNode();
    maybeApplyRandomEffect();
    setTimeout(() => {
      if (overlay) overlay.style.opacity = "1";
    }, 10);

    try {
      const base = "Summoning your adaptive canvas…";
      const statuses = shuffleStatuses(statusMessages);

      if (overlayStatusTimeout) {
        clearTimeout(overlayStatusTimeout);
        overlayStatusTimeout = null;
      }
      if (overlayStatusInterval) {
        clearInterval(overlayStatusInterval);
        overlayStatusInterval = null;
      }

      const target = overlay.querySelector<HTMLElement>(
        "[data-serve-llm-status]"
      );
      let idx = 0;
      if (target) {
        target.textContent = statuses[0] ?? base;
        overlayStatusTimeout = window.setTimeout(() => {
          idx = (idx + 1) % statuses.length;
          target.textContent = statuses[idx] ?? base;
          overlayStatusTimeout = null;
        }, 900);
        overlayStatusInterval = window.setInterval(() => {
          idx = (idx + 1) % statuses.length;
          target.textContent = statuses[idx] ?? base;
        }, 3500);
      }
    } catch {
      // ignore status update failures
    }
  }

  function addBypassParam(u: string | URL): URL | string {
    try {
      const url = u instanceof URL ? u : new URL(String(u), window.location.origin);
      url.searchParams.set("__serve-llm", "interceptor");
      return url;
    } catch {
      return u;
    }
  }

  try {
    const current = new URL(window.location.href);
    if (current.searchParams.get("__serve-llm") === "interceptor") {
      current.searchParams.delete("__serve-llm");
      history.replaceState(null, "", current.toString());
    }
  } catch {
    // ignore URL parsing errors
  }

  function handleRequest(url: URL | string, options: { method: string }): void {
    const destination = url instanceof URL ? url : new URL(url, window.location.origin);
    if (isRestApiPath(destination.pathname)) {
      emitRestApiEvent(document.body ?? null, {
        method: options.method,
        url: destination.href,
      });
      return;
    }

    if (destination.pathname.startsWith("/serve-llm") || destination.pathname.startsWith("/__setup")) {
      window.location.href = destination.href;
      return;
    }

    showOverlay();
    try {
      const nav = addBypassParam(destination);
      if (typeof console !== "undefined" && typeof console.debug === "function") {
        console.debug("serve-llm navigation via interceptor", nav.toString());
      }
      window.location.assign(nav.toString());
    } catch (error) {
      console.error("serve-llm navigation failed:", error);
      window.location.href = destination.href;
    }
  }

  window.addEventListener("resize", () => {
    if (currentOverlayEffect === "dvd-bounce") startDvdAnimation();
  });

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return;

      let node = event.target as Node | null;
      while (node && node.nodeType !== Node.ELEMENT_NODE) {
        node = node.parentNode;
      }
      const el = node as HTMLElement | null;
      const anchor = el?.closest<HTMLAnchorElement>("a") ?? null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (!anchor.href || anchor.href.startsWith("javascript:")) return;
      if (anchor.origin !== window.location.origin) return;

      try {
        const parsed = new URL(anchor.href);
        if (
          parsed.pathname === window.location.pathname &&
          parsed.search === window.location.search &&
          parsed.hash
        )
          return;

        if (isRestApiPath(parsed.pathname)) {
          event.preventDefault();
          emitRestApiEvent(anchor, { method: "GET", url: parsed.href });
          return;
        }
      } catch {
        // ignore malformed URLs
      }

      event.preventDefault();
      handleRequest(new URL(anchor.href), { method: "GET" });
    },
    true
  );

  document.addEventListener("submit", (event) => {
    let node = event.target as Node | null;
    while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
    const form = (node as HTMLElement | null)?.closest<HTMLFormElement>("form") ?? null;
    if (!form || form.target === "_blank") return;

    if (event.defaultPrevented) return;

    const method = (form.getAttribute("method") || "GET").toUpperCase();
    if (method === "GET") {
      event.preventDefault();
      const url = new URL(form.action || window.location.href);
      try {
        const submitter = (event as SubmitEvent).submitter as
          | HTMLButtonElement
          | HTMLInputElement
          | null;
        let formData: FormData;
        try {
          formData = submitter
            ? new FormData(form, submitter)
            : new FormData(form);
        } catch {
          formData = new FormData(form);
          if (submitter && submitter.name) {
            formData.append(submitter.name, submitter.value);
          }
        }
        formData.forEach((value, key) => {
          if (value instanceof File) return;
          url.searchParams.append(key, String(value));
        });
      } catch (error) {
        console.warn("serve-llm form encoding failed:", error);
      }

      if (isRestApiPath(url.pathname)) {
        emitRestApiEvent(form, { method: "GET", url: url.href });
        return;
      }

      handleRequest(url, { method: "GET" });
    } else {
      event.preventDefault();
      const destination = new URL(form.action || window.location.href);
      if (isRestApiPath(destination.pathname)) {
        emitRestApiEvent(form, {
          method,
          url: destination.href,
        });
        return;
      }

      try {
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = "__serve-llm";
        hidden.value = "interceptor";
        form.appendChild(hidden);
      } catch {
        // ignore hidden input creation errors
      }
      showOverlay();
      form.submit();
    }
  });

  window.addEventListener("popstate", () => {
    window.location.reload();
  });
})();
