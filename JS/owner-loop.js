/**
 * Phase B — Owner loop: Verify → List → Pending → Live
 * Keeps owner journey visible and marketplace rules strict.
 */
(function (global) {
  function readUser() {
    try {
      return JSON.parse(
        localStorage.getItem("leaseaccomCurrentUser") ||
          localStorage.getItem("leaseaccomCurrentUser") ||
          "null"
      );
    } catch (e) {
      return null;
    }
  }

  function ownerVerified(user) {
    const u = user || readUser();
    if (!u) return false;
    const st = String(
      u.verificationStatus || u.ownerVerificationStatus || ""
    ).toLowerCase();
    return st === "verified" || st === "approved" || u.verified === true;
  }

  function ownerVerificationState(user) {
    const u = user || readUser();
    if (!u) return "unverified";
    const st = String(
      u.verificationStatus || u.ownerVerificationStatus || "unverified"
    ).toLowerCase();
    if (st === "verified" || st === "approved") return "verified";
    if (st === "pending") return "pending";
    if (st === "rejected") return "rejected";
    return "unverified";
  }

  function readAllProperties() {
    try {
      const a = JSON.parse(localStorage.getItem("leaseaccomProperties") || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }

  function ownerListings(user) {
    const u = user || readUser();
    if (!u) return [];
    const all = readAllProperties();
    const ids = Array.isArray(u.properties) ? u.properties.map(String) : [];
    return all.filter(
      (p) =>
        String(p.ownerId) === String(u.id) || ids.indexOf(String(p.id)) >= 0
    );
  }

  function listingBadge(property, user) {
    const verified = ownerVerified(user);
    let st = String(
      property.listingStatus || property.verificationStatus || "pending"
    ).toLowerCase();
    if (st === "approved") st = "live";
    if (!verified && st === "live") st = "pending";
    if (st === "rejected") {
      return { key: "rejected", label: "Rejected", className: "lh-badge-rejected" };
    }
    if (st === "live" && verified) {
      return { key: "live", label: "Live", className: "lh-badge-live" };
    }
    return { key: "pending", label: "Pending review", className: "lh-badge-pending" };
  }

  function journeySteps(user) {
    const u = user || readUser();
    const v = ownerVerificationState(u);
    const list = ownerListings(u);
    const hasListing = list.length > 0;
    const hasLive = list.some((p) => listingBadge(p, u).key === "live");
    const hasPending = list.some((p) => listingBadge(p, u).key === "pending");

    return [
      {
        id: "account",
        done: !!u,
        label: "Owner account",
        detail: "Registered as landlord"
      },
      {
        id: "verify",
        done: v === "verified",
        active: v === "pending" || v === "unverified",
        label: "Get verified",
        detail:
          v === "verified"
            ? "Account approved by LeaseAccom"
            : v === "pending"
              ? "Documents submitted — waiting for LeaseAccom"
              : "Submit ID / ownership details",
        href: "owner-verification.html"
      },
      {
        id: "list",
        done: hasListing,
        active: v === "verified" && !hasListing,
        label: "Add a property",
        detail: hasListing
          ? list.length + " listing(s) on your account"
          : "Photos, rent, location, description",
        href: "add-property.html"
      },
      {
        id: "pending",
        done: hasLive || (hasPending && v === "verified"),
        active: hasPending && !hasLive,
        label: "Pending review",
        detail: hasLive
          ? "At least one listing is live"
          : hasPending
            ? "LeaseAccom will approve quality listings"
            : "New listings start as Pending"
      },
      {
        id: "live",
        done: hasLive,
        active: false,
        label: "Live on marketplace",
        detail: hasLive
          ? "Tenants can find your home"
          : "Only Live listings appear in search"
      }
    ];
  }

  function renderJourney() {
    const host = document.getElementById("ownerJourney");
    if (!host) return;
    const user = readUser();
    if (!user) return;
    const steps = journeySteps(user);
    host.innerHTML =
      '<h3 class="owner-panel-title">Your owner path</h3>' +
      '<ol class="lh-owner-journey">' +
      steps
        .map(function (s, i) {
          const cls = s.done ? "is-done" : s.active ? "is-active" : "";
          const link =
            s.href && !s.done
              ? ' <a href="' + s.href + '">Continue</a>'
              : "";
          return (
            '<li class="' +
            cls +
            '"><span class="lh-step-num">' +
            (i + 1) +
            "</span><div><strong>" +
            s.label +
            "</strong><p>" +
            s.detail +
            "</p>" +
            link +
            "</div></li>"
          );
        })
        .join("") +
      "</ol>";
  }

  function enhanceOwnerListingCards() {
    const container = document.getElementById("ownerProperties");
    if (!container) return;
    const user = readUser();
    const list = ownerListings(user);
    if (!list.length) return;

    // If container already has content from app.js, stamp badges
    container.querySelectorAll("[data-property-id]").forEach(function (card) {
      const id = card.getAttribute("data-property-id");
      const prop = list.find(function (p) {
        return String(p.id) === String(id);
      });
      if (!prop) return;
      const b = listingBadge(prop, user);
      let el = card.querySelector(".lh-listing-badge");
      if (!el) {
        el = document.createElement("span");
        el.className = "lh-listing-badge " + b.className;
        card.insertBefore(el, card.firstChild);
      }
      el.textContent = b.label;
      el.className = "lh-listing-badge " + b.className;
    });
  }

  function ensurePendingOnCreate() {
    // Hook is documentation only; add-property.js sets pending
  }

  /**
   * Marketplace gate used by data.js if present
   */
  function canShowOnMarketplace(property, ownerUser) {
    if (!property) return false;
    if (typeof isPropertyPublic === "function") {
      // Extra owner check
      const pub = isPropertyPublic(property);
      if (!pub) return false;
    }
    const ownerOk =
      property.ownerVerified === true ||
      String(property.ownerVerificationStatus || "").toLowerCase() === "verified" ||
      ownerVerified(ownerUser);
    // If listing claims live but owner not verified, hide
    const st = String(property.listingStatus || "").toLowerCase();
    if (st === "live" || st === "approved") {
      return ownerOk || property.ownerVerified === true;
    }
    return false;
  }

  document.addEventListener("DOMContentLoaded", function () {
    try {
      renderJourney();
      setTimeout(enhanceOwnerListingCards, 300);
    } catch (e) {
      console.warn("owner-loop", e);
    }
  });

  global.LeaseAccomOwnerLoop = {
    ownerVerified: ownerVerified,
    ownerVerificationState: ownerVerificationState,
    ownerListings: ownerListings,
    listingBadge: listingBadge,
    journeySteps: journeySteps,
    renderJourney: renderJourney,
    canShowOnMarketplace: canShowOnMarketplace
  };
})(window);
