/* LeaseAccom — page loader, toast, entrance animations */

(function () {
    "use strict";

    // ----- Page loader -----
    function createLoader() {
        if (document.querySelector(".page-loader")) return;

        const loader = document.createElement("div");
        loader.className = "page-loader";
        loader.id = "pageLoader";
        loader.innerHTML = `
            <div class="page-loader-spinner" aria-hidden="true"></div>
            <div class="page-loader-text">Loading LeaseAccom…</div>
        `;
        document.body.prepend(loader);
    }

    function hideLoader() {
        const loader = document.getElementById("pageLoader");
        if (!loader) return;
        loader.classList.add("is-hidden");
        setTimeout(() => loader.remove(), 500);
    }

    // Show loader immediately if DOM not ready
    if (document.readyState === "loading") {
        createLoader();
        document.addEventListener("DOMContentLoaded", () => {
            // small delay so content can paint
            setTimeout(hideLoader, 3000);
        });
    } else {
        // already loaded — skip or brief flash
        createLoader();
        setTimeout(hideLoader, 3000);
    }

    window.addEventListener("load", () => setTimeout(hideLoader, 3000));

    // ----- Toast -----
    window.showToast = function (message, type = "success", duration = 2800) {
        let toast = document.querySelector(".toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.className = "toast";
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = `toast is-visible is-${type}`;
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove("is-visible");
        }, duration);
    };

    // ----- Button loading helper -----
    window.setButtonLoading = function (btn, loading = true) {
        if (!btn) return;
        if (loading) {
            btn.dataset.originalText = btn.textContent;
            btn.classList.add("is-loading");
            btn.disabled = true;
        } else {
            btn.classList.remove("is-loading");
            btn.disabled = false;
            if (btn.dataset.originalText) {
                btn.textContent = btn.dataset.originalText;
            }
        }
    };

    // ----- Entrance animation for property grids / cards -----
    function animateCards() {
        const grids = document.querySelectorAll(
            ".property-grid, .categories-section, .trust-section, .stats-section, .how-section"
        );
        grids.forEach((grid) => {
            grid.classList.add("stagger");
            Array.from(grid.children).forEach((child) => {
                if (!child.classList.contains("animate-in")) {
                    child.classList.add("animate-in");
                }
            });
        });
    }

    // ----- Navbar scroll shadow -----
    function setupNavbarScroll() {
        const nav = document.querySelector(".navbar, header.navbar");
        if (!nav) return;
        const onScroll = () => {
            if (window.scrollY > 12) nav.classList.add("is-scrolled");
            else nav.classList.remove("is-scrolled");
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
    }

    // ----- Image fade-in -----
    function setupImageFade() {
        document.querySelectorAll("img").forEach((img) => {
            if (img.closest(".logo")) return;
            img.classList.add("fade-img");
            if (img.complete) {
                img.classList.add("is-loaded");
            } else {
                img.addEventListener("load", () => img.classList.add("is-loaded"), {
                    once: true,
                });
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        setupNavbarScroll();
        setupImageFade();
        // slight delay so dynamic content can render first
        setTimeout(animateCards, 120);
    });

    // Re-run card animation when marketplace re-renders
    const observer = new MutationObserver(() => {
        setTimeout(animateCards, 80);
        setupImageFade();
    });
    document.addEventListener("DOMContentLoaded", () => {
        const target = document.getElementById("marketplaceProperties");
        if (target) {
            observer.observe(target, { childList: true });
        }
    });
})();
