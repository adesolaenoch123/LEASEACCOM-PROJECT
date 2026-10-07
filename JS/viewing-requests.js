/* LeaseHub viewing requests — tenant side + shared status */
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("viewingRequests");
  if (!container) return;
  const S = window.LeaseHubStatus;
  let backendRequests = null;

  function loadRequests() {
    try {
      const v = JSON.parse(localStorage.getItem("viewingRequests") || "[]");
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }

  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem("leasehubCurrentUser") || localStorage.getItem("leaseHubCurrentUser") || "null");
    } catch { return null; }
  }

  function escapeHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function render() {
    let requests = backendRequests === null ? loadRequests() : backendRequests;
    const user = currentUser();
    if (backendRequests === null && user && (user.email || user.id)) {
      const filtered = requests.filter((r) =>
        String(r.tenantEmail || "").toLowerCase() === String(user.email || "").toLowerCase() ||
        String(r.tenantId) === String(user.id) || String(r.userId) === String(user.id)
      );
      if (filtered.length) requests = filtered;
    }
    const countEl = document.getElementById("viewingCount");
    if (countEl) countEl.textContent = String(requests.length);

    if (!requests.length) {
      container.innerHTML = `<div class="empty-requests"><h2>No viewing requests yet</h2>
        <p>Request a viewing from a property page. Status updates here for you and the owner.</p>
        <a href="properties.html" class="primary-btn">Browse properties</a></div>`;
      return;
    }

    requests = requests.slice().sort((a, b) =>
      new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
    );

    container.innerHTML = requests.map((request) => {
      const status = S ? S.normalizeViewingStatus(request.status) : String(request.status || "requested");
      const statusClass = S ? S.viewingClass(status) : "status-pending";
      const statusText = S ? S.viewingLabel(status) : status;
      const timeline = S ? S.timelineHtml("viewing", status) : "";
      let formattedDate = request.viewingDate || "Not set";
      if (request.viewingDate) {
        const d = new Date(request.viewingDate);
        if (!isNaN(d)) formattedDate = d.toLocaleDateString("en-NG", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
      }
      return `<article class="request-card lh-status-card">
        <div class="request-info">
          <div class="request-top">
            <h3>${escapeHtml(request.propertyTitle || "Property")}</h3>
            <span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span>
          </div>
          <div class="request-location">${escapeHtml(request.propertyLocation || request.location || "")}</div>
          <p class="request-meta"><strong>Preferred date:</strong> ${escapeHtml(formattedDate)}</p>
          ${request.viewingTime ? `<p class="request-meta"><strong>Preferred time:</strong> ${escapeHtml(request.viewingTime)}</p>` : ""}
          ${request.message ? `<p class="request-meta"><strong>Note:</strong> ${escapeHtml(request.message)}</p>` : ""}
          ${timeline}
          <p class="lh-status-hint">Owner sees the same status on their dashboard.</p>
        </div>
      </article>`;
    }).join("");
  }

  async function loadBackendRequests() {
    try {
      const token = await window.LeaseHubAuth?.getAccessToken();
      if (!token || !window.LeaseHubApi) return;

      const payload = await window.LeaseHubApi.request("/viewing-requests");
      backendRequests = (payload.viewing_requests || []).map((record) => ({
        id: record.id,
        propertyId: record.property_id,
        propertyTitle: record.property?.title || "Property",
        propertyLocation: record.property?.location || record.property?.city || "",
        viewingDate: record.preferred_date || record.viewing_date,
        viewingTime: record.preferred_time,
        message: record.notes || record.message,
        status: record.status,
        createdAt: record.created_at,
        updatedAt: record.updated_at
      }));
      render();
    } catch (error) {
      console.warn("Backend viewing requests could not be loaded.", error);
    }
  }

  render();
  loadBackendRequests();
  window.addEventListener("storage", (e) => { if (e.key === "viewingRequests") render(); });
});
