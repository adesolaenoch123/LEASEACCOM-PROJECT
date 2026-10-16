/**
 * Phase C — Tenant loop: Browse Live → Save → Viewing → Apply → Track status
 */
(function (global) {
  function readUser() {
    try {
      return JSON.parse(
        localStorage.getItem("leaseaccomCurrentUser") ||
          localStorage.getItem("leaseaccomCurrentUser") ||
          "null"
      );
    } catch (e) {
      return null;
    }
  }

  function isTenant(user) {
    const u = user || readUser();
    if (!u) return false;
    const t = String(u.accountType || u.account_type || "tenant").toLowerCase();
    return t !== "owner" && t !== "landlord" && t !== "admin";
  }

  function loadJSON(key) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function tenantViewings(user) {
    const u = user || readUser();
    if (!u) return [];
    return loadJSON("viewingRequests").filter(
      (r) =>
        String(r.tenantId) === String(u.id) ||
        String(r.userId) === String(u.id) ||
        String(r.tenantEmail || "").toLowerCase() === String(u.email || "").toLowerCase()
    );
  }

  function tenantApplications(user) {
    const u = user || readUser();
    if (!u) return [];
    return loadJSON("rentalApplications").filter(
      (r) =>
        String(r.tenantId) === String(u.id) ||
        String(r.userId) === String(u.id) ||
        String(r.tenantEmail || "").toLowerCase() === String(u.email || "").toLowerCase()
    );
  }

  function savedCount(user) {
    const u = user || readUser();
    if (!u) return 0;
    if (Array.isArray(u.savedProperties)) return u.savedProperties.length;
    if (Array.isArray(u.saved)) return u.saved.length;
    try {
      const s = JSON.parse(localStorage.getItem("leaseaccomSaved") || "[]");
      return Array.isArray(s) ? s.length : 0;
    } catch (e) {
      return 0;
    }
  }

  function journeySteps(user) {
    const u = user || readUser();
    const views = tenantViewings(u);
    const apps = tenantApplications(u);
    const saved = savedCount(u);
    return [
      {
        id: "browse",
        done: true,
        label: "Browse Live homes",
        detail: "Only approved marketplace listings",
        href: "properties.html"
      },
      {
        id: "save",
        done: saved > 0,
        active: saved === 0,
        label: "Save favourites",
        detail: saved ? saved + " saved" : "Heart homes to compare later",
        href: "saved.html"
      },
      {
        id: "viewing",
        done: views.length > 0,
        active: views.length === 0,
        label: "Request a viewing",
        detail: views.length
          ? views.length + " viewing request(s)"
          : "From any property page",
        href: "properties.html"
      },
      {
        id: "apply",
        done: apps.length > 0,
        active: views.length > 0 && apps.length === 0,
        label: "Submit application",
        detail: apps.length
          ? apps.length + " application(s)"
          : "After you like a home",
        href: "apply.html"
      },
      {
        id: "track",
        done: views.length + apps.length > 0,
        label: "Track status here",
        detail: "Viewings & applications update on this dashboard"
      }
    ];
  }

  function renderJourney() {
    const host = document.getElementById("tenantJourney");
    if (!host) return;
    const user = readUser();
    if (!user || !isTenant(user)) return;
    const steps = journeySteps(user);
    host.innerHTML =
      '<ol class="lh-tenant-journey">' +
      steps
        .map(function (s, i) {
          const cls = s.done ? "is-done" : s.active ? "is-active" : "";
          const link =
            s.href && !s.done
              ? ' <a href="' + s.href + '">Go</a>'
              : s.href
                ? ' <a href="' + s.href + '">Open</a>'
                : "";
          return (
            '<li class="' +
            cls +
            '"><span class="lh-step-num">' +
            (i + 1) +
            "</span><div><strong>" +
            s.label +
            "</strong><p>" +
            s.detail +
            "</p>" +
            link +
            "</div></li>"
          );
        })
        .join("") +
      "</ol>";
  }

  function refreshCounts() {
    const user = readUser();
    const v = tenantViewings(user).length;
    const a = tenantApplications(user).length;
    const s = savedCount(user);
    const el = (id, n) => {
      const e = document.getElementById(id);
      if (e) e.textContent = String(n);
    };
    el("viewingCount", v);
    el("applicationCount", a);
    el("savedCount", s);
  }

  function renderApplicationList() {
    const list = document.getElementById("tenantApplicationList");
    const empty = document.getElementById("emptyTenantApplications");
    if (!list) return;
    const user = readUser();
    const apps = tenantApplications(user).sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0) -
        new Date(a.updatedAt || a.createdAt || 0)
    );
    if (!apps.length) {
      list.innerHTML = "";
      if (empty) empty.style.display = "";
      return;
    }
    if (empty) empty.style.display = "none";
    const S = global.LeaseAccomStatus;
    list.innerHTML = apps
      .map(function (app) {
        const st = String(app.status || "submitted").toLowerCase();
        const label = S && S.applicationLabel ? S.applicationLabel(st) : st;
        const cls = S && S.applicationClass ? S.applicationClass(st) : "status-pending";
        return (
          '<article class="lh-tenant-card">' +
          "<h3>" +
          (app.propertyTitle || app.title || "Application") +
          "</h3>" +
          '<span class="lh-status ' +
          cls +
          '">' +
          label +
          "</span>" +
          "<p>" +
          (app.propertyLocation || app.location || "") +
          "</p>" +
          "<small>Updated " +
          (app.updatedAt || app.createdAt || "").toString().slice(0, 10) +
          "</small></article>"
        );
      })
      .join("");
  }

  async function refreshTenantApplications() {
    const user = readUser();
    if (!user || !window.LeaseAccomApi || typeof window.LeaseAccomApi.request !== "function") return;
    try {
      const token = await window.LeaseAccomAuth?.getAccessToken?.();
      if (!token || !window.LeaseAccomApi.isConfigured || !window.LeaseAccomApi.isConfigured()) return;
      const payload = await window.LeaseAccomApi.request("/applications");
      const apps = Array.isArray(payload && payload.applications) ? payload.applications : [];
      if (!apps.length) return;
      const normalized = apps.map(function (app) {
        return {
          id: app.id,
          status: app.status || "submitted",
          propertyTitle: app.property_title || app.propertyTitle || app.title || "Application",
          propertyLocation: app.property_location || app.propertyLocation || app.location || "",
          tenantId: app.tenant_id || app.tenantId || user.id,
          tenantEmail: app.tenant_email || app.tenantEmail || user.email || "",
          updatedAt: app.updated_at || app.updatedAt || app.created_at || app.createdAt || new Date().toISOString(),
          createdAt: app.created_at || app.createdAt || app.updated_at || app.updatedAt || new Date().toISOString()
        };
      });
      localStorage.setItem("rentalApplications", JSON.stringify(normalized));
    } catch (e) {
      console.warn("tenant-loop backend applications unavailable", e);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    try {
      if (global.LeaseAccomRoles && global.LeaseAccomRoles.enforce) {
        global.LeaseAccomRoles.enforce();
      }
      refreshTenantApplications();
      renderJourney();
      refreshCounts();
      renderApplicationList();
    } catch (e) {
      console.warn("tenant-loop", e);
    }
  });

  global.LeaseAccomTenantLoop = {
    isTenant: isTenant,
    tenantViewings: tenantViewings,
    tenantApplications: tenantApplications,
    journeySteps: journeySteps,
    renderJourney: renderJourney,
    refreshCounts: refreshCounts
  };
})(window);
