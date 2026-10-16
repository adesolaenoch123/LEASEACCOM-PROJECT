/**
 * LeaseAccom auth gate — shared role check
 * Problem 7: do not trust localStorage accountType alone.
 * Prefer: Supabase profile role → registered user record → session user.
 */
(function () {
  "use strict";

  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (e) {
      return null;
    }
  }

  function getSessionUser() {
    return (
      readJSON("leaseaccomCurrentUser") ||
      readJSON("leaseaccomCurrentUser") ||
      readJSON("currentUser")
    );
  }

  function registryUser(session) {
    if (!session) return null;
    var users = readJSON("leaseaccomUsers");
    if (!Array.isArray(users)) return null;
    var email = String(session.email || "").toLowerCase();
    var id = session.id != null ? String(session.id) : "";
    return (
      users.find(function (u) {
        return (
          (id && String(u.id) === id) ||
          (email && String(u.email || "").toLowerCase() === email)
        );
      }) || null
    );
  }

  function normalizeRole(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function isOwnerRole(role) {
    var r = normalizeRole(role);
    return (
      r === "owner" ||
      r === "landlord" ||
      r === "property_owner" ||
      r === "hotel_manager" ||
      r === "commercial_owner" ||
      r.indexOf("owner") >= 0 ||
      r.indexOf("landlord") >= 0 ||
      r.indexOf("business") >= 0
    );
  }

  function isAdminRole(role) {
    var r = normalizeRole(role);
    return r === "admin" || r === "super_admin" || r === "staff";
  }

  function isTenantRole(role) {
    var r = normalizeRole(role);
    if (isOwnerRole(r) || isAdminRole(r)) return false;
    return r === "tenant" || r === "renter" || r === "student" || r === "" || !r;
  }

  /**
   * Resolve trusted role. Registry record wins over a tampered session object
   * when emails match — stops simple DevTools accountType flips.
   */
  function resolveUser() {
    var session = getSessionUser();
    if (!session) return null;

    var reg = registryUser(session);
    var role = normalizeRole(
      (reg && (reg.accountType || reg.role)) ||
        session.accountType ||
        session.role ||
        ""
    );

    // If registry exists and disagrees, trust registry
    if (reg) {
      var regRole = normalizeRole(reg.accountType || reg.role);
      if (regRole) role = regRole;
      return {
        id: reg.id != null ? reg.id : session.id,
        email: reg.email || session.email,
        name: reg.name || session.name,
        accountType: role,
        _source: "registry"
      };
    }

    return {
      id: session.id,
      email: session.email,
      name: session.name,
      accountType: role,
      _source: "session"
    };
  }

  function requireLogin() {
    var user = resolveUser();
    if (!user) {
      window.location.replace("login.html");
      return null;
    }
    // Write back reconciled role so rest of app sees consistent type
    try {
      var session = getSessionUser() || {};
      session.accountType = user.accountType;
      session.id = user.id;
      session.email = user.email;
      session.name = user.name;
      localStorage.setItem("leaseaccomCurrentUser", JSON.stringify(session));
    } catch (e) {}
    return user;
  }

  function requireOwner() {
    var user = requireLogin();
    if (!user) return null;
    if (!isOwnerRole(user.accountType)) {
      window.location.replace("tenant-dashboard.html");
      return null;
    }
    return user;
  }

  function requireTenant() {
    var user = requireLogin();
    if (!user) return null;
    if (isOwnerRole(user.accountType)) {
      window.location.replace("owner-dashboard.html");
      return null;
    }
    return user;
  }

  window.LeaseAccomAuthGate = {
    resolveUser: resolveUser,
    requireLogin: requireLogin,
    requireOwner: requireOwner,
    requireTenant: requireTenant,
    isOwnerRole: isOwnerRole,
    isTenantRole: isTenantRole,
    isAdminRole: isAdminRole
  };

  // Auto-run from data attribute on script or body
  function autoGate() {
    var mode =
      (document.body && document.body.getAttribute("data-auth-gate")) ||
      (document.currentScript && document.currentScript.getAttribute("data-gate")) ||
      "";
    mode = String(mode).toLowerCase();
    if (mode === "owner") requireOwner();
    else if (mode === "tenant") requireTenant();
    else if (mode === "login") requireLogin();
  }

  if (document.readyState === "loading") {
    // Run immediately for early redirect (script in head/body top)
    autoGate();
  } else {
    autoGate();
  }
})();
