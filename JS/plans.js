/**
 * LeaseHub owner subscription plans (localStorage until Paystack is live).
 */
(function (global) {
  const PLANS = {
    free: {
      id: "free",
      name: "Free",
      priceNgn: 0,
      priceLabel: "₦0",
      billing: "forever",
      maxUnits: 5,
      features: {
        analytics: "none",
        viewerTracking: false,
        featuredListings: 0,
        noAds: false,
        homepageLogo: false,
        teamAccess: false,
        dashboard: "limited"
      },
      blurb: "List up to 5 units. Limited dashboard."
    },
    basic: {
      id: "basic",
      name: "Basic",
      priceNgn: 5000,
      priceLabel: "₦5,000",
      billing: "month",
      maxUnits: 10,
      features: {
        analytics: "none",
        viewerTracking: false,
        featuredListings: 0,
        noAds: false,
        homepageLogo: false,
        teamAccess: false,
        dashboard: "limited"
      },
      blurb: "Up to 10 units. Limited dashboard."
    },
    standard: {
      id: "standard",
      name: "Standard",
      priceNgn: 10000,
      priceLabel: "₦10,000",
      billing: "month",
      maxUnits: 30,
      features: {
        analytics: "basic",
        viewerTracking: false,
        featuredListings: 2,
        noAds: false,
        homepageLogo: false,
        teamAccess: false,
        dashboard: "standard"
      },
      blurb: "Up to 30 units. Basic analytics + 2 featured listings."
    },
    premium: {
      id: "premium",
      name: "Premium",
      priceNgn: 20000,
      priceLabel: "₦20,000",
      billing: "month",
      maxUnits: 50,
      features: {
        analytics: "full",
        viewerTracking: true,
        featuredListings: -1, // unlimited
        noAds: true,
        homepageLogo: true,
        teamAccess: true,
        dashboard: "full"
      },
      blurb: "Up to 50 units. Full analytics, viewer tracking, no ads, team access."
    }
  };

  const ORDER = ["free", "basic", "standard", "premium"];

  function normalizePlanId(raw) {
    const id = String(raw || "free").toLowerCase().trim();
    if (id === "pro") return "premium";
    if (PLANS[id]) return id;
    return "free";
  }

  function readUser() {
    try {
      return JSON.parse(localStorage.getItem("leasehubCurrentUser") || "null");
    } catch (e) {
      return null;
    }
  }

  function writeUser(user) {
    if (!user) return;
    try {
      localStorage.setItem("leasehubCurrentUser", JSON.stringify(user));
      localStorage.setItem("leaseHubCurrentUser", JSON.stringify(user));
      const users = JSON.parse(localStorage.getItem("leasehubUsers") || "[]");
      if (Array.isArray(users)) {
        const i = users.findIndex((u) => String(u.id) === String(user.id));
        if (i !== -1) {
          users[i] = user;
          localStorage.setItem("leasehubUsers", JSON.stringify(users));
        }
      }
    } catch (e) {}
  }

  function ensureUserPlan(user) {
    if (!user) return null;
    const planId = normalizePlanId(user.plan || user.subscriptionPlan || "free");
    user.plan = planId;
    user.subscriptionPlan = planId;
    if (!user.planUpdatedAt) user.planUpdatedAt = new Date().toISOString();
    return user;
  }

  function getCurrentPlan(user) {
    const u = ensureUserPlan(user || readUser()) || { plan: "free" };
    const id = normalizePlanId(u.plan);
    return { ...PLANS[id] };
  }

  function getPlanLimits(user) {
    const plan = getCurrentPlan(user);
    return {
      planId: plan.id,
      planName: plan.name,
      maxUnits: plan.maxUnits,
      features: { ...plan.features },
      priceNgn: plan.priceNgn,
      priceLabel: plan.priceLabel
    };
  }

  function countOwnerUnits(user) {
    const u = user || readUser();
    if (!u) return 0;
    // Prefer explicit properties array on user
    if (Array.isArray(u.properties) && u.properties.length) {
      return u.properties.length;
    }
    try {
      const all = JSON.parse(localStorage.getItem("leasehubProperties") || "[]");
      if (!Array.isArray(all)) return 0;
      return all.filter((p) => String(p.ownerId) === String(u.id)).length;
    } catch (e) {
      return 0;
    }
  }

  function canAddUnit(user) {
    const limits = getPlanLimits(user);
    const used = countOwnerUnits(user);
    const ok = used < limits.maxUnits;
    return {
      ok,
      used,
      max: limits.maxUnits,
      remaining: Math.max(0, limits.maxUnits - used),
      planName: limits.planName,
      planId: limits.planId,
      message: ok
        ? `You can list ${Math.max(0, limits.maxUnits - used)} more unit(s) on ${limits.planName}.`
        : `You've reached the ${limits.planName} limit of ${limits.maxUnits} units. Upgrade to list more.`
    };
  }

  function canAccessFeature(featureKey, user) {
    const f = getPlanLimits(user).features;
    switch (featureKey) {
      case "analytics":
        return f.analytics === "basic" || f.analytics === "full";
      case "fullAnalytics":
        return f.analytics === "full";
      case "viewerTracking":
        return !!f.viewerTracking;
      case "featureListing":
        return f.featuredListings === -1 || f.featuredListings > 0;
      case "noAds":
        return !!f.noAds;
      case "homepageLogo":
        return !!f.homepageLogo;
      case "teamAccess":
        return !!f.teamAccess;
      default:
        return false;
    }
  }

  function setPlan(planId, user) {
    const u = ensureUserPlan(user || readUser());
    if (!u) return null;
    u.plan = normalizePlanId(planId);
    u.subscriptionPlan = u.plan;
    u.planUpdatedAt = new Date().toISOString();
    writeUser(u);
    return getCurrentPlan(u);
  }

  function upgradePrompt(reason) {
    return {
      title: "Upgrade your plan",
      reason: reason || "This feature needs a higher LeaseHub plan.",
      href: "owner-payments.html#plans"
    };
  }

  function listPlans() {
    return ORDER.map((id) => ({ ...PLANS[id] }));
  }

  // Init: ensure logged-in owner has a plan field
  try {
    const u = readUser();
    if (u && (u.accountType === "owner" || u.account_type === "owner")) {
      ensureUserPlan(u);
      writeUser(u);
    }
  } catch (e) {}

  global.LeaseHubPlans = {
    PLANS,
    ORDER,
    getCurrentPlan,
    getPlanLimits,
    countOwnerUnits,
    canAddUnit,
    canAccessFeature,
    setPlan,
    upgradePrompt,
    listPlans,
    normalizePlanId,
    ensureUserPlan
  };
})(window);
