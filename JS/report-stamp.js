/**
 * LeaseAccom — light report-outcome stamp
 * Usage: add data-report-status="resolved" or "reviewed" on a listing card
 * or call LeaseAccomReportStamp.apply(el, "resolved")
 */
(function () {
  "use strict";
  function makeStamp(status) {
    var s = document.createElement("span");
    s.className = "la-report-stamp is-" + status;
    s.textContent = status === "resolved" ? "Report resolved" : "Report reviewed";
    return s;
  }
  function applyTo(el, status) {
    if (!el || el.querySelector(".la-report-stamp")) return;
    var stamp = makeStamp(status || "reviewed");
    var title = el.querySelector("h3, .property-title, .listing-title") || el;
    title.appendChild(stamp);
  }
  function scan() {
    document.querySelectorAll("[data-report-status]").forEach(function (el) {
      applyTo(el, el.getAttribute("data-report-status"));
    });
  }
  window.LeaseAccomReportStamp = { apply: applyTo, scan: scan };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
})();
