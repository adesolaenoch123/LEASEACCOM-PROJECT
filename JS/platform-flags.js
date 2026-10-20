/**
 * LeaseAccom — apply admin platform_settings flags on the public site
 * Keys: platform_flags, support_contact
 */
(function () {
  "use strict";

  var FLAGS = {
    maintenance: false,
    newSignups: true,
    requireOwnerVerif: false,
    featuredOnlyPaid: true
  };
  var SUPPORT = { email: "", phone: "" };
  var ready = null;

  function sb() {
    return window.leaseaccomSupabase || window.leasehubSupabase || null;
  }

  async function loadFlags() {
    var client = sb();
    if (!client) return FLAGS;
    try {
      var res = await client.from("platform_settings").select("key, value").in("key", [
        "platform_flags",
        "support_contact"
      ]);
      (res.data || []).forEach(function (row) {
        if (row.key === "platform_flags" && row.value) {
          FLAGS = Object.assign({}, FLAGS, row.value);
        }
        if (row.key === "support_contact" && row.value) {
          SUPPORT = Object.assign({}, SUPPORT, row.value);
        }
      });
    } catch (e) {}
    window.LeaseAccomFlags = {
      flags: FLAGS,
      support: SUPPORT,
      refresh: loadFlags
    };
    applyMaintenanceBanner();
    return FLAGS;
  }

  function applyMaintenanceBanner() {
    var existing = document.getElementById("laMaintenanceBanner");
    if (!FLAGS.maintenance) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    var bar = document.createElement("div");
    bar.id = "laMaintenanceBanner";
    bar.setAttribute("role", "status");
    bar.style.cssText =
      "position:sticky;top:0;z-index:9999;background:#0d7547;color:#fff;text-align:center;" +
      "padding:10px 14px;font-size:13px;font-weight:700;font-family:system-ui,sans-serif";
    bar.textContent =
      "LeaseAccom is under maintenance. Some features may be limited. " +
      (SUPPORT.email ? "Support: " + SUPPORT.email : "");
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function blockSignupsIfNeeded() {
    if (FLAGS.newSignups !== false) return;
    var form = document.getElementById("registerForm");
    if (!form) return;
    form.addEventListener(
      "submit",
      function (e) {
        e.preventDefault();
        e.stopPropagation();
        alert("New sign-ups are temporarily closed. Please try again later.");
      },
      true
    );
    var note = document.createElement("p");
    note.style.cssText = "color:#dc3d3d;font-weight:700;margin:12px 0";
    note.textContent = "New registrations are currently closed by the platform admin.";
    form.parentNode.insertBefore(note, form);
    form.querySelectorAll("button[type=submit], .primary-btn").forEach(function (b) {
      b.disabled = true;
    });
  }

  ready = loadFlags().then(function () {
    blockSignupsIfNeeded();
  });

  window.LeaseAccomFlagsReady = ready;
})();
