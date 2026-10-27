/* =========================================================
   LEASEACCOM RENTAL AGREEMENT ENGINE
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    const agreementContent =
        document.getElementById("agreementContent");

    const agreementDate =
        document.getElementById("agreementDate");

    const agreementSubtitle =
        document.getElementById("agreementSubtitle");

    const ownerSignature =
        document.getElementById("ownerSignature");

    const tenantSignature =
        document.getElementById("tenantSignature");

    const ownerAgreeBtn =
        document.getElementById("ownerAgreeBtn");

    const tenantAgreeBtn =
        document.getElementById("tenantAgreeBtn");

    const finalStatus =
        document.getElementById("agreementFinalStatus");


    if (!agreementContent) {
        return;
    }


    /* =====================================================
       GET AGREEMENT ID
       ===================================================== */

    const params =
        new URLSearchParams(window.location.search);

    const applicationId =
        params.get("applicationId");


    if (!applicationId) {

        agreementContent.innerHTML = `
            <div class="dashboard-empty">
                <h3>
                    Agreement not found
                </h3>

                <p>
                    No rental application was provided.
                </p>
            </div>
        `;

        return;
    }


    /* =====================================================
       GET APPLICATION
       ===================================================== */

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


    let application =
        applications.find(
            item =>
                String(item.id) ===
                String(applicationId)
        );

    let backendMode = false;
    let backendAgreement = null;
    let backendLoadError = null;
    let currentUser = null;
    try {
        currentUser = JSON.parse(localStorage.getItem("leaseaccomCurrentUser") || "null");
    } catch (error) {
        currentUser = null;
    }

    if (window.LeaseAccomApi && window.LeaseAccomAuth) {
        try {
            const token = await window.LeaseAccomAuth.getAccessToken();
            if (token) {
                const response = await window.LeaseAccomApi.request(
                    `/applications/${encodeURIComponent(applicationId)}`
                );
                const record = response.application;
                application = {
                    ...application,
                    id: record.id,
                    propertyId: record.property_id,
                    propertyTitle: record.property_title,
                    propertyImage: record.property_image,
                    propertyLocation: record.property_location,
                    propertyPrice: record.property_price,
                    propertyPeriod: record.property_period,
                    ownerId: record.owner_id,
                    ownerName: record.owner_name,
                    applicantName: record.applicant_name,
                    applicantEmail: record.applicant_email,
                    applicantPhone: record.applicant_phone,
                    moveInDate: record.move_in_date,
                    stayLength: record.stay_length,
                    tenantId: record.tenant_id,
                    status: record.status
                };
                backendMode = true;
            }
        } catch (error) {
            backendLoadError = error;
        }
    }


    if (!application) {

        agreementContent.innerHTML = `
            <div class="dashboard-empty">
                <h3>
                    ${backendLoadError ? "Agreement could not be loaded" : "Application not found"}
                </h3>

                <p>
                    ${backendLoadError ? escapeHTML(backendLoadError.message) : "This rental application could not be found."}
                </p>
            </div>
        `;

        return;
    }


    /* =====================================================
       ONLY ACCEPTED APPLICATIONS CAN CREATE AGREEMENTS
       ===================================================== */

    if (application.status !== "accepted") {

        agreementContent.innerHTML = `
            <div class="dashboard-empty">

                <h3>
                    Agreement not available yet
                </h3>

                <p>
                    The rental application must be accepted
                    by the property owner before an agreement
                    can be generated.
                </p>

            </div>
        `;

        ownerAgreeBtn.style.display = "none";
        tenantAgreeBtn.style.display = "none";

        return;
    }


    /* =====================================================
       FIND PROPERTY
       ===================================================== */

    let properties = [];

    try {
        const storedProperties = JSON.parse(
            localStorage.getItem("leaseaccomProperties") || "[]"
        );
        properties = Array.isArray(storedProperties)
            ? storedProperties
            : [];
    } catch (error) {
        properties = [];
    }


    let property =
        properties.find(
            item =>
                String(item.id) ===
                String(application.propertyId)
        );

    if (!property && backendMode) {
        property = {
            id: application.propertyId,
            title: application.propertyTitle,
            image: application.propertyImage,
            location: application.propertyLocation,
            price: application.propertyPrice,
            period: application.propertyPeriod,
            ownerName: application.ownerName
        };
    }


    if (!property) {

        agreementContent.innerHTML = `
            <div class="dashboard-empty">

                <h3>
                    Property not found
                </h3>

                <p>
                    The property connected to this application
                    could not be found.
                </p>

            </div>
        `;

        return;
    }


    /* =====================================================
       OWNER PROFILE
       ===================================================== */

    let ownerProfile = {};

    try {
        ownerProfile = JSON.parse(
            localStorage.getItem("leaseaccomOwnerProfile") || "{}"
        ) || {};
    } catch (error) {
        ownerProfile = {};
    }


    const ownerName =
        application.ownerName ||
        property.ownerName ||
        ownerProfile.name ||
        ownerProfile.fullName ||
        "Property Owner";


    /* =====================================================
       DETERMINE AGREEMENT TYPE
       ===================================================== */

    const propertyType =
        String(
            property.type ||
            ""
        ).toLowerCase();


    const period =
        String(
            property.period ||
            application.propertyPeriod ||
            "year"
        ).toLowerCase();


    let agreementType =
        "Residential Rental Agreement";


    if (
        propertyType.includes("shortlet") ||
        period.includes("day") ||
        period.includes("night") ||
        period.includes("week")
    ) {

        agreementType =
            "Shortlet Rental Agreement";

    }

    else if (
        propertyType.includes("office") ||
        propertyType.includes("commercial") ||
        propertyType.includes("shop") ||
        propertyType.includes("warehouse") ||
        propertyType.includes("business")
    ) {

        agreementType =
            "Commercial Rental Agreement";

    }


    /* =====================================================
       DATE FORMATTING
       ===================================================== */

    function formatDate(dateValue) {

        if (!dateValue) {
            return "Not specified";
        }

        const date =
            new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "Not specified";
        }

        return date.toLocaleDateString(
            "en-NG",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );

    }


    function formatMoney(value) {

        const number =
            Number(value);

        if (Number.isNaN(number)) {
            return "Not specified";
        }

        return new Intl.NumberFormat(
            "en-NG",
            {
                style: "currency",
                currency: "NGN",
                maximumFractionDigits: 0
            }
        ).format(number);

    }


    /* =====================================================
       GENERATE AGREEMENT
       ===================================================== */

    const generatedDate =
        formatDate(
            new Date().toISOString()
        );


    agreementDate.textContent =
        generatedDate;


    agreementSubtitle.textContent =
        `${agreementType} for ${property.title}`;


    ownerSignature.textContent =
        ownerName;


    tenantSignature.textContent =
        application.applicantName ||
        "Tenant";


    let agreementTerms = "";


    if (
        agreementType ===
        "Shortlet Rental Agreement"
    ) {

        agreementTerms = `

            <h3>
                1. Rental Property
            </h3>

            <p>
                This agreement relates to
                <strong>
                    ${escapeHTML(property.title)}
                </strong>,
                located at
                <strong>
                    ${escapeHTML(
                        property.location ||
                        property.city ||
                        property.state ||
                        "Nigeria"
                    )}
                </strong>.
            </p>


            <h3>
                2. Parties
            </h3>

            <p>
                Property Owner:
                <strong>
                    ${escapeHTML(ownerName)}
                </strong>
            </p>

            <p>
                Tenant/Guest:
                <strong>
                    ${escapeHTML(
                        application.applicantName
                    )}
                </strong>
            </p>


            <h3>
                3. Rental Period
            </h3>

            <p>
                The agreed move-in/check-in date is
                <strong>
                    ${formatDate(
                        application.moveInDate
                    )}
                </strong>.
            </p>


            <h3>
                4. Rental Price
            </h3>

            <p>
                The listed rental price is
                <strong>
                    ${formatMoney(property.price)}
                </strong>
                per
                <strong>
                    ${escapeHTML(
                        property.period ||
                        "rental period"
                    )}
                </strong>.
            </p>


            <h3>
                5. Property Use
            </h3>

            <p>
                The property shall be used only for the
                purpose agreed between the owner and tenant.
                The tenant must comply with applicable
                property rules and reasonable house rules.
            </p>


            <h3>
                6. Property Care
            </h3>

            <p>
                The tenant is expected to take reasonable
                care of the property and report significant
                problems to the owner.
            </p>


            <h3>
                7. Additional Terms
            </h3>

            <p>
                Any additional rules, deposits,
                cancellation conditions or services should
                be agreed by both parties before payment.
            </p>

        `;

    }

    else if (
        agreementType ===
        "Commercial Rental Agreement"
    ) {

        agreementTerms = `

            <h3>
                1. Premises
            </h3>

            <p>
                This agreement relates to
                <strong>
                    ${escapeHTML(property.title)}
                </strong>,
                located at
                <strong>
                    ${escapeHTML(
                        property.location ||
                        property.city ||
                        property.state ||
                        "Nigeria"
                    )}
                </strong>.
            </p>


            <h3>
                2. Parties
            </h3>

            <p>
                Property Owner:
                <strong>
                    ${escapeHTML(ownerName)}
                </strong>
            </p>

            <p>
                Tenant/Business:
                <strong>
                    ${escapeHTML(
                        application.applicantName
                    )}
                </strong>
            </p>


            <h3>
                3. Commencement
            </h3>

            <p>
                The proposed commencement date is
                <strong>
                    ${formatDate(
                        application.moveInDate
                    )}
                </strong>.
            </p>


            <h3>
                4. Rent
            </h3>

            <p>
                The listed rental amount is
                <strong>
                    ${formatMoney(property.price)}
                </strong>
                per
                <strong>
                    ${escapeHTML(
                        property.period ||
                        "rental period"
                    )}
                </strong>.
            </p>


            <h3>
                5. Permitted Use
            </h3>

            <p>
                The premises shall be used for the business
                or commercial purpose agreed by the parties.
                Any material change of use should be agreed
                with the property owner.
            </p>


            <h3>
                6. Maintenance
            </h3>

            <p>
                The responsibilities of the owner and tenant
                for maintenance, utilities and service charges
                should be confirmed before the agreement is
                finalized.
            </p>


            <h3>
                7. Additional Terms
            </h3>

            <p>
                Any applicable deposits, service charges,
                renewal terms, notice periods and additional
                commercial conditions should be confirmed by
                both parties.
            </p>

        `;

    }

    else {

        agreementTerms = `

            <h3>
                1. Rental Property
            </h3>

            <p>
                This agreement relates to
                <strong>
                    ${escapeHTML(property.title)}
                </strong>,
                located at
                <strong>
                    ${escapeHTML(
                        property.location ||
                        property.city ||
                        property.state ||
                        "Nigeria"
                    )}
                </strong>.
            </p>


            <h3>
                2. Parties
            </h3>

            <p>
                Property Owner:
                <strong>
                    ${escapeHTML(ownerName)}
                </strong>
            </p>

            <p>
                Tenant:
                <strong>
                    ${escapeHTML(
                        application.applicantName
                    )}
                </strong>
            </p>


            <h3>
                3. Tenancy Commencement
            </h3>

            <p>
                The proposed tenancy commencement date is
                <strong>
                    ${formatDate(
                        application.moveInDate
                    )}
                </strong>.
            </p>


            <h3>
                4. Rent
            </h3>

            <p>
                The agreed rental amount is
                <strong>
                    ${formatMoney(property.price)}
                </strong>
                per
                <strong>
                    ${escapeHTML(
                        property.period ||
                        "rental period"
                    )}
                </strong>.
            </p>


            <h3>
                5. Use of Property
            </h3>

            <p>
                The tenant shall use the property for
                lawful residential purposes and shall take
                reasonable care of the premises.
            </p>


            <h3>
                6. Maintenance and Utilities
            </h3>

            <p>
                The parties shall confirm their respective
                responsibilities for maintenance, utilities,
                repairs and other property-related costs.
            </p>


            <h3>
                7. Termination and Renewal
            </h3>

            <p>
                The parties shall agree the applicable
                notice, termination and renewal conditions
                before the agreement is finalized.
            </p>


            <h3>
                8. Additional Terms
            </h3>

            <p>
                Any additional conditions agreed between the
                owner and tenant should be recorded before
                final acceptance of this agreement.
            </p>

        `;

    }


    agreementContent.innerHTML = `

        <div class="agreement-introduction">

            <p>
                This LeaseAccom agreement has been generated
                using the information provided in the rental
                application and property listing.
            </p>

            <div class="agreement-summary">

                <div>
                    <span>Property</span>
                    <strong>
                        ${escapeHTML(property.title)}
                    </strong>
                </div>

                <div>
                    <span>Property type</span>
                    <strong>
                        ${escapeHTML(
                            property.type ||
                            "Property"
                        )}
                    </strong>
                </div>

                <div>
                    <span>Location</span>
                    <strong>
                        ${escapeHTML(
                            property.location ||
                            property.city ||
                            property.state ||
                            "Nigeria"
                        )}
                    </strong>
                </div>

                <div>
                    <span>Rent</span>
                    <strong>
                        ${formatMoney(property.price)}
                        /
                        ${escapeHTML(
                            property.period ||
                            "period"
                        )}
                    </strong>
                </div>

                <div>
                    <span>Move-in date</span>
                    <strong>
                        ${formatDate(
                            application.moveInDate
                        )}
                    </strong>
                </div>

            </div>

        </div>


        <div class="agreement-terms">

            ${agreementTerms}

        </div>


        <div class="agreement-notice">

            <strong>
                Important
            </strong>

            <p>
                This prototype agreement is generated from
                LeaseAccom application data and is intended for
                product testing. It should be reviewed by a
                qualified legal professional before being used
                as a legally binding rental agreement.
            </p>

        </div>

    `;


    /* =====================================================
       SAVE AGREEMENT
       ===================================================== */

    let agreements = [];

    try {
        const storedAgreements = JSON.parse(
            localStorage.getItem("leaseaccomAgreements") || "[]"
        );
        agreements = Array.isArray(storedAgreements)
            ? storedAgreements
            : [];
    } catch (error) {
        agreements = [];
    }


    let agreement =
        agreements.find(
            item =>
                String(item.applicationId) ===
                String(application.id)
        );


    if (backendMode) {
        try {
            const response = await window.LeaseAccomApi.request("/agreements");
            backendAgreement = (response.agreements || []).find((item) =>
                String(item.application_id) === String(application.id)
            );

            if (!backendAgreement) {
                const requestedStay = String(application.stayLength || "");
                const requestedValue = Number(requestedStay.match(/\d+/)?.[0]) || 1;
                const termMonths = /month/i.test(requestedStay)
                    ? requestedValue
                    : requestedValue * 12;
                const created = await window.LeaseAccomApi.request("/agreements", {
                    method: "POST",
                    body: {
                        application_id: String(application.id),
                        term_months: Math.max(1, termMonths),
                        start_date: application.moveInDate || null
                    }
                });
                backendAgreement = created.agreement;
            }

            agreement = {
                id: backendAgreement.id,
                applicationId: backendAgreement.application_id,
                propertyId: backendAgreement.property_id,
                propertyTitle: application.propertyTitle || property.title,
                agreementType,
                ownerName,
                tenantName: application.applicantName,
                rent: backendAgreement.monthly_rent,
                period: backendAgreement.property_period || property.period || "year",
                moveInDate: backendAgreement.start_date || application.moveInDate,
                status: backendAgreement.status,
                ownerAgreed: Boolean(backendAgreement.owner_agreed),
                tenantAgreed: Boolean(backendAgreement.tenant_agreed),
                ownerAgreedAt: backendAgreement.owner_agreed_at,
                tenantAgreedAt: backendAgreement.tenant_agreed_at,
                createdAt: backendAgreement.created_at
            };
        } catch (error) {
            agreementContent.innerHTML = `
                <div class="dashboard-empty">
                    <h3>Agreement could not be loaded</h3>
                    <p>${escapeHTML(error.message || "The agreement service is unavailable.")}</p>
                </div>
            `;
            ownerAgreeBtn.disabled = true;
            tenantAgreeBtn.disabled = true;
            return;
        }
    }


    if (!agreement && !backendMode) {

        agreement = {

            id: Date.now(),

            applicationId:
                application.id,

            propertyId:
                property.id,

            propertyTitle:
                property.title,

            agreementType,

            ownerName,

            tenantName:
                application.applicantName,

            rent:
                property.price,

            period:
                property.period || "year",

            moveInDate:
                application.moveInDate,

            status:
                "pending",

            ownerAgreed:
                false,

            tenantAgreed:
                false,

            createdAt:
                new Date().toISOString()

        };


        agreements.push(agreement);


        localStorage.setItem(
            "leaseaccomAgreements",
            JSON.stringify(agreements)
        );

    }


    /* =====================================================
       LOAD AGREEMENT STATUS
       ===================================================== */

    function refreshStatus() {

        if (
            agreement.ownerAgreed
        ) {

            ownerAgreeBtn.disabled = true;
            ownerAgreeBtn.textContent =
                "Owner Agreed";

        }


        if (
            agreement.tenantAgreed
        ) {

            tenantAgreeBtn.disabled = true;
            tenantAgreeBtn.textContent =
                "Tenant Agreed";

        }


        if (
            agreement.ownerAgreed &&
            agreement.tenantAgreed
        ) {

            finalStatus.innerHTML = `
                <strong>
                    ✓ Agreement accepted by both parties
                </strong>

                <p>
                    The agreement is ready for the next
                    LeaseAccom stage: protected payment.
                </p>
            `;

        }

        else {

            const ownerText =
                agreement.ownerAgreed
                    ? "✓ Owner has agreed"
                    : "Waiting for owner";

            const tenantText =
                agreement.tenantAgreed
                    ? "✓ Tenant has agreed"
                    : "Waiting for tenant";


            finalStatus.innerHTML = `
                <strong>
                    Agreement status
                </strong>

                <p>
                    ${ownerText}
                    &nbsp; • &nbsp;
                    ${tenantText}
                </p>
            `;

        }

    }


    async function recordSignature(role) {
        if (backendMode) {
            try {
                const response = await window.LeaseAccomApi.request(
                    `/agreements/${encodeURIComponent(backendAgreement.id)}/sign`,
                    { method: "PATCH" }
                );
                backendAgreement = response.agreement;
                agreement.ownerAgreed = Boolean(backendAgreement.owner_agreed);
                agreement.tenantAgreed = Boolean(backendAgreement.tenant_agreed);
                agreement.ownerAgreedAt = backendAgreement.owner_agreed_at;
                agreement.tenantAgreedAt = backendAgreement.tenant_agreed_at;
                agreement.status = backendAgreement.status;
            } catch (error) {
                window.alert(error.message || "Unable to record your agreement.");
                return;
            }
        } else {
            agreement[`${role}Agreed`] = true;
            agreement[`${role}AgreedAt`] = new Date().toISOString();
            saveAgreement();
        }

        refreshStatus();
    }


    /* =====================================================
       OWNER AGREES
       ===================================================== */

    ownerAgreeBtn.addEventListener(
        "click",
        async () => {
            ownerAgreeBtn.disabled = true;
            await recordSignature("owner");
            if (!agreement.ownerAgreed) ownerAgreeBtn.disabled = false;
        }
    );


    /* =====================================================
       TENANT AGREES
       ===================================================== */

    tenantAgreeBtn.addEventListener(
        "click",
        async () => {
            tenantAgreeBtn.disabled = true;
            await recordSignature("tenant");
            if (!agreement.tenantAgreed) tenantAgreeBtn.disabled = false;
        }
    );

    if (backendMode) {
        const role = String(currentUser?.accountType || "").toLowerCase();
        ownerAgreeBtn.style.display = role === "owner" ? "" : "none";
        tenantAgreeBtn.style.display = role === "tenant" ? "" : "none";
    }


    function saveAgreement() {

        agreements =
            agreements.map(
                item =>
                    String(item.id) ===
                    String(agreement.id)
                        ? agreement
                        : item
            );


        localStorage.setItem(
            "leaseaccomAgreements",
            JSON.stringify(
                agreements
            )
        );

    }


    function escapeHTML(value) {

        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    refreshStatus();

});
