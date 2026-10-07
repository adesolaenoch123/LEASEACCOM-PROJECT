/* =========================================================
   LEASEHUB - PROPERTY DETAILS
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    const detailsContainer =
        document.getElementById("propertyDetails");

    if (!detailsContainer) return;


    function isPublicProperty(listing) {
        return typeof isPropertyPublic === "function"
            ? isPropertyPublic(listing)
            : String(listing?.verificationStatus || "")
                .toLowerCase() !== "rejected";
    }


    /* =====================================================
       GET PROPERTY ID FROM URL
       ===================================================== */

    const urlParams =
        new URLSearchParams(window.location.search);

    const propertyId =
        String(urlParams.get("id") || "");


    /* =====================================================
       CHECK PROPERTY DATA
       ===================================================== */

    if (!Array.isArray(properties)) {

        detailsContainer.innerHTML = `
            <div class="property-loading">
                <h2>Unable to load properties</h2>
                <p>Please refresh the page and try again.</p>
            </div>
        `;

        console.error(
            "LeaseHub: properties data was not loaded."
        );

        return;
    }

    if (window.loadLeaseHubPropertyCatalog) {
        await window.loadLeaseHubPropertyCatalog();
    }


    /* =====================================================
       FIND PROPERTY
       ===================================================== */

    const property =
        properties.find(
            item => String(item.id) === propertyId
        );


    /* =====================================================
       PROPERTY NOT FOUND
       ===================================================== */

    if (!property || !isPublicProperty(property)) {

        detailsContainer.innerHTML = `
            <div class="property-loading">
                <h2>Property not found</h2>

                <p>
                    Sorry, we couldn't find the property
                    you're looking for.
                </p>

                <a
                    href="properties.html"
                    class="primary-btn"
                >
                    Browse Properties
                </a>
            </div>
        `;

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
            .map(Number)
            .includes(propertyId);


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
        return Number(item.id) === Number(compareTo.id);
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
        Number(item.id)
    );

    const recommendedProperties =
        properties
            .filter(item =>
                isPublicProperty(item) &&
                !isSameProperty(item, property) &&
                !similarIds.includes(Number(item.id)) &&
                (
                    item.city === property.city ||
                    item.state === property.state
                )
            )
            .slice(0, 3);

    const recommendedIds = recommendedProperties.map(item =>
        Number(item.id)
    );

    const recentProperties =
        typeof getRecentlyViewedProperties === "function"
            ? getRecentlyViewedProperties()
                .filter(item =>
                    !isSameProperty(item, property) &&
                    !similarIds.includes(Number(item.id)) &&
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
        { ok: isVerified, label: "Listing reviewed by LeaseHub" },
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

                            Contact LeaseHub to learn more
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
                                ? "This listing has been reviewed by LeaseHub and is open for enquiries."
                                : "This listing is awaiting LeaseHub review before it becomes fully available."
                        }
                    </p>

                </section>


                <!-- LEASEHUB TRUST -->

                <section class="details-section trust-section">

                    <span class="section-label">
                        LEASEHUB TRUST
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
                                            ? "This listing completed LeaseHub's listing review."
                                            : "This listing has not completed LeaseHub review yet."
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
                                            : "Owner details are shared securely through LeaseHub."
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
                                    Secure LeaseHub communication
                                </strong>

                                <p>
                                    Keep conversations and payments
                                    inside LeaseHub.
                                </p>

                            </div>

                        </div>

                    </div>

                    <p class="trust-disclaimer">
                        LeaseHub reviews listing information. We do not
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
                        Secure your rental process through LeaseHub.
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
                        protected by LeaseHub.
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
                        Prefer LeaseHub-protected payment when it goes live — never send money to a random account.
                    </p>
                </div>

                <!-- TRUST PANEL -->
                <div class="lh-trust-panel">
                    <div class="lh-trust-head">
                        <div>
                            <span class="lh-trust-kicker">LeaseHub trust</span>
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
                            ? "LeaseHub has reviewed this listing. Always inspect the property and keep conversations in-app."
                            : "This listing is still under review. Extra caution is advised until verification completes."}
                    </p>
                </div>

                <!-- SAFETY + REPORT -->
                <div class="info-card lh-safety-card">
                    <div class="info-icon">🛡️</div>
                    <div>
                        <h3>Stay safe on LeaseHub</h3>
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
                    saved.map(Number);


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
            event => {

                event.preventDefault();

                let currentUser = null;

                try {
                    currentUser = JSON.parse(
                        localStorage.getItem("leasehubCurrentUser") || "null"
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


                const viewingTime =
                    document.getElementById(
                        "viewingTime"
                    )?.value;


                if (
                    !viewerName ||
                    !viewingDate ||
                    !viewingTime
                ) {

                    alert(
                        "Please complete all viewing details."
                    );

                    return;
                }


                /* =====================================
                   SAVE VIEWING REQUEST
                   ===================================== */

                const viewingRequest = {

                    id:
                        Date.now(),

                    propertyId:
                        property.id,

                    propertyTitle:
                        property.title,

                    viewerName:
                        viewerName,

                    viewingDate:
                        viewingDate,

                    viewingTime:
                        viewingTime,

                    status:
                        "requested",

                    createdAt:
                        new Date().toISOString(),

                    updatedAt:
                        new Date().toISOString(),

                    statusHistory: [{ status: "requested", at: new Date().toISOString(), by: "tenant" }]

                };


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

                localStorage.setItem(
                    "leasehubCurrentUser",
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

LeaseHub will process your request.`
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
            event => {

                event.preventDefault();

                let currentUser = null;

                try {
                    currentUser = JSON.parse(
                        localStorage.getItem("leasehubCurrentUser") || "null"
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
                            Number(application.propertyId) ===
                                Number(property.id) &&
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
                        "requested",

                    createdAt:
                        new Date().toISOString()

                };


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

                if (!Array.isArray(currentUser.applications)) {
                    currentUser.applications = [];
                }

                if (!currentUser.applications.some(id =>
                    String(id) === String(rentalApplication.id)
                )) {
                    currentUser.applications.push(rentalApplication.id);
                }

                localStorage.setItem(
                    "leasehubCurrentUser",
                    JSON.stringify(currentUser)
                );

                try {
                    const users = JSON.parse(
                        localStorage.getItem("leasehubUsers") || "[]"
                    );
                    const userIndex = Array.isArray(users)
                        ? users.findIndex(user =>
                            String(user.id) === String(currentUser.id)
                        )
                        : -1;

                    if (userIndex !== -1) {
                        users[userIndex] = currentUser;
                        localStorage.setItem(
                            "leasehubUsers",
                            JSON.stringify(users)
                        );
                    }
                } catch (error) {
                    console.warn("LeaseHub tenant data could not be updated.", error);
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

                if (typeof leaseHubToast === "function") {
                    leaseHubToast("Application submitted — pending owner review.");
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
       LeaseHub Messaging
       ===================================================== */

    const contactLandlordBtn =
        document.getElementById(
            "contactLandlordBtn"
        );


    if (contactLandlordBtn) {

        contactLandlordBtn.addEventListener(
            "click",
            () => {

                /* -----------------------------------------
                   GET EXISTING CONVERSATIONS
                   ----------------------------------------- */

                let conversations = [];

                try {

                    conversations =
                        JSON.parse(
                            localStorage.getItem(
                                "leasehubMessages"
                            )
                        ) || [];

                } catch (error) {

                    console.error(
                        "Unable to load LeaseHub messages.",
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
                        "leasehubMessages",
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

            const key = "leasehubListingReports";
            let reports = [];
            try { reports = JSON.parse(localStorage.getItem(key) || "[]") || []; } catch (e) { reports = []; }
            reports.unshift({
                id: "rep-" + Date.now(),
                propertyId: propertyId,
                title: property.title || "",
                reason: reason,
                at: new Date().toISOString()
            });
            localStorage.setItem(key, JSON.stringify(reports.slice(0, 50)));
            reportBtn.textContent = "Report submitted — thank you";
            reportBtn.disabled = true;
            alert("Thanks. LeaseHub will review this report: " + reason);
        });
    }

});

