(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var container = document.getElementById("ownerProperties");
    var count = document.getElementById("ownerListingCount");
    var empty = document.getElementById("emptyOwnerProperties");
    var user;

    if (!container || !window.LeaseAccomData || !window.LeaseAccomData.hasSupabase()) return;

    try {
      user = JSON.parse(localStorage.getItem("leaseaccomCurrentUser") || "null");
    } catch (e) {
      return;
    }
    if (!user || !user.id) return;

    try {
      var listings = await window.LeaseAccomData.fetchOwnerProperties(user.id);
      if (!Array.isArray(listings)) return;

      if (Array.isArray(window.properties)) {
        listings.forEach(function (listing) {
          var existingIndex = window.properties.findIndex(function (property) {
            return String(property.id) === String(listing.id);
          });
          if (existingIndex === -1) {
            window.properties.push(listing);
          } else {
            window.properties[existingIndex] = Object.assign({}, window.properties[existingIndex], listing);
          }
        });
      }

      if (count) count.textContent = String(listings.length);
      if (empty) empty.style.display = listings.length ? "none" : "block";
      container.innerHTML = listings.map(function (listing) {
        var status = String(listing.verificationStatus || "pending").toLowerCase();
        var ownerVerified = String(user.ownerVerificationStatus || user.verificationStatus || "").toLowerCase() === "verified";
        var statusClass = status === "approved" && ownerVerified
          ? "status-live"
          : status === "rejected"
            ? "status-rejected"
            : "status-pending";
        var statusText = status === "approved" && ownerVerified
          ? "Live"
          : status === "rejected"
            ? "Rejected"
            : ownerVerified
              ? "Pending"
              : "Pending — verify account";
        var image = listing.image || (listing.images && listing.images[0]) || "IMAGES/leaseaccom-logo-full.png";

        return '<div class="owner-property-item">' +
          '<img class="owner-property-image" src="' + escapeHtml(image) + '" alt="' + escapeHtml(listing.title) + '">' +
          '<div class="owner-property-info">' +
          '<h3>' + escapeHtml(listing.title || "Property") + '</h3>' +
          '<p><i class="bx bx-map" aria-hidden="true"></i> ' + escapeHtml(listing.location || listing.city || "Nigeria") + '</p>' +
          '<div class="owner-property-price">₦' + new Intl.NumberFormat("en-NG").format(Number(listing.price) || 0) + ' / ' + escapeHtml(listing.period || "year") + '</div>' +
          '<div class="owner-property-actions"><button type="button" class="owner-small-btn" data-owner-property-id="' + escapeHtml(listing.id) + '">View</button></div>' +
          '</div>' +
          '<div class="owner-property-status"><span class="status-badge ' + statusClass + '">' + escapeHtml(statusText) + '</span></div>' +
          '</div>';
      }).join("");

      container.querySelectorAll("[data-owner-property-id]").forEach(function (button) {
        button.addEventListener("click", function () {
          if (typeof window.openProperty === "function") {
            window.openProperty(button.getAttribute("data-owner-property-id"));
          }
        });
      });
    } catch (error) {
      console.warn("Owner properties could not be loaded from Supabase.", error);
    }
  });
})();