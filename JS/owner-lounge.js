(function () {
  const store_KEY = "leaseaccom_owner_store_v1";
  const tips = [
    {
      title: "Sharp property photos",
      text: "High-quality images usually attract more tenants in the marketplace."
    },
    {
      title: "Clear rent and fees",
      text: "List service charge and agency fee up front so applications stay serious."
    },
    {
      title: "Respond to viewings fast",
      text: "Owners who reply quickly convert more viewing requests into applications."
    }
  ];

  function loadstore() {
    try {
      return JSON.parse(localStorage.getItem(store_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function savestore(data) {
    localStorage.setItem(store_KEY, JSON.stringify(data));
  }

  function applystoreToUI(data) {
    const name = data.name || "";
    const tagline = data.tagline || "";
    const goal = data.goal || "";
    const banner = data.banner || "";
    const logo = data.logo || "";

    const nameInput = document.getElementById("ownerStoreNameInput");
    const taglineInput = document.getElementById("ownerStoreTaglineInput");
    const goalInput = document.getElementById("ownerStoreGoalInput");
    if (nameInput && !nameInput.value) nameInput.value = name;
    if (taglineInput && !taglineInput.value) taglineInput.value = tagline;
    if (goalInput && !goalInput.value) goalInput.value = goal;

    const liveName = document.getElementById("liveOwnerName");
    const liveTagline = document.getElementById("livestoreTagline");
    const liveGoal = document.getElementById("livestoreGoal");
    const liveBanner = document.getElementById("liveBannerText");
    const liveLogo = document.getElementById("liveLogoText");
    const bannerPreview = document.getElementById("ownerBannerPreview");
    const logoPreview = document.getElementById("ownerLogoPreview");
    const storeTitle = document.getElementById("ownerStoreTitle");

    if (liveName) liveName.textContent = nameInput?.value || name || "LeaseAccom Owner";
    if (liveTagline) liveTagline.textContent = taglineInput?.value || tagline || "Explore this store";
    if (liveGoal) liveGoal.textContent = goalInput?.value || goal || "List quality homes";
    if (storeTitle && (nameInput?.value || name)) storeTitle.textContent = nameInput?.value || name;

    if (banner) {
      if (liveBanner) {
        liveBanner.textContent = "";
        liveBanner.style.backgroundImage = `url("${banner}")`;
      }
      if (bannerPreview) {
        bannerPreview.style.backgroundImage = `url("${banner}")`;
        bannerPreview.style.backgroundSize = "cover";
        const span = bannerPreview.querySelector("span");
        if (span) span.style.display = "none";
      }
    }

    if (logo) {
      if (liveLogo) liveLogo.innerHTML = `<img src="${logo}" alt="Logo">`;
      if (logoPreview) logoPreview.innerHTML = `<img src="${logo}" alt="Logo">`;
    }
  }

  function syncLiveFromInputs() {
    const data = loadstore();
    data.name = document.getElementById("ownerStoreNameInput")?.value || data.name || "";
    data.tagline = document.getElementById("ownerStoreTaglineInput")?.value || data.tagline || "";
    data.goal = document.getElementById("ownerStoreGoalInput")?.value || data.goal || "";
    applystoreToUI(data);
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function setupSidebar() {
    const lounge = document.querySelector(".owner-lounge");
    const openBtn = document.getElementById("ownerMenuToggle");
    const closeBtn = document.getElementById("ownerSidebarHide");
    const overlay = document.getElementById("ownerSidebarOverlay");
    const open = () => lounge?.classList.add("sidebar-open");
    const close = () => lounge?.classList.remove("sidebar-open");
    openBtn?.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
    overlay?.addEventListener("click", close);
  }

  function setupTips() {
    const tip = tips[Math.floor(Math.random() * tips.length)];
    const title = document.getElementById("ownerTipTitle");
    const text = document.getElementById("ownerTipText");
    if (title) title.textContent = tip.title;
    if (text) text.textContent = tip.text;
  }

  function ensureOwnerPlanOptions() {
    const optionsHost = document.getElementById("ownerPlanOptions");
    if (!optionsHost) return;
    if (optionsHost.querySelector(".owner-plan-option")) return;

    const planCards = [
      { name: "Basic", price: "₦5,000", summary: "For growing portfolios", accent: "" },
      { name: "Standard", price: "₦10,000", summary: "Most popular for active owners", accent: "is-popular" },
      { name: "Premium", price: "₦20,000", summary: "Unlimited growth and visibility", accent: "" }
    ];

    optionsHost.innerHTML = planCards.map((plan) => `
      <article class="owner-plan-option ${plan.accent}">
        <div class="owner-plan-option-head">
          <span>${plan.name}</span>
          <strong>${plan.price}</strong>
        </div>
        <p>${plan.summary}</p>
        <button type="button" class="owner-plan-button" data-plan-name="${plan.name}">Subscribe now</button>
      </article>
    `).join("");

    const notice = document.getElementById("ownerPlanNotice");
    optionsHost.querySelectorAll(".owner-plan-button").forEach((button) => {
      button.addEventListener("click", () => {
        if (notice) {
          notice.textContent = "Checkout is not connected yet. The demo plan selection is saved locally for now.";
        }
      });
    });
  }

  function ensureFeaturedVideo() {
    if (document.querySelector(".owner-featured-video")) return;
    const host = document.querySelector("#ownerPlan") || document.querySelector("#ownerPlanOptions");
    if (!host) return;
    const video = document.createElement("video");
    video.className = "owner-featured-video";
    video.src = "hero-banner.mp4";
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("aria-label", "Owner featured video");
    host.insertBefore(video, host.firstChild);
  }

  function setupstore() {
    const data = loadstore();
    applystoreToUI(data);

    ["ownerStoreNameInput", "ownerStoreTaglineInput", "ownerStoreGoalInput"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", syncLiveFromInputs);
    });

    document.getElementById("ownerBannerBtn")?.addEventListener("click", () => {
      document.getElementById("ownerBannerInput")?.click();
    });
    document.getElementById("ownerLogoBtn")?.addEventListener("click", () => {
      document.getElementById("ownerLogoInput")?.click();
    });

    document.getElementById("ownerBannerInput")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const url = await readFileAsDataURL(file);
      const stored = loadstore();
      stored.banner = url;
      savestore(stored);
      applystoreToUI(stored);
    });

    document.getElementById("ownerLogoInput")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const url = await readFileAsDataURL(file);
      const stored = loadstore();
      stored.logo = url;
      savestore(stored);
      applystoreToUI(stored);
    });

    document.getElementById("ownerSaveStoreBtn")?.addEventListener("click", () => {
      const stored = loadstore();
      stored.name = document.getElementById("ownerStoreNameInput")?.value?.trim() || "";
      stored.tagline = document.getElementById("ownerStoreTaglineInput")?.value?.trim() || "";
      stored.goal = document.getElementById("ownerStoreGoalInput")?.value?.trim() || "";
      savestore(stored);
      applystoreToUI(stored);
      alert("storeappearance saved on this device.");
    });

    document.getElementById("ownerManagePlanBtn")?.addEventListener("click", () => {
      window.location.href = "owner-payments.html#plans";
    });

    document.getElementById("ownerRefreshBtn")?.addEventListener("click", () => {
      window.location.reload();
    });
  }

  function syncCountsTostorefront() {
    const count = document.getElementById("ownerListingCount")?.textContent || "0";
    const chip = document.getElementById("liveProductChip");
    const label = document.getElementById("ownerStoreProductCount");
    if (chip) chip.textContent = `${count} properties`;
    if (label) label.textContent = `${count} properties`;
    const pts = document.getElementById("ownerEngagementPts");
    if (pts) {
      const n = Number(count) || 0;
      pts.textContent = `${n * 3 + 3} pts`;
    }
  }


  function getOwnerVerificationStatus() {
    try {
      const raw = localStorage.getItem("leaseaccomCurrentUser") || localStorage.getItem("leaseaccomCurrentUser") || localStorage.getItem("currentUser");
      const user = raw ? JSON.parse(raw) : null;
      if (!user) return "unverified";
      return String(user.verificationStatus || user.ownerVerificationStatus || "unverified").toLowerCase();
    } catch (e) {
      return "unverified";
    }
  }

  function setupVerificationPrompt() {
    const status = getOwnerVerificationStatus();
    const existing = document.getElementById("ownerVerifyBanner");
    if (status === "verified") {
      if (existing) existing.remove();
      document.body.classList.remove("owner-needs-verify");
      return;
    }

    document.body.classList.add("owner-needs-verify");

    let title = "Verify your owner account";
    let text = "You must be verified by LeaseAccom before your listings can go Live on the marketplace. Complete verification to build trust with tenants.";
    let cta = "Get verified";
    if (status === "pending") {
      title = "Verification under review";
      text = "We received your details. Your listings stay Pending until LeaseAccom approves your account. You will be able to go Live after approval.";
      cta = "View verification status";
    }

    const html = `
      <div class="owner-verify-banner" id="ownerVerifyBanner" role="status">
        <div class="owner-verify-banner-inner">
          <div class="owner-verify-banner-icon"><i class="bx bx-badge-check"></i></div>
          <div class="owner-verify-banner-copy">
            <strong>${title}</strong>
            <p>${text}</p>
          </div>
          <a href="owner-verification.html" class="primary-btn owner-verify-cta">${cta}</a>
          <button type="button" class="owner-verify-dismiss" id="ownerVerifyDismiss" aria-label="Dismiss for now">×</button>
        </div>
      </div>`;

    if (existing) {
      existing.outerHTML = html;
    } else {
      const main = document.querySelector(".owner-content") || document.querySelector(".owner-main");
      if (main) main.insertAdjacentHTML("afterbegin", html);
      else document.body.insertAdjacentHTML("afterbegin", html);
    }

    document.getElementById("ownerVerifyDismiss")?.addEventListener("click", () => {
      document.getElementById("ownerVerifyBanner")?.classList.add("is-dismissed");
      try { sessionStorage.setItem("leaseaccom_verify_banner_dismissed", "1"); } catch (e) {}
    });
    try {
      if (sessionStorage.getItem("leaseaccom_verify_banner_dismissed") === "1") {
        document.getElementById("ownerVerifyBanner")?.classList.add("is-dismissed");
      }
    } catch (e) {}
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.body.classList.contains("owner-lounge-body")) return;
    setupSidebar();
    setupTips();
    ensureFeaturedVideo();
    ensureOwnerPlanOptions();
    setupstore();
    setupVerificationPrompt();
    // Wait a tick for app.js owner dashboard render
    window.setTimeout(syncCountsTostorefront, 200);
    window.setTimeout(syncCountsTostorefront, 800);
  });
})();


/* ===== Subscription plan UI ===== */
function refreshOwnerPlanUI() {
  if (!window.LeaseAccomPlans) return;
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("leaseaccomCurrentUser") || "null");
  } catch (e) {}
  if (!user) return;
  window.LeaseAccomPlans.ensureUserPlan(user);
  const plan = window.LeaseAccomPlans.getCurrentPlan(user);
  const limits = window.LeaseAccomPlans.getPlanLimits(user);
  const used = window.LeaseAccomPlans.countOwnerUnits(user);

  const pill = document.getElementById("ownerPlanPill");
  if (pill) {
    pill.textContent = plan.name.toUpperCase();
    pill.dataset.plan = plan.id;
    pill.title = `${used}/${limits.maxUnits} units · ${plan.priceLabel}/${plan.billing === "forever" ? "free" : "mo"}`;
  }

  // Subscription panel summary
  let box = document.getElementById("ownerPlanSummary");
  const panel = document.querySelector(".owner-plan-card");
  if (panel && !box) {
    box = document.createElement("div");
    box.id = "ownerPlanSummary";
    box.className = "owner-plan-summary";
    panel.appendChild(box);
  }
  if (box) {
    box.innerHTML = `
      <p><strong>${plan.name}</strong> · ${plan.priceLabel}${plan.billing === "month" ? "/mo" : ""}</p>
      <p class="owner-muted">${used} / ${limits.maxUnits === Infinity ? "∞" : limits.maxUnits} units used</p>
      <p class="owner-muted">${plan.blurb}</p>
      <div class="owner-plan-meter"><span style="width:${Math.min(100, (limits.maxUnits === Infinity ? 5 : (used / limits.maxUnits) * 100))}%"></span></div>
      <a class="owner-btn owner-btn-small" href="owner-payments.html#plans">Manage plan</a>
    `;
  }

  // Gate premium / standard features
  document.querySelectorAll("[data-plan-feature]").forEach((el) => {
    const key = el.getAttribute("data-plan-feature");
    const ok = window.LeaseAccomPlans.canAccessFeature(key, user);
    el.classList.toggle("is-plan-locked", !ok);
    if (!ok) {
      el.setAttribute("aria-disabled", "true");
      if (!el.querySelector(".plan-lock-msg")) {
        const msg = document.createElement("div");
        msg.className = "plan-lock-msg";
        msg.innerHTML = `<span>🔒 ${key} needs a higher plan.</span> <a href="owner-payments.html#plans">Upgrade</a>`;
        el.appendChild(msg);
      }
    }
  });

  // Analytics / viewer tracking placeholders
  const analytics = document.getElementById("ownerAnalyticsPanel");
  if (analytics) {
    const level = limits.features.analytics;
    analytics.classList.toggle("is-plan-locked", level === "none");
    if (level === "none") {
      analytics.innerHTML = `<div class="plan-lock-msg"><p>Analytics unlock on <strong>Standard</strong> and <strong>Premium</strong>.</p><a href="owner-payments.html#plans">Upgrade</a></div>`;
    }
  }

  // Live engagement chart from property views
  (function renderOwnerViewsChart() {
    const chart = document.getElementById("ownerEngagementChart");
    if (!chart) return;
    let viewsMap = {};
    try { viewsMap = JSON.parse(localStorage.getItem("leaseaccomPropertyViews") || "{}") || {}; } catch (e) {}
    // Prefer live views_count from cloud-loaded properties if present
    try {
      const cloudProps = JSON.parse(localStorage.getItem("leaseaccomProperties") || "[]");
      if (Array.isArray(cloudProps)) {
        cloudProps.forEach(function (p) {
          if (p && p.id != null && (p.views_count != null || p.views != null)) {
            const key = String(p.id);
            const total = Number(p.views_count != null ? p.views_count : p.views) || 0;
            if (!viewsMap[key]) viewsMap[key] = { total: total, byDay: {} };
            else viewsMap[key].total = Math.max(Number(viewsMap[key].total) || 0, total);
          }
        });
      }
    } catch (e) {}
    let props = [];
    try {
      props = JSON.parse(localStorage.getItem("leaseaccomProperties") || localStorage.getItem("leaseaccomProperties") || "[]") || [];
    } catch (e) {}
    const user = (function () {
      try {
        return JSON.parse(
          localStorage.getItem("leaseaccomCurrentUser") ||
            localStorage.getItem("leaseaccomCurrentUser") ||
            "null"
        );
      } catch (e) { return null; }
    })();
    const ownerId = user && user.id != null ? String(user.id) : "";
    const mine = (Array.isArray(props) ? props : []).filter(function (p) {
      return ownerId && String(p.ownerId) === ownerId;
    });
    // Build bars: last 7 days totals across owner properties, or per-property totals
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const dayTotals = days.map(function (day) {
      let sum = 0;
      mine.forEach(function (p) {
        const rec = viewsMap[String(p.id)];
        if (rec && rec.byDay && rec.byDay[day]) sum += Number(rec.byDay[day]) || 0;
      });
      return sum;
    });
    const max = Math.max.apply(null, dayTotals.concat([0]));
    const totalViews = mine.reduce(function (s, p) {
      const rec = viewsMap[String(p.id)];
      return s + (rec ? Number(rec.total) || 0 : Number(p.views) || 0);
    }, 0);
    const viewsLabel = document.querySelector(".owner-stat small");
    // Prefer specific views stat if present
    const viewStat = document.getElementById("ownerTotalViews");
    if (viewStat) viewStat.textContent = String(totalViews);

    if (!mine.length || (max === 0 && totalViews === 0)) {
      chart.innerHTML = '<div class="owner-chart-empty">No views yet. When tenants open your listings, the graph fills in here.</div>';
      return;
    }
    if (max === 0) {
      // show per-property bars instead
      const rows = mine.slice(0, 7).map(function (p) {
        const rec = viewsMap[String(p.id)];
        const v = rec ? Number(rec.total) || 0 : Number(p.views) || 0;
        return { label: (p.title || "Listing").slice(0, 10), v: v };
      });
      const m2 = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
      chart.innerHTML = rows.map(function (r) {
        const h = Math.max(6, Math.round((r.v / m2) * 120));
        return '<div class="owner-chart-bar"><div class="bar" style="height:' + h + 'px"></div><span>' + r.label + ' · ' + r.v + '</span></div>';
      }).join("");
      return;
    }
    chart.innerHTML = days.map(function (day, i) {
      const v = dayTotals[i];
      const h = Math.max(6, Math.round((v / max) * 120));
      const label = day.slice(5); // MM-DD
      return '<div class="owner-chart-bar"><div class="bar" style="height:' + h + 'px" title="' + v + ' views"></div><span>' + label + '</span></div>';
    }).join("");
  })();

  const tracking = document.getElementById("ownerViewerTracking");
  if (tracking) {
    const ok = limits.features.viewerTracking;
    tracking.classList.toggle("is-plan-locked", !ok);
    if (!ok) {
      tracking.innerHTML = `<div class="plan-lock-msg"><p>Viewer tracking is a <strong>Premium</strong> feature.</p><a href="owner-payments.html#plans">Upgrade to Premium</a></div>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  try { refreshOwnerPlanUI(); } catch (e) { console.warn(e); }
});
