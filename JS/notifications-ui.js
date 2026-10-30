/**
 * LeaseAccom notifications UI
 * - Injects bell into .navbar when markup is missing
 * - Works offline via localStorage ("leaseaccomNotifications")
 * - Mobile bottom-sheet panel via notifications.css
 */
(function () {
  "use strict";

  var STORAGE_KEY = "leaseaccomNotifications";

  function ensureStylesheet() {
    if (document.querySelector('link[href*="notifications.css"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "CSS/notifications.css";
    document.head.appendChild(link);
  }

  function ensureMarkup() {
    var path = (window.location.pathname || "").toLowerCase();
    var isLanding = /index\.html?$/.test(path) || path === "/" || path.endsWith("/leaseaccom") || path.endsWith("/leaseaccom/");
    var isDashboard = /dashboard\.html?$/i.test(path) || /owner-dashboard|tenant-dashboard/.test(path);
    var loggedIn = false;
    try {
      loggedIn = !!(
        localStorage.getItem("leaseaccomCurrentUser") ||
        localStorage.getItem("currentUser")
      );
    } catch (e) {}

    var shouldEnable =
      document.body &&
      !isLanding &&
      isDashboard &&
      loggedIn &&
      (
        document.body.dataset.notificationsEnabled === "true" ||
        isDashboard
      );

    // If markup already exists on the page, always wire it
    if (document.querySelector("[data-notifications-panel]")) {
      return document.querySelector("[data-notifications-panel]");
    }

    if (!shouldEnable) {
      return null;
    }

    var navbar = document.querySelector("header.navbar, .navbar");
    if (!navbar) return null;

    // Place before hamburger / nav-actions so it stays visible on mobile
    var wrap = document.createElement("div");
    wrap.className = "leaseaccom-header-notifications";
    wrap.innerHTML =
      '<div class="leaseaccom-notification-panel" data-notifications-panel>' +
      '<button class="notification-toggle" type="button" data-notifications-toggle aria-label="Open notifications" aria-expanded="false">' +
      '<i class="bx bx-bell" aria-hidden="true"></i>' +
      '<span class="notification-badge" data-notifications-badge hidden>0</span>' +
      "</button>" +
      '<section class="leaseaccom-notification-panel__dropdown" role="dialog" aria-label="Notifications">' +
      '<div class="leaseaccom-notification-panel__header"><span>Notifications</span>' +
      '<button class="notification-close" type="button" data-notifications-close aria-label="Close notifications">×</button></div>' +
      '<div class="leaseaccom-notification-list" data-notifications-list></div>' +
      "</section></div>";

    var menuBtn = navbar.querySelector(".menu-btn, #menuBtn");
    if (menuBtn && menuBtn.parentNode === navbar) {
      navbar.insertBefore(wrap, menuBtn);
    } else {
      navbar.appendChild(wrap);
    }
    return wrap.querySelector("[data-notifications-panel]");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c];
    });
  }

  function loadLocal() {
    try {
      var v = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocal(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function canUseLocalFallback() {
    return true; // always show local/demo notifications if API has none
  }

  function seedDemoIfEmpty() {
    var items = loadLocal();
    if (items.length) return items;
    // Light demo so the panel is never a dead empty void after login path
    try {
      var user = JSON.parse(
        localStorage.getItem("leaseaccomCurrentUser") ||
          localStorage.getItem("leaseaccomCurrentUser") ||
          localStorage.getItem("leaseaccomCurrentUser") ||
          localStorage.getItem("currentUser") ||
          "null"
      );
      if (!user) return items;
      items = [
        {
          id: "demo-welcome",
          title: "Welcome to LeaseAccom",
          message: "You will see viewing and application updates here.",
          type: "info",
          read: false,
          createdAt: new Date().toISOString()
        }
      ];
      saveLocal(items);
    } catch (e) {}
    return items;
  }

  function init() {
    var path = (window.location.pathname || "").toLowerCase();
    if (/index\.html?$/.test(path) || path === "/" || path === "") {
      return; // never show notifications on landing page
    }
    ensureStylesheet();
    var notificationPanel = ensureMarkup();
    if (!notificationPanel) return;

    var bellButton = document.querySelector("[data-notifications-toggle]");
    var closeButton = document.querySelector("[data-notifications-close]");
    var list = document.querySelector("[data-notifications-list]");
    var badge = document.querySelector("[data-notifications-badge]");
    if (!bellButton || !list) return;

    function showFallback(message, icon) {
      list.innerHTML =
        '<div class="leaseaccom-empty-state"><div class="leaseaccom-empty-icon">' +
        (icon || "🔔") +
        "</div><p>" +
        escapeHtml(message) +
        "</p></div>";
    }

    function renderNotifications(items) {
      items = Array.isArray(items) ? items : [];
      var unreadCount = items.filter(function (item) {
        return !item.read;
      }).length;
      if (badge) {
        badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
        badge.hidden = unreadCount === 0;
      }

      if (!items.length) {
        showFallback("No notifications yet.", "🔔");
        return;
      }

      list.innerHTML = items
        .map(function (item) {
          var icon =
            item.type === "success"
              ? "✓"
              : item.type === "warning"
                ? "!"
                : item.type === "danger"
                  ? "✕"
                  : "ℹ";
          return (
            '<div class="leaseaccom-notification ' +
            (item.read ? "is-read" : "is-unread") +
            '" data-id="' +
            escapeHtml(item.id) +
            '">' +
            '<div class="leaseaccom-notification__icon ' +
            escapeHtml(item.type || "info") +
            '">' +
            icon +
            "</div>" +
            '<div class="leaseaccom-notification__body"><strong>' +
            escapeHtml(item.title || "Notification") +
            "</strong><p>" +
            escapeHtml(item.message || "") +
            "</p></div>" +
            '<button class="leaseaccom-notification__mark" type="button" data-mark-read="' +
            escapeHtml(item.id) +
            '" ' +
            (item.read ? "disabled" : "") +
            ">" +
            (item.read ? "Read" : "Mark read") +
            "</button></div>"
          );
        })
        .join("");
    }

    function openPanel() {
      notificationPanel.classList.add("is-open");
      bellButton.setAttribute("aria-expanded", "true");
      document.body.classList.add("lh-notifications-open");
    }

    function closePanel() {
      notificationPanel.classList.remove("is-open");
      bellButton.setAttribute("aria-expanded", "false");
      document.body.classList.remove("lh-notifications-open");
    }

    function togglePanel() {
      if (notificationPanel.classList.contains("is-open")) closePanel();
      else openPanel();
    }

    async function fetchNotifications() {
      try {
        if (window.LeaseAccomApi && window.LeaseAccomAuth) {
          var token = await window.LeaseAccomAuth.getAccessToken();
          if (token && window.LeaseAccomApi.isConfigured && window.LeaseAccomApi.isConfigured()) {
            var payload = await window.LeaseAccomApi.request("/notifications");
            var remote = Array.isArray(payload.notifications) ? payload.notifications : [];
            renderNotifications(remote);
            return;
          }
        }
      } catch (error) {
        console.warn("LeaseAccom notifications API unavailable.", error);
      }

      if (!canUseLocalFallback()) {
        showFallback("Notifications are temporarily unavailable.", "🔔");
        if (badge) badge.hidden = true;
        return;
      }

      var local = seedDemoIfEmpty();
      try {
        var user = JSON.parse(
          localStorage.getItem("leaseaccomCurrentUser") ||
            localStorage.getItem("leaseaccomCurrentUser") ||
            localStorage.getItem("leaseaccomCurrentUser") ||
            localStorage.getItem("currentUser") ||
            "null"
        );
        if (!user) {
          showFallback("Log in to view notifications.", "🔒");
          if (badge) badge.hidden = true;
          return;
        }
      } catch (e2) {
        showFallback("Log in to view notifications.", "🔒");
        return;
      }
      renderNotifications(local);
    }

    bellButton.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      togglePanel();
      if (notificationPanel.classList.contains("is-open")) {
        fetchNotifications();
      }
    });

    if (closeButton) {
      closeButton.addEventListener("click", function (event) {
        event.preventDefault();
        closePanel();
      });
    }

    document.addEventListener("click", function (event) {
      if (!notificationPanel.classList.contains("is-open")) return;
      if (notificationPanel.contains(event.target)) return;
      closePanel();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closePanel();
    });

    list.addEventListener("click", async function (event) {
      var btn = event.target.closest("[data-mark-read]");
      if (!btn) return;
      var id = btn.getAttribute("data-mark-read");

      if (window.LeaseAccomApi && window.LeaseAccomApi.isConfigured && window.LeaseAccomApi.isConfigured()) {
        try {
          var token = await window.LeaseAccomAuth?.getAccessToken?.();
          if (!token) throw new Error("Please log in again to continue.");
          await window.LeaseAccomApi.request("/notifications/" + encodeURIComponent(id) + "/read", {
            method: "PATCH"
          });
          await fetchNotifications();
          return;
        } catch (error) {
          console.warn("Notification read update failed.", error);
          if (!canUseLocalFallback()) {
            if (typeof window.leaseaccomToast === "function") window.leaseaccomToast("Could not update notification");
            return;
          }
        }
      }

      var items = loadLocal().map(function (item) {
        if (String(item.id) === String(id)) item.read = true;
        return item;
      });
      saveLocal(items);
      renderNotifications(items);
    });

    try {
      var user = JSON.parse(
        localStorage.getItem("leaseaccomCurrentUser") ||
          localStorage.getItem("leaseaccomCurrentUser") ||
          localStorage.getItem("leaseaccomCurrentUser") ||
          localStorage.getItem("currentUser") ||
          "null"
      );
      if (user) {
        fetchNotifications();
      }
    } catch (e) {}

    // Expose helper for other modules to push notifications
    window.LeaseAccomNotify = {
      push: function (notif) {
        var items = loadLocal();
        items.unshift({
          id: String((notif && notif.id) || "n-" + Date.now()),
          title: (notif && notif.title) || "LeaseAccom",
          message: (notif && notif.message) || "",
          type: (notif && notif.type) || "info",
          read: false,
          createdAt: new Date().toISOString()
        });
        saveLocal(items.slice(0, 50));
        var unread = items.filter(function (i) {
          return !i.read;
        }).length;
        if (badge) {
          badge.textContent = String(unread);
          badge.hidden = unread === 0;
        }
      },
      refresh: fetchNotifications
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
