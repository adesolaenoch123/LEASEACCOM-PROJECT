/* LeaseAccom viewing requests — tenant side + shared status */
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("viewingRequests");
  if (!container) return;
  const S = window.LeaseAccomStatus;
  let backendRequests = null;

  function loadRequests() {
    try {
      const v = JSON.parse(localStorage.getItem("viewingRequests") || "[]");
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }

  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem("leaseaccomCurrentUser") || localStorage.getItem("leaseaccomCurrentUser") || "null");
    } catch { return null; }
  }

  function escapeHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function propertyForRequest(request) {
    const id = request.propertyId || request.property_id;
    const catalog = Array.isArray(window.properties) ? window.properties : [];
    return catalog.find((property) => String(property.id) === String(id)) || null;
  }

  function propertyTitle(request) {
    const property = propertyForRequest(request);
    return request.propertyTitle || request.property_title || property?.title || "Property";
  }

  function propertyLocation(request) {
    const property = propertyForRequest(request);
    return request.propertyLocation || request.property_location || request.location || property?.location || property?.city || "";
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
      const empty = document.getElementById("emptyViewings");
      if (empty) empty.style.display = "flex";
      if (document.getElementById("emptyViewings")) {
        container.innerHTML = "";
        return;
      }
      container.innerHTML = `<div class="empty-requests"><h2>No viewing requests yet</h2>
        <p>Request a viewing from a property page. Status updates here for you and the owner.</p>
        <a href="properties.html" class="primary-btn">Browse properties</a></div>`;
      return;
    }

    const empty = document.getElementById("emptyViewings");
    if (empty) empty.style.display = "none";

    requests = requests.slice().sort((a, b) =>
      new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
    );

    container.innerHTML = requests.map((request) => {
      const status = S ? S.normalizeViewingStatus(request.status) : String(request.status || "requested");
      const statusClass = S ? S.viewingClass(status) : "status-pending";
      const statusText = S ? S.viewingLabel(status) : status;
      const timeline = S ? S.timelineHtml("viewing", status) : "";
      const requestedDate = request.viewingDate || request.date;
      const requestedTime = request.viewingTime || request.time;
      let formattedDate = requestedDate || "Not set";
      if (requestedDate) {
        const d = new Date(requestedDate);
        if (!isNaN(d)) formattedDate = d.toLocaleDateString("en-NG", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
      }
      return `<article class="request-card lh-status-card">
        <div class="request-info">
          <div class="request-top">
            <h3>${escapeHtml(propertyTitle(request))}</h3>
            <span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span>
          </div>
          <div class="request-location">${escapeHtml(propertyLocation(request))}</div>
          <p class="request-meta"><strong>Preferred date:</strong> ${escapeHtml(formattedDate)}</p>
          ${requestedTime ? `<p class="request-meta"><strong>Preferred time:</strong> ${escapeHtml(requestedTime)}</p>` : ""}
          ${request.message ? `<p class="request-meta"><strong>Note:</strong> ${escapeHtml(request.message)}</p>` : ""}
          ${timeline}
          <p class="lh-status-hint">Owner sees the same status on their dashboard.</p>
          ${request.propertyId ? `<a class="primary-btn request-property-btn" href="property-details.html?id=${encodeURIComponent(request.propertyId)}">View property <i class="bx bx-arrow-right" aria-hidden="true"></i></a>` : ""}
        </div>
      </article>`;
    }).join("");
  }

  async function loadBackendRequests() {
    try {
      const token = await window.LeaseAccomAuth?.getAccessToken();
      if (!token || !window.LeaseAccomApi) return;

      const payload = await window.LeaseAccomApi.request("/viewing-requests");
      backendRequests = (payload.viewing_requests || []).map((record) => ({
        id: record.id,
        propertyId: record.property_id,
        propertyTitle: record.property?.title || record.property_title || "",
        propertyLocation: record.property?.location || record.property?.city || record.property_location || "",
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
  window.LeaseAccomViewingRequests = { render };
});
