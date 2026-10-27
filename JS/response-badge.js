/**
 * LeaseAccom — response-time badge placeholder
 * Usage: data-response-time="Usually replies in 2 hours"
 * or LeaseAccomResponseBadge.apply(el, "Usually replies within a day")
 */
(function () {
  "use strict";
  function makeBadge(text) {
    var b = document.createElement("span");
    b.className = "la-response-badge";
    b.innerHTML = '<i class="bx bx-time-five" aria-hidden="true"></i> ' + (text || "Response time");
    return b;
  }
  function applyTo(el, text) {
    if (!el || el.querySelector(".la-response-badge")) return;
    var badge = makeBadge(text);
    var target = el.querySelector("h1, h2, h3, .owner-name, .property-owner") || el;
    target.appendChild(badge);
  }
  function scan() {
    document.querySelectorAll("[data-response-time]").forEach(function (el) {
      applyTo(el, el.getAttribute("data-response-time"));
    });
  }
  window.LeaseAccomResponseBadge = { apply: applyTo, scan: scan };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
})();
