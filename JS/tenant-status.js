/* Tenant applications list + shared status */
(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }
  function escapeHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function formatSubmittedDate(value) {
    if (!value) return "\u2014";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-NG", {
      day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit"
    }).format(date);
  }
  function catalogProperty(propertyId) {
    const catalog = Array.isArray(window.properties) ? window.properties : [];
    return catalog.find((property) => String(property.id) === String(propertyId)) || null;
  }
  ready(function () {
    const S = window.LeaseAccomStatus;
    let apps = [];
    try { apps = JSON.parse(localStorage.getItem("rentalApplications") || "[]"); } catch { apps = []; }
    if (!Array.isArray(apps)) apps = [];
    let user = null;
    try { user = JSON.parse(localStorage.getItem("leaseaccomCurrentUser") || localStorage.getItem("leaseaccomCurrentUser") || "null"); } catch {}
    if (user && user.email) {
      const mine = apps.filter((a) =>
        String(a.applicantEmail || a.email || "").toLowerCase() === String(user.email).toLowerCase() ||
        String(a.tenantId) === String(user.id)
      );
      if (mine.length) apps = mine;
    }
    const appCount = document.getElementById("applicationCount");
    if (appCount) appCount.textContent = String(apps.length);
    const box = document.getElementById("tenantApplications") || document.getElementById("applicationsList");
    if (!box || !apps.length) return;
    apps = apps.slice().sort((a, b) => new Date(b.updatedAt || b.submittedAt || 0) - new Date(a.updatedAt || a.submittedAt || 0));
    box.innerHTML = apps.map((app) => {
      const property = catalogProperty(app.propertyId || app.property_id);
      const propertyId = app.propertyId || app.property_id || "";
      const st = S ? S.normalizeApplicationStatus(app.status) : (app.status || "submitted");
      const label = S ? S.applicationLabel(st) : st;
      const cls = S ? S.applicationClass(st) : "status-pending";
      const timeline = S ? S.timelineHtml("application", st) : "";
      return `<article class="request-card lh-status-card">
        <div class="request-top"><h3>${escapeHtml(app.propertyTitle || app.property_title || property?.title || "Property")}</h3>
        <span class="status-badge ${cls}">${escapeHtml(label)}</span></div>
        <p class="request-meta"><strong>Submitted:</strong> ${escapeHtml(formatSubmittedDate(app.submittedAt || app.createdAt))}</p>
        ${timeline}
        <p class="lh-status-hint">Owner sees the same status on their applications panel.</p>
        ${propertyId ? `<a class="primary-btn request-property-btn" href="property-details.html?id=${encodeURIComponent(propertyId)}">View property <i class="bx bx-arrow-right" aria-hidden="true"></i></a>` : ""}
      </article>`;
    }).join("");
  });
})();
