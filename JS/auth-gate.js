/**
 * LeaseAccom auth gate — resolve hosted roles from the authenticated profile.
 */
(function (global) {
  "use strict";

  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (error) {
      return null;
    }
  }

  function isLocalDevelopment() {
    var hostname = String(global.location && global.location.hostname || "");
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";
  }

  function getLocalUser() {
    var session =
      readJSON("leaseaccomCurrentUser") ||
      readJSON("leasehubCurrentUser") ||
      readJSON("currentUser");
    if (!session) return null;

    var users = readJSON("leaseaccomUsers");
    var registryUser = Array.isArray(users)
      ? users.find(function (user) {
          return (
            (session.id != null && String(user.id) === String(session.id)) ||
            (session.email && String(user.email || "").toLowerCase() === String(session.email).toLowerCase())
          );
        })
      : null;
    var source = registryUser || session;
    return {
      id: source.id != null ? source.id : session.id,
      email: source.email || session.email,
      name: source.name || session.name,
      accountType: normalizeRole(source.accountType || source.account_type || source.role),
      _source: "local-development"
    };
  }

  function normalizeRole(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  }

  function isOwnerRole(role) {
    return [
      "owner",
      "landlord",
      "property_owner",
      "hotel_manager",
      "commercial_owner",
      "business_owner"
    ].indexOf(normalizeRole(role)) >= 0;
  }

  function isAdminRole(role) {
    return ["admin", "super_admin", "staff"].indexOf(normalizeRole(role)) >= 0;
  }

  function isTenantRole(role) {
    return ["tenant", "renter", "student"].indexOf(normalizeRole(role)) >= 0;
  }

  async function resolveUser() {
    var client = global.leaseaccomSupabase || global.leasehubSupabase;
    if (!client || !client.auth || typeof client.auth.getUser !== "function") {
      return isLocalDevelopment() ? getLocalUser() : null;
    }

    var authResult;
    try {
      authResult = await client.auth.getUser();
    } catch (error) {
      console.error("Could not verify the current LeaseAccom session.", error);
      return isLocalDevelopment() ? getLocalUser() : null;
    }
    if (authResult.error) {
      console.error("Could not verify the current LeaseAccom session.", authResult.error);
      return isLocalDevelopment() ? getLocalUser() : null;
    }

    var authUser = authResult.data && authResult.data.user;
    if (!authUser) return isLocalDevelopment() ? getLocalUser() : null;

    try {
      var profileResult = await client
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();
      if (profileResult.error) throw profileResult.error;

      var profile = profileResult.data;
      if (!profile || String(profile.account_status || "active").toLowerCase() !== "active") {
        return null;
      }

      var verificationStatus = profile.verification_status || "unverified";
      return {
        id: authUser.id,
        email: authUser.email,
        name: profile.full_name || authUser.email,
        accountType: normalizeRole(profile.account_type),
        verificationStatus: verificationStatus,
        ownerVerificationStatus: verificationStatus,
        verification_status: verificationStatus,
        verified: verificationStatus === "verified",
        verifiedAt: profile.verified_at || null,
        verified_at: profile.verified_at || null,
        plan: profile.plan || profile.subscription_plan,
        subscriptionPlan: profile.subscription_plan || profile.plan,
        promoType: profile.promo_type || null,
        promoEndsAt: profile.promo_ends_at || null,
        _source: "supabase-profile"
      };
    } catch (error) {
      console.error("Could not verify the LeaseAccom profile role.", error);
      return null;
    }
  }

  function redirectForRole(user) {
    if (user && isAdminRole(user.accountType)) {
      global.location.replace("admin/admin.html");
    } else if (user && isOwnerRole(user.accountType)) {
      global.location.replace("owner-dashboard.html");
    } else if (user && isTenantRole(user.accountType)) {
      global.location.replace("tenant-dashboard.html");
    } else {
      global.location.replace("login.html");
    }
  }

  async function requireRole(role) {
    var user = await resolveUser();
    if (!user) {
      global.location.replace("login.html");
      return null;
    }

    var allowed = role === "owner"
      ? isOwnerRole(user.accountType)
      : role === "tenant"
        ? isTenantRole(user.accountType)
        : role === "admin" && isAdminRole(user.accountType);
    if (!allowed) {
      redirectForRole(user);
      return null;
    }

    if (document.body) document.body.setAttribute("data-auth-approved", "true");
    if (user._source === "supabase-profile") {
      try {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify(user));
      } catch (error) {
        console.warn("Could not cache the verified LeaseAccom profile.", error);
      }
    }
    return user;
  }

  function requireLogin() {
    return resolveUser().then(function (user) {
      if (!user) global.location.replace("login.html");
      else if (document.body) document.body.setAttribute("data-auth-approved", "true");
      return user;
    });
  }

  function requireOwner() {
    return requireRole("owner");
  }

  function requireTenant() {
    return requireRole("tenant");
  }

  function requireAdmin() {
    return requireRole("admin");
  }

  global.LeaseAccomAuthGate = {
    resolveUser: resolveUser,
    requireLogin: requireLogin,
    requireOwner: requireOwner,
    requireTenant: requireTenant,
    requireAdmin: requireAdmin,
    isOwnerRole: isOwnerRole,
    isTenantRole: isTenantRole,
    isAdminRole: isAdminRole
  };

  function autoGate() {
    var mode =
      (document.body && document.body.getAttribute("data-auth-gate")) ||
      (document.currentScript && document.currentScript.getAttribute("data-gate")) ||
      "";
    mode = String(mode).toLowerCase();
    if (mode === "owner") requireOwner();
    else if (mode === "tenant") requireTenant();
    else if (mode === "admin") requireAdmin();
    else if (mode === "login") requireLogin();
  }

  autoGate();
})(window);
