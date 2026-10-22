/**
 * LeaseAccom owner plans + listing limit enforcement
 * Limits: free 1 · professional 5 · business 10 · enterprise 30
 * Admin can override via platform_settings.listing_limits
 */
(function () {
  "use strict";

  var PLANS = {
    free: {
      id: "free",
      name: "Free",
      monthly: 0,
      annual: 0,
      maxListings: 1,
      priceLabel: "Free",
      blurb: "List properties, receive viewings and applications.",
      billing: "forever"
    },
    professional: {
      id: "professional",
      name: "Professional",
      monthly: 5000,
      annual: 54000,
      maxListings: 5,
      priceLabel: "₦5,000",
      blurb: "For individual landlords and small property owners.",
      billing: "month"
    },
    business: {
      id: "business",
      name: "Business",
      monthly: 10000,
      annual: 108000,
      maxListings: 10,
      priceLabel: "₦10,000",
      blurb: "For growing landlords and property managers.",
      billing: "month"
    },
    enterprise: {
      id: "enterprise",
      name: "Enterprise",
      monthly: 20000,
      annual: 216000,
      maxListings: 30,
      priceLabel: "₦20,000",
      blurb: "For agencies, hotels and large property businesses.",
      billing: "month"
    }
  };

  var billing = "monthly";
  var cachedLimits = null;

  function money(n) {
    return "₦" + Number(n).toLocaleString("en-NG");
  }

  function sb() {
    return window.leaseaccomSupabase || window.leasehubSupabase || null;
  }

  function currentUser() {
    try {
      return JSON.parse(
        localStorage.getItem("leasehubCurrentUser") ||
          localStorage.getItem("leaseHubCurrentUser") ||
          localStorage.getItem("leaseaccomCurrentUser") ||
          localStorage.getItem("currentUser") ||
          "null"
      );
    } catch (e) {
      return null;
    }
  }

  function normalizePlanId(raw) {
    var p = String(raw || "free").toLowerCase().trim();
    if (p === "basic" || p === "pro") return "professional";
    if (p === "standard" || p === "premium") return p === "premium" ? "enterprise" : "business";
    if (PLANS[p]) return p;
    return "free";
  }

  function getUserPlanId(user) {
    var u = user || currentUser() || {};
    return normalizePlanId(u.plan || u.subscriptionPlan || u.subscription_plan || "free");
  }

  function defaultLimitsMap() {
    return {
      free: PLANS.free.maxListings,
      professional: PLANS.professional.maxListings,
      business: PLANS.business.maxListings,
      enterprise: PLANS.enterprise.maxListings
    };
  }

  async function fetchAdminLimits() {
    if (cachedLimits) return cachedLimits;
    var client = sb();
    if (!client) {
      cachedLimits = defaultLimitsMap();
      return cachedLimits;
    }
    try {
      var res = await client
        .from("platform_settings")
        .select("value")
        .eq("key", "listing_limits")
        .maybeSingle();
      if (res.data && res.data.value) {
        cachedLimits = Object.assign(defaultLimitsMap(), res.data.value);
        return cachedLimits;
      }
    } catch (e) {}
    cachedLimits = defaultLimitsMap();
    return cachedLimits;
  }

  function getPlanLimitsSync(user) {
    var id = getUserPlanId(user);
    var map = cachedLimits || defaultLimitsMap();
    var max = map[id] != null ? Number(map[id]) : PLANS[id] ? PLANS[id].maxListings : 1;
    return { planId: id, planName: (PLANS[id] && PLANS[id].name) || id, maxListings: max, maxUnits: max, features: { analytics: id === 'free' ? 'none' : id === 'professional' ? 'basic' : 'full' } };
  }

  function getPlanLimits(user) {
    return getPlanLimitsSync(user);
  }

  function countOwnerUnits(user) {
    var u = user || currentUser();
    if (!u) return 0;
    var uid = String(u.id || u.userId || "");
    var n = 0;
    try {
      var all = JSON.parse(localStorage.getItem("leasehubProperties") || localStorage.getItem("properties") || "[]");
      if (Array.isArray(all)) {
        n = all.filter(function (p) {
          return String(p.ownerId || p.owner_id || p.userId || "") === uid;
        }).length;
      }
    } catch (e) {}
    if (u._cloudListingCount != null) return Number(u._cloudListingCount) || n;
    return n;
  }

  async function countOwnerUnitsCloud(user) {
    var u = user || currentUser();
    if (!u) return 0;
    var client = sb();
    var uid = u.id || u.userId;
    if (!client || !uid) return countOwnerUnits(u);
    try {
      var res = await client
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", uid);
      if (typeof res.count === "number") {
        u._cloudListingCount = res.count;
        return res.count;
      }
    } catch (e) {}
    return countOwnerUnits(u);
  }

  function canAddUnit(user) {
    var limits = getPlanLimitsSync(user);
    var used = countOwnerUnits(user);
    if (used >= limits.maxListings) {
      return {
        ok: false,
        used: used,
        max: limits.maxListings,
        planId: limits.planId,
        message:
          "Your " +
          limits.planName +
          " plan allows " +
          limits.maxListings +
          " active listing(s). You have " +
          used +
          "."
      };
    }
    return { ok: true, used: used, max: limits.maxListings, planId: limits.planId };
  }

  async function canAddUnitAsync(user) {
    await fetchAdminLimits();
    var u = user || currentUser();
    if (u) await countOwnerUnitsCloud(u);
    return canAddUnit(u);
  }

  function canAccessFeature(key, user) {
    var id = getUserPlanId(user);
    if (key === "featured") return id === "business" || id === "enterprise";
    if (key === "analytics") return id !== "free";
    if (key === "ad_free") return id === "business" || id === "enterprise";
    return true;
  }

  function ensureUserPlan(user) {
    var u = user || currentUser();
    if (!u) return null;
    if (!u.plan && !u.subscriptionPlan) {
      u.plan = "free";
      u.subscriptionPlan = "free";
    }
    return u;
  }

  function getCurrentPlan(user) {
    var id = getUserPlanId(user);
    var p = PLANS[id] || PLANS.free;
    return Object.assign({}, p, {
      priceLabel: p.priceLabel || (p.monthly ? "₦" + Number(p.monthly).toLocaleString("en-NG") : "Free"),
      blurb: p.blurb || "",
      billing: p.billing || (p.monthly ? "month" : "forever")
    });
  }

  function renderPricingGrid(container) {
    if (!container) return;
    var order = ["professional", "business", "enterprise"];
    container.innerHTML = order
      .map(function (id) {
        var p = PLANS[id];
        var popular = id === "business" ? " is-popular" : "";
        var ent = id === "enterprise" ? " is-ent" : "";
        return (
          '<article class="op-card' +
          popular +
          ent +
          '">' +
          (id === "business" ? '<span class="tag">Most Popular</span>' : "") +
          "<h3>" +
          p.name +
          "</h3>" +
          '<p class="aud">' +
          p.blurb +
          "</p>" +
          '<div><span class="price">' +
          p.priceLabel +
          '</span> <span class="period">/ month</span></div>' +
          '<div class="annual">Annual: ₦' +
          Number(p.annual).toLocaleString("en-NG") +
          " (10% off)</div>" +
          '<button type="button" class="cta' +
          (id === "enterprise" ? " is-purple" : "") +
          '" data-select-plan="' +
          id +
          '">Get Started →</button>' +
          "<ul><li>✓ Up to " +
          p.maxListings +
          " active listings</li><li>✓ Verification eligibility</li><li>✓ Viewings &amp; applications</li></ul>" +
          "</article>"
        );
      })
      .join("");
    container.querySelectorAll("[data-select-plan]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectPlan(btn.getAttribute("data-select-plan"));
      });
    });
  }

  function showCurrentPlan() {
    var el = document.getElementById("currentPlanBox");
    if (!el) return;
    var u = currentUser();
    var plan = getUserPlanId(u);
    var lim = getPlanLimitsSync(u);
    el.innerHTML =
      '<div class="box"><div>Your current plan: <span class="chip">' +
      lim.planName +
      "</span></div><div style=\"font-size:13px;color:#66706a\">Up to " +
      lim.maxListings +
      " active listings.</div></div>";
  }

  function setBilling(mode) {
    billing = mode;
    document.querySelectorAll("[data-billing]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-billing") === mode);
    });
    document.querySelectorAll("[data-price-for]").forEach(function (node) {
      var id = node.getAttribute("data-price-for");
      var p = PLANS[id];
      if (!p) return;
      node.textContent = mode === "annual" ? money(Math.round(p.annual / 12)) : money(p.monthly);
    });
    document.querySelectorAll("[data-annual-note]").forEach(function (node) {
      var id = node.getAttribute("data-annual-note");
      var p = PLANS[id];
      if (!p) return;
      node.textContent =
        mode === "annual"
          ? "Billed annually at " + money(p.annual) + " (10% off)"
          : "Annual: " + money(p.annual) + " (10% off)";
    });
  }

  function selectPlan(planId) {
    var p = PLANS[planId];
    if (!p || planId === "free") return;
    var u = currentUser();
    if (!u) {
      alert("Please sign in as an owner to choose a plan.");
      location.href = "login.html";
      return;
    }
    var intent = {
      planId: p.id,
      planName: p.name,
      billing: billing,
      amount: billing === "annual" ? p.annual : p.monthly,
      at: new Date().toISOString()
    };
    localStorage.setItem("leaseaccomPlanIntent", JSON.stringify(intent));
    alert(
      "Selected " +
        p.name +
        " (" +
        billing +
        ") — " +
        money(intent.amount) +
        ".\n\nPayment gateway will complete this when Paystack is connected. Your choice is saved on this device."
    );
    u.plan = p.id;
    u.subscriptionPlan = p.id;
    localStorage.setItem("leasehubCurrentUser", JSON.stringify(u));
    try {
      localStorage.setItem("leaseaccomCurrentUser", JSON.stringify(u));
    } catch (e) {}
    showCurrentPlan();
  }

  document.addEventListener("DOMContentLoaded", function () {
    fetchAdminLimits().then(function () {
      showCurrentPlan();
    });
    setBilling("monthly");
    document.querySelectorAll("[data-billing]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setBilling(btn.getAttribute("data-billing"));
      });
    });
    document.querySelectorAll("[data-select-plan]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectPlan(btn.getAttribute("data-select-plan"));
      });
    });
  });

  window.LeaseAccomPlans = {
    PLANS: PLANS,
    selectPlan: selectPlan,
    renderPricingGrid: renderPricingGrid,
    canAddUnit: canAddUnit,
    canAddUnitAsync: canAddUnitAsync,
    getPlanLimits: getPlanLimits,
    getCurrentPlan: getCurrentPlan,
    countOwnerUnits: countOwnerUnits,
    countOwnerUnitsCloud: countOwnerUnitsCloud,
    canAccessFeature: canAccessFeature,
    ensureUserPlan: ensureUserPlan,
    fetchAdminLimits: fetchAdminLimits,
    getUserPlanId: getUserPlanId
  };
})();
