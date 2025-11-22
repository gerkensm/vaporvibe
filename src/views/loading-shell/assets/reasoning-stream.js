(function () {
  if (typeof window === "undefined") return;
  var config = window.__vaporVibeReasoningStream;
  try {
    delete window.__vaporVibeReasoningStream;
  } catch (error) {
    window.__vaporVibeReasoningStream = undefined;
  }
  if (!config || typeof config !== "object") return;
  var token = typeof config.token === "string" ? config.token : "";
  var routePrefix = typeof config.routePrefix === "string" ? config.routePrefix : "";
  if (!token) return;

  var endpoint = routePrefix.replace(/\/$/, "") + "/" + token.replace(/^\/+/, "");
  dispatchGlobalEvent("vaporvibe:reasoning-token", {
    token: token,
    routePrefix: routePrefix,
  });

  var statusTargets = [];
  var statusRegistry = new WeakSet();

  function registerStatusTarget(node) {
    if (!node || statusRegistry.has(node)) return;
    statusRegistry.add(node);
    statusTargets.push(node);
  }

  function discoverStatusTargets(root) {
    if (!root) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      var element = root;
      if (element.hasAttribute && element.hasAttribute("data-status")) {
        registerStatusTarget(element);
      }
    }
    var candidates =
      root.querySelectorAll instanceof Function
        ? root.querySelectorAll("[data-status]")
        : [];
    for (var i = 0; i < candidates.length; i += 1) {
      registerStatusTarget(candidates[i]);
    }
  }

  discoverStatusTargets(document);

  function dispatchGlobalEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (error) {
      // ignore dispatch failures in local context
    }
    if (window.parent && window.parent !== window) {
      try {
        window.parent.dispatchEvent(new CustomEvent(name, { detail: detail }));
      } catch (error) {
        // ignore cross-window dispatch failures
      }
    }
    if (window.top && window.top !== window && window.top !== window.parent) {
      try {
        window.top.dispatchEvent(new CustomEvent(name, { detail: detail }));
      } catch (error) {
        // ignore top-level dispatch failures
      }
    }
  }

  function broadcastStatus(message, lock) {
    if (!message) return;
    for (var i = statusTargets.length - 1; i >= 0; i -= 1) {
      var node = statusTargets[i];
      if (!node || !node.isConnected) {
        statusTargets.splice(i, 1);
        continue;
      }
      node.textContent = message;
    }
    dispatchGlobalEvent("vaporvibe:reasoning-status", {
      message: message,
      lock: Boolean(lock),
    });
  }

  var displays = [];
  var logRegistry = new WeakSet();

  var READING_CHARS_PER_SECOND = 150;
  var animationState = {
    displayed: "",
    target: "",
    queue: "",
    rafId: null,
    lastTimestamp: 0,
    charAccumulator: 0,
    latestSnapshot: null,
  };

  function registerDisplay(log) {
    if (!log || logRegistry.has(log)) return;
    var panel = null;
    if (log.closest instanceof Function) {
      panel = log.closest("[data-reasoning-panel]");
    }
    if (!panel) return;
    logRegistry.add(log);
    var record = { panel: panel, log: log, entry: null, autoScroll: true };
    attachScrollHandler(record);
    displays.push(record);
    updateDisplays();
  }

  function discoverDisplays(root) {
    if (!root) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      var element = root;
      if (element.hasAttribute && element.hasAttribute("data-reasoning-log")) {
        registerDisplay(element);
      }
    }
    var candidates =
      root.querySelectorAll instanceof Function
        ? root.querySelectorAll("[data-reasoning-log]")
        : [];
    for (var i = 0; i < candidates.length; i += 1) {
      registerDisplay(candidates[i]);
    }
    discoverStatusTargets(root);
  }

  var SUMMARY_ENTRY_LIMIT = 3;

  var streamState = {
    finalized: false,
    liveBuffer: "",
    finalText: "",
    summaryBuffer: "",
    summaryEntries: [],
  };

  var hasStreamingUpdates = false;
  var latestSnapshot = null;

  discoverDisplays(document);

  var observer;
  if (typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var mutation = mutations[i];
        if (!mutation.addedNodes) continue;
        for (var j = 0; j < mutation.addedNodes.length; j += 1) {
          var node = mutation.addedNodes[j];
          if (node && node.nodeType === Node.ELEMENT_NODE) {
            discoverDisplays(node);
          }
        }
      }
    });
    var target = document.body || document.documentElement;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  }

  function sanitizeText(value) {
    return typeof value === "string" ? value.replace(/\r/g, "") : "";
  }

  function appendToBuffer(buffer, text) {
    var sanitized = sanitizeText(text);
    if (!sanitized) return buffer || "";
    return buffer ? buffer + sanitized : sanitized;
  }

  function buildSnapshot() {
    var streaming = !streamState.finalized;
    var liveText = streaming ? sanitizeText(streamState.liveBuffer) : "";
    var finalText = streamState.finalized ? sanitizeText(streamState.finalText) : "";
    var summaries = streamState.finalized
      ? streamState.summaryEntries
        .map(function (value) {
          return sanitizeText(value);
        })
        .filter(function (value) {
          return value && value.trim().length > 0;
        })
      : [];
    var summaryPreview = !streamState.finalized ? sanitizeText(streamState.summaryBuffer) : "";
    var hasContent = Boolean(
      (summaries && summaries.length > 0) ||
      (summaryPreview && summaryPreview.trim().length > 0) ||
      (streaming && liveText && liveText.trim().length > 0) ||
      (!streaming && finalText && finalText.trim().length > 0)
    );
    return {
      streaming: streaming,
      live: liveText,
      final: finalText,
      summaryPreview: summaryPreview,
      summaries: summaries,
      hasContent: hasContent,
    };
  }

  function broadcastReasoningUpdate(snapshot) {
    if (!snapshot) return;
    dispatchGlobalEvent("vaporvibe:reasoning-log", snapshot);
  }

  function updateDisplays() {
    var snapshot = buildSnapshot();
    latestSnapshot = snapshot;
    scheduleAnimation(snapshot);
    broadcastReasoningUpdate(snapshot);
  }

  updateDisplays();

  var source;
  try {
    source = new EventSource(endpoint);
  } catch (error) {
    console.warn("Unable to open reasoning stream", error);
    if (observer && observer.disconnect) observer.disconnect();
    return;
  }

  function closeStream() {
    if (source) {
      try {
        source.close();
      } catch (error) {
        // ignore
      }
    }
    if (observer && observer.disconnect) {
      observer.disconnect();
    }
  }

  source.addEventListener("reasoning", function (event) {
    if (streamState.finalized) return;
    try {
      var data = JSON.parse(event.data);
      var text = data && typeof data.text === "string" ? data.text : "";
      if (!text) return;
      var kind = data && typeof data.kind === "string" ? data.kind : "thinking";
      if (kind === "summary") {
        streamState.summaryBuffer = appendToBuffer(streamState.summaryBuffer, text);
      } else {
        streamState.liveBuffer = appendToBuffer(streamState.liveBuffer, text);
      }
      hasStreamingUpdates = true;
      updateDisplays();
      broadcastStatus("Capturing live model reasoning…", true);
    } catch (error) {
      console.warn("Failed to parse reasoning event", error);
    }
  });

  source.addEventListener("final", function (event) {
    try {
      var data = JSON.parse(event.data);
      streamState.finalized = true;
      var detailsText =
        data && Array.isArray(data.details) && data.details.length
          ? data.details.join("\n\n")
          : "";
      if (detailsText && detailsText.trim()) {
        streamState.finalText = sanitizeText(detailsText);
      } else if (streamState.liveBuffer.trim()) {
        streamState.finalText = sanitizeText(streamState.liveBuffer);
      } else {
        streamState.finalText = "";
      }
      var summaries = [];
      if (data && Array.isArray(data.summaries) && data.summaries.length) {
        summaries = data.summaries;
      } else if (streamState.summaryBuffer && streamState.summaryBuffer.trim()) {
        summaries = [streamState.summaryBuffer];
      }
      streamState.summaryEntries = summaries
        .map(function (value) {
          return sanitizeText(value);
        })
        .filter(function (value) {
          return value && value.trim().length > 0;
        })
        .slice(0, SUMMARY_ENTRY_LIMIT);
      streamState.summaryBuffer = "";
      updateDisplays();
    } catch (error) {
      console.warn("Failed to parse final reasoning payload", error);
    }
  });

  source.addEventListener("complete", function () {
    closeStream();
    if (!hasStreamingUpdates) {
      broadcastStatus("Model response ready.");
    }
  });

  source.addEventListener("error", function () {
    closeStream();
    if (!hasStreamingUpdates) {
      broadcastStatus("Awaiting model response…");
    }
  });

  window.addEventListener("beforeunload", function () {
    closeStream();
  });

  function scheduleAnimation(snapshot) {
    animationState.latestSnapshot = snapshot;
    var target = snapshotToMarkdown(snapshot);
    animationState.target = target;

    if (!target || target.length === 0) {
      animationState.displayed = "";
      animationState.queue = "";
      if (animationState.rafId !== null) {
        if (typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(animationState.rafId);
        }
        animationState.rafId = null;
      }
      animationState.lastTimestamp = 0;
      animationState.charAccumulator = 0;
      applyRender("", snapshot);
      return;
    }

    var prefixLength = getCommonPrefixLength(animationState.displayed, target);
    animationState.displayed = target.slice(0, prefixLength);
    animationState.queue = target.slice(prefixLength);

    applyRender(animationState.displayed, snapshot);

    if (animationState.queue.length > 0 && animationState.rafId === null) {
      animationState.lastTimestamp = 0;
      animationState.charAccumulator = 0;
      animationState.rafId = requestAnimationFrame(animationStep);
    }
  }

  function animationStep(timestamp) {
    if (!animationState.queue || animationState.queue.length === 0) {
      animationState.rafId = null;
      animationState.lastTimestamp = 0;
      animationState.charAccumulator = 0;
      return;
    }

    if (!animationState.lastTimestamp) {
      animationState.lastTimestamp = timestamp;
    }
    var delta = timestamp - animationState.lastTimestamp;
    animationState.lastTimestamp = timestamp;
    if (delta < 0) {
      delta = 0;
    }

    var rate = READING_CHARS_PER_SECOND;
    if (animationState.latestSnapshot && animationState.latestSnapshot.streaming === false) {
      rate = READING_CHARS_PER_SECOND * 1.6;
    }
    animationState.charAccumulator += (delta / 1000) * rate;
    var count = animationState.charAccumulator >= 1 ? Math.floor(animationState.charAccumulator) : 0;
    if (count <= 0) {
      animationState.rafId = requestAnimationFrame(animationStep);
      return;
    }
    if (count > animationState.queue.length) {
      count = animationState.queue.length;
    }

    animationState.displayed += animationState.queue.slice(0, count);
    animationState.queue = animationState.queue.slice(count);
    animationState.charAccumulator -= count;

    applyRender(animationState.displayed, animationState.latestSnapshot);

    if (animationState.queue.length > 0) {
      animationState.rafId = requestAnimationFrame(animationStep);
    } else {
      animationState.rafId = null;
      animationState.lastTimestamp = 0;
      animationState.charAccumulator = 0;
    }
  }

  function applyRender(markdown, snapshot) {
    var html = markdownToHtml(markdown);
    var hasContent =
      (snapshot && snapshot.hasContent) ||
      (typeof markdown === "string" && markdown.trim().length > 0);

    for (var i = displays.length - 1; i >= 0; i -= 1) {
      var display = displays[i];
      if (
        !display ||
        !display.panel ||
        !display.log ||
        !display.panel.isConnected ||
        !display.log.isConnected
      ) {
        displays.splice(i, 1);
        continue;
      }

      var log = display.log;
      if (!hasContent) {
        display.panel.removeAttribute("data-active");
        if (display.entry && display.entry.isConnected) {
          display.entry.innerHTML = "";
        }
        display.entry = null;
        if (log && log.firstChild) {
          log.innerHTML = "";
        }
        // Reset scroll state when clearing content
        display.userScrolled = false;
        continue;
      }

      display.panel.setAttribute("data-active", "true");
      var entry = display.entry;
      if (!entry || !entry.isConnected) {
        entry = document.createElement("div");
        entry.className = "reasoning-entry reasoning-markdown";
        log.innerHTML = "";
        log.appendChild(entry);
        display.entry = entry;
      }

      // Sticky logic: if user hasn't scrolled up, keep pinning to bottom
      var shouldPin = !display.userScrolled;

      entry.innerHTML = html;

      if (shouldPin) {
        log.scrollTop = log.scrollHeight;
      }
    }
  }

  function isNearBottom(node) {
    if (!node) return false;
    var distance = node.scrollHeight - (node.scrollTop + node.clientHeight);
    return distance <= 28;
  }

  function attachScrollHandler(record) {
    if (!record || !record.log || record.log.dataset.autoscrollAttached === "true") return;
    record.log.dataset.autoscrollAttached = "true";
    // Initialize state
    record.userScrolled = false;

    record.log.addEventListener(
      "scroll",
      function () {
        if (isNearBottom(record.log)) {
          // User returned to bottom, resume sticky scrolling
          record.userScrolled = false;
        } else {
          // User scrolled up, disable sticky scrolling
          record.userScrolled = true;
        }
      },
      { passive: true }
    );
  }

  function snapshotToMarkdown(snapshot) {
    if (!snapshot || !snapshot.hasContent) {
      return "";
    }
    var sections = [];
    if (snapshot.summaries && snapshot.summaries.length > 0) {
      if (snapshot.summaries.length > 1) {
        for (var i = 0; i < snapshot.summaries.length; i += 1) {
          var summary = snapshot.summaries[i];
          if (!summary) continue;
          sections.push(summary);
        }
      } else {
        sections.push(snapshot.summaries[0]);
      }
    } else if (snapshot.summaryPreview && snapshot.summaryPreview.trim()) {
      sections.push(snapshot.summaryPreview);
    }
    if (snapshot.streaming && snapshot.live && snapshot.live.trim()) {
      sections.push("#### Thinking aloud");
      sections.push(snapshot.live);
    }
    if (!snapshot.streaming && snapshot.final && snapshot.final.trim()) {
      sections.push("#### Final reasoning");
      sections.push(snapshot.final);
    }
    return sections.join("\n\n");
  }

  function getCommonPrefixLength(a, b) {
    if (!a || !b) return 0;
    var max = Math.min(a.length, b.length);
    var index = 0;
    while (index < max && a.charCodeAt(index) === b.charCodeAt(index)) {
      index += 1;
    }
    return index;
  }

  function markdownToHtml(markdown) {
    if (!markdown) return "";
    var sanitized = String(markdown).replace(/\r/g, "");
    var lines = sanitized.split("\n");
    var html = [];
    var inList = false;
    var listTag = "ul";
    var inCode = false;
    var codeLines = [];
    var paragraphLines = [];

    function closeList() {
      if (inList) {
        html.push("</" + listTag + ">");
        inList = false;
        listTag = "ul";
      }
    }

    function flushParagraph() {
      if (!paragraphLines.length) return;
      var rendered = [];
      for (var i = 0; i < paragraphLines.length; i += 1) {
        var line = paragraphLines[i];
        if (!line.trim()) continue;
        rendered.push(applyInlineMarkdown(line));
      }
      if (rendered.length > 0) {
        html.push("<p>" + rendered.join("<br>") + "</p>");
      }
      paragraphLines = [];
    }

    function flushCode() {
      if (!inCode) return;
      html.push(
        "<pre><code>" +
        escapeHtml(codeLines.join("\n")) +
        "</code></pre>"
      );
      codeLines = [];
      inCode = false;
    }

    for (var i = 0; i < lines.length; i += 1) {
      var rawLine = lines[i];
      var line = rawLine;
      if (line.trim().length === 0) {
        if (inCode) {
          codeLines.push("");
        } else {
          flushParagraph();
          closeList();
        }
        continue;
      }
      if (line.startsWith("```")) {
        if (inCode) {
          flushCode();
          continue;
        }
        flushParagraph();
        closeList();
        inCode = true;
        codeLines = [];
        continue;
      }
      if (inCode) {
        codeLines.push(line);
        continue;
      }
      if (line.startsWith("#")) {
        var headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
        if (headingMatch) {
          flushParagraph();
          closeList();
          var level = headingMatch[1].length;
          var headingText = applyInlineMarkdown(headingMatch[2]);
          html.push("<h" + level + ">" + headingText + "</h" + level + ">");
          continue;
        }
      }
      if (/^[-*]\s+/.test(line)) {
        flushParagraph();
        if (!inList) {
          html.push("<ul>");
          inList = true;
          listTag = "ul";
        } else if (listTag !== "ul") {
          closeList();
          html.push("<ul>");
          inList = true;
          listTag = "ul";
        }
        var itemText = line.replace(/^[-*]\s+/, "");
        html.push("<li>" + applyInlineMarkdown(itemText) + "</li>");
        continue;
      }
      if (/^\d+\.\s+/.test(line)) {
        flushParagraph();
        if (!inList) {
          html.push("<ol>");
          inList = true;
          listTag = "ol";
        } else if (listTag !== "ol") {
          closeList();
          html.push("<ol>");
          inList = true;
          listTag = "ol";
        }
        var orderedText = line.replace(/^\d+\.\s+/, "");
        html.push("<li>" + applyInlineMarkdown(orderedText) + "</li>");
        continue;
      }
      paragraphLines.push(line);
    }

    flushParagraph();
    flushCode();
    closeList();

    return html.join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeUrl(url) {
    if (typeof url !== "string") return "#";
    var trimmed = url.trim();
    if (!trimmed) return "#";
    if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
      return trimmed;
    }
    return "#";
  }

  function applyInlineMarkdown(text) {
    var escaped = escapeHtml(text);
    escaped = escaped.replace(/`([^`]+)`/g, function (_, code) {
      return "<code>" + code.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</code>";
    });
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    escaped = escaped.replace(/_([^_]+)_/g, "<em>$1</em>");
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, href) {
      var safeHref = sanitizeUrl(href);
      return '<a href="' + safeHref + '" target="_blank" rel="noreferrer noopener">' + label + "</a>";
    });
    return escaped;
  }
})();
