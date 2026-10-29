/**
 * LeaseAccom — extra quality / verified-style badge
 * Usage: data-quality="verified" or data-quality="high"
 */
(function () {
  "use strict";
  function make(text) {
    var b = document.createElement("span");
    b.className = "la-quality-badge";
    b.innerHTML = '<i class="bx bx-check-shield" aria-hidden="true"></i> ' + (text || "Quality");
    return b;
  }
  function apply(el, label) {
    if (!el || el.querySelector(".la-quality-badge")) return;
    var target = el.querySelector("h1, h2, h3, .property-title") || el;
    target.appendChild(make(label || "Verified quality"));
  }
  function scan() {
    document.querySelectorAll("[data-quality]").forEach(function (el) {
      var q = el.getAttribute("data-quality");
      var label = q === "verified" ? "Verified listing" : (q === "high" ? "High quality" : "Quality checked");
      apply(el, label);
    });
  }
  window.LeaseAccomQualityBadge = { apply: apply, scan: scan };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
})();
