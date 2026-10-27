/**
 * LeaseAccom Standout enhancements (organized module)
 * Does not rewrite core apps — only enhances UI when elements exist.
 */
(function (global) {
  "use strict";

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function isVerifiedProperty(p) {
    if (!p) return false;
    if (p.verified === true || p.verified === "true") return true;
    var st = String(p.verification_status || p.listing_status || "").toLowerCase();
    return st === "approved" || st === "live" || st === "verified";
  }

  function isRisk(p) {
    return p && (p.risk_flag === true || p.risk_flag === "true");
  }

  function listingQualityScore(p) {
    if (!p) return 0;
    var score = 0;
    if (p.title && String(p.title).length > 8) score += 15;
    if (p.description && String(p.description).length > 80) score += 20;
    var imgs = p.images || p.photos || [];
    if (!Array.isArray(imgs) && p.image) imgs = [p.image];
    var n = Array.isArray(imgs) ? imgs.length : 0;
    if (p.cover_image || p.image) n = Math.max(n, 1);
    if (n >= 1) score += 10;
    if (n >= 4) score += 10;
    if (n >= 8) score += 10;
    if (p.price) score += 10;
    if (p.city || p.location) score += 10;
    if (p.video || p.video_url) score += 10;
    if (p.amenities && (Array.isArray(p.amenities) ? p.amenities.length : 1)) score += 5;
    return Math.min(100, score);
  }

  function qualityLabel(score) {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs work";
  }

  function injectSafePayTip(container) {
    if (!container || qs(".la-safe-pay-tip", container)) return;
    var tip = document.createElement("div");
    tip.className = "la-safe-pay-tip";
    tip.innerHTML =
      "<strong>Stay safe:</strong> Keep conversations on LeaseAccom. Never pay inspection fees or deposits outside official channels. Prefer verified landlords and inspect in person.";
    container.insertBefore(tip, container.firstChild);
  }

  function enhancePropertyDetailsPage() {
    var main =
      qs(".property-details") ||
      qs("#propertyDetails") ||
      qs("main") ||
      qs(".details-content");
    if (!main) return;
    injectSafePayTip(main);
    var head = qs("h1", main) || qs(".property-title");
    if (head && !qs(".la-trust-row", main)) {
      var row = document.createElement("div");
      row.className = "la-trust-row";
      row.innerHTML =
        '<span class="la-badge la-badge-verified">Prefer verified listings</span>' +
        '<span class="la-badge la-badge-safe">In-app messages only</span>';
      head.parentNode.insertBefore(row, head.nextSibling);
    }
    var viewingForm = qs("#viewingForm") || qs("form[data-viewing]");
    if (viewingForm && !qs(".la-slot-hint", viewingForm)) {
      var hint = document.createElement("p");
      hint.className = "la-slot-hint";
      hint.textContent =
        "Tip: Suggest 2–3 preferred time slots in your message so the owner can confirm faster.";
      viewingForm.appendChild(hint);
    }
  }

  function enhanceMessagesPage() {
    var chat = qs("#chatContent") || qs(".chat-content");
    if (chat) injectSafePayTip(chat);
  }

  function enhanceOwnerDashboard() {
    document.querySelectorAll("[data-owner-property], .owner-property-card, .property-card").forEach(function (card) {
      if (qs(".la-quality", card)) return;
      var el = document.createElement("div");
      el.className = "la-quality";
      el.innerHTML =
        "<span>Listing quality: use 8+ photos, clear price, full description, and a short video to get more views.</span>";
      card.appendChild(el);
    });
  }

  function enhanceApplicationTimeline() {
    document.querySelectorAll("[data-application-status], .application-card").forEach(function (card) {
      if (qs(".la-next-steps", card)) return;
      var steps = document.createElement("div");
      steps.className = "la-next-steps";
      steps.innerHTML =
        "<span>Next:</span> Wait for owner review · Message owner · Prepare documents for viewing";
      card.appendChild(steps);
    });
  }

  function badgeHtml(p) {
    var parts = [];
    if (isVerifiedProperty(p)) parts.push('<span class="la-badge la-badge-verified">Verified</span>');
    if (isRisk(p)) parts.push('<span class="la-badge la-badge-risk">Review carefully</span>');
    var q = listingQualityScore(p);
    if (q) parts.push('<span class="la-badge la-badge-quality">' + qualityLabel(q) + "</span>");
    return parts.join(" ");
  }

  function boot() {
    var path = (location.pathname || "").toLowerCase();
    if (path.indexOf("property-details") !== -1) enhancePropertyDetailsPage();
    if (path.indexOf("messages") !== -1) enhanceMessagesPage();
    if (path.indexOf("owner-dashboard") !== -1 || path.indexOf("owner-properties") !== -1) {
      enhanceOwnerDashboard();
    }
    if (path.indexOf("tenant") !== -1 || path.indexOf("application") !== -1) {
      enhanceApplicationTimeline();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.LeaseAccomStandout = {
    listingQualityScore: listingQualityScore,
    qualityLabel: qualityLabel,
    badgeHtml: badgeHtml,
    isVerifiedProperty: isVerifiedProperty
  };
})(window);
