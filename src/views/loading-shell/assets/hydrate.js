window.__vaporVibeHydrateFromToken = function(token, path) {
  if (!token || typeof token !== "string") return;
  if (window.__vaporVibeHydrateFromTokenBusy) return;
  window.__vaporVibeHydrateFromTokenBusy = true;
  var prefix = __RESULT_ROUTE_PREFIX__;
  var originPath = typeof path === "string" && path.trim().length > 0 ? path : __ORIGINAL_PATH__;
  var requestUrl = prefix.replace(/\/$/, "") + "/" + token.replace(/^\/+/, "");
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
    console.error("vaporvibe hydrate failed", error);
    window.__vaporVibeHydrateError("We could not load the generated page. Reload and try again.");
  }).finally(function() {
    window.__vaporVibeHydrateFromTokenBusy = false;
  });
};

window.__vaporVibeHydrateError = function(message) {
  var container = document.querySelector("main");
  if (!container) return;
  container.innerHTML = '<h1>We hit a snag</h1><p>' + message + '</p><p class="hint">Retry the request, or check the server logs for additional detail.</p>';
};
