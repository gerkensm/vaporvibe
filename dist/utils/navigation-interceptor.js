export function getNavigationInterceptorScript() {
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
        "  .serve-llm-stage { position: relative; z-index: 3; display: grid; place-items: center; gap: 12px; text-align: center; max-width: 520px; width: calc(100% - 32px); padding: 18px; }",
        "  .serve-llm-pulse { width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(circle, rgba(29, 78, 216, 0.28), rgba(29, 78, 216, 0)); display:grid; place-items:center; animation: serve-llm-pulse 2.4s ease-in-out infinite; }",
        "  .serve-llm-spinner { width: 72px; height: 72px; border-radius: 50%; border: 6px solid rgba(29, 78, 216, 0.2); border-top-color: var(--accent); animation: serve-llm-spin 1.1s linear infinite; }",
        "  .serve-llm-title { font: 600 1.1rem/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#0f172a; }",
        "  .serve-llm-status { font: 400 0.95rem/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--muted); min-height:1.2em; }",
        "  .serve-llm-hint { font: 400 0.9rem/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--subtle); }",
        "</style>",
        '<div class="liquidGlass-wrapper">',
        '  <div class="liquidGlass-effect"></div>',
        '  <div class="liquidGlass-tint"></div>',
        '  <div class="liquidGlass-shine"></div>',
        '  <div class="serve-llm-stage">',
        '    <div class="serve-llm-pulse"><div class="serve-llm-spinner" role="status" aria-live="polite" aria-label="Generating the next view"></div></div>',
        '    <div class="serve-llm-title">Generating your next view</div>',
        '    <div class="serve-llm-status" data-serve-llm-status></div>',
        '    <div class="serve-llm-hint">Hold tight—we ask your configured model to compose a fresh canvas.</div>',
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

  var interceptorScriptId = 'serve-llm-interceptor-script';
  if (document.currentScript && !document.currentScript.id) {
    document.currentScript.id = interceptorScriptId;
  }

  // --- UI Overlay Logic ---
  var overlay = null;
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
    document.body.appendChild(overlay);
  }

  function showOverlay() {
    if (!overlay || !document.getElementById('serve-llm-overlay')) createOverlay();
    if (!overlay) return;
    overlay.style.pointerEvents = 'auto';
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
      var target = document.querySelector('[data-serve-llm-status]');
      var idx = 0;
      if (target) {
        target.textContent = statuses[0] || base;
        setTimeout(function() {
          idx = (idx + 1) % statuses.length;
          target.textContent = statuses[idx] || base;
        }, 900);
        setInterval(function() {
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
      window.location.assign(nav.toString());
    } catch (error) {
      console.error('serve-llm navigation failed:', error);
      window.location.href = u.href;
    }
  }

  // --- Event Listeners ---
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
