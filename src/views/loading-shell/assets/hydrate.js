window.__vaporVibeHydrateFromToken = function(token, path) {
  if (!token || typeof token !== "string") return;
  if (window.__vaporVibeHydrateFromTokenBusy) return;
  window.__vaporVibeHydrateFromTokenBusy = true;
  var prefix = __RESULT_ROUTE_PREFIX__;
  var originPath = typeof path === "string" && path.trim().length > 0 ? path : __ORIGINAL_PATH__;
  var requestUrl = prefix.replace(/\/$/, "") + "/" + token.replace(/^\/+/, "");
  var MAX_ATTEMPTS = 3;
  var RETRY_DELAY_MS = 3000;

  function onSuccess(htmlString) {
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
    window.__vaporVibeHydrateFromTokenBusy = false;
  }

  function onFailure(error) {
    console.error("vaporvibe hydrate failed", error);
    window.__vaporVibeHydrateFromTokenBusy = false;
    window.__vaporVibeHydrateError("We could not load the generated page. Reload and try again.");
  }

  function attemptFetch(attempt) {
    fetch(requestUrl, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Accept": "text/html" }
    }).then(function(response) {
      if (!response.ok) {
        throw new Error("Unexpected status " + response.status);
      }
      return response.text();
    }).then(onSuccess).catch(function(error) {
      if (attempt < MAX_ATTEMPTS) {
        console.warn("vaporvibe hydrate attempt " + attempt + " failed:", error);
        window.setTimeout(function() {
          attemptFetch(attempt + 1);
        }, RETRY_DELAY_MS * attempt);
        return;
      }
      onFailure(error);
    });
  }

  attemptFetch(1);
};

window.__vaporVibeHydrateError = function(message, detail) {
  var container = document.querySelector("main");
  if (!container) return;
  var detailHtml = "";
  if (detail) {
    var pre = document.createElement("pre");
    pre.textContent = detail;
    pre.style.background = "rgba(8, 47, 73, 0.65)";
    pre.style.padding = "16px 20px";
    pre.style.borderRadius = "12px";
    pre.style.lineHeight = "1.45";
    pre.style.overflowX = "auto";
    pre.style.textAlign = "left";
    pre.style.color = "#e2e8f0";
    pre.style.fontFamily = "monospace";
    detailHtml = "<h3>Error Details</h3>" + pre.outerHTML;
  }
  container.innerHTML =
    '<h1>We hit a snag</h1><p>' +
    message +
    '</p><p class="hint">Retry the request, or check the server logs for additional detail.</p>' +
    detailHtml;
};
