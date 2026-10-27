/* =========================================================
   LEASEACCOM - PROPERTY DETAILS
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    const detailsContainer =
        document.getElementById("propertyDetails");

    if (!detailsContainer) return;

    function showDetailsError(title, message) {
        detailsContainer.innerHTML = `
            <div class="property-loading">
                <h2>${title}</h2>
                <p>${message}</p>
                <a href="properties.html" class="primary-btn">Browse Properties</a>
            </div>
        `;
    }

    /**
     * For a specific property the user opened, do not hide it
     * solely because of the strict marketplace quality gate
     * (min 4 photos). Only reject truly rejected listings.
     */
    function isPublicProperty(listing) {
        if (!listing) return false;
        if (typeof isLeaseAccomPropertyPublic === "function") {
            return isLeaseAccomPropertyPublic(listing);
        }
        if (typeof isPropertyPublic === "function") {
            // Fallback: still allow non-rejected listings on details page
            const status = String(listing.verificationStatus || listing.verification_status || "").toLowerCase();
            if (status === "rejected") return false;
            return true;
        }
        return String(listing.verificationStatus || "").toLowerCase() !== "rejected";
    }

    function withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise(function (resolve) {
                setTimeout(function () { resolve(null); }, ms);
            })
        ]);
    }

    function findPropertyById(list, id) {
        if (!Array.isArray(list) || !id) return null;
        const target = String(id);
        return list.find(function (item) {
            return String(item.id) === target;
        }) || null;
    }

    function readSelectedFromStorage() {
        try {
            const raw = localStorage.getItem("selectedProperty");
            if (!raw) return null;
            // Newer path stores full JSON object
            if (raw.trim().charAt(0) === "{") {
                return JSON.parse(raw);
            }
            // Older path stored only the id
            return null;
        } catch (e) {
            return null;
        }
    }


    /* =====================================================
       GET PROPERTY ID FROM URL
       ===================================================== */

    const urlParams =
        new URLSearchParams(window.location.search);

    let propertyId =
        String(urlParams.get("id") || "").trim();

    // Fallback: id from localStorage when URL has no ?id=
    if (!propertyId) {
        try {
            const storedProperty = localStorage.getItem("selectedProperty");
            if (storedProperty) {
                if (storedProperty.trim().charAt(0) === "{") {
                    const obj = JSON.parse(storedProperty);
                    propertyId = String(obj && obj.id != null ? obj.id : "");
                } else {
                    propertyId = String(storedProperty);
                }
            }
        } catch (e) {}
    }

    if (!propertyId) {
        showDetailsError(
            "No property selected",
            "Open a listing from the marketplace to view its details."
        );
        return;
    }


    /* =====================================================
       CHECK PROPERTY DATA
       ===================================================== */

    if (!Array.isArray(properties)) {
        showDetailsError(
            "Unable to load properties",
            "Please refresh the page and try again."
        );
        console.error("LeaseAccom: properties data was not loaded.");
        return;
    }

    // Catalog load must never hang the page forever
    if (window.loadLeaseAccomPropertyCatalog) {
        try {
            await withTimeout(window.loadLeaseAccomPropertyCatalog(), 4000);
        } catch (e) {
            console.warn("LeaseAccom: catalog refresh skipped.", e);
        }
    }


    /* =====================================================
       FIND PROPERTY (demo IDs + UUID + localStorage fallback)
       ===================================================== */

    let property = findPropertyById(properties, propertyId);

    if (!property) {
        const fromStorage = readSelectedFromStorage();
        if (fromStorage && String(fromStorage.id) === String(propertyId)) {
            property = fromStorage;
        }
    }


    /* =====================================================
       PROPERTY NOT FOUND
       ===================================================== */

    if (!property || !isPublicProperty(property)) {
        showDetailsError(
            "Property not found",
            "Sorry, we couldn't find the property you're looking for."
        );
        return;
    }


    /* =====================================================
       RECENTLY VIEWED
       Record this property as the most recently viewed.
       ===================================================== */

    if (typeof addRecentlyViewed === "function") {
        addRecentlyViewed(propertyId);
    }


    /* =====================================================
       PRICE FORMAT
       ===================================================== */

    const formattedPrice =
        new Intl.NumberFormat("en-NG").format(
            Number(property.price) || 0
        );


    /* =====================================================
       SAVED PROPERTY
       ===================================================== */

    let savedProperties = [];

    try {

        savedProperties =
            JSON.parse(
                localStorage.getItem(
                    "savedProperties"
                )
            ) || [];

    } catch (error) {

        savedProperties = [];

    }


    const isSaved =
        savedProperties
            .map(String)
            .includes(String(propertyId));


    /* =====================================================
       VERIFIED BADGE
       ===================================================== */

    const isVerified =
        typeof isPropertyVerified === "function"
            ? isPropertyVerified(property)
            : property.verified === true &&
              String(property.verificationStatus || "approved").toLowerCase() !== "rejected";

    const verificationBadge =
        isVerified
            ? `
                <span class="badge">
                    <i class="bx bx-check-circle" aria-hidden="true"></i> Verified Property
                </span>
            `
            : `
                <span class="badge pending-badge">
                    Verification Pending
                </span>
            `;

    const type = property.type || "Property";
    const residentialTypes = ["Apartment", "Studio Apartment", "House", "Duplex", "Shortlet"];
    const isResidential = residentialTypes.includes(type);
    const featureItems = [];

    if (isResidential && Number(property.bedrooms) > 0) {
        featureItems.push(`
            <div class="feature">
                <strong>🛏</strong>
                <span>${property.bedrooms} Bedroom${Number(property.bedrooms) === 1 ? "" : "s"}</span>
            </div>
        `);
    }

    if (Number(property.bathrooms) > 0 && type !== "Land") {
        featureItems.push(`
            <div class="feature">
                <strong>🚿</strong>
                <span>${property.bathrooms} Bathroom${Number(property.bathrooms) === 1 ? "" : "s"}</span>
            </div>
        `);
    }

    if (property.size) {
        featureItems.push(`
            <div class="feature">
                <strong>📐</strong>
                <span>${type === "Land" ? "Land size" : "Space size"}: ${property.size}</span>
            </div>
        `);
    }

    featureItems.push(`
        <div class="feature">
            <strong>${type === "Land" ? "🌳" : type === "Shop" ? "🏪" : type === "Office" ? "💼" : "🏠"}</strong>
            <span>${type}</span>
        </div>
    `);


    /* =====================================================
       AVAILABILITY + AMENITIES
       ===================================================== */

    const availabilityLabel =
        isVerified ? "Available now" : "Pending verification";

    const amenitiesList =
        Array.isArray(property.amenities)
            ? property.amenities.filter(Boolean)
            : [];


    /* =====================================================
       DISCOVERY LISTS (frontend rules only, no AI)
       ===================================================== */

    function isSameProperty(item, compareTo) {
        return String(item && item.id) === String(compareTo && compareTo.id);
    }

    const similarProperties =
        properties
            .filter(item =>
                isPublicProperty(item) &&
                !isSameProperty(item, property) &&
                item.type === property.type
            )
            .sort((a, b) =>
                Math.abs(Number(a.price) - Number(property.price)) -
                Math.abs(Number(b.price) - Number(property.price))
            )
            .slice(0, 3);

    const similarIds = similarProperties.map(item =>
        String(item.id)
    );

    const recommendedProperties =
        properties
            .filter(item =>
                isPublicProperty(item) &&
                !isSameProperty(item, property) &&
                !similarIds.includes(String(item.id)) &&
                (
                    item.city === property.city ||
                    item.state === property.state
                )
            )
            .slice(0, 3);

    const recommendedIds = recommendedProperties.map(item =>
        String(item.id)
    );

    const recentProperties =
        typeof getRecentlyViewedProperties === "function"
            ? getRecentlyViewedProperties()
                .filter(item =>
                    !isSameProperty(item, property) &&
                    !similarIds.includes(String(item.id)) &&
                    !recommendedIds.includes(Number(item.id))
                )
                .slice(0, 3)
            : [];

    function buildDiscoveryCards(list) {
        if (!list.length) {
            return `
                <p class="discovery-empty">
                    No matching properties right now.
                </p>
            `;
        }

        return list
            .map(item => createPropertyCard(item))
            .join("");
    }


    /* =====================================================
       COST BREAKDOWN (UI only — no payments yet)
       ===================================================== */

    const rentDisplay = formattedPrice;
    const periodDisplay = property.period || "year";

    /* =====================================================
       TOTAL COST + TRUST PANEL DATA
       ===================================================== */
    const rentAmount = Number(property.price) || 0;
    const fmtNaira = (n) => "₦" + new Intl.NumberFormat("en-NG").format(Math.max(0, Math.round(Number(n) || 0)));

    // Use explicit fields when present; otherwise sensible NG-style estimates (clearly labeled)
    const hasService = property.serviceCharge != null && property.serviceCharge !== "";
    const hasCaution = property.cautionFee != null && property.cautionFee !== "";
    const hasAgency = property.agencyFee != null && property.agencyFee !== "";
    const hasLegal = property.legalFee != null && property.legalFee !== "";

    const serviceCharge = hasService ? Number(property.serviceCharge) : Math.round(rentAmount * 0.05);
    const cautionFee = hasCaution ? Number(property.cautionFee) : Math.round(rentAmount * 0.1);
    const agencyFee = hasAgency ? Number(property.agencyFee) : 0;
    const legalFee = hasLegal ? Number(property.legalFee) : 0;
    const otherFees = Number(property.otherFees) || 0;

    const totalMoveIn = rentAmount + serviceCharge + cautionFee + agencyFee + legalFee + otherFees;

    const ownerVerified = String(property.ownerVerificationStatus || property.ownerVerified || "").toLowerCase() === "verified"
        || (property.ownerVerified === true)
        || (isVerified && property.verified === true);

    const checks = [
        { ok: isVerified, label: "Listing reviewed by LeaseAccom" },
        { ok: ownerVerified || isVerified, label: "Owner identity status checked" },
        { ok: Array.isArray(property.images) ? property.images.length >= 4 : Boolean(property.image), label: "Multiple photos on listing" },
        { ok: Boolean(property.location || property.city), label: "Location provided" },
        { ok: rentAmount > 0, label: "Rent amount published" },
        { ok: Boolean(property.description && String(property.description).length > 40), label: "Description provided" }
    ];

    const trustScore = checks.filter(c => c.ok).length;
    const trustChecksHtml = checks.map(c => `
        <li class="trust-check ${c.ok ? "is-ok" : "is-miss"}">
            <i class="bx ${c.ok ? "bx-check-circle" : "bx-circle"}" aria-hidden="true"></i>
            <span>${c.label}</span>
        </li>
    `).join("");

    const costRows = [
        { label: `Rent / ${periodDisplay}`, value: fmtNaira(rentAmount), note: "" },
        { label: "Service charge", value: fmtNaira(serviceCharge), note: hasService ? "" : "Estimate (5%) — confirm with owner" },
        { label: "Caution / security deposit", value: fmtNaira(cautionFee), note: hasCaution ? "" : "Estimate (10%) — confirm with owner" },
    ];
    if (agencyFee > 0) costRows.push({ label: "Agency fee", value: fmtNaira(agencyFee), note: hasAgency ? "" : "" });
    if (legalFee > 0) costRows.push({ label: "Legal / agreement fee", value: fmtNaira(legalFee), note: "" });
    if (otherFees > 0) costRows.push({ label: property.otherFeesLabel || "Other fees", value: fmtNaira(otherFees), note: "" });

    const costRowsHtml = costRows.map(r => `
        <div class="cost-row">
            <div class="cost-row-label">
                <span>${r.label}</span>
                ${r.note ? `<small class="cost-estimate-note">${r.note}</small>` : ""}
            </div>
            <strong>${r.value}</strong>
        </div>
    `).join("");


    /* =====================================================
       PROPERTY DETAILS HTML
       ===================================================== */

    detailsContainer.innerHTML = `

        <div class="property-details-layout">


            <!-- =========================================
                 LEFT SIDE
                 ========================================= -->

            <div class="property-details-main">


                <!-- PROPERTY GALLERY (multi-photo carousel) -->

                <div class="property-gallery-carousel" id="propertyGalleryCarousel" data-autoplay="true">
                    <div class="gallery-track" id="galleryTrack">
                        ${(
                            (Array.isArray(property.images) && property.images.length
                                ? property.images
                                : [property.image || ""]
                            ).filter(Boolean)
                        ).map((src, i) => `
                            <div class="gallery-slide">
                                <img src="${src}" alt="${(property.title || "Property")} photo ${i + 1}"
                                    onerror="this.style.opacity=.3">
                            </div>
                        `).join("")}
                    </div>
                    <button type="button" class="gallery-nav prev" id="galleryPrev" aria-label="Previous photo">‹</button>
                    <button type="button" class="gallery-nav next" id="galleryNext" aria-label="Next photo">›</button>
                    <div class="gallery-counter" id="galleryCounter">1 / 1</div>
                    <div class="gallery-dots" id="galleryDots"></div>
                </div>


                <!-- PROPERTY TITLE -->

                <div class="property-heading">

                    <div class="property-heading-top">

                        <div>

                            ${verificationBadge}

                            <div class="property-type">
                                ${property.type || "Property"}
                            </div>

                        </div>


                        <button
                            type="button"
                            class="save-btn details-save-btn ${
                                isSaved ? "saved" : ""
                            }"
                            id="detailsSaveBtn"
                            aria-label="Save property"
                        >
                            ${isSaved ? "♥" : "♡"}
                        </button>

                    </div>


                    <h1>
                        ${property.title || "Untitled Property"}
                    </h1>


                    <div class="property-location">
                        📍
                        ${property.location || property.city || "Nigeria"}
                    </div>

                </div>


                <!-- PROPERTY FEATURES -->

                <div class="property-features">

                    ${featureItems.join("")}

                </div>


                <!-- DESCRIPTION -->

                <section class="details-section">

                    <span class="section-label">
                        ABOUT THIS PROPERTY
                    </span>

                    <h2>
                        Property description
                    </h2>

                    <p>
                        ${
                            property.description ||
                            `This ${
                                property.type || "property"
                            } is located in ${
                                property.location ||
                                property.city ||
                                "Nigeria"
                            }.

                            Contact LeaseAccom to learn more
                            about this property, arrange a
                            viewing, and begin the rental process.`
                        }
                    </p>

                </section>


                <!-- LOCATION -->

                <section class="details-section">

                    <span class="section-label">
                        LOCATION
                    </span>

                    <h2>
                        Property location
                    </h2>

                    <p>
                        📍
                        ${property.location || property.city || "Nigeria"}
                    </p>

                    <div class="map-placeholder">

                        <div>
                            📍
                        </div>

                        <p>
                            Map location will be available
                            when Google Maps is connected.
                        </p>

                    </div>

                </section>


                <!-- AMENITIES -->

                <section class="details-section">

                    <span class="section-label">
                        AMENITIES
                    </span>

                    <h2>
                        What this property offers
                    </h2>

                    ${
                        amenitiesList.length
                            ? `
                                <div class="amenity-grid">
                                    ${amenitiesList
                                        .map(
                                            item => `
                                                <div class="amenity">
                                                    ✓ ${item}
                                                </div>
                                            `
                                        )
                                        .join("")}
                                </div>
                            `
                            : `
                                <p class="amenity-empty">
                                    Amenity details for this listing
                                    will be provided by the property owner.
                                </p>
                            `
                    }

                </section>


                <!-- AVAILABILITY -->

                <section class="details-section">

                    <span class="section-label">
                        AVAILABILITY
                    </span>

                    <h2>
                        Property status
                    </h2>

                    <div class="availability-row">

                        <span
                            class="availability-dot ${
                                isVerified
                                    ? "is-available"
                                    : "is-pending"
                            }"
                        ></span>

                        <strong>
                            ${availabilityLabel}
                        </strong>

                    </div>

                    <p class="availability-note">
                        ${
                            isVerified
                                ? "This listing has been reviewed by LeaseAccom and is open for enquiries."
                                : "This listing is awaiting LeaseAccom review before it becomes fully available."
                        }
                    </p>

                </section>


                <!-- LEASEACCOM TRUST -->

                <section class="details-section trust-section">

                    <span class="section-label">
                        LEASEACCOM TRUST
                    </span>

                    <h2>
                        Why you can trust this listing
                    </h2>

                    <div class="trust-grid">

                        <div class="trust-item">

                            <span class="trust-icon">
                                ${isVerified ? "✓" : "⏳"}
                            </span>

                            <div>

                                <strong>
                                    ${
                                        isVerified
                                            ? "Verified listing"
                                            : "Verification pending"
                                    }
                                </strong>

                                <p>
                                    ${
                                        isVerified
                                            ? "This listing completed LeaseAccom's listing review."
                                            : "This listing has not completed LeaseAccom review yet."
                                    }
                                </p>

                            </div>

                        </div>


                        <div class="trust-item">

                            <span class="trust-icon">
                                
                            </span>

                            <div>

                                <strong>
                                    Owner information available
                                </strong>

                                <p>
                                    ${
                                        property.ownerName
                                            ? `Listed by ${property.ownerName}.`
                                            : "Owner details are shared securely through LeaseAccom."
                                    }
                                </p>

                            </div>

                        </div>


                        <div class="trust-item">

                            <span class="trust-icon">
                                ️
                            </span>

                            <div>

                                <strong>
                                    Secure LeaseAccom communication
                                </strong>

                                <p>
                                    Keep conversations and payments
                                    inside LeaseAccom.
                                </p>

                            </div>

                        </div>

                    </div>

                    <p class="trust-disclaimer">
                        LeaseAccom reviews listing information. We do not
                        claim to have physically inspected a property
                        unless a physical inspection is recorded.
                    </p>

                </section>


            </div>


            <!-- =========================================
                 RIGHT SIDE
                 ========================================= -->

            <aside class="property-details-sidebar">


                <!-- PRICE CARD -->

                <div class="booking-card">

                    <div class="booking-price">

                        <span>
                            ₦${formattedPrice}
                        </span>

                        <small>
                            / ${property.period || "year"}
                        </small>

                    </div>


                    <p class="booking-note">
                        Secure your rental process through LeaseAccom.
                    </p>


                    <button
                        type="button"
                        class="primary-btn full-btn"
                        id="requestViewingBtn"
                    >
                        Request a Viewing
                    </button>


                    <!-- APPLY TO RENT -->

                    <button
                        type="button"
                        class="primary-btn full-btn"
                        id="applyRentBtn"
                    >
                        Apply to Rent
                    </button>


                    <button
                        type="button"
                        class="secondary-btn full-btn"
                        id="contactLandlordBtn"
                    >
                        Contact Property Owner
                    </button>


                    <p class="secure-note">
                        Your personal information is
                        protected by LeaseAccom.
                    </p>

                </div>


                <!-- TOTAL COST (move-in clarity) -->
                <div class="cost-breakdown lh-total-cost">
                    <div class="lh-cost-head">
                        <h3>Total cost to move in</h3>
                        <span class="lh-cost-pill">Transparent pricing</span>
                    </div>
                    ${costRowsHtml}
                    <div class="cost-row cost-total">
                        <span>Estimated total (first payment)</span>
                        <strong>${fmtNaira(totalMoveIn)}</strong>
                    </div>
                    <p class="cost-note">
                        Figures marked as estimates should be confirmed with the owner before you pay.
                        Prefer LeaseAccom-protected payment when it goes live — never send money to a random account.
                    </p>
                </div>

                <!-- TRUST PANEL -->
                <div class="lh-trust-panel">
                    <div class="lh-trust-head">
                        <div>
                            <span class="lh-trust-kicker">LeaseAccom trust</span>
                            <h3>${isVerified ? "Verified listing" : "Verification in progress"}</h3>
                        </div>
                        <div class="lh-trust-score" title="Trust checklist score">
                            <strong>${trustScore}</strong><span>/ ${checks.length}</span>
                        </div>
                    </div>
                    <ul class="lh-trust-checks">
                        ${trustChecksHtml}
                    </ul>
                    <div class="lh-trust-owner">
                        <div class="lh-trust-owner-avatar">${(property.ownerName || "O").trim().charAt(0).toUpperCase()}</div>
                        <div>
                            <strong>${property.ownerName || "Property owner"}</strong>
                            <span>${ownerVerified || isVerified ? "Owner status: Verified path" : "Owner status: Standard listing"}</span>
                        </div>
                    </div>
                    <p class="lh-trust-foot">
                        ${isVerified
                            ? "LeaseAccom has reviewed this listing. Always inspect the property and keep conversations in-app."
                            : "This listing is still under review. Extra caution is advised until verification completes."}
                    </p>
                </div>

                <!-- SAFETY + REPORT -->
                <div class="info-card lh-safety-card">
                    <div class="info-icon">🛡️</div>
                    <div>
                        <h3>Stay safe on LeaseAccom</h3>
                        <p>Never pay inspection fees or deposits outside the app to unknown accounts. Use Request Viewing and Apply so there is a record.</p>
                    </div>
                </div>

                <button type="button" class="lh-report-btn" id="reportListingBtn">
                    <i class="bx bx-flag" aria-hidden="true"></i>
                    Report this listing
                </button>


            </aside>

        </div>


        <!-- =========================================
             DISCOVERY
             ========================================= -->

        <section class="discovery-section">

            <div class="section-heading">

                <div>

                    <span class="section-label">
                        SIMILAR PROPERTIES
                    </span>

                    <h2>
                        More like this
                    </h2>

                </div>

            </div>

            <div class="property-grid">

                ${buildDiscoveryCards(similarProperties)}

            </div>

        </section>


        <section class="discovery-section">

            <div class="section-heading">

                <div>

                    <span class="section-label">
                        RECOMMENDED FOR YOU
                    </span>

                    <h2>
                        You may also like
                    </h2>

                </div>

            </div>

            <div class="property-grid">

                ${buildDiscoveryCards(recommendedProperties)}

            </div>

        </section>


        ${
            recentProperties.length
                ? `
                    <section class="discovery-section">

                        <div class="section-heading">

                            <div>

                                <span class="section-label">
                                    RECENTLY VIEWED
                                </span>

                                <h2>
                                    Pick up where you left off
                                </h2>

                            </div>

                        </div>

                        <div class="property-grid">

                            ${buildDiscoveryCards(recentProperties)}

                        </div>

                    </section>
                `
                : ""
        }

    `;


    /* =====================================================
       IMAGE LOAD HANDLER
       Reveal the image once loaded, or immediately if already
       loaded, and also on error so it never stays invisible.
       ===================================================== */

    const detailsImage =
        detailsContainer.querySelector(
            ".property-details-image img"
        );

    if (detailsImage) {

        const revealImage = () =>
            detailsImage.classList.add("is-loaded");

        if (
            detailsImage.complete &&
            detailsImage.naturalWidth > 0
        ) {

            revealImage();

        } else {

            detailsImage.addEventListener(
                "load",
                revealImage,
                { once: true }
            );

            detailsImage.addEventListener(
                "error",
                revealImage,
                { once: true }
            );

        }

    }


    /* =====================================================
       GALLERY CAROUSEL (arrows + autoplay 3.5s)
       ===================================================== */
    (function initPropertyGallery() {
        const root = document.getElementById("propertyGalleryCarousel");
        const track = document.getElementById("galleryTrack");
        if (!root || !track) return;
        const slides = Array.from(track.querySelectorAll(".gallery-slide"));
        const n = slides.length;
        if (n === 0) return;
        let index = 0;
        let timer = null;
        const counter = document.getElementById("galleryCounter");
        const dotsWrap = document.getElementById("galleryDots");
        const prev = document.getElementById("galleryPrev");
        const next = document.getElementById("galleryNext");

        if (n <= 1) {
            if (prev) prev.style.display = "none";
            if (next) next.style.display = "none";
        }

        if (dotsWrap) {
            dotsWrap.innerHTML = slides.map((_, i) =>
                `<button type="button" data-i="${i}" aria-label="Go to photo ${i + 1}"></button>`
            ).join("");
        }

        function go(i) {
            index = (i + n) % n;
            track.style.transform = `translateX(-${index * 100}%)`;
            if (counter) counter.textContent = `${index + 1} / ${n}`;
            if (dotsWrap) {
                dotsWrap.querySelectorAll("button").forEach((b, bi) => {
                    b.classList.toggle("active", bi === index);
                });
            }
        }

        function startAuto() {
            stopAuto();
            if (n <= 1) return;
            timer = setInterval(() => go(index + 1), 3500);
        }
        function stopAuto() {
            if (timer) clearInterval(timer);
            timer = null;
        }

        prev?.addEventListener("click", () => { go(index - 1); startAuto(); });
        next?.addEventListener("click", () => { go(index + 1); startAuto(); });
        dotsWrap?.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-i]");
            if (!btn) return;
            go(Number(btn.dataset.i));
            startAuto();
        });
        root.addEventListener("mouseenter", stopAuto);
        root.addEventListener("mouseleave", startAuto);
        root.addEventListener("touchstart", stopAuto, { passive: true });

        go(0);
        startAuto();
    })();



    /* =====================================================
       SAVE BUTTON
       ===================================================== */

    const saveButton =
        document.getElementById(
            "detailsSaveBtn"
        );

    if (saveButton) {

        saveButton.addEventListener(
            "click",
            () => {

                let saved = [];

                try {

                    saved =
                        JSON.parse(
                            localStorage.getItem(
                                "savedProperties"
                            )
                        ) || [];

                } catch (error) {

                    saved = [];

                }


                saved =
                    saved.map(String);


                const index =
                    saved.indexOf(propertyId);


                if (index === -1) {

                    saved.push(propertyId);

                    saveButton.classList.add(
                        "saved"
                    );

                    saveButton.textContent =
                        "♥";

                } else {

                    saved.splice(
                        index,
                        1
                    );

                    saveButton.classList.remove(
                        "saved"
                    );

                    saveButton.textContent =
                        "♡";
                }


                localStorage.setItem(
                    "savedProperties",
                    JSON.stringify(saved)
                );

            }
        );

    }


    /* =====================================================
       VIEWING MODAL
       ===================================================== */

    const viewingModal =
        document.getElementById(
            "viewingModal"
        );

    const requestViewingBtn =
        document.getElementById(
            "requestViewingBtn"
        );

    const closeModal =
        document.getElementById(
            "closeModal"
        );


    /* =====================================================
       OPEN VIEWING MODAL
       ===================================================== */

    if (
        requestViewingBtn &&
        viewingModal
    ) {

        requestViewingBtn.addEventListener(
            "click",
            () => {

                viewingModal.classList.add(
                    "active"
                );

                document.body.classList.add(
                    "modal-open"
                );

            }
        );

    }


    /* =====================================================
       CLOSE VIEWING MODAL
       ===================================================== */

    if (closeModal && viewingModal) {

        closeModal.addEventListener(
            "click",
            () => {

                viewingModal.classList.remove(
                    "active"
                );

                document.body.classList.remove(
                    "modal-open"
                );

            }
        );

    }


    /* =====================================================
       CLOSE VIEWING MODAL OUTSIDE
       ===================================================== */

    if (viewingModal) {

        viewingModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    viewingModal
                ) {

                    viewingModal.classList.remove(
                        "active"
                    );

                    document.body.classList.remove(
                        "modal-open"
                    );

                }

            }
        );

    }


    /* =====================================================
       VIEWING FORM
       ===================================================== */

    const viewingForm =
        document.getElementById(
            "viewingForm"
        );


    if (viewingForm) {

        viewingForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                let currentUser = null;

                try {
                    currentUser = JSON.parse(
                        localStorage.getItem("leaseaccomCurrentUser") || "null"
                    );
                } catch (error) {
                    currentUser = null;
                }

                if (!currentUser || currentUser.accountType !== "tenant") {
                    alert("Please log in as a tenant before requesting a viewing.");
                    window.location.href = "login.html";
                    return;
                }


                const viewerName =
                    document.getElementById(
                        "viewerName"
                    )?.value.trim();


                const viewingDate =
                    document.getElementById(
                        "viewingDate"
                    )?.value;


                let viewingTime =
                    document.getElementById(
                        "viewingTime"
                    )?.value;

                const slotBoxes = Array.from(
                    document.querySelectorAll('input[name="viewingSlot"]:checked')
                ).map(function (el) { return el.value; });
                if (slotBoxes.length) {
                    if (slotBoxes.length > 3) {
                        alert("Please choose up to 3 preferred time slots.");
                        return;
                    }
                    viewingTime = slotBoxes.join(" · ");
                    var hiddenTime = document.getElementById("viewingTime");
                    if (hiddenTime) hiddenTime.value = viewingTime;
                }

                if (
                    !viewerName ||
                    !viewingDate ||
                    !viewingTime
                ) {

                    alert(
                        "Please complete all viewing details (date + at least one time slot)."
                    );

                    return;
                }


                /* =====================================
                   SAVE VIEWING REQUEST
                   ===================================== */

                const viewingRequest = {

                    id: "vr-" + Date.now(),

                    propertyId: String(property.id),

                    propertyTitle: property.title,

                    propertyLocation: property.location || property.city || "",

                    propertyImage: property.image || (Array.isArray(property.images) && property.images[0]) || "",

                    viewerName: viewerName,

                    viewingDate: viewingDate,

                    viewingTime: viewingTime,

                    status: "requested",

                    // Critical for owner dashboard matching
                    ownerId: property.ownerId != null ? String(property.ownerId) : "",
                    ownerName: property.ownerName || "Property Owner",
                    tenantId: currentUser.id != null ? String(currentUser.id) : "",
                    tenantEmail: currentUser.email || "",
                    tenantName: currentUser.name || viewerName,

                    createdAt: new Date().toISOString(),

                    updatedAt: new Date().toISOString(),

                    statusHistory: [{ status: "requested", at: new Date().toISOString(), by: "tenant" }]

                };


                // Optional API — never block localStorage save if API is offline
                try {
                    if (window.LeaseAccomApi && typeof window.LeaseAccomApi.createViewingRequest === "function") {
                        const response = await window.LeaseAccomApi.createViewingRequest({
                            property_id: String(property.id),
                            preferred_date: viewingDate,
                            preferred_time: viewingTime,
                            notes: viewingMessage || viewingRequest.message || ""
                        });
                        const savedViewing = response && (response.viewing_request || response.viewing || response);
                        if (savedViewing && savedViewing.id) {
                            Object.assign(viewingRequest, {
                                id: savedViewing.id,
                                propertyId: savedViewing.property_id || viewingRequest.propertyId,
                                tenantId: savedViewing.tenant_id || viewingRequest.tenantId,
                                ownerId: savedViewing.owner_id || viewingRequest.ownerId,
                                status: savedViewing.status || viewingRequest.status,
                                createdAt: savedViewing.created_at || viewingRequest.createdAt,
                                updatedAt: savedViewing.updated_at || viewingRequest.updatedAt
                            });
                        }
                    }
                } catch (error) {
                    console.warn("LeaseAccom: viewing API unavailable, saved locally.", error);
                }

                if (window.persistViewingRequest) {
                    try {
                        await window.persistViewingRequest(viewingRequest);
                    } catch (error) {
                        console.warn("LeaseAccom: viewing request could not sync to Supabase.", error);
                    }
                }


                let requests = [];

                try {

                    requests =
                        JSON.parse(
                            localStorage.getItem(
                                "viewingRequests"
                            )
                        ) || [];

                } catch (error) {

                    requests = [];

                }


                requests.push(
                    viewingRequest
                );

                if (!Array.isArray(currentUser.viewingRequests)) {
                    currentUser.viewingRequests = [];
                }

                currentUser.viewingRequests.push({
                    ...viewingRequest,
                    name: viewerName,
                    date: viewingDate,
                    time: viewingTime
                });

                localStorage.setItem(
                    "viewingRequests",
                    JSON.stringify(requests)
                );
                if (window.LeaseAccomCloud && typeof window.LeaseAccomCloud.createViewing === "function") {
                    try {
                        await window.LeaseAccomCloud.createViewing({
                            propertyId: viewingRequest.propertyId || property.id,
                            ownerId: viewingRequest.ownerId || property.ownerId,
                            date: viewingRequest.date || viewingRequest.preferredDate,
                            time: viewingRequest.time || viewingRequest.preferredTime,
                            message: viewingRequest.message || ""
                        });
                    } catch (cloudErr) {
                        console.warn("LeaseAccom cloud viewing:", cloudErr);
                    }
                }


                localStorage.setItem(
                    "leaseaccomCurrentUser",
                    JSON.stringify(currentUser)
                );


                /* =====================================
                   CLOSE MODAL
                   ===================================== */

                viewingModal.classList.remove(
                    "active"
                );

                document.body.classList.remove(
                    "modal-open"
                );


                /* =====================================
                   SUCCESS MESSAGE
                   ===================================== */

                alert(
                    `Viewing request submitted!

Property: ${property.title}
Date: ${viewingDate}
Time: ${viewingTime}

LeaseAccom will process your request.`
                );


                viewingForm.reset();

            }
        );

    }


    /* =====================================================
       RENTAL APPLICATION
       ===================================================== */

    const applicationModal =
        document.getElementById(
            "applicationModal"
        );

    const applyRentBtn =
        document.getElementById(
            "applyRentBtn"
        );

    const closeApplicationModal =
        document.getElementById(
            "closeApplicationModal"
        );

    const rentalApplicationForm =
        document.getElementById(
            "rentalApplicationForm"
        );


    /* =====================================================
       OPEN APPLICATION MODAL
       ===================================================== */

    if (
        applyRentBtn &&
        applicationModal
    ) {

        applyRentBtn.addEventListener(
            "click",
            () => {

                applicationModal.classList.add(
                    "active"
                );

                document.body.classList.add(
                    "modal-open"
                );

            }
        );

    }


    /* =====================================================
       CLOSE APPLICATION MODAL
       ===================================================== */

    if (
        closeApplicationModal &&
        applicationModal
    ) {

        closeApplicationModal.addEventListener(
            "click",
            () => {

                applicationModal.classList.remove(
                    "active"
                );

                document.body.classList.remove(
                    "modal-open"
                );

            }
        );

    }


    /* =====================================================
       CLOSE APPLICATION MODAL OUTSIDE
       ===================================================== */

    if (applicationModal) {

        applicationModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    applicationModal
                ) {

                    applicationModal.classList.remove(
                        "active"
                    );

                    document.body.classList.remove(
                        "modal-open"
                    );

                }

            }
        );

    }


    /* =====================================================
       RENTAL APPLICATION FORM
       ===================================================== */

    if (rentalApplicationForm) {

        rentalApplicationForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                let currentUser = null;

                try {
                    currentUser = JSON.parse(
                        localStorage.getItem("leaseaccomCurrentUser") || "null"
                    );
                } catch (error) {
                    currentUser = null;
                }

                if (!currentUser || currentUser.accountType !== "tenant") {
                    alert("Please log in as a tenant before applying.");
                    window.location.href = "login.html";
                    return;
                }


                const applicantName =
                    document.getElementById(
                        "applicantName"
                    )?.value.trim();


                const applicantEmail =
                    document.getElementById(
                        "applicantEmail"
                    )?.value.trim();


                const applicantPhone =
                    document.getElementById(
                        "applicantPhone"
                    )?.value.trim();


                const moveInDate =
                    document.getElementById(
                        "moveInDate"
                    )?.value;


                const applicationMessage =
                    document.getElementById(
                        "applicationMessage"
                    )?.value.trim();


                /* =====================================
                   VALIDATION
                   ===================================== */

                if (
                    !applicantName ||
                    !applicantEmail ||
                    !applicantPhone ||
                    !moveInDate
                ) {

                    alert(
                        "Please complete all required application details."
                    );

                    return;
                }


                /* =====================================
                   GET EXISTING APPLICATIONS
                   ===================================== */

                let applications = [];

                try {

                    const storedApplications = JSON.parse(
                        localStorage.getItem("rentalApplications") || "[]"
                    );

                    applications = Array.isArray(storedApplications)
                        ? storedApplications
                        : [];

                } catch (error) {

                    applications = [];

                }


                /* =====================================
                   PREVENT DUPLICATE APPLICATION
                   ===================================== */

                const alreadyApplied =
                    applications.some(
                        application =>
                            String(application.propertyId) ===
                                String(property.id) &&
                            String(application.applicantEmail || "")
                                .toLowerCase() ===
                                applicantEmail.toLowerCase() &&
                            String(application.status || "pending")
                                .toLowerCase() !==
                                "rejected"
                    );


                if (alreadyApplied) {

                    alert(
                        "You have already submitted an application for this property."
                    );

                    return;
                }


                /* =====================================
                   CREATE APPLICATION
                   ===================================== */

                const rentalApplication = {

                    id:
                        Date.now(),

                    propertyId:
                        property.id,

                    propertyTitle:
                        property.title,

                    propertyImage:
                        property.image || "",

                    propertyLocation:
                        property.location ||
                        property.city ||
                        "Nigeria",

                    propertyPrice:
                        property.price,

                    propertyPeriod:
                        property.period ||
                        "year",

                    ownerName:
                        property.ownerName ||
                        "Property Owner",

                    applicantName:
                        applicantName,

                    applicantEmail:
                        applicantEmail,

                    applicantPhone:
                        applicantPhone,

                    moveInDate:
                        moveInDate,

                    message:
                        applicationMessage,

                    status:
                        "submitted",

                    createdAt:
                        new Date().toISOString()

                };


                // Attach owner + tenant linkage for owner dashboard
                rentalApplication.ownerId = property.ownerId != null ? String(property.ownerId) : (rentalApplication.ownerId || "");
                rentalApplication.ownerName = property.ownerName || rentalApplication.ownerName || "Property Owner";
                rentalApplication.tenantId = currentUser.id != null ? String(currentUser.id) : "";
                rentalApplication.tenantEmail = currentUser.email || rentalApplication.applicantEmail || "";
                rentalApplication.propertyId = String(property.id);
                rentalApplication.status = rentalApplication.status === "requested" ? "submitted" : rentalApplication.status;

                try {
                    if (window.LeaseAccomApi && typeof window.LeaseAccomApi.createApplication === "function") {
                        const response = await window.LeaseAccomApi.createApplication({
                            property_id: String(property.id),
                            applicant_name: rentalApplication.applicantName,
                            applicant_phone: rentalApplication.applicantPhone,
                            move_in_date: rentalApplication.moveInDate,
                            occupants: rentalApplication.occupants,
                            stay_length: rentalApplication.stayLength,
                            income_range: rentalApplication.incomeRange,
                            employment_status: rentalApplication.employmentStatus,
                            message: rentalApplication.message
                        });
                        const savedApplication = response && (response.application || response);
                        if (savedApplication && savedApplication.id) {
                            Object.assign(rentalApplication, {
                                id: savedApplication.id,
                                propertyId: savedApplication.property_id || rentalApplication.propertyId,
                                tenantId: savedApplication.tenant_id || rentalApplication.tenantId,
                                ownerId: savedApplication.owner_id || rentalApplication.ownerId,
                                status: savedApplication.status || rentalApplication.status,
                                createdAt: savedApplication.created_at || rentalApplication.createdAt
                            });
                        }
                    }
                } catch (error) {
                    console.warn("LeaseAccom: application API unavailable, saved locally.", error);
                }

                if (window.persistApplication) {
                    try {
                        await window.persistApplication(rentalApplication);
                    } catch (error) {
                        console.warn("LeaseAccom: application could not sync to Supabase.", error);
                    }
                }


                /* =====================================
                   SAVE APPLICATION
                   ===================================== */

                applications.push(
                    rentalApplication
                );


                localStorage.setItem(
                    "rentalApplications",
                    JSON.stringify(applications)
                );
                if (window.LeaseAccomCloud && typeof window.LeaseAccomCloud.createApplication === "function") {
                    try {
                        await window.LeaseAccomCloud.createApplication({
                            propertyId: rentalApplication.propertyId || property.id,
                            ownerId: rentalApplication.ownerId || property.ownerId,
                            name: rentalApplication.name || rentalApplication.applicantName,
                            email: rentalApplication.email || rentalApplication.applicantEmail,
                            phone: rentalApplication.phone || rentalApplication.applicantPhone,
                            moveInDate: rentalApplication.moveInDate,
                            message: rentalApplication.message || "",
                            propertyTitle: rentalApplication.propertyTitle || property.title
                        });
                    } catch (cloudErr) {
                        console.warn("LeaseAccom cloud application:", cloudErr);
                    }
                }


                if (!Array.isArray(currentUser.applications)) {
                    currentUser.applications = [];
                }

                if (!currentUser.applications.some(id =>
                    String(id) === String(rentalApplication.id)
                )) {
                    currentUser.applications.push(rentalApplication.id);
                }

                localStorage.setItem(
                    "leaseaccomCurrentUser",
                    JSON.stringify(currentUser)
                );

                try {
                    const users = JSON.parse(
                        localStorage.getItem("leaseaccomUsers") || "[]"
                    );
                    const userIndex = Array.isArray(users)
                        ? users.findIndex(user =>
                            String(user.id) === String(currentUser.id)
                        )
                        : -1;

                    if (userIndex !== -1) {
                        users[userIndex] = currentUser;
                        localStorage.setItem(
                            "leaseaccomUsers",
                            JSON.stringify(users)
                        );
                    }
                } catch (error) {
                    console.warn("LeaseAccom tenant data could not be updated.", error);
                }


                /* =====================================
                   CLOSE MODAL
                   ===================================== */

                applicationModal.classList.remove(
                    "active"
                );

                document.body.classList.remove(
                    "modal-open"
                );


                /* =====================================
                   SUCCESS MESSAGE
                   ===================================== */

                if (typeof leaseaccomToast === "function") {
                    leaseaccomToast("Application submitted — pending owner review.");
                } else {
                    alert("Application submitted successfully.");
                }

                rentalApplicationForm.reset();
                applicationModal.classList.remove("active");
                document.body.classList.remove("modal-open");

            }
        );

    }


    /* =====================================================
       CONTACT PROPERTY OWNER
       LeaseAccom Messaging
       ===================================================== */

    const contactLandlordBtn =
        document.getElementById(
            "contactLandlordBtn"
        );


    if (contactLandlordBtn) {

        contactLandlordBtn.addEventListener(
            "click",
            async () => {

                /* Cloud-first conversation (fixes Conversation not found) */
                try {
                    if (window.LeaseAccomCloud && typeof window.LeaseAccomCloud.getOrCreateConversation === "function") {
                        var ownerId = property.ownerId || property.owner_id || property.user_id;
                        if (ownerId) {
                            var cre = await window.LeaseAccomCloud.getOrCreateConversation(property.id, ownerId);
                            if (cre && cre.ok && cre.data && cre.data.id) {
                                var convId = cre.data.id;
                                var list = [];
                                try { list = JSON.parse(localStorage.getItem("leaseaccomMessages") || "[]") || []; } catch (e1) { list = []; }
                                if (!Array.isArray(list)) list = [];
                                if (!list.some(function (c) { return String(c.id) === String(convId); })) {
                                    list.unshift({
                                        id: convId,
                                        propertyId: property.id,
                                        propertyTitle: property.title || "Listing",
                                        propertyImage: property.image || "",
                                        propertyLocation: property.location || property.city || "Nigeria",
                                        ownerName: property.ownerName || "Property Owner",
                                        ownerId: ownerId,
                                        messages: [],
                                        serverBacked: true,
                                        updatedAt: new Date().toISOString()
                                    });
                                    localStorage.setItem("leaseaccomMessages", JSON.stringify(list));
                                }
                                localStorage.setItem("activeConversationId", convId);
                                window.location.href = "messages.html";
                                return;
                            }
                        }
                    }
                } catch (cloudErr) {
                    console.warn("cloud conversation", cloudErr);
                }

                /* -----------------------------------------
                   GET EXISTING CONVERSATIONS
                   ----------------------------------------- */

                let conversations = [];

                try {

                    conversations =
                        JSON.parse(
                            localStorage.getItem(
                                "leaseaccomMessages"
                            )
                        ) || [];

                } catch (error) {

                    console.error(
                        "Unable to load LeaseAccom messages.",
                        error
                    );

                    conversations = [];

                }


                /* -----------------------------------------
                   CREATE CONVERSATION ID
                   ----------------------------------------- */

                const conversationId =
                    `property-${property.id}`;


                /* -----------------------------------------
                   CHECK IF CONVERSATION ALREADY EXISTS
                   ----------------------------------------- */

                const existingConversation =
                    conversations.find(
                        conversation =>
                            conversation.id ===
                            conversationId
                    );


                /* -----------------------------------------
                   CREATE NEW CONVERSATION
                   ----------------------------------------- */

                if (!existingConversation) {

                    conversations.push({

                        id:
                            conversationId,

                        propertyId:
                            property.id,

                        propertyTitle:
                            property.title,

                        propertyImage:
                            property.image || "",

                        propertyLocation:
                            property.location ||
                            property.city ||
                            "Nigeria",

                        ownerName:
                            property.ownerName ||
                            "Property Owner",

                        ownerId:
                            property.ownerId || null,

                        ownerAvatar:
                            property.ownerAvatar || "",

                        ownerPhone:
                            property.ownerPhone || "",

                        ownerBio:
                            property.ownerBio || "",

                        createdAt:
                            new Date().toISOString(),

                        unread: 0,

                        messages: []

                    });


                    localStorage.setItem(
                        "leaseaccomMessages",
                        JSON.stringify(
                            conversations
                        )
                    );

                }


                /* -----------------------------------------
                   REMEMBER SELECTED CONVERSATION
                   ----------------------------------------- */

                localStorage.setItem(
                    "activeConversationId",
                    conversationId
                );


                /* -----------------------------------------
                   OPEN MESSAGES PAGE
                   ----------------------------------------- */

                window.location.href =
                    "messages.html";

            }
        );

    }


    /* =====================================================
       MINIMUM VIEWING DATE
       ===================================================== */

    const viewingDate =
        document.getElementById(
            "viewingDate"
        );


    if (viewingDate) {

        const today =
            new Date()
                .toISOString()
                .split("T")[0];

        viewingDate.min = today;

    }


    /* =====================================================
       MINIMUM MOVE-IN DATE
       ===================================================== */

    const moveInDate =
        document.getElementById(
            "moveInDate"
        );


    if (moveInDate) {

        const today =
            new Date()
                .toISOString()
                .split("T")[0];

        moveInDate.min = today;

    }



    /* =====================================================
       REPORT LISTING
       ===================================================== */
    const reportBtn = document.getElementById("reportListingBtn");
    if (reportBtn) {
        reportBtn.addEventListener("click", () => {
            const reasons = [
                "Suspected scam / fake listing",
                "Photos or details misleading",
                "Wrong price or location",
                "Owner unresponsive / abusive",
                "Property not available",
                "Other"
            ];
            const choice = window.prompt(
                "Report listing — type a number:\\n" +
                reasons.map((r, i) => (i + 1) + ". " + r).join("\\n") +
                "\\n\\nOr type your own reason:"
            );
            if (choice == null || !String(choice).trim()) return;
            let reason = String(choice).trim();
            const num = Number(reason);
            if (num >= 1 && num <= reasons.length) reason = reasons[num - 1];

            const key = "leaseaccomListingReports";
            let reports = [];
            try { reports = JSON.parse(localStorage.getItem(key) || "[]") || []; } catch (e) { reports = []; }
            const reportRow = {
                id: "rep-" + Date.now(),
                propertyId: propertyId,
                property_id: propertyId,
                title: property.title || "",
                reason: reason,
                status: "open",
                at: new Date().toISOString(),
                created_at: new Date().toISOString()
            };
            reports.unshift(reportRow);
            localStorage.setItem(key, JSON.stringify(reports.slice(0, 50)));
            // Cloud
            (async function () {
                try {
                    var client = window.leaseaccomSupabase || window.leasehubSupabase;
                    if (client) {
                        await client.from("reports").insert({
                            property_id: String(propertyId),
                            reason: reason,
                            status: "open",
                            listing_title: property.title || ""
                        });
                    }
                } catch (err) { console.warn("report cloud", err); }
            })();
            reportBtn.textContent = "Report submitted — thank you";
            reportBtn.disabled = true;
            alert("Thanks. LeaseAccom will review this report: " + reason);
        });
    }

});



/* Track property views for owner analytics */
(function trackPropertyViewOnce() {
  try {
    var params = new URLSearchParams(window.location.search);
    var id = params.get("id");
    if (!id) {
      try {
        var sp = JSON.parse(localStorage.getItem("selectedProperty") || "null");
        id = sp && (sp.id != null ? String(sp.id) : null);
      } catch (e) {}
    }
    if (!id) return;
    var key = "leaseaccomPropertyViews";
    var map = {};
    try { map = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) { map = {}; }
    var day = new Date().toISOString().slice(0, 10);
    if (!map[id]) map[id] = { total: 0, byDay: {} };
    map[id].total = (map[id].total || 0) + 1;
    map[id].byDay[day] = (map[id].byDay[day] || 0) + 1;
    map[id].lastViewedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(map));
    if (window.LeaseAccomCloud && typeof window.LeaseAccomCloud.recordView === "function") {
      try { window.LeaseAccomCloud.recordView(id); } catch (e) {}
    }
    // also bump on stored property list if present
    try {
      var props = JSON.parse(localStorage.getItem("leaseaccomProperties") || localStorage.getItem("leasehubProperties") || "[]");
      if (Array.isArray(props)) {
        props.forEach(function (p) {
          if (String(p.id) === String(id)) {
            p.views = (Number(p.views) || 0) + 1;
          }
        });
        localStorage.setItem("leaseaccomProperties", JSON.stringify(props));
      }
    } catch (e2) {}
  } catch (err) {}
})();
