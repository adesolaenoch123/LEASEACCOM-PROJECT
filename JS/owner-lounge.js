(function () {
  const STORE_KEY = "leasehub_owner_store_v1";
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

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveStore(data) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }

  function applyStoreToUI(data) {
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

    const liveName = document.getElementById("liveStoreName");
    const liveTagline = document.getElementById("liveStoreTagline");
    const liveGoal = document.getElementById("liveStoreGoal");
    const liveBanner = document.getElementById("liveBannerText");
    const liveLogo = document.getElementById("liveLogoText");
    const bannerPreview = document.getElementById("ownerBannerPreview");
    const logoPreview = document.getElementById("ownerLogoPreview");
    const storeTitle = document.getElementById("ownerStoreTitle");

    if (liveName) liveName.textContent = nameInput?.value || name || "LeaseHub Owner";
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
    const data = loadStore();
    data.name = document.getElementById("ownerStoreNameInput")?.value || data.name || "";
    data.tagline = document.getElementById("ownerStoreTaglineInput")?.value || data.tagline || "";
    data.goal = document.getElementById("ownerStoreGoalInput")?.value || data.goal || "";
    applyStoreToUI(data);
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

  function setupStore() {
    const data = loadStore();
    applyStoreToUI(data);

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
      const stored = loadStore();
      stored.banner = url;
      saveStore(stored);
      applyStoreToUI(stored);
    });

    document.getElementById("ownerLogoInput")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const url = await readFileAsDataURL(file);
      const stored = loadStore();
      stored.logo = url;
      saveStore(stored);
      applyStoreToUI(stored);
    });

    document.getElementById("ownerSaveStoreBtn")?.addEventListener("click", () => {
      const stored = loadStore();
      stored.name = document.getElementById("ownerStoreNameInput")?.value?.trim() || "";
      stored.tagline = document.getElementById("ownerStoreTaglineInput")?.value?.trim() || "";
      stored.goal = document.getElementById("ownerStoreGoalInput")?.value?.trim() || "";
      saveStore(stored);
      applyStoreToUI(stored);
      alert("Store appearance saved on this device.");
    });

    document.getElementById("ownerManagePlanBtn")?.addEventListener("click", () => {
      window.location.href = "owner-payments.html#plans";
    });

    document.getElementById("ownerRefreshBtn")?.addEventListener("click", () => {
      window.location.reload();
    });
  }

  function syncCountsToStorefront() {
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
      const raw = localStorage.getItem("leasehubCurrentUser") || localStorage.getItem("leaseHubCurrentUser") || localStorage.getItem("currentUser");
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
    let text = "You must be verified by LeaseHub before your listings can go Live on the marketplace. Complete verification to build trust with tenants.";
    let cta = "Get verified";
    if (status === "pending") {
      title = "Verification under review";
      text = "We received your details. Your listings stay Pending until LeaseHub approves your account. You will be able to go Live after approval.";
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
      try { sessionStorage.setItem("leasehub_verify_banner_dismissed", "1"); } catch (e) {}
    });
    try {
      if (sessionStorage.getItem("leasehub_verify_banner_dismissed") === "1") {
        document.getElementById("ownerVerifyBanner")?.classList.add("is-dismissed");
      }
    } catch (e) {}
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.body.classList.contains("owner-lounge-body")) return;
    setupSidebar();
    setupTips();
    setupStore();
    setupVerificationPrompt();
    // Wait a tick for app.js owner dashboard render
    window.setTimeout(syncCountsToStorefront, 200);
    window.setTimeout(syncCountsToStorefront, 800);
  });
})();


/* ===== Subscription plan UI ===== */
function refreshOwnerPlanUI() {
  if (!window.LeaseHubPlans) return;
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("leasehubCurrentUser") || "null");
  } catch (e) {}
  if (!user) return;
  window.LeaseHubPlans.ensureUserPlan(user);
  const plan = window.LeaseHubPlans.getCurrentPlan(user);
  const limits = window.LeaseHubPlans.getPlanLimits(user);
  const used = window.LeaseHubPlans.countOwnerUnits(user);

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
      <p class="owner-muted">${used} / ${limits.maxUnits} units used</p>
      <p class="owner-muted">${plan.blurb}</p>
      <div class="owner-plan-meter"><span style="width:${Math.min(100, (used / limits.maxUnits) * 100)}%"></span></div>
      <a class="owner-btn owner-btn-small" href="owner-payments.html#plans">Manage plan</a>
    `;
  }

  // Gate premium / standard features
  document.querySelectorAll("[data-plan-feature]").forEach((el) => {
    const key = el.getAttribute("data-plan-feature");
    const ok = window.LeaseHubPlans.canAccessFeature(key, user);
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
