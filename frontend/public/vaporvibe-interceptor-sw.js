(() => {
  const MESSAGE_TYPE = "vaporvibe-cache-html";
  const CACHE_TTL_MS = 90000;
  const cache = new Map();

  function pruneExpiredEntries() {
    const now = Date.now();
    for (const [token, entry] of cache.entries()) {
      if (!entry || typeof entry !== "object") {
        cache.delete(token);
        continue;
      }
      if (typeof entry.expiresAt !== "number" || entry.expiresAt <= now) {
        cache.delete(token);
      }
    }
  }

  self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
  });

  self.addEventListener("message", (event) => {
    const port = event.ports && event.ports[0];
    const respond = (payload) => {
      if (port) {
        try {
          port.postMessage(payload);
        } catch {
          // ignore channel failures
        }
      }
    };
    const data = event.data;
    if (!data || data.type !== MESSAGE_TYPE) {
      respond({ ok: false, reason: "unsupported-message" });
      return;
    }
    const targetUrl =
      typeof data.targetUrl === "string" && data.targetUrl.trim().length > 0
        ? data.targetUrl.trim()
        : null;
    const html =
      typeof data.html === "string" && data.html.trim().length > 0
        ? data.html
        : null;
    if (!targetUrl || !html) {
      respond({ ok: false, reason: "invalid-payload" });
      return;
    }
    pruneExpiredEntries();
    cache.set(targetUrl, {
      html,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    respond({ ok: true });
  });

  self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.mode !== "navigate") {
      return;
    }
    pruneExpiredEntries();
    const requestUrl = request.url;
    const entry = cache.get(requestUrl);
    if (!entry || !entry.html) {
      cache.delete(requestUrl);
      return;
    }
    cache.delete(requestUrl);
    event.respondWith(
      new Response(entry.html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      })
    );
  });
})();
