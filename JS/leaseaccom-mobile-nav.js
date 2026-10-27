/**
 * LeaseAccom mobile bottom navigation — tenant/public experience
 * Polished for better touch targets and active states.
 */
(function () {
  "use strict";
  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  var ownerPages = /owner-|add-property|admin/.test(page);
  var authPages = /login|register|forgot|reset|auth-callback/.test(page);
  if (ownerPages || authPages || page === "admin.html") return;

  var items = [
    { href: "index.html", icon: "bx-home-alt", label: "Home", match: /^(index\.html)?$/ },
    { href: "properties.html", icon: "bx-search", label: "Properties", match: /properties|shortlets|commercial|student|hotels|property-details|saved|compare/ },
    { href: "messages.html", icon: "bx-message-dots", label: "Messages", match: /messages|viewing-requests/ },
    { href: "tenant-dashboard.html", icon: "bx-user", label: "Profile", match: /tenant-dashboard|apply|rental-agreement/ }
  ];

  function install() {
    if (document.querySelector(".la-bottom-nav")) return;
    var nav = document.createElement("nav");
    nav.className = "la-bottom-nav";
    nav.setAttribute("aria-label", "LeaseAccom mobile navigation");
    nav.innerHTML = items
      .map(function (item) {
        var active = item.match.test(page) ? " is-active" : "";
        return (
          '<a href="' +
          item.href +
          '" class="' +
          active.trim() +
          '"><i class="bx ' +
          item.icon +
          '" aria-hidden="true"></i><span>' +
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
