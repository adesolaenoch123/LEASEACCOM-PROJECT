/**
 * LeaseAccom owner mobile bottom navigation — present on all owner pages
 */
(function () {
  "use strict";
  var page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (!/owner-|add-property/.test(page)) return;

  var items = [
    { href: "owner-dashboard.html", icon: "bx-grid-alt", label: "Dashboard", match: /owner-dashboard/ },
    { href: "owner-dashboard.html#myProperties", icon: "bx-building-house", label: "Properties", match: /myProperties|add-property|owner-properties/ },
    { href: "owner-messages.html", icon: "bx-message-dots", label: "Messages", match: /owner-messages/ },
    { href: "owner-plans.html", icon: "bx-diamond", label: "Plans", match: /owner-plans/ },
    { href: "owner-payments.html", icon: "bx-wallet", label: "Payments", match: /owner-payments/ }
  ];

  function install() {
    if (document.querySelector(".la-owner-bottom-nav")) return;
    var nav = document.createElement("nav");
    nav.className = "la-owner-bottom-nav la-bottom-nav";
    nav.setAttribute("aria-label", "Owner navigation");
    nav.innerHTML = items
      .map(function (item) {
        var active = item.match.test(page) || (page === "owner-dashboard.html" && item.label === "Dashboard" && !location.hash)
          ? " is-active"
          : "";
        if (location.hash === "#myProperties" && item.label === "Properties") active = " is-active";
        return (
          '<a href="' +
          item.href +
          '" class="' +
          active.trim() +
          '"><i class="bx ' +
          item.icon +
          '"></i><span>' +
          item.label +
          "</span></a>"
        );
      })
      .join("");
    document.body.appendChild(nav);
    document.body.classList.add("la-has-bottom-nav");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
