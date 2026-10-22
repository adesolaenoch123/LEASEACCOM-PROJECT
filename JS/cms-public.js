/**
 * LeaseAccom CMS — apply admin-published content on public pages
 * Source: platform_settings key "cms" (Supabase) + local cache
 */
(function () {
  "use strict";

  var DEFAULTS = {
    heroBadge: "Nigeria Built for Nigeria",
    heroTitle: "Find your place.",
    heroTitleSpan: "Skip the unnecessary stress.",
    heroSubtitle:
      "LeaseAccom connects you directly with property owners while helping you discover verified homes, shortlets and commercial spaces.",
    heroButton: "Explore Properties",
    heroVideoUrl: "hero-banner.mp4",
    heroImageUrl: "",
    primaryColor: "#0d7547",
    accentColor: "#8ce0b2",
    footerText: "Find your place without the unnecessary stress.",
    adEnabled: false,
    adHeadline: "",
    adBody: "",
    adLink: "",
    adImageUrl: "",
    featuredSectionTitle: "Featured properties",
    featuredSectionSub: "Enterprise partners appear first — then more marketplace picks."
  };

  function sb() {
    return window.leaseaccomSupabase || window.leasehubSupabase || null;
  }

  function merge(base, extra) {
    var out = Object.assign({}, base);
    if (!extra || typeof extra !== "object") return out;
    Object.keys(extra).forEach(function (k) {
      if (extra[k] != null && extra[k] !== "") out[k] = extra[k];
    });
    return out;
  }

  function cacheGet() {
    try {
      return JSON.parse(localStorage.getItem("leaseaccomCmsPublished") || "{}");
    } catch (e) {
      return {};
    }
  }

  function cacheSet(v) {
    try {
      localStorage.setItem("leaseaccomCmsPublished", JSON.stringify(v));
    } catch (e) {}
  }

  async function fetchCms() {
    var client = sb();
    if (!client) return merge(DEFAULTS, cacheGet());
    try {
      var res = await client.from("platform_settings").select("value").eq("key", "cms").maybeSingle();
      if (res.data && res.data.value) {
        var merged = merge(DEFAULTS, res.data.value);
        cacheSet(merged);
        return merged;
      }
    } catch (e) {}
    return merge(DEFAULTS, cacheGet());
  }

  function applyColors(cms) {
    var root = document.documentElement;
    if (cms.primaryColor) {
      root.style.setProperty("--primary", cms.primaryColor);
      root.style.setProperty("--la-green", cms.primaryColor);
      root.style.setProperty("--green", cms.primaryColor);
    }
    if (cms.accentColor) {
      root.style.setProperty("--accent", cms.accentColor);
      root.style.setProperty("--la-soft", cms.accentColor + "33");
    }
  }

  function applyHero(cms) {
    var badge = document.querySelector(".hero-badge");
    if (badge && cms.heroBadge) badge.textContent = cms.heroBadge;

    var h1 = document.querySelector(".hero h1");
    if (h1 && (cms.heroTitle || cms.heroTitleSpan)) {
      h1.innerHTML =
        escapeHtml(cms.heroTitle || "") +
        (cms.heroTitleSpan ? " <span>" + escapeHtml(cms.heroTitleSpan) + "</span>" : "");
    }

    var sub = document.querySelector(".hero-content > p");
    if (sub && cms.heroSubtitle) sub.textContent = cms.heroSubtitle;

    var video = document.querySelector("video.hero-video");
    if (video && cms.heroVideoUrl) {
      var src = video.querySelector("source");
      if (src) {
        if (src.getAttribute("src") !== cms.heroVideoUrl) {
          src.setAttribute("src", cms.heroVideoUrl);
          video.load();
          video.play && video.play().catch(function () {});
        }
      } else {
        video.src = cms.heroVideoUrl;
      }
      video.style.display = "";
    }

    var hero = document.querySelector(".hero");
    if (hero && cms.heroImageUrl && !cms.heroVideoUrl) {
      hero.style.backgroundImage =
        'linear-gradient(90deg,rgba(8,28,18,.66),rgba(8,28,18,.12)),url("' +
        String(cms.heroImageUrl).replace(/["\\]/g, "") +
        '")';
      hero.style.backgroundSize = "cover";
      hero.style.backgroundPosition = "center";
    }
  }

  function applyFooter(cms) {
    var footer = document.querySelector(".footer-main > div:first-child > p");
    if (footer && cms.footerText) footer.textContent = cms.footerText;
  }

  function applyFeaturedCopy(cms) {
    var section = document.getElementById("featuredProperties");
    if (!section) return;
    var wrap = section.closest("section") || section.parentElement;
    if (!wrap) return;
    var h2 = wrap.querySelector("h2");
    var p = wrap.querySelector(".section-heading p, .section-heading + p, p");
    if (h2 && cms.featuredSectionTitle) h2.textContent = cms.featuredSectionTitle;
    // try specific sub
    var subs = wrap.querySelectorAll("p");
    if (subs.length && cms.featuredSectionSub) {
      for (var i = 0; i < subs.length; i++) {
        if (subs[i].closest(".property-grid")) continue;
        if (subs[i].textContent && subs[i].textContent.length > 10) {
          subs[i].textContent = cms.featuredSectionSub;
          break;
        }
      }
    }
  }

  function applyAd(cms) {
    var existing = document.getElementById("laCmsAdBanner");
    if (!cms.adEnabled || !cms.adHeadline) {
      if (existing) existing.remove();
      return;
    }
    if (existing) existing.remove();
    var bar = document.createElement("aside");
    bar.id = "laCmsAdBanner";
    bar.style.cssText =
      "max-width:1100px;margin:16px auto;padding:16px 18px;border-radius:16px;" +
      "background:linear-gradient(120deg," +
      (cms.primaryColor || "#0d7547") +
      "," +
      (cms.accentColor || "#15945c") +
      ");color:#fff;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between";
    bar.innerHTML =
      "<div><strong style='display:block;font-size:16px'>" +
      escapeHtml(cms.adHeadline) +
      "</strong>" +
      (cms.adBody ? "<span style='opacity:.92;font-size:13px'>" + escapeHtml(cms.adBody) + "</span>" : "") +
      "</div>" +
      (cms.adLink
        ? '<a href="' +
          escapeHtml(cms.adLink) +
          '" style="background:#fff;color:' +
          (cms.primaryColor || "#0d7547") +
          ';font-weight:800;padding:10px 16px;border-radius:12px;text-decoration:none">Learn more</a>'
        : "");
    var main = document.querySelector("main");
    var hero = document.querySelector(".hero");
    if (hero && hero.parentNode) {
      hero.parentNode.insertBefore(bar, hero.nextSibling);
    } else if (main) {
      main.insertBefore(bar, main.firstChild);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[c];
    });
  }

  async function boot() {
    var cms = await fetchCms();
    window.LeaseAccomCms = cms;
    applyColors(cms);
    applyHero(cms);
    applyFooter(cms);
    applyFeaturedCopy(cms);
    applyAd(cms);
    document.dispatchEvent(new CustomEvent("leaseaccom:cms-ready", { detail: cms }));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
