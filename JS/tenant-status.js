/* Tenant applications list + shared status */
(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }
  function escapeHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
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
      const st = S ? S.normalizeApplicationStatus(app.status) : (app.status || "submitted");
      const label = S ? S.applicationLabel(st) : st;
      const cls = S ? S.applicationClass(st) : "status-pending";
      const timeline = S ? S.timelineHtml("application", st) : "";
      return `<article class="request-card lh-status-card">
        <div class="request-top"><h3>${escapeHtml(app.propertyTitle || "Property")}</h3>
        <span class="status-badge ${cls}">${escapeHtml(label)}</span></div>
        <p class="request-meta"><strong>Submitted:</strong> ${escapeHtml(app.submittedAt || app.createdAt || "—")}</p>
        ${timeline}
        <p class="lh-status-hint">Owner sees the same status on their applications panel.</p>
      </article>`;
    }).join("");
  });
})();
