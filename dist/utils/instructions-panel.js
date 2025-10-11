import { ADMIN_ROUTE_PREFIX, INSTRUCTIONS_FIELD } from "../constants.js";
export function getInstructionsPanelScript() {
    const styles = [
        "#serve-llm-instructions-panel { position: fixed; bottom: 20px; right: 20px; z-index: 2147483600; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #0f172a; }",
        "#serve-llm-instructions-panel * { box-sizing: border-box; font-family: inherit; }",
        "#serve-llm-instructions-panel button { cursor: pointer; }",
        "#serve-llm-instructions-panel textarea { font-family: inherit; }",
        "#serve-llm-instructions-panel[data-state=collapsed] .serve-llm-instructions-shell { display: none; }",
        "#serve-llm-instructions-panel[data-state=expanded] .serve-llm-instructions-toggle { display: none; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-toggle { border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 999px; padding: 12px 18px; background: rgba(15, 23, 42, 0.9); color: #f8fafc; font-weight: 600; font-size: 0.88rem; display: flex; align-items: center; gap: 10px; box-shadow: 0 18px 44px rgba(15, 23, 42, 0.34); backdrop-filter: blur(12px); transition: transform 140ms ease, box-shadow 180ms ease, background 180ms ease; letter-spacing: 0.01em; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-toggle:hover { transform: translateY(-1px); box-shadow: 0 22px 52px rgba(15, 23, 42, 0.4); background: rgba(15, 23, 42, 0.82); }",
        "#serve-llm-instructions-panel .serve-llm-instructions-toggle:focus-visible { outline: 2px solid rgba(148, 163, 184, 0.65); outline-offset: 3px; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-toggle .serve-llm-token { width: 24px; height: 24px; border-radius: 999px; display: grid; place-items: center; font-size: 0.72rem; font-weight: 700; line-height: 1; background: linear-gradient(135deg, rgba(59, 130, 246, 0.92), rgba(139, 92, 246, 0.88)); box-shadow: 0 6px 16px rgba(79, 70, 229, 0.45); }",
        "#serve-llm-instructions-panel .serve-llm-instructions-toggle span:last-child { display: inline-block; transform: translateY(1px); }",
        "#serve-llm-instructions-panel .serve-llm-instructions-shell { width: 320px; padding: 18px; border-radius: 20px; background: rgba(255, 255, 255, 0.94); border: 1px solid rgba(15, 23, 42, 0.12); box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28); backdrop-filter: blur(12px); display: grid; gap: 12px; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-header { display: flex; align-items: center; justify-content: space-between; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-title { font-size: 0.95rem; font-weight: 600; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-close { border: none; background: transparent; color: #475569; padding: 6px; border-radius: 999px; width: 30px; height: 30px; display: grid; place-items: center; font-size: 1rem; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-close:hover { background: rgba(148, 163, 184, 0.18); color: #1e293b; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-description { font-size: 0.83rem; color: #475569; margin: 0; line-height: 1.5; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-form { display: grid; gap: 10px; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-label { font-size: 0.78rem; font-weight: 500; color: #334155; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-textarea { width: 100%; min-height: 100px; border-radius: 14px; padding: 12px 14px; border: 1px solid rgba(15, 23, 42, 0.16); background: rgba(248, 250, 252, 0.94); resize: vertical; font-size: 0.9rem; line-height: 1.45; color: inherit; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-textarea:focus-visible { outline: 2px solid rgba(37, 99, 235, 0.65); outline-offset: 2px; background: #fff; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-actions { display: flex; gap: 10px; }",
        "#serve-llm-instructions-panel .serve-llm-instructions-submit { flex: 1; border: none; border-radius: 12px; padding: 10px 14px; font-weight: 600; font-size: 0.9rem; color: #fff; background: linear-gradient(135deg, #2563eb, #1d4ed8); box-shadow: 0 18px 40px rgba(37, 99, 235, 0.35); }",
        "#serve-llm-instructions-panel .serve-llm-instructions-submit:hover { box-shadow: 0 20px 44px rgba(37, 99, 235, 0.42); transform: translateY(-1px); }",
        "#serve-llm-instructions-panel .serve-llm-instructions-cancel { flex: 1; border: none; border-radius: 12px; padding: 10px 14px; font-weight: 600; font-size: 0.9rem; color: #0f172a; background: rgba(148, 163, 184, 0.18); }",
        "#serve-llm-instructions-panel .serve-llm-instructions-cancel:hover { background: rgba(148, 163, 184, 0.26); }",
        "#serve-llm-instructions-panel .serve-llm-instructions-status { font-size: 0.8rem; color: #475569; margin: 0; min-height: 1.5em; }",
        "#serve-llm-instructions-panel .serve-llm-admin-link { font-size: 0.78rem; color: #1d4ed8; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }",
        "#serve-llm-instructions-panel .serve-llm-admin-link:hover { color: #1e40af; text-decoration: underline; }",
        "#serve-llm-instructions-panel .serve-llm-admin-link svg { width: 12px; height: 12px; fill: currentColor; }",
        "@media (max-width: 600px) { #serve-llm-instructions-panel { right: 12px; left: 12px; bottom: 12px; } #serve-llm-instructions-panel .serve-llm-instructions-shell { width: auto; } }",
    ].join("\n");
    const markup = [
        '<button type="button" class="serve-llm-instructions-toggle" aria-expanded="false" aria-controls="serve-llm-instructions-shell"><span class="serve-llm-token" aria-hidden="true">AI</span><span>Instructions</span></button>',
        '<section id="serve-llm-instructions-shell" class="serve-llm-instructions-shell" role="region" aria-label="Iteration instructions">',
        '  <header class="serve-llm-instructions-header">',
        '    <span class="serve-llm-instructions-title">Iteration Panel</span>',
        '    <button type="button" class="serve-llm-instructions-close" aria-label="Close iteration panel">&times;</button>',
        '  </header>',
        '  <p class="serve-llm-instructions-description">Send quick nudges to the runtime without hand-authoring markup.</p>',
        '  <form class="serve-llm-instructions-form" novalidate>',
        '    <label class="serve-llm-instructions-label" for="serve-llm-instructions-textarea">Describe the next change</label>',
        '    <textarea id="serve-llm-instructions-textarea" class="serve-llm-instructions-textarea" placeholder="e.g. brighten the CTA or add a testimonials strip"></textarea>',
        '    <div class="serve-llm-instructions-actions">',
        '      <button type="submit" class="serve-llm-instructions-submit">Apply</button>',
        '      <button type="button" class="serve-llm-instructions-cancel" data-action="cancel">Clear</button>',
        '    </div>',
        '  </form>',
        '  <p class="serve-llm-instructions-status" role="status" aria-live="polite"></p>',
        `  <a class="serve-llm-admin-link" href="${ADMIN_ROUTE_PREFIX}" data-serve-llm-admin-link>`,
        '    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M7.999 1.333a3.999 3.999 0 0 1 4 4v.337a5.334 5.334 0 0 1 2.669 4.63V12a.667.667 0 0 1-.447.628l-4 1.333a.666.666 0 0 1-.42 0l-4-1.333A.667.667 0 0 1 5.334 12v-1.7a5.334 5.334 0 0 1 2.666-4.63v-.337a3.999 3.999 0 0 1 4-4Zm0 1.334a2.666 2.666 0 0 0-2.666 2.666v.667c0 .245-.156.463-.387.54A4.001 4.001 0 0 0 6 10.3v1.115l2.666.888 2.667-.888V10.3a4 4 0 0 0-.945-3.756.584.584 0 0 1-.387-.54V5.333A2.666 2.666 0 0 0 8 2.667Z"/></svg>',
        '    Admin Panel',
        '  </a>',
        '</section>',
    ].join("");
    return `
(function() {
  'use strict';
  var PANEL_ID = 'serve-llm-instructions-panel';
  var PANEL_STYLE_ID = 'serve-llm-instructions-style';
  var PANEL_STATE_ATTR = 'data-state';
  var PANEL_EXPANDED = 'expanded';
  var PANEL_COLLAPSED = 'collapsed';
  var INSTRUCTIONS_FIELD = ${JSON.stringify(INSTRUCTIONS_FIELD)};
  var DEFAULT_STATUS = 'Share a quick tweak and press Apply when ready.';

  if (window.serveLlmInstructionsPanelAttached) return;
  window.serveLlmInstructionsPanelAttached = true;

  function init() {
    if (!document.body) {
      return;
    }
    ensureStyles();
    ensurePanel();
  }

  function ensureStyles() {
    if (document.getElementById(PANEL_STYLE_ID)) {
      return;
    }
    var style = document.createElement('style');
    style.id = PANEL_STYLE_ID;
    style.type = 'text/css';
    style.textContent = ${JSON.stringify(styles)};
    (document.head || document.documentElement).appendChild(style);
  }

  function ensurePanel() {
    if (document.getElementById(PANEL_ID)) {
      return;
    }

    var panel = document.createElement('aside');
    panel.id = PANEL_ID;
    panel.setAttribute(PANEL_STATE_ATTR, PANEL_COLLAPSED);
    panel.innerHTML = ${JSON.stringify(markup)};

    document.body.appendChild(panel);

    var toggle = panel.querySelector('.serve-llm-instructions-toggle');
    var closeBtn = panel.querySelector('.serve-llm-instructions-close');
    var cancelBtn = panel.querySelector('[data-action="cancel"]');
    var form = panel.querySelector('.serve-llm-instructions-form');
    var textarea = panel.querySelector('#serve-llm-instructions-textarea');
    var status = panel.querySelector('.serve-llm-instructions-status');

    function updateStatus(message) {
      if (!status) return;
      var trimmed = message && typeof message === 'string' ? message.trim() : '';
      status.textContent = trimmed || DEFAULT_STATUS;
    }

    function setExpanded(expanded) {
      panel.setAttribute(PANEL_STATE_ATTR, expanded ? PANEL_EXPANDED : PANEL_COLLAPSED);
      if (toggle) {
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      }
      if (expanded && textarea) {
        textarea.focus();
        textarea.select();
      }
    }

    function submitInstructions(value) {
      if (!document.body) return;
      updateStatus('Submitting instructions…');
      var ghostForm = document.createElement('form');
      ghostForm.method = 'post';
      ghostForm.action = window.location.pathname + window.location.search;
      ghostForm.style.position = 'absolute';
      ghostForm.style.width = '0';
      ghostForm.style.height = '0';
      ghostForm.style.overflow = 'hidden';
      ghostForm.style.opacity = '0';
      ghostForm.style.pointerEvents = 'none';

      var payload = document.createElement('input');
      payload.type = 'hidden';
      payload.name = INSTRUCTIONS_FIELD;
      payload.value = value;
      ghostForm.appendChild(payload);

      var hiddenInputs = document.querySelectorAll('input[type="hidden"]');
      for (var i = 0; i < hiddenInputs.length; i++) {
        var input = hiddenInputs[i];
        if (!input.name) continue;
        if (input.disabled) continue;
        if (input.name === INSTRUCTIONS_FIELD) continue;
        if (panel.contains(input)) continue;
        var clone = document.createElement('input');
        clone.type = 'hidden';
        clone.name = input.name;
        clone.value = input.value;
        ghostForm.appendChild(clone);
      }

      var submit = document.createElement('button');
      submit.type = 'submit';
      submit.style.display = 'none';
      ghostForm.appendChild(submit);

      document.body.appendChild(ghostForm);
      if (typeof ghostForm.requestSubmit === 'function') {
        ghostForm.requestSubmit(submit);
      } else {
        var event = typeof SubmitEvent === 'function'
          ? new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: submit })
          : new Event('submit', { bubbles: true, cancelable: true });
        var prevented = !ghostForm.dispatchEvent(event);
        if (!prevented) ghostForm.submit();
      }
    }

    if (toggle) {
      toggle.addEventListener('click', function() {
        var expanded = panel.getAttribute(PANEL_STATE_ATTR) === PANEL_EXPANDED;
        setExpanded(!expanded);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        setExpanded(false);
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        if (textarea) {
          textarea.value = '';
        }
        setExpanded(false);
        updateStatus('Cleared pending instructions.');
      });
    }

    if (form) {
      form.addEventListener('submit', function(event) {
        event.preventDefault();
        if (!textarea) return;
        var value = textarea.value.trim();
        if (!value) {
          textarea.focus();
          updateStatus('Add a quick instruction before submitting.');
          return;
        }
        submitInstructions(value);
      });
    }

    updateStatus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
`;
}
