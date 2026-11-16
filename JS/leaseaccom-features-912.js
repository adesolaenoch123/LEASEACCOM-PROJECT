/* Landing-page loading lifecycle. Kept separate so the first paint stays predictable. */
(function () {
    "use strict";

    if (!document.body || document.body.dataset.leaseaccomPage === "property-details") return;

    var root = document.documentElement;
    var spinner = document.createElement("div");
    spinner.id = "landingSpinnerStage";
    spinner.setAttribute("role", "status");
    spinner.setAttribute("aria-live", "polite");
    spinner.innerHTML = '<img src="IMAGES/leaseaccom-logo-full.png" alt="LeaseAccom"><span>Loading LeaseAccom...</span>';

    var skeleton = document.createElement("div");
    skeleton.id = "landingSkeletonStage";
    skeleton.setAttribute("aria-hidden", "true");
    skeleton.innerHTML = [1, 2, 3].map(function () {
        return '<div class="landing-skeleton-card"><div class="leaseaccom-skeleton-shimmer leaseaccom-skeleton-image"></div>' +
            '<div class="leaseaccom-skeleton-body"><div class="leaseaccom-skeleton-shimmer leaseaccom-skeleton-line medium"></div>' +
            '<div class="leaseaccom-skeleton-shimmer leaseaccom-skeleton-line short"></div></div></div>';
    }).join("");

    var style = document.createElement("style");
    style.textContent = "#landingSpinnerStage{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#fff;color:#173b2b}#landingSpinnerStage[hidden],#landingSkeletonStage[hidden]{display:none!important}#landingSpinnerStage img{width:min(220px,60vw);height:auto}#landingSkeletonStage{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;max-width:1200px;margin:24px auto;padding:0 24px}#landingSkeletonStage .landing-skeleton-card{min-height:220px;border:1px solid #e3e8e5;border-radius:16px;overflow:hidden;background:#fff}#landingSkeletonStage .leaseaccom-skeleton-image{height:140px}#landingSkeletonStage .leaseaccom-skeleton-body{padding:18px}@media(max-width:700px){#landingSkeletonStage{grid-template-columns:1fr;padding:0 16px}}";
    document.head.appendChild(style);
    document.body.prepend(skeleton);
    document.body.prepend(spinner);
    root.setAttribute("data-landing-loader-phase", "spinner");

    window.setTimeout(function () {
        spinner.style.display = "none";
        skeleton.style.display = "grid";
        root.setAttribute("data-landing-loader-phase", "skeleton");
    }, 120);

    window.setTimeout(function () {
        spinner.hidden = true;
        skeleton.hidden = true;
        root.setAttribute("data-landing-loader-phase", "ready");
    }, 650);
}());
