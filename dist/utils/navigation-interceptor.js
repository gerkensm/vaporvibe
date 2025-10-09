import { navigationOverlayDecorationsMarkup, navigationOverlayEffectStyles, navigationOverlayEffects, navigationOverlayMiniGameMarkup, } from "./navigation-interceptor-effects.js";
export function getNavigationInterceptorScript() {
    const overlayEffectStylesScoped = navigationOverlayEffectStyles
        .split("\n")
        .map((line) => (line ? `  ${line}` : ""))
        .join("\n");
    const overlayEffectClassNames = navigationOverlayEffects.map((effect) => `effect-${effect.id}`);
    // Prebuild overlay markup and safely embed it as a JS string literal
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
        overlayEffectStylesScoped,
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
    return `
(function() {
  'use strict';
  if (window.serveLlmInterceptorAttached) return;
  window.serveLlmInterceptorAttached = true;

  var overlayEffectsConfig = ${JSON.stringify(navigationOverlayEffects)};
  var overlayEffectClassNames = ${JSON.stringify(overlayEffectClassNames)};

  var interceptorScriptId = 'serve-llm-interceptor-script';
  if (document.currentScript && !document.currentScript.id) {
    document.currentScript.id = interceptorScriptId;
  }

  // --- UI Overlay Logic ---
  var overlay = null;
  var overlayMotionNode = null;
  var currentOverlayEffect = null;
  var dvdFrameRef = null;
  var dvdLastTick = null;
  var dvdPosition = { x: 0, y: 0, vx: 0.2, vy: 0.18 };
  var overlayStatusTimeout = null;
  var overlayStatusInterval = null;
  var overlayEffectCursor = 0;

  function ensureOverlayMotionNode() {
    if (!overlay) return null;
    if (!overlayMotionNode || !overlay.contains(overlayMotionNode)) {
      overlayMotionNode = overlay.querySelector('.liquidGlass-wrapper');
    }
    return overlayMotionNode;
  }

  function stopDvdAnimation() {
    if (dvdFrameRef) cancelAnimationFrame(dvdFrameRef);
    dvdFrameRef = null;
    dvdLastTick = null;
  }

  function dvdFrame(timestamp) {
    var motionNode = ensureOverlayMotionNode();
    if (!overlay || !motionNode || !overlay.classList.contains('effect-dvd-bounce')) {
      if (motionNode) motionNode.style.transform = '';
      stopDvdAnimation();
      return;
    }

    if (dvdLastTick === null) {
      dvdLastTick = timestamp;
      dvdFrameRef = requestAnimationFrame(dvdFrame);
      return;
    }

    var delta = timestamp - dvdLastTick;
    dvdLastTick = timestamp;

    var boundsWidth = overlay.clientWidth;
    var boundsHeight = overlay.clientHeight;
    var nodeWidth = motionNode.offsetWidth;
    var nodeHeight = motionNode.offsetHeight;
    var maxX = Math.max(boundsWidth - nodeWidth, 0);
    var maxY = Math.max(boundsHeight - nodeHeight, 0);

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

    motionNode.style.transform = 'translate3d(' + dvdPosition.x.toFixed(2) + 'px,' + dvdPosition.y.toFixed(2) + 'px,0)';
    dvdFrameRef = requestAnimationFrame(dvdFrame);
  }

  function startDvdAnimation() {
    var motionNode = ensureOverlayMotionNode();
    if (!overlay || !motionNode) return;

    stopDvdAnimation();

    var boundsWidth = overlay.clientWidth;
    var boundsHeight = overlay.clientHeight;
    var nodeWidth = motionNode.offsetWidth;
    var nodeHeight = motionNode.offsetHeight;
    var maxX = Math.max(boundsWidth - nodeWidth, 0);
    var maxY = Math.max(boundsHeight - nodeHeight, 0);

    dvdPosition.x = maxX > 0 ? Math.random() * maxX : 0;
    dvdPosition.y = maxY > 0 ? Math.random() * maxY : 0;
    dvdPosition.vx = (Math.random() > 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.08);
    dvdPosition.vy = (Math.random() > 0.5 ? 1 : -1) * (0.16 + Math.random() * 0.07);
    dvdLastTick = null;

    motionNode.style.transform = 'translate3d(' + dvdPosition.x.toFixed(2) + 'px,' + dvdPosition.y.toFixed(2) + 'px,0)';
    dvdFrameRef = requestAnimationFrame(dvdFrame);
  }

  function clearOverlayEffect() {
    if (!overlay) return;

    for (var i = 0; i < overlayEffectClassNames.length; i++) {
      overlay.classList.remove(overlayEffectClassNames[i]);
    }

    var motionNode = ensureOverlayMotionNode();
    if (motionNode) motionNode.style.transform = '';

    if (overlay && overlay.removeAttribute) {
      overlay.removeAttribute('data-serve-llm-effect');
    }

    stopDvdAnimation();
    currentOverlayEffect = null;
  }

  function applyOverlayEffectById(effectId) {
    if (!overlayEffectsConfig || !overlayEffectsConfig.length) return;

    clearOverlayEffect();
    if (!effectId) return;

    var effect = null;
    for (var i = 0; i < overlayEffectsConfig.length; i++) {
      if (overlayEffectsConfig[i] && overlayEffectsConfig[i].id === effectId) {
        effect = overlayEffectsConfig[i];
        break;
      }
    }

    if (!effect) return;

    overlay.classList.add('effect-' + effect.id);
    if (overlay && overlay.setAttribute) {
      overlay.setAttribute('data-serve-llm-effect', effect.id);
    }
    currentOverlayEffect = effect.id;

    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      try {
        console.debug('serve-llm overlay effect', effect.id);
      } catch (_) {}
    }

    if (effect.behavior === 'dvdBounce') startDvdAnimation();
  }

  function maybeApplyRandomEffect() {
    if (!overlayEffectsConfig || !overlayEffectsConfig.length) {
      applyOverlayEffectById(null);
      return;
    }

    var minChance = 1;
    var maxChance = 1;
    var threshold = minChance + Math.random() * (maxChance - minChance);

    if (Math.random() > threshold) {
      applyOverlayEffectById(null);
      return;
    }

    var chosen = overlayEffectsConfig[overlayEffectCursor % overlayEffectsConfig.length];
    overlayEffectCursor = (overlayEffectCursor + 1) % overlayEffectsConfig.length;
    applyOverlayEffectById(chosen ? chosen.id : null);
  }

  function createOverlay() {
    if (document.getElementById('serve-llm-overlay')) return;
    overlay = document.createElement('div');
    overlay.id = 'serve-llm-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      // Keep the backdrop crisp for the glass to distort; avoid fullscreen blur here
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      zIndex: '2147483647', display: 'flex', justifyContent: 'center', alignItems: 'center',
      opacity: '0', transition: 'opacity 0.2s ease-in-out', pointerEvents: 'none',
    });
    var overlayMarkup = ${JSON.stringify(overlayMarkup)};
    overlay.innerHTML = overlayMarkup;
    overlayMotionNode = overlay.querySelector('.liquidGlass-wrapper');
    document.body.appendChild(overlay);
  }

  function showOverlay() {
    if (!overlay || !document.getElementById('serve-llm-overlay')) createOverlay();
    if (!overlay) return;
    overlay.style.pointerEvents = 'auto';
    ensureOverlayMotionNode();
    maybeApplyRandomEffect();
    setTimeout(function() { if (overlay) overlay.style.opacity = '1'; }, 10);

    try {
      var base = 'Summoning your adaptive canvas…';
      var statuses = ${JSON.stringify([
        "Reticulating creative splines",
        "Searching the web for inspo",
        "Sketching wireframes in thin air",
        "Procrastinating... productively",
        "Auditing color palettes against vibes",
        "Consulting the prompt whisperer",
        "Coaxing latent space into a moodboard",
        "Sampling temperature curves for witty tooltips",
        "Polishing edge cases in the instruction buffer",
    ])};
      // Shuffle messages for variety
      for (var i = statuses.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = statuses[i]; statuses[i] = statuses[j]; statuses[j] = t;
      }
      if (overlayStatusTimeout) {
        clearTimeout(overlayStatusTimeout);
        overlayStatusTimeout = null;
      }
      if (overlayStatusInterval) {
        clearInterval(overlayStatusInterval);
        overlayStatusInterval = null;
      }
      var target = overlay.querySelector('[data-serve-llm-status]');
      var idx = 0;
      if (target) {
        target.textContent = statuses[0] || base;
        overlayStatusTimeout = setTimeout(function() {
          idx = (idx + 1) % statuses.length;
          target.textContent = statuses[idx] || base;
          overlayStatusTimeout = null;
        }, 900);
        overlayStatusInterval = setInterval(function() {
          idx = (idx + 1) % statuses.length;
          target.textContent = statuses[idx] || base;
        }, 3500);
      }
    } catch (_) {}
  }

  // --- URL helpers ---
  function addBypassParam(u) {
    try {
      var url = u instanceof URL ? u : new URL(String(u), window.location.origin);
      url.searchParams.set('__serve-llm', 'interceptor');
      return url;
    } catch (_) { return u; }
  }

  // Strip the bypass param from visible URL on load, if present
  try {
    var current = new URL(window.location.href);
    if (current.searchParams.get('__serve-llm') === 'interceptor') {
      current.searchParams.delete('__serve-llm');
      history.replaceState(null, '', current.toString());
    }
  } catch (_) {}

  // --- Navigation Handling Logic ---
  function handleRequest(url, options) {
    var u = url instanceof URL ? url : new URL(url, window.location.origin);
    if (u.pathname.startsWith('/serve-llm') || u.pathname.startsWith('/__setup')) {
      window.location.href = u.href;
      return;
    }

    showOverlay();
    try {
      var nav = addBypassParam(u);
      // Use assign to keep back/forward navigation natural
      if (typeof console !== 'undefined' && typeof console.debug === 'function') {
        try {
          console.debug('serve-llm navigation via interceptor', nav.toString());
        } catch (_) {}
      }
      window.location.assign(nav.toString());
    } catch (error) {
      console.error('serve-llm navigation failed:', error);
      window.location.href = u.href;
    }
  }

  // --- Event Listeners ---
  window.addEventListener('resize', function() {
    if (currentOverlayEffect === 'dvd-bounce') startDvdAnimation();
  });

  document.addEventListener('click', function(event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    // Walk up from the actual target to find an element, then the nearest anchor
    var node = event.target;
    while (node && node.nodeType !== 1) node = node.parentNode;
    var el = node;
    var anchor = el && el.closest ? el.closest('a') : null;
    if (!anchor) return;
    // Ignore non-standard navigations
    if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    if (!anchor.href || anchor.href.startsWith('javascript:')) return;
    // Only same-origin navigations
    if (anchor.origin !== window.location.origin) return;
    // No-op for hash-only navigations within the same path
    try {
      var u = new URL(anchor.href);
      if (u.pathname === window.location.pathname && u.search === window.location.search && u.hash) return;
    } catch (_) {}

    event.preventDefault();
    handleRequest(new URL(anchor.href), { method: 'GET' });
  }, true);

  document.addEventListener('submit', function(event) {
    var node = event.target;
    while (node && node.nodeType !== 1) node = node.parentNode;
    var form = node && node.closest ? node.closest('form') : null;
    if (!form || form.target === '_blank') return;
    event.preventDefault();

    var method = (form.getAttribute('method') || 'GET').toUpperCase();
    if (method === 'GET') {
      var url = new URL(form.action || window.location.href);
      try {
        var submitter = event.submitter || null;
        var formData;
        try {
          formData = submitter ? new FormData(form, submitter) : new FormData(form);
        } catch (_) {
          formData = new FormData(form);
          if (submitter && submitter.name) {
            formData.append(submitter.name, submitter.value);
          }
        }
        formData.forEach(function(value, key) {
          if (value instanceof File) return;
          url.searchParams.append(key, String(value));
        });
      } catch (error) {
        console.warn('serve-llm form encoding failed:', error);
      }
      handleRequest(url, { method: 'GET' });
    } else {
      // For non-GET, add a hidden field and submit normally to preserve method/body
      try {
        var hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = '__serve-llm';
        hidden.value = 'interceptor';
        form.appendChild(hidden);
      } catch (_) {}
      showOverlay();
      form.submit();
    }
  }, true);

  window.addEventListener('popstate', function() { window.location.reload(); });
})();
  `;
}
