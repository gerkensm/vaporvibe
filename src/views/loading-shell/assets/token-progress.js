(function () {
  if (typeof window === "undefined") return;

  var progressRoot = null;
  var progressBar = null;
  var rafId = null;
  var target = 0;
  var current = 0;
  var lastTimestamp = 0;
  var hasStream = false;
  var completed = false;
  var pendingDetail = null;

  function selectElements() {
    if (progressRoot && progressBar && progressRoot.isConnected) return true;
    progressRoot = document.querySelector("[data-token-progress]");
    progressBar = progressRoot
      ? progressRoot.querySelector("[data-token-progress-bar]")
      : null;
    return Boolean(progressRoot && progressBar);
  }

  function setVisibility(active) {
    if (!progressRoot) return;
    if (active) {
      progressRoot.setAttribute("data-active", "true");
    } else {
      progressRoot.removeAttribute("data-active");
    }
  }

  function render(value) {
    if (!progressBar) return;
    var clamped = Math.max(0.02, Math.min(1, value));
    progressBar.style.transform = "scaleX(" + clamped + ")";
  }

  function step(timestamp) {
    if (!progressRoot || !progressBar) {
      rafId = null;
      return;
    }
    if (!lastTimestamp) {
      lastTimestamp = timestamp;
    }
    var delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    var eased = current + (target - current) * Math.min(0.45, delta / 140);
    if (Math.abs(eased - target) < 0.002) {
      eased = target;
    }
    current = eased;
    render(current);
    if (current < target - 0.001) {
      rafId = requestAnimationFrame(step);
    } else if (completed) {
      setVisibility(true);
      rafId = null;
    } else {
      rafId = null;
    }
  }

  function schedule() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(step);
  }

  function handleProgress(detail) {
    if (!selectElements()) {
      pendingDetail = detail || null;
      return;
    }
    var produced = Number(detail && detail.produced);
    var maxOutputTokens = Number(detail && detail.maxOutputTokens);
    var isComplete = Boolean(detail && detail.complete);

    if (!hasStream && !isComplete) {
      setVisibility(true);
      hasStream = true;
    }

    if (isComplete) {
      completed = true;
      target = 1;
      current = Math.min(current, target);
      setVisibility(true);
      render(current);
      schedule();
      return;
    }

    if (!Number.isFinite(produced) || produced < 0) return;

    var nextTarget = target;
    if (Number.isFinite(maxOutputTokens) && maxOutputTokens > 0) {
      nextTarget = Math.min(1, produced / maxOutputTokens);
    } else {
      nextTarget = Math.min(target + 0.015, 0.92);
    }

    if (nextTarget > target) {
      target = Math.min(1, nextTarget);
      setVisibility(true);
      schedule();
    }
  }

  function reset() {
    target = 0;
    current = 0;
    lastTimestamp = 0;
    completed = false;
    hasStream = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (selectElements()) {
      render(0);
      setVisibility(false);
    }
  }

  function onTokenEvent(event) {
    if (!(event instanceof CustomEvent)) return;
    handleProgress(event.detail || {});
  }

  function onReasoningHide() {
    reset();
  }

  function attachListeners() {
    window.addEventListener("vaporvibe:token-progress", onTokenEvent);
    window.addEventListener("vaporvibe:reasoning-hide", onReasoningHide);
    window.addEventListener("vaporvibe:reasoning-token", function () {
      reset();
      hasStream = true;
      if (progressRoot) {
        setVisibility(true);
      }
    });
  }

  function init() {
    selectElements();
    render(0);
    setVisibility(false);
    if (pendingDetail) {
      var replay = pendingDetail;
      pendingDetail = null;
      handleProgress(replay);
    }
  }

  attachListeners();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.__vaporVibeResetProgressBar = reset;
})();
