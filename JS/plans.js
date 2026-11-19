/** LeaseAccom owner plans and listing limits. */
(function () {
  "use strict";
  var PLANS = {
    free: { id: "free", name: "Free", monthly: 0, annual: 0, maxListings: 5, maxPhotos: 10, maxVideos: 2, priceLabel: "₦0", blurb: "For private landlords listing on LeaseAccom.", billing: "forever" },
    business: { id: "business", name: "Business", monthly: 10000, annual: 108000, maxListings: 15, maxPhotos: 15, maxVideos: 3, priceLabel: "₦10,000", blurb: "For growing landlords and property managers.", billing: "month" },
    enterprise: { id: "enterprise", name: "Enterprise", monthly: 20000, annual: 216000, maxListings: 30, maxPhotos: 30, maxVideos: 5, priceLabel: "₦20,000", blurb: "For established agencies, hotels and large property businesses.", billing: "month" }
  };
  var billing = "monthly", cachedLimits = null;
  var LAUNCH = { startDate: "2026-11-18", foundingSlots: 200 };
  function money(n) { return "₦" + Number(n || 0).toLocaleString("en-NG"); }
  function sb() { return window.leaseaccomSupabase || window.leasehubSupabase || null; }
  function currentUser() { try { return JSON.parse(localStorage.getItem("leasehubCurrentUser") || localStorage.getItem("leaseHubCurrentUser") || localStorage.getItem("leaseaccomCurrentUser") || localStorage.getItem("currentUser") || "null"); } catch (e) { return null; } }
  function normalizePlanId(raw) { var p = String(raw || "free").toLowerCase().trim(); if (p === "basic" || p === "pro" || p === "professional") return "free"; if (p === "standard") return "business"; if (p === "premium") return "enterprise"; return PLANS[p] ? p : "free"; }
  function isVerified(user) { var u = user || {}; return u.verified === true || [u.verificationStatus, u.verification_status, u.ownerVerificationStatus].some(function (value) { return String(value || "").toLowerCase() === "verified"; }); }
  function dateValue(value) { var time = value ? Date.parse(value) : NaN; return Number.isFinite(time) ? time : 0; }
  function addMonths(date, months) { var result = new Date(date); result.setMonth(result.getMonth() + months); return result.toISOString(); }
  function isPromoActive(user) { var u = user || {}; return isVerified(u) && !!u.promoType && dateValue(u.promoEndsAt || u.promo_ends_at) > Date.now(); }
  function paidPlanId(user) { var u = user || currentUser() || {}, ids = [normalizePlanId(u.plan), normalizePlanId(u.subscriptionPlan), normalizePlanId(u.subscription_plan)], id = ids.indexOf("enterprise") >= 0 ? "enterprise" : ids.indexOf("business") >= 0 ? "business" : "free", ends = u.subscriptionEndsAt || u.subscription_ends_at || u.planEndsAt || u.plan_ends_at || (u.subscription && (u.subscription.endsAt || u.subscription.ends_at)), status = String(u.subscriptionStatus || u.subscription_status || (u.subscription && u.subscription.status) || "active").toLowerCase(); if (id === "free" || ["cancelled", "canceled", "expired", "inactive", "past_due"].indexOf(status) >= 0 || (ends && dateValue(ends) <= Date.now())) return "free"; return id; }
  function getEffectivePlanId(user) { var u = user || currentUser() || {}, paid = paidPlanId(u); if (paid === "business" || paid === "enterprise") return paid; if (isPromoActive(u)) return u.promoType === "enterprise_founding" ? "enterprise" : "business"; return "free"; }
  function getUserPlanId(user) { return getEffectivePlanId(user); }
  function defaultLimitsMap() { return { free: 5, business: 15, enterprise: 30 }; }
  async function fetchAdminLimits() { if (cachedLimits) return cachedLimits; var client = sb(); if (!client) return (cachedLimits = defaultLimitsMap()); try { var res = await client.from("platform_settings").select("value").eq("key", "listing_limits").maybeSingle(); if (res.data && res.data.value) return (cachedLimits = Object.assign(defaultLimitsMap(), res.data.value)); } catch (e) {} return (cachedLimits = defaultLimitsMap()); }
  function getPlanLimitsSync(user) { var id = getEffectivePlanId(user), plan = PLANS[id] || PLANS.free, map = cachedLimits || defaultLimitsMap(), max = map[id] != null ? Number(map[id]) : plan.maxListings, promo = paidPlanId(user) === "free" && isPromoActive(user); return { planId: id, planName: plan.name + (promo ? (id === "enterprise" ? " (founding)" : " (promo)") : ""), maxListings: max, maxUnits: max, maxPhotos: plan.maxPhotos, maxVideos: plan.maxVideos, features: { analytics: "basic", viewerTracking: id !== "free" } }; }
  function getPlanLimits(user) { return getPlanLimitsSync(user); }
  function countOwnerUnits(user) { var u = user || currentUser(); if (!u) return 0; var uid = String(u.id || u.userId || ""), n = 0; try { var all = JSON.parse(localStorage.getItem("leasehubProperties") || localStorage.getItem("properties") || "[]"); if (Array.isArray(all)) n = all.filter(function (p) { return String(p.ownerId || p.owner_id || p.userId || "") === uid; }).length; } catch (e) {} return u._cloudListingCount != null ? Number(u._cloudListingCount) || n : n; }
  async function countOwnerUnitsCloud(user) { var u = user || currentUser(); if (!u) return 0; var client = sb(), uid = u.id || u.userId; if (!client || !uid) return countOwnerUnits(u); try { var res = await client.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", uid); if (typeof res.count === "number") { u._cloudListingCount = res.count; return res.count; } } catch (e) {} return countOwnerUnits(u); }
  function canAddUnit(user) { var limits = getPlanLimitsSync(user), used = countOwnerUnits(user); if (used >= limits.maxListings) return { ok: false, used: used, max: limits.maxListings, planId: limits.planId, message: "Your " + limits.planName + " plan allows " + limits.maxListings + " active listing(s). You have " + used + "." }; return { ok: true, used: used, max: limits.maxListings, planId: limits.planId }; }
  function canAddMedia(kind, count, user) { var id = getEffectivePlanId(user), plan = PLANS[id] || PLANS.free, videos = kind === "video" || kind === "videos", max = videos ? plan.maxVideos : plan.maxPhotos, used = Number(count) || 0; return { ok: used < max, used: used, max: max, planId: plan.id, message: "Your " + plan.name + " plan allows up to " + max + " " + (videos ? "videos" : "photos") + " per listing." }; }
  async function canAddUnitAsync(user) { await fetchAdminLimits(); var u = user || currentUser(); if (u) await countOwnerUnitsCloud(u); return canAddUnit(u); }
  function canAccessFeature(key, user) { var id = getEffectivePlanId(user); if (["storefront", "property_page_appearance", "analytics_full", "featured"].indexOf(key) >= 0) return id === "business" || id === "enterprise"; if (["spotlight", "ai", "ai_assistant"].indexOf(key) >= 0) return id === "enterprise"; if (key === "analytics" || key === "analytics_basic") return true; if (key === "ad_free") return id === "business" || id === "enterprise"; return true; }
  function ensureUserPlan(user) { var u = user || currentUser(); if (u && !u.plan && !u.subscriptionPlan) { u.plan = "free"; u.subscriptionPlan = "free"; } return u; }
  function savePromoUser(user) { var payload = JSON.stringify(user), keys = ["leaseaccomCurrentUser", "leasehubCurrentUser", "currentUser"]; keys.forEach(function (key) { try { var current = JSON.parse(localStorage.getItem(key) || "null"); if (current && ((user.id && String(current.id) === String(user.id)) || (user.email && String(current.email || "").toLowerCase() === String(user.email).toLowerCase()))) localStorage.setItem(key, payload); } catch (e) {} }); try { var users = JSON.parse(localStorage.getItem("leaseaccomUsers") || "[]"); if (Array.isArray(users) && user.id) { var index = users.findIndex(function (item) { return String(item.id) === String(user.id); }); if (index >= 0) users[index] = Object.assign({}, users[index], user); else users.push(user); localStorage.setItem("leaseaccomUsers", JSON.stringify(users)); } } catch (e) {} }
  function persistPromoToCloud(user) { var client = sb(); if (!client || !user || !user.id) return; client.from("profiles").update({ promo_type: user.promoType, promo_ends_at: user.promoEndsAt }).eq("id", user.id).then(function () {}).catch(function () {}); }
  function grantFoundingPromo(user) {
    var u = user || currentUser();
    if (!u || !isVerified(u) || paidPlanId(u) !== "free") return u;
    var launch = dateValue(LAUNCH.startDate) || dateValue(u.signupAt || u.createdAt || u.created_at) || Date.now();
    var verifiedAt = dateValue(u.verifiedAt || u.verificationVerifiedAt || u.ownerVerifiedAt || u.verificationDate) || Date.now();
    if (verifiedAt < launch || verifiedAt > launch + 90 * 24 * 60 * 60 * 1000 || u.promoType) return u;
    u.promoType = "business_90";
    u.promoEndsAt = new Date(launch + 90 * 24 * 60 * 60 * 1000).toISOString();
    savePromoUser(u);
    persistPromoToCloud(u);
    var localUsers = [];
    try { localUsers = JSON.parse(localStorage.getItem("leaseaccomUsers") || "[]"); } catch (e) {}
    var foundingCount = Array.isArray(localUsers) ? localUsers.filter(function (item) { return item.promoType === "enterprise_founding" && dateValue(item.promoEndsAt) > Date.now(); }).length : 0;
    if (foundingCount < LAUNCH.foundingSlots) {
      u.promoType = "enterprise_founding";
      u.promoEndsAt = addMonths(new Date(verifiedAt), 6);
      savePromoUser(u);
      persistPromoToCloud(u);
      var client = sb();
      if (client) client.from("profiles").select("id", { count: "exact", head: true }).eq("promo_type", "enterprise_founding").then(function (result) { if (result && typeof result.count === "number" && result.count >= LAUNCH.foundingSlots && !u.promoClaimed) { u.promoType = "business_90"; u.promoEndsAt = new Date(launch + 90 * 24 * 60 * 60 * 1000).toISOString(); savePromoUser(u); persistPromoToCloud(u); } }).catch(function () {});
    }
    return u;
  }
  function getCurrentPlan(user) { var u = user || currentUser() || {}, id = getEffectivePlanId(u), p = PLANS[id] || PLANS.free, promo = paidPlanId(u) === "free" && isPromoActive(u); return Object.assign({}, p, { name: p.name + (promo ? (id === "enterprise" ? " (founding)" : " (promo)") : ""), isPromo: promo, promoType: promo ? u.promoType : null, priceLabel: p.priceLabel || money(p.monthly), billing: p.billing || (p.monthly ? "month" : "forever") }); }
  function renderPricingGrid(container) { if (!container) return; container.innerHTML = ["free", "business", "enterprise"].map(function (id) { var p = PLANS[id], popular = id === "business" ? " is-popular" : "", ent = id === "enterprise" ? " is-ent" : ""; var second = id === "free" ? "Tenant enquiries and in-app chat" : id === "business" ? "Property page appearance / custom storefront" : "AI assistant"; var third = id === "free" ? "Application tracking and basic analytics" : id === "business" ? "Full portfolio analytics" : "Homepage / landing page spotlight"; return '<article class="op-card' + popular + ent + '">' + (id === "business" ? '<span class="tag">Most Popular</span>' : '') + '<div class="ico"><i class="bx ' + (id === "free" ? 'bx-home-alt' : 'bx-buildings') + '"></i></div><h3>' + p.name + '</h3><p class="aud">' + p.blurb + '</p><div><span class="price" data-price-for="' + id + '">' + p.priceLabel + '</span> <span class="period">/ month</span></div>' + (p.annual ? '<div class="annual" data-annual-note="' + id + '">Annual: ' + money(p.annual) + ' (10% off)</div>' : '') + '<button type="button" class="cta' + (ent ? ' is-purple' : '') + '" data-select-plan="' + id + '">Get Started</button><p class="feat-head">Property listings</p><ul><li><i class="bx bx-check"></i> Up to ' + p.maxListings + ' active listings</li><li><i class="bx bx-check"></i> Up to ' + p.maxPhotos + ' photos per listing</li><li><i class="bx bx-check"></i> Up to ' + p.maxVideos + ' videos per listing</li><li><i class="bx bx-check"></i> Property verification eligibility</li><li><i class="bx bx-check"></i> ' + (id === "free" ? "Standard" : "Priority") + ' search placement</li><li><i class="bx bx-check"></i> Availability calendar</li></ul><p class="feat-head">' + (id === "enterprise" ? "Enterprise features" : id === "business" ? "Management &amp; growth tools" : "Management &amp; support") + '</p><ul><li><i class="bx bx-check"></i> ' + (id === "free" ? "Viewing request management" : id === "business" ? "Everything in Free" : "Everything in Business") + '</li><li><i class="bx bx-check"></i> ' + second + '</li><li><i class="bx bx-check"></i> ' + third + '</li><li><i class="bx bx-check"></i> ' + (id === "free" ? "Reviews, notifications and email support" : id === "business" ? "Lead tracking, bulk management and priority support" : "Full branded company storefront and advanced analytics") + '</li><li><i class="bx bx-check"></i> ' + (id === "free" ? "Standard platform placement" : "Ad-free experience") + '</li></ul><div class="foot">' + (id === "free" ? "Perfect for getting started — list, attract tenants and manage enquiries with ease." : id === "business" ? "For growing businesses — more visibility, better insights and portfolio control." : "Built for bigger ambitions — showcase your brand and manage your portfolio in one place.") + '</div></article>'; }).join(""); container.querySelectorAll("[data-select-plan]").forEach(function (btn) { btn.addEventListener("click", function () { selectPlan(btn.getAttribute("data-select-plan")); }); }); }
  function showCurrentPlan() { var el = document.getElementById("currentPlanBox"); if (!el) return; var lim = getPlanLimitsSync(); el.innerHTML = '<div class="box"><div>Your current plan: <span class="chip">' + lim.planName + '</span></div><div style="font-size:13px;color:#66706a">Up to ' + lim.maxListings + ' active listings.</div></div>'; }
  function setBilling(mode) { billing = mode; document.querySelectorAll("[data-billing]").forEach(function (btn) { btn.classList.toggle("is-active", btn.getAttribute("data-billing") === mode); btn.setAttribute("aria-pressed", String(btn.getAttribute("data-billing") === mode)); }); document.querySelectorAll("[data-price-for]").forEach(function (node) { var p = PLANS[node.getAttribute("data-price-for")]; if (p) node.textContent = mode === "annual" ? money(Math.round(p.annual / 12)) : money(p.monthly); }); document.querySelectorAll("[data-annual-note]").forEach(function (node) { var p = PLANS[node.getAttribute("data-annual-note")]; if (p) node.textContent = mode === "annual" ? "Billed annually at " + money(p.annual) + " (10% off)" : "Annual: " + money(p.annual) + " (10% off)"; }); }
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
    try {
      localStorage.setItem("leaseaccomPlanIntent", JSON.stringify(intent));
    } catch (error) {
      console.error("Could not save plan selection.", error);
      alert("Your plan selection could not be saved in this browser. Please check your browser storage settings and try again.");
      return;
    }

    if (window.LeaseAccomPlanCheckout && typeof window.LeaseAccomPlanCheckout.show === "function") {
      return window.LeaseAccomPlanCheckout.show(intent);
    }
    console.error("Plan checkout preview is unavailable.");
    alert("Your plan selection was saved, but the checkout preview could not be opened. Please reload the page and try again.");
  }
  document.addEventListener("DOMContentLoaded", function () { fetchAdminLimits().then(showCurrentPlan); setBilling("monthly"); document.querySelectorAll("[data-billing]").forEach(function (btn) { btn.addEventListener("click", function () { setBilling(btn.getAttribute("data-billing")); }); }); document.querySelectorAll("[data-select-plan]").forEach(function (btn) { btn.addEventListener("click", function () { selectPlan(btn.getAttribute("data-select-plan")); }); }); });
  window.LeaseAccomPlans = { PLANS: PLANS, LAUNCH: LAUNCH, selectPlan: selectPlan, renderPricingGrid: renderPricingGrid, canAddUnit: canAddUnit, canAddUnitAsync: canAddUnitAsync, canAddMedia: canAddMedia, getPlanLimits: getPlanLimits, getCurrentPlan: getCurrentPlan, countOwnerUnits: countOwnerUnits, countOwnerUnitsCloud: countOwnerUnitsCloud, canAccessFeature: canAccessFeature, ensureUserPlan: ensureUserPlan, fetchAdminLimits: fetchAdminLimits, getUserPlanId: getUserPlanId, getEffectivePlanId: getEffectivePlanId, grantFoundingPromo: grantFoundingPromo };
})();
