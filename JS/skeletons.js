/**
 * LeaseAccom skeleton helper
 * Usage: LeaseAccomSkeleton.show(container) / .hide(container)
 * Auto-shows on .property-grid and .dashboard-stats until content arrives.
 */
(function () {
  "use strict";
  function card() {
    return (
      '<div class="la-skeleton-card">' +
      '<div class="la-skeleton la-skeleton-img"></div>' +
      '<div class="la-skeleton la-skeleton-line"></div>' +
      '<div class="la-skeleton la-skeleton-line short"></div>' +
      '<div class="la-skeleton la-skeleton-line tiny"></div>' +
      "</div>"
    );
  }
  function show(container, count) {
    if (!container || container.querySelector(".la-skeleton-grid, .la-skeleton-card")) return;
    var n = count || 6;
    var wrap = document.createElement("div");
    wrap.className = "la-skeleton-grid";
    wrap.setAttribute("data-la-skeleton", "1");
    var html = "";
    for (var i = 0; i < n; i++) html += card();
    wrap.innerHTML = html;
    container.appendChild(wrap);
  }
  function hide(container) {
    if (!container) return;
    var sk = container.querySelector("[data-la-skeleton]");
    if (sk) sk.remove();
  }
  function auto() {
    document.querySelectorAll(".property-grid").forEach(function (grid) {
      if (!grid.children.length || grid.querySelector(".la-skeleton-grid")) {
        show(grid, 6);
        // Hide once real cards appear
        var obs = new MutationObserver(function () {
          if (grid.querySelector(".property-card, article")) {
            hide(grid);
            obs.disconnect();
          }
        });
        obs.observe(grid, { childList: true, subtree: true });
        // Safety timeout
        setTimeout(function () { hide(grid); }, 8000);
      }
    });
    document.querySelectorAll(".dashboard-stats").forEach(function (stats) {
      if (stats.querySelector(".la-skeleton-stat")) return;
      var cards = stats.querySelectorAll(".stat-card");
      cards.forEach(function (c) {
        if (!c.querySelector(".la-skeleton")) {
          var s = document.createElement("div");
          s.className = "la-skeleton la-skeleton-stat";
          s.setAttribute("data-la-skeleton", "1");
          c.style.position = "relative";
          c.appendChild(s);
          setTimeout(function () { s.remove(); }, 2500);
        }
      });
    });
  }
  
  // Property details
  var details = document.querySelector(".property-loading, .property-details, main");
  if (details && /property-details/.test(location.pathname) && !details.querySelector("[data-la-skeleton]")) {
    var d = document.createElement("div");
    d.className = "la-skeleton-details";
    d.setAttribute("data-la-skeleton", "1");
    d.innerHTML = '<div class="la-skeleton la-skeleton-hero"></div><div class="la-skeleton la-skeleton-title"></div><div class="la-skeleton la-skeleton-meta"></div><div class="la-skeleton la-skeleton-line"></div><div class="la-skeleton la-skeleton-line short"></div>';
    var target = document.querySelector(".property-loading") || details;
    if (target) target.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.remove(); }, 4000);
  }

  // Messages list
  document.querySelectorAll(".conversation-list, #conversationList, .messages-list").forEach(function (list) {
    if (list.querySelector("[data-la-skeleton]")) return;
    var wrap = document.createElement("div");
    wrap.setAttribute("data-la-skeleton", "1");
    for (var i = 0; i < 5; i++) {
      wrap.innerHTML += '<div class="la-skeleton-msg"><div class="la-skeleton la-skeleton-avatar"></div><div class="la-skeleton-msg-lines"><div class="la-skeleton la-skeleton-line"></div><div class="la-skeleton la-skeleton-line short"></div></div></div>';
    }
    list.appendChild(wrap);
    var obs = new MutationObserver(function () {
      if (list.querySelector(".conversation-item, .message-item")) { wrap.remove(); obs.disconnect(); }
    });
    obs.observe(list, { childList: true });
    setTimeout(function () { if (wrap.parentNode) wrap.remove(); }, 6000);
  });

  // Admin tables
  document.querySelectorAll(".admin-table-wrap, #reportsTable, #propertiesTable").forEach(function (box) {
    if (box.querySelector("[data-la-skeleton]") || box.querySelector("table")) return;
    var s = document.createElement("div");
    s.setAttribute("data-la-skeleton", "1");
    for (var i = 0; i < 6; i++) s.innerHTML += '<div class="la-skeleton la-skeleton-row"></div>';
    box.appendChild(s);
    setTimeout(function () { if (s.parentNode) s.remove(); }, 5000);
  });

  window.LeaseAccomSkeleton = { show: show, hide: hide, auto: auto };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", auto);
  } else {
    auto();
  }
})();
