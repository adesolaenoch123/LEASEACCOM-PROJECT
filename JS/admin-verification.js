document.addEventListener("DOMContentLoaded", () => {
    const propertyList = document.getElementById("adminPropertyList");
    const pendingCount = document.getElementById("pendingCount");
    const verifiedCount = document.getElementById("verifiedCount");
    const rejectedCount = document.getElementById("rejectedCount");

    if (!propertyList) return;

    function getProperties() {
        try {
            return JSON.parse(
                localStorage.getItem("leaseaccomProperties")
            ) || [];
        } catch (error) {
            console.error("Unable to load properties:", error);
            return [];
        }
    }

    function saveProperties(properties) {
        localStorage.setItem(
            "leaseaccomProperties",
            JSON.stringify(properties)
        );
    }

    function formatPrice(price) {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            maximumFractionDigits: 0
        }).format(price || 0);
    }

    function renderProperties() {
        const properties = getProperties();

        const getStatus = property =>
            typeof normalizeVerificationStatus === "function"
                ? normalizeVerificationStatus(property)
                : String(property.verificationStatus || "pending").toLowerCase();

        const pending = properties.filter(
            property => getStatus(property) === "pending"
        );

        const verified = properties.filter(
            property => getStatus(property) === "approved"
        );

        const rejected = properties.filter(
            property => getStatus(property) === "rejected"
        );

        if (pendingCount) pendingCount.textContent = pending.length;
        if (verifiedCount) verifiedCount.textContent = verified.length;
        if (rejectedCount) rejectedCount.textContent = rejected.length;

        if (properties.length === 0) {
            propertyList.innerHTML = `
                <div class="admin-empty">
                    <h3>No properties submitted</h3>
                    <p>
                        New property submissions will appear here
                        for verification.
                    </p>
                </div>
            `;
            return;
        }

        propertyList.innerHTML = properties.map(property => {

            const status =
                typeof normalizeVerificationStatus === "function"
                    ? normalizeVerificationStatus(property)
                    : String(property.verificationStatus || "pending").toLowerCase();

            let statusClass = "pending";
            let statusText = "Pending Verification";

            if (status === "approved") {
                statusClass = "approved";
                statusText = "Verified";
            }

            if (status === "rejected") {
                statusClass = "rejected";
                statusText = "Rejected";
            }

            return `
                <article class="admin-property-card">

                    <div class="admin-property-image">
                        <img
                            src="${property.image || "IMAGES/leaseaccom-logo-full.png"}"
                            alt="${property.title || "Property"}"
                        >
                    </div>

                    <div class="admin-property-content">

                        <div class="admin-property-top">

                            <div>
                                <span class="admin-property-type">
                                    ${property.type || "Property"}
                                </span>

                                <h3>
                                    ${property.title || "Untitled Property"}
                                </h3>

                                <p>
                                    <i class="bx bx-map" aria-hidden="true"></i> ${property.location || property.city || "Nigeria"}
                                </p>
                            </div>

                            <span class="verification-status ${statusClass}">
                                ${statusText}
                            </span>

                        </div>

                        <div class="admin-property-details">

                            <div>
                                <strong>Price</strong>
                                <span>
                                    ${formatPrice(property.price)}
                                </span>
                            </div>

                            <div>
                                <strong>Bedrooms</strong>
                                <span>
                                    ${property.bedrooms ?? 0}
                                </span>
                            </div>

                            <div>
                                <strong>Bathrooms</strong>
                                <span>
                                    ${property.bathrooms ?? 0}
                                </span>
                            </div>

                            <div>
                                <strong>Owner</strong>
                                <span>
                                    ${property.ownerName || "Property Owner"}
                                </span>
                            </div>

                        </div>

                        <div class="admin-property-description">
                            <strong>Description</strong>
                            <p>
                                ${property.description || "No description provided."}
                            </p>
                        </div>

                        <div class="admin-property-actions">

                            ${
                                status !== "approved"
                                ? `
                                    <button
                                        class="approve-property-btn"
                                        data-id="${property.id}"
                                    >
                                        <i class="bx bx-check-circle" aria-hidden="true"></i> Approve & Verify
                                    </button>
                                `
                                : ""
                            }

                            ${
                                status !== "rejected"
                                ? `
                                    <button
                                        class="reject-property-btn"
                                        data-id="${property.id}"
                                    >
                                        ✕ Reject
                                    </button>
                                `
                                : `
                                    <button
                                        class="approve-property-btn"
                                        data-id="${property.id}"
                                    >
                                        ✓ Approve Again
                                    </button>
                                `
                            }

                        </div>

                    </div>

                </article>
            `;
        }).join("");

        attachActionButtons();
    }

    function attachActionButtons() {

        document.querySelectorAll(
            ".approve-property-btn"
        ).forEach(button => {

            button.addEventListener("click", () => {

                const propertyId = Number(button.dataset.id);

                const properties = getProperties();

                const property = properties.find(
                    item => Number(item.id) === propertyId
                );

                if (!property) return;

                const confirmed = confirm(
                    `Approve "${property.title}" and give it a Verified badge?`
                );

                if (!confirmed) return;

                property.verified = true;
                property.verificationStatus = "approved";
                property.verificationLabel = "Verified";
                property.listingStatus = "active";

                property.verifiedAt =
                    new Date().toISOString();

                saveProperties(properties);

                renderProperties();

                alert(
                    "Property approved successfully. It now has a Verified badge."
                );
            });
        });

        document.querySelectorAll(
            ".reject-property-btn"
        ).forEach(button => {

            button.addEventListener("click", () => {

                const propertyId = Number(button.dataset.id);

                const properties = getProperties();

                const property = properties.find(
                    item => Number(item.id) === propertyId
                );

                if (!property) return;

                const confirmed = confirm(
                    `Reject "${property.title}"?`
                );

                if (!confirmed) return;

                property.verified = false;
                property.verificationStatus = "rejected";
                property.verificationLabel = "Rejected";
                property.listingStatus = "rejected";

                property.rejectedAt =
                    new Date().toISOString();

                saveProperties(properties);

                renderProperties();

                alert(
                    "Property has been rejected."
                );
            });
        });
    }

    renderProperties();

    // Refresh if another LeaseAccom page changes the properties
    window.addEventListener("storage", event => {

        if (event.key === "leaseaccomProperties") {
            renderProperties();
        }

    });

});