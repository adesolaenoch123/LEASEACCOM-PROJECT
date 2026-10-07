(function () {
  const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const apiBaseUrl = String(
    window.LEASEHUB_API_URL || (localHost ? "http://127.0.0.1:8000" : "")
  ).replace(/\/$/, "");

  window.LeaseHubApi = {
    async request(path, options = {}) {
      if (!apiBaseUrl) {
        throw new Error("LeaseHub services are not configured for this app build.");
      }

      const token = await window.LeaseHubAuth?.getAccessToken();
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
        body: options.body && typeof options.body !== "string"
          ? JSON.stringify(options.body)
          : options.body
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || "LeaseHub could not complete that request.");
      }
      return payload;
    },

    async createApplication(payload) {
      const token = await window.LeaseHubAuth?.getAccessToken();
      if (!token) return null;

      return this.request("/applications", {
        method: "POST",
        body: payload
      });
    },

    async createViewingRequest(payload) {
      const token = await window.LeaseHubAuth?.getAccessToken();
      if (!token) return null;

      return this.request("/viewing-requests", {
        method: "POST",
        body: payload
      });
    }
  };
})();
