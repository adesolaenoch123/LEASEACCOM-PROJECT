(function () {
  const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  function resolveApiBase() {
    const fromWindow = String(window.LEASEACCOM_API_URL || "").trim().replace(/\/$/, "");
    if (fromWindow) return fromWindow;
    if (localHost) return "http://127.0.0.1:8000";
    return "";
  }

  window.LeaseAccomApi = {
    isConfigured() {
      return Boolean(resolveApiBase());
    },
    getBaseUrl() {
      return resolveApiBase();
    },
    async request(path, options = {}) {
      const apiBaseUrl = resolveApiBase();
      if (!apiBaseUrl) {
        throw new Error(
          "LeaseAccom API is not configured. Set window.LEASEACCOM_API_URL in JS/config.js."
        );
      }
      const token = await window.LeaseAccomAuth?.getAccessToken?.();
      if (!token) {
        throw new Error("Please log in again to continue.");
      }
      const headers = new Headers(options.headers || {});
      headers.set("Authorization", `Bearer ${token}`);
      if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers,
        body:
          options.body && typeof options.body !== "string"
            ? JSON.stringify(options.body)
            : options.body
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = payload.detail;
        const msg = typeof detail === "string" ? detail : (detail && JSON.stringify(detail)) || "LeaseAccom could not complete that request.";
        throw new Error(msg);
      }
      return payload;
    },
    async health() {
      const base = resolveApiBase();
      if (!base) return { ok: false, configured: false };
      try {
        const res = await fetch(`${base}/health`);
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, configured: true, data };
      } catch (e) {
        return { ok: false, configured: true, error: e.message };
      }
    },
    async createApplication(payload) {
      const token = await window.LeaseAccomAuth?.getAccessToken?.();
      if (!token) return null;
      return this.request("/applications", { method: "POST", body: payload });
    },
    async createViewingRequest(payload) {
      const token = await window.LeaseAccomAuth?.getAccessToken?.();
      if (!token) return null;
      return this.request("/viewing-requests", { method: "POST", body: payload });
    }
  };
})();
