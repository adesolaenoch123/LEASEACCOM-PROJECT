/**
 * LeaseAccom features pack: response-time, portfolio stats,
 * application tracker polish, enterprise spotlight helper.
 * Additive only — does not replace core modules.
 */
(function (global) {
  "use strict";

  var RESPONSE_KEY = "leaseaccomOwnerResponseStats";

  function readStats() {
    try {
      return JSON.parse(localStorage.getItem(RESPONSE_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function writeStats(obj) {
    try {
      localStorage.setItem(RESPONSE_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  /** Call when an owner sends a message in a conversation */
  function recordOwnerReply(ownerId, tenantMessageAt) {
    if (!ownerId) return;
    var stats = readStats();
    var row = stats[String(ownerId)] || { samples: [], avgMinutes: null };
    var start = tenantMessageAt ? new Date(tenantMessageAt).getTime() : Date.now() - 30 * 60000;
    var mins = Math.max(1, Math.round((Date.now() - start) / 60000));
    row.samples = (row.samples || []).slice(-19).concat([mins]);
    var sum = row.samples.reduce(function (a, b) {
      return a + b;
    }, 0);
    row.avgMinutes = Math.round(sum / row.samples.length);
    row.updatedAt = new Date().toISOString();
    stats[String(ownerId)] = row;
    writeStats(stats);
  }

  function responseLabel(ownerId) {
    if (!ownerId) return null;
    var row = readStats()[String(ownerId)];
    if (!row || !row.avgMinutes) return null;
    var m = row.avgMinutes;
    if (m <= 60) return "Usually replies in under 1 hour";
    if (m <= 180) return "Usually replies in a few hours";
    if (m <= 1440) return "Usually replies within a day";
    return "Replies may take longer";
  }

  function injectResponseBadge(ownerId, host) {
    if (!host || !ownerId) return;
    if (host.querySelector(".la-response-badge")) return;
    var label = responseLabel(ownerId);
    if (!label) {
      label = "New host · response time building";
    }
    var el = document.createElement("div");
    el.className = "la-response-badge";
    el.textContent = label;
    host.appendChild(el);
  }

  function enhancePropertyDetailsResponse() {
    var path = (location.pathname || "").toLowerCase();
    if (path.indexOf("property-details") === -1) return;
    var ownerId = null;
    try {
      var selected = JSON.parse(localStorage.getItem("selectedProperty") || "null");
      if (selected) ownerId = selected.ownerId || selected.owner_id || selected.user_id;
    } catch (e) {}
    var host =
      document.querySelector(".property-heading") ||
      document.querySelector(".property-details h1") ||
      document.querySelector("main");
    if (host) injectResponseBadge(ownerId, host);
  }

  function enhanceOwnerPortfolio() {
    var path = (location.pathname || "").toLowerCase();
    if (path.indexOf("owner-dashboard") === -1) return;

    var panel = document.getElementById("ownerPortfolioPlus");
    if (!panel) {
      var chart = document.getElementById("ownerEngagementChart");
      var parent = chart && chart.parentElement;
      if (!parent) return;
      panel = document.createElement("div");
      panel.id = "ownerPortfolioPlus";
      panel.className = "la-portfolio-plus";
      parent.appendChild(panel);
    }

    var viewings = 0;
    var applications = 0;
    var messages = 0;
    try {
      var v = JSON.parse(localStorage.getItem("leaseaccomViewingRequests") || "[]") || [];
      viewings = Array.isArray(v) ? v.length : 0;
    } catch (e) {}
    try {
      var a = JSON.parse(localStorage.getItem("leaseaccomRentalApplications") || "[]") || [];
      applications = Array.isArray(a) ? a.length : 0;
    } catch (e2) {}
    try {
      var m = JSON.parse(localStorage.getItem("leaseaccomMessages") || "[]") || [];
      messages = Array.isArray(m) ? m.length : 0;
    } catch (e3) {}

    // Cloud counts if available on window
    if (global.__laOwnerViewingsCount != null) viewings = global.__laOwnerViewingsCount;
    if (global.__laOwnerApplicationsCount != null) applications = global.__laOwnerApplicationsCount;

    panel.innerHTML =
      '<div class="la-portfolio-grid">' +
      '<div class="la-portfolio-card"><strong id="laStatViewings">' +
      viewings +
      "</strong><span>Viewing requests</span></div>" +
      '<div class="la-portfolio-card"><strong id="laStatApps">' +
      applications +
      "</strong><span>Applications</span></div>" +
      '<div class="la-portfolio-card"><strong id="laStatMsgs">' +
      messages +
      "</strong><span>Conversations</span></div>" +
      "</div>" +
      '<p class="la-portfolio-note">Portfolio snapshot from your activity on LeaseAccom. Counts update as tenants engage.</p>';

    // Try cloud refresh
    if (global.LeaseAccomCloud && global.LeaseAccomCloud.hasSb && global.LeaseAccomCloud.hasSb()) {
      var client = global.leaseaccomSupabase || global.leasehubSupabase;
      if (client && global.LeaseAccomCloud.uid) {
        global.LeaseAccomCloud.uid().then(function (uid) {
          if (!uid) return;
          Promise.all([
            client.from("viewings").select("id", { count: "exact", head: true }).eq("owner_id", uid),
            client.from("applications").select("id", { count: "exact", head: true }).eq("owner_id", uid),
            client.from("conversations").select("id", { count: "exact", head: true }).eq("owner_id", uid)
          ]).then(function (results) {
            var vc = results[0] && results[0].count;
            var ac = results[1] && results[1].count;
            var mc = results[2] && results[2].count;
            if (vc != null && document.getElementById("laStatViewings"))
              document.getElementById("laStatViewings").textContent = String(vc);
            if (ac != null && document.getElementById("laStatApps"))
              document.getElementById("laStatApps").textContent = String(ac);
            if (mc != null && document.getElementById("laStatMsgs"))
              document.getElementById("laStatMsgs").textContent = String(mc);
          }).catch(function () {});
        });
      }
    }
  }

  function enhanceApplicationTracker() {
    document.querySelectorAll(".application-card, .lh-status-card").forEach(function (card) {
      if (card.querySelector(".la-app-tracker")) return;
      var statusEl =
        card.querySelector(".pending-badge, .verified-badge, .rejected-badge, .review-badge, .status-pill");
      var statusText = statusEl ? statusEl.textContent.trim().toLowerCase() : "";
      var steps = ["Submitted", "Under review", "Decision"];
      var active = 0;
      if (/review/.test(statusText)) active = 1;
      if (/accept|approved|reject|declin|withdraw/.test(statusText)) active = 2;
      var wrap = document.createElement("div");
      wrap.className = "la-app-tracker";
      wrap.innerHTML = steps
        .map(function (label, i) {
          var cls = i < active ? "done" : i === active ? "current" : "";
          return '<div class="la-app-step ' + cls + '"><span class="dot"></span><span>' + label + "</span></div>";
        })
        .join('<div class="la-app-line"></div>');
      var details = card.querySelector(".application-details") || card;
      details.appendChild(wrap);
    });
  }

  function enhanceEnterpriseSpotlight() {
    var path = (location.pathname || "").toLowerCase();
    if (path.indexOf("index") === -1 && path !== "/" && !path.endsWith("/")) return;
    var grid = document.getElementById("featuredProperties");
    if (!grid) return;
    var section = grid.closest("section") || grid.parentElement;
    if (section && !section.querySelector(".la-enterprise-note")) {
      var note = document.createElement("p");
      note.className = "la-enterprise-note";
      note.innerHTML =
        "<strong>Enterprise spotlight:</strong> Top partners and featured homes appear first so you see premium verified inventory sooner.";
      section.insertBefore(note, grid);
    }
    // Mark first cards as spotlight
    grid.querySelectorAll(".property-card").forEach(function (card, i) {
      if (i < 3) card.classList.add("la-spotlight-card");
    });
  }

  function wireMessageResponseTracking() {
    // When owner sends from owner-messages, record reply
    var form = document.getElementById("messageForm");
    if (!form || form.__laResponseWired) return;
    form.__laResponseWired = true;
    form.addEventListener(
      "submit",
      function () {
        var path = (location.pathname || "").toLowerCase();
        var isOwner = path.indexOf("owner-message") !== -1;
        if (!isOwner) return;
        var ownerId = null;
        try {
          var u =
            JSON.parse(localStorage.getItem("leaseaccomCurrentUser") || "null") ||
            JSON.parse(localStorage.getItem("leasehubCurrentUser") || "null");
          ownerId = u && (u.id || u.userId);
        } catch (e) {}
        recordOwnerReply(ownerId, null);
      },
      true
    );
  }

  function boot() {
    enhancePropertyDetailsResponse();
    enhanceOwnerPortfolio();
    enhanceApplicationTracker();
    enhanceEnterpriseSpotlight();
    wireMessageResponseTracking();
    // Re-run tracker after late renders
    setTimeout(enhanceApplicationTracker, 1200);
    setTimeout(enhanceEnterpriseSpotlight, 1500);
    setTimeout(enhanceOwnerPortfolio, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.LeaseAccomNext4 = {
    recordOwnerReply: recordOwnerReply,
    responseLabel: responseLabel
  };
})(window);
