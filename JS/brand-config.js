/**
 * LeaseAccom — applies Command Centre brand settings site-wide
 * Reads leaseaccomBrandConfig / leaseaccomCmsPublished from localStorage
 */
(function () {
  "use strict";
  function readBrand() {
    try {
      return (
        JSON.parse(localStorage.getItem("leaseaccomBrandConfig") || "null") ||
        JSON.parse(localStorage.getItem("leaseaccomCmsPublished") || "null")
      );
    } catch (e) {
      return null;
    }
  }
  var brand = readBrand();
  if (!brand) return;

  var root = document.documentElement;
  if (brand.colorPrimary) {
    root.style.setProperty("--lh-green", brand.colorPrimary);
    root.style.setProperty("--la-green", brand.colorPrimary);
  }
  if (brand.colorSecondary) {
    root.style.setProperty("--lh-green-2", brand.colorSecondary);
  }
  if (brand.colorBg) {
    root.style.setProperty("--lh-bg", brand.colorBg);
    document.body && (document.body.style.backgroundColor = brand.colorBg);
  }
  if (brand.colorInk) {
    root.style.setProperty("--lh-ink", brand.colorInk);
  }

  function applyLogos() {
    if (!brand.logoUrl) return;
    document.querySelectorAll("img").forEach(function (img) {
      var src = (img.getAttribute("src") || "").toLowerCase();
      if (src.indexOf("logo") >= 0 || src.indexOf("leaseaccom") >= 0 || src.indexOf("leaseaccom") >= 0) {
        if (src.indexOf("horizontal") >= 0 || (img.closest && img.closest(".logo"))) {
          img.src = brand.logoUrl;
        } else if (brand.logoIconUrl) {
          img.src = brand.logoIconUrl;
        }
      }
    });
  }

  function applyHeroVideo() {
    if (!brand.heroVideo) return;
    document.querySelectorAll("video").forEach(function (v) {
      var s = v.querySelector("source");
      if (s) {
        s.src = brand.heroVideo;
        v.load();
      } else {
        v.src = brand.heroVideo;
      }
    });
  }

  function applyCopy() {
    if (brand.heroTitle) {
      var h = document.querySelector(".hero h1, .hero-title, [data-cms='heroTitle']");
      if (h) h.textContent = brand.heroTitle;
    }
    if (brand.heroSubtitle) {
      var p = document.querySelector(".hero p, .hero-sub, [data-cms='heroSubtitle']");
      if (p) p.textContent = brand.heroSubtitle;
    }
    if (brand.appName) {
      document.title = document.title.replace(/LeaseAccom|leaseaccom/gi, brand.appName);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      applyLogos();
      applyHeroVideo();
      applyCopy();
    });
  } else {
    applyLogos();
    applyHeroVideo();
    applyCopy();
  }
})();
