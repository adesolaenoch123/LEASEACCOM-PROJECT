/* LeaseAccom — stable navigation, scroll reveal and lightweight UI polish */
(function () {
    "use strict";

    const reduceMotion = () =>
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.leaseaccomSafeJSON = function (key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value ?? fallback;
        } catch (error) {
            return fallback;
        }
    };

    window.leaseaccomToast = function (message, type) {
        if (typeof window.showToast === "function") {
            window.showToast(message, type || "success");
            return;
        }

        let toast = document.querySelector(".leaseaccom-toast-fallback");
        if (!toast) {
            toast = document.createElement("div");
            toast.className = "toast leaseaccom-toast-fallback";
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.add("is-visible");
        clearTimeout(toast._timer);
        toast._timer = setTimeout(
            () => toast.classList.remove("is-visible"),
            2600
        );
    };

    /* =====================================================
       MOBILE NAVIGATION
       One controller only. app.js no longer binds the menu.
       ===================================================== */

    function setupMobileNav() {
        document.querySelectorAll(".navbar .menu-btn").forEach((button) => {
            if (button.dataset.leaseaccomNavStable === "1") return;

            const navbar = button.closest(".navbar");
            if (!navbar) return;

            const links = navbar.querySelector(".nav-links");
            const actions = navbar.querySelector(".nav-actions");

            if (!links && !actions) return;

            button.dataset.leaseaccomNavStable = "1";

            const setIcon = (open) => {
                button.innerHTML = open
                    ? '<i class="bx bx-x" aria-hidden="true"></i>'
                    : '<i class="bx bx-menu" aria-hidden="true"></i>';

                button.setAttribute(
                    "aria-label",
                    open ? "Close navigation" : "Open navigation"
                );
                button.setAttribute(
                    "aria-expanded",
                    open ? "true" : "false"
                );
            };

            const close = () => {
                navbar.classList.remove("leaseaccom-mobile-open");
                navbar.classList.remove("menu-open");
                setIcon(false);
            };

            const open = () => {
                navbar.classList.add("leaseaccom-mobile-open");
                navbar.classList.remove("menu-open");
                setIcon(true);
            };

            setIcon(false);

            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (navbar.classList.contains("leaseaccom-mobile-open")) {
                    close();
                } else {
                    open();
                }
            });

            navbar
                .querySelectorAll(".nav-links a, .nav-actions a")
                .forEach((link) => {
                    link.addEventListener("click", close);
                });

            document.addEventListener("click", (event) => {
                if (
                    navbar.classList.contains("leaseaccom-mobile-open") &&
                    !navbar.contains(event.target)
                ) {
                    close();
                }
            });

            document.addEventListener("keydown", (event) => {
                if (
                    event.key === "Escape" &&
                    navbar.classList.contains("leaseaccom-mobile-open")
                ) {
                    close();
                    button.focus();
                }
            });
        });
    }

    /* =====================================================
       HERO ENTRANCE
       Never alter the headline text or its internal markup.
       ===================================================== */

    function setupHeroEntrance() {
        const hero = document.querySelector(".hero-content");
        if (!hero || hero.dataset.heroMotionReady === "1") return;

        hero.dataset.heroMotionReady = "1";
        hero.classList.add("lh-hero-motion");

        const elements = [
            hero.querySelector(".hero-badge"),
            hero.querySelector("h1"),
            hero.querySelector("p"),
            hero.querySelector(".search-box"),
            hero.querySelector(".ai-search-btn")
        ].filter(Boolean);

        elements.forEach((element, index) => {
            element.classList.add("lh-hero-item");
            element.style.setProperty(
                "--lh-hero-delay",
                `${index * 110}ms`
            );
        });

        if (reduceMotion()) {
            hero.classList.add("lh-hero-visible");
            return;
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                hero.classList.add("lh-hero-visible");
            });
        });
    }

    /* =====================================================
       SCROLL REVEAL
       IntersectionObserver only.
       ===================================================== */

    function setupScrollReveal() {
        const targets = new Set();

        const add = (selector) => {
            document.querySelectorAll(selector).forEach((element) => {
                if (!element.closest(".hero")) targets.add(element);
            });
        };

        add("main > section:not(.hero)");
        add("main > section:not(.hero) .section-heading");
        add("main > section:not(.hero) h2");
        add("main > section:not(.hero) > p");
        add(".property-card");
        add(".category-card");
        add(".step");
        add(".step-item");
        add(".how-it-works-step");
        add(".stat-item");
        add(".trust-item");
        add(".leaseaccom-city");
        add(".leaseaccom-detail-card");
        add(".leaseaccom-empty");
        add(".form-section");
        add(".admin-card");
        add(".admin-panel");
        add(".admin-kpi-grid > *");

        const elements = Array.from(targets);

        elements.forEach((element) => {
            element.classList.add("lh-scroll-reveal");
        });

        /* Add a short stagger only to actual repeated card groups. */
        document
            .querySelectorAll(
                ".property-grid, .category-grid, .steps, .how-it-works-grid, .trust-grid, .leaseaccom-city-grid"
            )
            .forEach((group) => {
                Array.from(group.children).forEach((child, index) => {
                    child.classList.add("lh-scroll-reveal");
                    child.style.setProperty(
                        "--lh-reveal-delay",
                        `${Math.min(index, 7) * 70}ms`
                    );
                });
            });

        if (!elements.length) return;

        if (reduceMotion() || !("IntersectionObserver" in window)) {
            elements.forEach((element) =>
                element.classList.add("lh-scroll-visible")
            );
            return;
        }

        const observer = new IntersectionObserver(
            (entries, instance) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    entry.target.classList.add("lh-scroll-visible");
                    instance.unobserve(entry.target);
                });
            },
            {
                threshold: 0.12,
                rootMargin: "0px 0px -50px 0px"
            }
        );

        elements.forEach((element) => observer.observe(element));
    }

    /* =====================================================
       DYNAMIC CONTENT
       Re-run reveal for cards added after initial page load.
       ===================================================== */

    function setupDynamicReveal() {
        const container = document.getElementById("marketplaceProperties");
        if (!container || !("MutationObserver" in window)) return;

        let timer = null;

        const observer = new MutationObserver(() => {
            clearTimeout(timer);

            timer = setTimeout(() => {
                container
                    .querySelectorAll(".property-card:not(.lh-scroll-reveal)")
                    .forEach((card, index) => {
                        card.classList.add("lh-scroll-reveal");
                        card.style.setProperty(
                            "--lh-reveal-delay",
                            `${Math.min(index, 7) * 70}ms`
                        );

                        if (reduceMotion()) {
                            card.classList.add("lh-scroll-visible");
                        } else {
                            requestAnimationFrame(() =>
                                card.classList.add("lh-scroll-visible")
                            );
                        }
                    });
            }, 40);
        });

        observer.observe(container, {
            childList: true,
            subtree: true
        });
    }

    /* =====================================================
       IMAGE FALLBACK / LAZY LOADING
       ===================================================== */

    function setupImages() {
        document.querySelectorAll("img").forEach((image) => {
            if (image.dataset.leaseaccomImageReady === "1") return;

            image.dataset.leaseaccomImageReady = "1";

            if (
                !image.hasAttribute("loading") &&
                !image.closest(".logo, .admin-brand")
            ) {
                image.loading = "lazy";
            }

            image.addEventListener(
                "error",
                () => {
                    image.classList.add("leaseaccom-img-error");
                    image.parentElement?.classList.add("image-error");
                },
                { once: true }
            );
        });
    }

    /* =====================================================
       PURPOSEFUL PAGE LOADERS
       A page should hint at the work it is about to show,
       rather than using the same spinner everywhere.
       ===================================================== */

    function getLoaderPurpose() {
        const page = location.pathname.split("/").pop().toLowerCase();

        if (page === "index.html" || !page) return "home";
        if (/^(properties|shortlets|commercial|hotels|student-housing|saved|compare|owner-properties)\.html$/.test(page)) return "listings";
        if (page === "property-details.html") return "gallery";
        if (/messages\.html$/.test(page)) return "messages";
        if (/(dashboard|admin)\.html$/.test(page)) return "dashboard";
        if (/^(login|register|add-property|apply|rental-agreement|verification|viewing-requests)\.html$/.test(page)) return "form";
        return "default";
    }

    function loaderVisual(purpose) {
        const visuals = {
            listings: `<div class="leaseaccom-loader-listings" aria-hidden="true"><i></i><i></i><i></i></div>`,
            gallery: `<div class="leaseaccom-loader-gallery" aria-hidden="true"><span></span><span></span><span></span></div>`,
            messages: `<div class="leaseaccom-loader-dots" aria-hidden="true"><span></span><span></span><span></span></div>`,
            dashboard: `<div class="leaseaccom-loader-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></div>`,
            form: `<div class="leaseaccom-loader-steps" aria-hidden="true"><span></span><span></span><span></span></div>`,
            default: `<div class="leaseaccom-loader-spinner" aria-hidden="true"></div>`
        };
        return visuals[purpose] || visuals.default;
    }

    function loaderCopy(purpose) {
        return {
            listings: "Preparing listings...",
            gallery: "Opening property details...",
            messages: "Connecting conversations...",
            dashboard: "Building your overview...",
            form: "Getting things ready...",
            default: "Loading LeaseAccom..."
        }[purpose] || "Loading LeaseAccom...";
    }

    function installPurposeLoader() {
        // The landing page has its own logo-to-skeleton sequence in index.html.
        // Do not layer the generic purpose loader over it.
        if (getLoaderPurpose() === "home") return;
        if (!document.body || document.getElementById("leaseaccomPageLoader")) return;

        const purpose = getLoaderPurpose();
        const loader = document.createElement("div");
        loader.id = "leaseaccomPageLoader";
        loader.className = `leaseaccom-loader--${purpose}`;
        loader.setAttribute("role", "status");
        loader.setAttribute("aria-live", "polite");
        loader.innerHTML = `<div class="leaseaccom-loader-content"><img class="leaseaccom-loader-logo" src="IMAGES/leaseaccom-logo-full.png" alt=""><div class="leaseaccom-loader-visual">${loaderVisual(purpose)}</div><div class="leaseaccom-loader-text">${loaderCopy(purpose)}</div><span class="sr-only">Loading page</span></div>`;
        document.body.prepend(loader);
        document.documentElement.classList.remove("lh-preload-lock");
        document.documentElement.classList.add("lh-loader-on");

        const hide = () => {
            loader.classList.add("is-hidden");
            document.documentElement.classList.remove("lh-loader-on");
        };
        const delay = reduceMotion() ? 0 : 900;
        document.addEventListener("DOMContentLoaded", () => setTimeout(hide, delay), { once: true });
        window.addEventListener("load", () => setTimeout(hide, delay), { once: true });
        setTimeout(hide, 1200);
    }

    installPurposeLoader();

    /* =====================================================
       INITIALIZE
       ===================================================== */

    document.addEventListener("DOMContentLoaded", () => {
        if (!document.querySelector('link[href*="boxicons"]')) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href =
                "https://cdn.boxicons.com/3.0.8/fonts/basic/boxicons.min.css";
            document.head.appendChild(link);
        }

        document.body.classList.add("lh-motion-ready");

        setupMobileNav();
        setupHeroEntrance();
        setupScrollReveal();
        setupDynamicReveal();
        setupImages();

        // Notifications are intentionally disabled on the landing page.
    });
})();

    /* Text logo on non-landing pages */
    (function brandLogoText() {
        try {
            var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
            var isLanding = page === "" || page === "index.html" || page === "/";
            if (isLanding) {
                document.body.classList.add("is-landing-page");
            } else {
                document.body.classList.remove("is-landing-page");
            }
            document.querySelectorAll(".navbar .logo, .messages-topbar .logo, a.logo").forEach(function (logo) {
                if (logo.querySelector(".logo-text")) return;
                var span = document.createElement("span");
                span.className = "logo-text";
                span.setAttribute("aria-label", "LeaseAccom");
                span.innerHTML = '<span class="lh-lease">Lease</span><span class="lh-accom">Accom</span>';
                logo.appendChild(span);
            });
        } catch (e) {}
    })();

