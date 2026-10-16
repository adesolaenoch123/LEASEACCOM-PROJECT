
(function () {
  function applyNav() {
    if (!window.LeaseAccomRoles) return;
    var user = window.LeaseAccomRoles.readUser();
    var role = user ? window.LeaseAccomRoles.normalizeAccountType(user.accountType) : null;
    document.querySelectorAll("[data-owner-only]").forEach(function (el) {
      el.style.display = role === "owner" || role === "admin" ? "" : "none";
    });
    document.querySelectorAll("[data-tenant-only]").forEach(function (el) {
      el.style.display = role === "tenant" || !role ? "" : "none";
    });
    // Common: owner-btn "List a Property" on public nav
    if (role === "tenant") {
      document.querySelectorAll("a.owner-btn, a[href='add-property.html'], a[href='owner-dashboard.html']").forEach(function (a) {
        var text = (a.textContent || "").toLowerCase();
        if (text.indexOf("list") >= 0 || (a.getAttribute("href") || "").indexOf("add-property") >= 0) {
          a.style.display = "none";
        }
      });
    }
    if (role === "owner") {
      document.querySelectorAll("a[href='tenant-dashboard.html']").forEach(function (a) {
        /* keep optional */
      });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyNav);
  } else applyNav();
})();
