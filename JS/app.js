document.addEventListener("DOMContentLoaded", () => {

    const featuredContainer =
        document.getElementById("featuredProperties");

    const searchBtn =
        document.getElementById("searchBtn");

    const locationInput =
        document.getElementById("locationSearch");

    const propertyType =
        document.getElementById("propertyType");

    const budget =
        document.getElementById("budget");


   /* ================= PROPERTY CARD ================= */

function createPropertyCard(property) {

    const saved =
        JSON.parse(localStorage.getItem("savedProperties")) || [];

    const isSaved =
        saved.includes(property.id);

    const price =
        new Intl.NumberFormat("en-NG").format(property.price);

    // =========================
    // VERIFICATION STATUS
    // =========================

    const isVerified =
        typeof isLeaseAccomPropertyVerified === "function"
            ? isLeaseAccomPropertyVerified(property)
            : property.verified === true &&
              String(property.verificationStatus || "approved").toLowerCase() !== "rejected";

    const isRejected =
        typeof isLeaseAccomPropertyPublic === "function"
            ? !isLeaseAccomPropertyPublic(property)
            : String(property.verificationStatus || "").toLowerCase() === "rejected";

    // Rejected properties should not appear
    // on the public marketplace.
    if (isRejected) {
        return "";
    }

    return `

        <article
            class="property-card"
            onclick="openProperty('${String(property.id).replace(/'/g, "")}')"
        >

            <div class="property-image">

                <img
                    src="${property.image}"
                    alt="${property.title}"
                    loading="lazy"
                >

                ${
                    isVerified
                    ?
                    `
                    <div class="badge la-verified-badge" title="Reviewed and approved on LeaseAccom">
                        ✓ Verified
                    </div>
                    `
                    :
                    `
                    <div class="badge pending-badge">
                        Under review
                    </div>
                    `
                }

                <button
                    class="save-btn ${isSaved ? "saved" : ""}"
                    data-id="${property.id}"
                    aria-label="Save property"
                    onclick="event.stopPropagation()"
                >
                    ${isSaved ? "♥" : "♡"}
                </button>

                <button
                    class="compare-card-btn"
                    data-compare-id="${property.id}"
                    aria-label="Add property to comparison"
                    onclick="event.stopPropagation()"
                    type="button"
                >
                    Compare
                </button>

            </div>


            <div class="property-info">

                <div class="property-type">
                    ${property.type}
                </div>

                <h3>
                    ${property.title}
                </h3>

                <div class="property-location">
                    <i class="bx bx-map" aria-hidden="true"></i> ${property.location}
                </div>

                <div class="property-price">

                    ₦${price}

                    <span>
                        / ${property.period}
                    </span>

                </div>

                <div class="property-meta">

                    ${
                        property.bedrooms > 0
                        ?
                        `
                        <span>
                            <i class="bx bx-bed" aria-hidden="true"></i> ${property.bedrooms} beds
                        </span>
                        `
                        :
                        ""
                    }

                    <span>
                        <i class="bx bx-bath" aria-hidden="true"></i> ${property.bathrooms} baths
                    </span>

                </div>

            </div>

        </article>
    `;
}


/* ================= LOAD FEATURED ================= */

function loadFeatured() {
    // Enterprise spotlight: owners on enterprise plan + featured flag rank first


    if (!featuredContainer) return;

    function planRank(p) {
        var plan = String(p.ownerPlan || p.owner_plan || p.plan || "").toLowerCase();
        var featured = p.featured === true || p.featured === "true" || p.is_featured;
        // Enterprise partners first, then admin-featured, then Business, then rest
        if (plan === "enterprise" || featured) return featured && plan === "enterprise" ? 0 : plan === "enterprise" ? 1 : 2;
        if (plan === "business") return 3;
        if (plan === "professional") return 4;
        return 5;
    }

    // Enrich with owner plan from profiles cache if present
    var planByOwner = window.__leaseaccomOwnerPlans || {};
    var list = properties
        .filter(isLeaseAccomPropertyPublic)
        .map(function (p) {
            var oid = p.ownerId || p.owner_id || p.userId;
            if (oid && planByOwner[oid] && !p.ownerPlan) {
                return Object.assign({}, p, { ownerPlan: planByOwner[oid] });
            }
            return p;
        })
        .sort(function (a, b) {
            var ra = planRank(a);
            var rb = planRank(b);
            if (ra !== rb) return ra - rb;
            return 0;
        })
        .slice(0, 6);

    if (!list.length) {
        featuredContainer.innerHTML =
            '<div class="empty-state" style="padding:28px 16px;text-align:center;color:#66706a;grid-column:1/-1">' +
            '<p style="margin:0 0 8px;font-weight:700;color:#101311">No live listings yet</p>' +
            '<p style="margin:0;font-size:14px">Approved properties will appear here. Enterprise partners appear first.</p>' +
            '</div>';
        return;
    }
    featuredContainer.innerHTML =
        list
            .map(createPropertyCard)
            .join("");

    activateSaveButtons();
}

// Load owner plans for featured ranking (non-blocking)
(function loadOwnerPlansForFeatured() {
    var client = window.leaseaccomSupabase || window.leasehubSupabase;
    if (!client) return;
    client
        .from("profiles")
        .select("id, plan, subscription_plan")
        .eq("account_type", "owner")
        .then(function (res) {
            if (!res.data) return;
            window.__leaseaccomOwnerPlans = {};
            res.data.forEach(function (row) {
                window.__leaseaccomOwnerPlans[row.id] = row.plan || row.subscription_plan || "free";
            });
            if (typeof loadFeatured === "function") loadFeatured();
        })
        .catch(function () {});
})();

    /* ================= SAVE PROPERTY ================= */

    function activateSaveButtons() {

        document
            .querySelectorAll(".save-btn")
            .forEach(button => {

                button.addEventListener("click", () => {

                    const id =
                        String(button.dataset.id || "");

                    let saved =
                        JSON.parse(
                            localStorage.getItem("savedProperties")
                        ) || [];

                    if (saved.map(String).includes(id)) {

                        saved =
                            saved.filter(
                                propertyId =>
                                    String(propertyId) !== id
                            );

                        button.classList.remove("saved");
                        button.textContent = "♡";

                    } else {

                        saved.push(id);

                        button.classList.add("saved");
                        button.textContent = "♥";
                    }

                    localStorage.setItem(
                        "savedProperties",
                        JSON.stringify(saved)
                    );

                });

            });

        document
            .querySelectorAll(".compare-card-btn")
            .forEach(button => {
                button.addEventListener("click", () => {
                    const id = Number(button.dataset.compareId);
                    const selected = getComparedProperties();

                    if (selected.includes(id)) {
                        saveComparedProperties(selected.filter(propertyId => propertyId !== id));
                    } else if (selected.length < 3) {
                        saveComparedProperties([...selected, id]);
                    }

                    updateCompareTray();
                });
            });

    }


    /* ================= SEARCH ================= */

    if (searchBtn) {

        searchBtn.addEventListener("click", () => {

            const location =
                locationInput.value
                    .trim()
                    .toLowerCase();

            const type =
                propertyType.value;

            const maxBudget =
                budget.value === "all"
                    ? Infinity
                    : Number(budget.value);


            const results =
                properties.filter(property => {

                    const locationMatch =
                        !location ||
                        property.location
                            .toLowerCase()
                            .includes(location) ||
                        property.city
                            .toLowerCase()
                            .includes(location);

                    const typeMatch =
                        type === "all" ||
                        property.type === type;

                    const budgetMatch =
                        property.price <= maxBudget;

                    return (
                        locationMatch &&
                        typeMatch &&
                        budgetMatch
                    );

                });


            if (results.length === 0) {

                alert(
                    "No demo properties matched your search. Try another location or budget."
                );

                return;
            }


            localStorage.setItem(
                "leaseaccomSearchResults",
                JSON.stringify(results)
            );


            window.location.href =
                "properties.html";

        });

    }


    /* ================= AI ASSISTANT ================= */

    const assistantPanel = document.getElementById("assistantPanel");
    const assistantLauncher = document.getElementById("assistantLauncher");
    const assistantClose = document.getElementById("assistantClose");
    const assistantForm = document.getElementById("assistantForm");
    const assistantInput = document.getElementById("assistantInput");
    const assistantMessages = document.getElementById("assistantMessages");
    let lastAssistantRequest = null;

    function addAssistantMessage(message, sender = "ai") {
        const bubble = document.createElement("div");
        bubble.className = `assistant-message assistant-message-${sender}`;
        bubble.textContent = message;
        assistantMessages.appendChild(bubble);
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
    }


    function leaseaccomPlaybookReply(query) {
        const q = String(query || "").toLowerCase();
        const user = (() => { try { return JSON.parse(localStorage.getItem("leaseaccomCurrentUser") || localStorage.getItem("leaseaccomCurrentUser") || "null"); } catch { return null; } })();
        const isOwner = user && String(user.accountType || "").toLowerCase() === "owner";
        const vStatus = String(user?.verificationStatus || user?.ownerVerificationStatus || "unverified").toLowerCase();

        if (/\b(scam|fraud|safe|safety|never pay)\b/.test(q)) {
            return "Stay safe on LeaseAccom:\n1) Prefer Verified owners and Live listings\n2) Use in-app chat and Request Viewing\n3) Never pay inspection fees or deposits to a random personal account\n4) Check Total cost on the property page (rent + service + caution)\n5) Report suspicious listings with Report this listing.";
        }
        if (/\b(verif|badge|kyc|nin|bvn)\b/.test(q)) {
            if (isOwner) {
                if (vStatus === "verified") return "Your owner account is Verified. You can publish listings (they still need Admin Approve → Live).";
                if (vStatus === "pending") return "Your verification is Pending. You cannot publish until admin approves. Open Verification in the owner menu.";
                return "Owners must verify before listing. Open Verification, submit your details, then wait for approval. Listing stays locked until status is Verified.";
            }
            return "Verified means LeaseAccom reviewed the owner/listing path. On a property page open the Trust panel to see checks and total move-in cost. Prefer Verified + Live homes.";
        }
        if (/\b(viewing|inspect|schedule|visit)\b/.test(q)) {
            return "How viewings work:\n1) Open a property → Request a Viewing\n2) Status starts as Requested\n3) Owner can Accept or Decline\n4) After the visit, owner can Mark completed\nYou and the owner see the same status timeline.";
        }
        if (/\b(apply|application|rent this)\b/.test(q)) {
            return "How applications work:\n1) Open property → Apply to Rent\n2) Status: Submitted → Under review → Accepted/Rejected\n3) Track it on your tenant dashboard\nKeep chats in LeaseAccom so there is a record.";
        }
        if (/\b(list|add property|publish|landlord)\b/.test(q) || (isOwner && /\b(how|help)\b/.test(q))) {
            return "Owner listing path:\n1) Complete Verification (must be Verified)\n2) Add property with 8+ clear photos and a real description\n3) Submit → Pending review\n4) Admin Approve → Live on marketplace\nIncomplete or unverified listings stay off the public list.";
        }
        if (/\b(cost|caution|service charge|deposit|budget|how much)\b/.test(q)) {
            return "Move-in cost on LeaseAccom should include:\n• Rent for the period\n• Service charge (if any)\n• Caution / security deposit\n• Other listed fees\nOpen any property → Total cost to move in. Figures marked estimate should be confirmed before you pay.";
        }
        if (/\b(pay|payment|escrow|withdraw)\b/.test(q)) {
            return "Payments: the Payments page is demo for now (Held → Released story). When live, tenants pay through LeaseAccom protection and owners withdraw to a saved bank account. Never send rent to an unknown account outside the app.";
        }
        if (/\b(message|chat|contact)\b/.test(q)) {
            return "Use LeaseAccom Messages to contact owners/tenants. On mobile, open a chat then use Back to return to the conversation list. Keep first contact in-app.";
        }
        return null;
    }

    function parseAssistantRequest(query) {
        const normalizedQuery = query.toLowerCase();
        const location = properties.find((property) =>
            normalizedQuery.includes(property.city.toLowerCase())
        )?.city;
        const typeAliases = [
            ["Studio Apartment", "studio apartment"],
            ["Apartment", "apartment"],
            ["House", "house"],
            ["Duplex", "duplex"],
            ["Shortlet", "shortlet"],
            ["Office", "office space"],
            ["Office", "office"],
            ["Shop", "shop"],
            ["Land", "land"]
        ];
        const type = typeAliases
            .find(([, alias]) => normalizedQuery.includes(alias))?.[0];
        const bedroomMatch = normalizedQuery.match(/(\d+)\s*[- ]?bed(?:room)?s?/);
        const budgetMatch = normalizedQuery.match(/(?:under|below|less than)\s*[₦n]?\s*([\d,.]+)\s*(m|million|k|thousand)?/);

        let maxBudget = Infinity;
        if (budgetMatch) {
            maxBudget = Number(budgetMatch[1].replace(/,/g, ""));
            if (["m", "million"].includes(budgetMatch[2])) maxBudget *= 1000000;
            if (["k", "thousand"].includes(budgetMatch[2])) maxBudget *= 1000;
        }

        return {
            location,
            type,
            bedrooms: bedroomMatch ? Number(bedroomMatch[1]) : null,
            maxBudget
        };
    }

    function findAssistantMatches(query) {
        const playbook = leaseaccomPlaybookReply(query);
        if (playbook) {
            addAssistantMessage(playbook, "ai");
            return [];
        }
        const request = parseAssistantRequest(query);
        const matches = properties.filter((property) => (
            isLeaseAccomPropertyPublic(property) &&
            (!request.location || property.city === request.location) &&
            (!request.type || property.type === request.type) &&
            (!request.bedrooms || property.bedrooms === request.bedrooms) &&
            property.price <= request.maxBudget
        )).slice(0, 3);

        return { request, matches };
    }

    function addAssistantResults(matches) {
        const results = document.createElement("div");
        results.className = "assistant-results";

        matches.forEach((property) => {
            const result = document.createElement("div");
            result.className = "assistant-result";
            result.innerHTML = `
                <strong>${property.title}</strong>
                <span>${property.location} · ₦${new Intl.NumberFormat("en-NG").format(property.price)} / ${property.period}</span>
                <div class="assistant-result-actions">
                    <button type="button" class="assistant-view-property">View</button>
                    <button type="button" class="assistant-save-property">Save</button>
                    <a class="assistant-apply-property" href="apply.html?property=${property.id}">Apply</a>
                    <a class="assistant-contact-property" href="property-details.html?id=${property.id}">View details</a>
                </div>
            `;

            result.querySelector(".assistant-view-property").addEventListener(
                "click",
                () => window.openProperty(property.id)
            );

            result.querySelector(".assistant-save-property").addEventListener(
                "click",
                () => {
                    const saved = JSON.parse(localStorage.getItem("savedProperties")) || [];
                    const propertyId = Number(property.id);
                    const index = saved.map(Number).indexOf(propertyId);
                    const saveButton = result.querySelector(".assistant-save-property");

                    if (index === -1) {
                        saved.push(propertyId);
                        saveButton.textContent = "Saved";
                    } else {
                        saved.splice(index, 1);
                        saveButton.textContent = "Save";
                    }

                    localStorage.setItem("savedProperties", JSON.stringify(saved));
                }
            );

            results.appendChild(result);
        });

        assistantMessages.appendChild(results);
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
    }

    function answerAssistant(query) {
        const normalizedQuery = query.toLowerCase();

        if (/^(hi|hey|hello|good morning|good afternoon|good evening)\b/.test(normalizedQuery)) {
            addAssistantMessage("Hello. I can help you search verified homes, shortlets, and commercial spaces across Nigeria. What are you looking for?");
            return;
        }

        if (/\b(thank you|thanks|thx)\b/.test(normalizedQuery)) {
            addAssistantMessage("You're welcome. I’m here whenever you need help finding a place.");
            return;
        }

        if (/\b(who are you|what are you|what can you do|help)\b/.test(normalizedQuery)) {
            addAssistantMessage("I’m LeaseAccom Assistant. I can chat with you, explain how LeaseAccom works, and find properties by location, type, bedrooms, and budget.");
            return;
        }

        if (/\b(save|saved|favourite|favorite)\b/.test(normalizedQuery) && /\b(property|listing|home|house)\b/.test(normalizedQuery)) {
            addAssistantMessage("Select the heart icon on a property card to save or remove a listing. Saved properties are available from your tenant dashboard.");
            return;
        }

        if (/\b(compare|comparison)\b/.test(normalizedQuery)) {
            addAssistantMessage("Use Compare on up to three property cards, then open the comparison tray to review their type, location, price, rooms, and verification status.");
            return;
        }

        if (/\b(viewing|view a property|schedule a visit)\b/.test(normalizedQuery)) {
            addAssistantMessage("Open a property, select Request Viewing, and choose your preferred date and time. You must be logged in as a tenant.");
            return;
        }

        if (/\b(apply|application)\b/.test(normalizedQuery) && /\b(property|rent|home|house|listing)\b/.test(normalizedQuery)) {
            addAssistantMessage("Open the property you want, select Apply Now, and complete the tenant application form. You need to log in first.");
            return;
        }

        if (/\b(contact|message|chat)\b/.test(normalizedQuery) && /\b(owner|landlord|agent)\b/.test(normalizedQuery)) {
            addAssistantMessage("Open a property and select Contact Owner to start a conversation with the person who listed it.");
            return;
        }

        if (/\b(list|list a property|add a property|become an owner)\b/.test(normalizedQuery)) {
            addAssistantMessage("Create or log in to an owner account, open the owner dashboard, and choose Add Property. New listings go through verification before approval.");
            return;
        }

        if (/\b(verified|verification|safe|trust)\b/.test(normalizedQuery)) {
            addAssistantMessage("Verified badges identify listings approved by LeaseAccom. You can also use the Verified Only filter when browsing properties.");
            return;
        }

        if (/\b(account|register|sign up|login|log in|password)\b/.test(normalizedQuery)) {
            addAssistantMessage("Use Register to create a tenant or owner account, then use Login to access your dashboard and LeaseAccom features.");
            return;
        }

        if (/\b(leaseaccom|how does this work|how it works|safe|verified|agent fee|fees)\b/.test(normalizedQuery) &&
            !/\b(apartment|house|duplex|shortlet|office|shop|bedroom|under|below|rent|property)\b/.test(normalizedQuery)) {
            addAssistantMessage("LeaseAccom connects you directly with property owners and highlights verified listings, helping you find your place without the unnecessary stress.");
            return;
        }

        const { request, matches } = findAssistantMatches(query);
        const hasPropertyIntent = /\b(apartment|house|duplex|shortlet|office|shop|home|property|rent|bedroom|budget|under|below)\b/.test(normalizedQuery);

        if (hasPropertyIntent && !request.location) {
            lastAssistantRequest = query;
            addAssistantMessage("Which city or area would you like to search in?");
            return;
        }

        if (hasPropertyIntent && request.location && request.maxBudget === Infinity) {
            lastAssistantRequest = query;
            addAssistantMessage("What is your maximum budget? You can say something like ₦3m or ₦500k.");
            return;
        }

        if (!hasPropertyIntent && lastAssistantRequest) {
            const followUpQuery = `${lastAssistantRequest} ${query}`;
            const followUp = findAssistantMatches(followUpQuery);
            if (followUp.request.location || followUp.request.type || followUp.request.bedrooms || followUp.request.maxBudget !== Infinity) {
                lastAssistantRequest = followUpQuery;

                if (followUp.request.location && followUp.request.maxBudget === Infinity) {
                    addAssistantMessage("What is your maximum budget? You can say something like ₦3m or ₦500k.");
                    return;
                }

                respondWithAssistantMatches(followUp.request, followUp.matches);
                return;
            }
        }

        if (!hasPropertyIntent && !request.location && !request.type && !request.bedrooms && request.maxBudget === Infinity) {
            addAssistantMessage("I can chat about LeaseAccom or help you find a property. Try “a house in Abuja” or “an apartment under ₦3m”.");
            return;
        }

        lastAssistantRequest = query;
        respondWithAssistantMatches(request, matches);
    }

    function respondWithAssistantMatches(request, matches) {
        const filters = [request.location, request.type, request.bedrooms && `${request.bedrooms}-bedroom`]
            .filter(Boolean)
            .join(", ");

        if (!filters && matches.length === properties.length) {
            addAssistantMessage("Tell me a location, property type, bedroom count, or budget so I can narrow it down.");
            return;
        }

        if (!matches.length) {
            addAssistantMessage("I couldn't find an exact match in the demo listings. Try a wider budget or another location.");
            return;
        }

        addAssistantMessage(`I found ${matches.length} option${matches.length === 1 ? "" : "s"}${filters ? ` for ${filters}` : ""}.`);
        addAssistantResults(matches);
    }

    function openAISearch() {
        if (!assistantPanel) return;
        assistantPanel.classList.add("is-open");
        assistantPanel.setAttribute("aria-hidden", "false");
        assistantLauncher.setAttribute("aria-expanded", "true");
        assistantInput.focus();
    }

    function closeAISearch() {
        assistantPanel.classList.remove("is-open");
        assistantPanel.setAttribute("aria-hidden", "true");
        assistantLauncher.setAttribute("aria-expanded", "false");
    }


    const aiButton =
        document.getElementById("aiSearchBtn");

    const aiButton2 =
        document.getElementById("aiSearchBtn2");


    if (aiButton) {
        aiButton.addEventListener(
            "click",
            openAISearch
        );
    }

    if (aiButton2) {
        aiButton2.addEventListener(
            "click",
            openAISearch
        );
    }

    assistantLauncher?.addEventListener("click", openAISearch);
    assistantClose?.addEventListener("click", closeAISearch);

    assistantForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        const query = assistantInput.value.trim();
        if (!query) return;
        addAssistantMessage(query, "user");
        assistantInput.value = "";
        answerAssistant(query);
    });

    document.querySelectorAll("[data-assistant-prompt]").forEach((button) => {
        button.addEventListener("click", () => {
            const query = button.dataset.assistantPrompt;
            addAssistantMessage(query, "user");
            answerAssistant(query);
        });
    });


    /* Mobile navigation is handled centrally by JS/leaseaccom-polish.js. */


    /* ================= INITIALIZE ================= */

    loadFeatured();

});

function getComparedProperties() {
    try {
        const raw = JSON.parse(localStorage.getItem("compareProperties") || "[]");
        return typeof leaseaccomNormalizeIdList === "function"
            ? leaseaccomNormalizeIdList(raw).slice(0, 3)
            : (Array.isArray(raw) ? raw.map(String).slice(0, 3) : []);
    } catch (e) {
        return [];
    }
}

function saveComparedProperties(ids) {
    const normalized = typeof leaseaccomNormalizeIdList === "function"
        ? leaseaccomNormalizeIdList(ids).slice(0, 3)
        : (Array.isArray(ids) ? ids.map(String).slice(0, 3) : []);
    localStorage.setItem("compareProperties", JSON.stringify(normalized));
}

function updateCompareTray() {
    const tray = document.getElementById("compareTray");
    const selectedContainer = document.getElementById("compareSelected");
    const count = document.getElementById("compareCount");
    const compareButton = document.getElementById("compareBtn");

    if (!tray || !selectedContainer || !count || !compareButton) return;

    const selected = getComparedProperties()
        .map(id => properties.find(property => property.id === id))
        .filter(Boolean);

    tray.classList.toggle("has-selections", selected.length > 0);
    count.textContent = `${selected.length} of 3 selected`;
    compareButton.disabled = selected.length < 2;
    selectedContainer.innerHTML = selected
        .map(property => `<span>${property.title}</span>`)
        .join("");
}

function openComparison() {
    const modal = document.getElementById("compareModal");
    const table = document.getElementById("compareTable");
    const selected = getComparedProperties()
        .map(id => properties.find(property => property.id === id))
        .filter(Boolean);

    if (!modal || !table || selected.length < 2) return;

    const rows = [
        ["Type", property => property.type],
        ["Location", property => property.location],
        ["Price", property => `₦${new Intl.NumberFormat("en-NG").format(property.price)} / ${property.period}`],
        ["Bedrooms", property => property.bedrooms || "N/A"],
        ["Bathrooms", property => property.bathrooms],
        ["Verification", property => property.verified ? "Verified" : "Pending"]
    ];

    table.innerHTML = `<div class="compare-row compare-properties"><span></span>${selected.map(property => `<strong>${property.title}</strong>`).join("")}</div>` +
        rows.map(([label, value]) => `<div class="compare-row"><strong>${label}</strong>${selected.map(property => `<span>${value(property)}</span>`).join("")}</div>`).join("");

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
}

function closeComparison() {
    const modal = document.getElementById("compareModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
}

/* ================= MARKETPLACE ================= */

const marketplaceContainer =
    document.getElementById("marketplaceProperties");

if (marketplaceContainer) {

    const searchInput =
        document.getElementById("marketSearch");

    const searchButton =
        document.getElementById("marketSearchBtn");

    const typeFilter =
        document.getElementById("filterType");

    const budgetFilter =
        document.getElementById("filterBudget");

    const verifiedFilter =
        document.getElementById("verifiedOnly");

    const sortSelect =
        document.getElementById("sortProperties");

    const resultsCount =
        document.getElementById("resultsCount");

    const noResults =
        document.getElementById("noResults");

    const savedOnlyButton =
        document.getElementById("savedOnlyBtn");

    const mapViewButton =
        document.getElementById("mapViewBtn");

    const saveSearchButton =
        document.getElementById("saveSearchBtn");

    const marketToast =
        document.getElementById("marketToast");

    const marketMap =
        document.getElementById("marketMap");

    let savedOnly = false;
    let map;

    const cityCoordinates = {
        Lagos: [6.5244, 3.3792],
        Abuja: [9.0765, 7.3986],
        "Port Harcourt": [4.8156, 7.0498],
        Ibadan: [7.3775, 3.9470],
        "Benin City": [6.3350, 5.6037],
        Enugu: [6.4584, 7.5464],
        Kano: [12.0022, 8.5920],
        Kaduna: [10.5105, 7.4165],
        Nsukka: [6.8567, 7.3950]
    };


    function renderMarketplace() {

        const search =
            searchInput.value
                .trim()
                .toLowerCase();

        const type =
            typeFilter.value;

        const maxBudget =
            budgetFilter.value === "all"
                ? Infinity
                : Number(budgetFilter.value);

        const verified =
            verifiedFilter.checked;


    let results =
        properties.filter(property => {

            if (!isLeaseAccomPropertyPublic(property)) return false;

            const searchMatch =
                    !search ||
                    property.title
                        .toLowerCase()
                        .includes(search) ||
                    property.location
                        .toLowerCase()
                        .includes(search) ||
                    property.city
                        .toLowerCase()
                        .includes(search);

                const typeMatch =
                    type === "all" ||
                    property.type === type;

                const budgetMatch =
                    property.price <= maxBudget;

                const verifiedMatch =
                    !verified ||
                    isLeaseAccomPropertyVerified(property);

                const savedMatch =
                    !savedOnly ||
                    getSavedProperties().map(String).includes(String(property.id));


                return (
                    searchMatch &&
                    typeMatch &&
                    budgetMatch &&
                    verifiedMatch &&
                    savedMatch
                );

            });


        /* SORT */

        if (sortSelect.value === "low") {

            results.sort(
                (a, b) =>
                    a.price - b.price
            );

        }

        if (sortSelect.value === "high") {

            results.sort(
                (a, b) =>
                    b.price - a.price
            );

        }


        /* DISPLAY */

        if (results.length === 0) {

            marketplaceContainer.innerHTML = "";

            noResults.style.display =
                "block";

            resultsCount.textContent =
                "0 properties";

            return;

        }


        noResults.style.display =
            "none";


        resultsCount.textContent =
            `${results.length} ${
                results.length === 1
                    ? "property"
                    : "properties"
            } found`;


        marketplaceContainer.innerHTML =
            results
                .map(createPropertyCard)
                .join("");


        activateSaveButtons();
        updateCompareTray();
        renderMarketMap(results);

    }

    function renderMarketMap(results) {
        if (!marketMap || typeof L === "undefined") return;

        if (!map) {
            map = L.map(marketMap).setView([7.5, 6.5], 6);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "&copy; OpenStreetMap contributors"
            }).addTo(map);
        }

        map.eachLayer(layer => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        results.forEach(property => {
            const coordinates = cityCoordinates[property.city];
            if (!coordinates) return;
            L.marker(coordinates)
                .addTo(map)
                .bindPopup(`<strong>${property.title}</strong><br>${property.city} · ₦${new Intl.NumberFormat("en-NG").format(property.price)}<br><a href="property-details.html?id=${property.id}">View property</a>`);
        });
    }

    function showMarketplaceToast(message) {
        if (!marketToast) return;
        marketToast.textContent = message;
        marketToast.classList.add("is-visible");
        window.setTimeout(() => marketToast.classList.remove("is-visible"), 2600);
    }


    /* SEARCH */

    searchButton.addEventListener(
        "click",
        renderMarketplace
    );


    searchInput.addEventListener(
        "keyup",
        event => {

            if (
                event.key === "Enter"
            ) {

                renderMarketplace();

            }

        }
    );


    /* FILTERS */

    typeFilter.addEventListener(
        "change",
        renderMarketplace
    );

    budgetFilter.addEventListener(
        "change",
        renderMarketplace
    );

    verifiedFilter.addEventListener(
        "change",
        renderMarketplace
    );

    sortSelect.addEventListener(
        "change",
        renderMarketplace
    );

    savedOnlyButton?.addEventListener("click", () => {
        savedOnly = !savedOnly;
        savedOnlyButton.classList.toggle("active", savedOnly);
        savedOnlyButton.textContent = savedOnly ? "♥ Showing saved" : "♡ Saved only";
        renderMarketplace();
    });

    mapViewButton?.addEventListener("click", () => {
        const isVisible = marketMap.classList.toggle("is-visible");
        mapViewButton.classList.toggle("active", isVisible);
        if (isVisible && map) setTimeout(() => map.invalidateSize(), 100);
    });

    saveSearchButton?.addEventListener("click", () => {
        const savedSearches = JSON.parse(localStorage.getItem("leaseaccomSavedSearches")) || [];
        const matchIds = (Array.isArray(properties) ? properties : [])
            .filter(function (property) {
                if (typeof isLeaseAccomPropertyPublic === "function" && !isLeaseAccomPropertyPublic(property)) return false;
                const search = searchInput.value.trim().toLowerCase();
                const type = typeFilter.value;
                const maxBudget = budgetFilter.value === "all" ? Infinity : Number(budgetFilter.value);
                const verified = verifiedFilter.checked;
                const searchMatch = !search ||
                    String(property.title || "").toLowerCase().includes(search) ||
                    String(property.location || "").toLowerCase().includes(search) ||
                    String(property.city || "").toLowerCase().includes(search);
                const typeMatch = type === "all" || property.type === type;
                const budgetMatch = Number(property.price) <= maxBudget;
                const verifiedMatch = !verified || (typeof isLeaseAccomPropertyVerified === "function" && isLeaseAccomPropertyVerified(property));
                return searchMatch && typeMatch && budgetMatch && verifiedMatch;
            })
            .map(function (p) { return String(p.id); });

        const search = {
            text: searchInput.value.trim(),
            type: typeFilter.value,
            budget: budgetFilter.value,
            verified: verifiedFilter.checked,
            createdAt: new Date().toISOString(),
            matchIds: matchIds,
            lastCheckedAt: new Date().toISOString(),
            alertsEnabled: true
        };

        const duplicate = savedSearches.some(item =>
            item.text === search.text &&
            item.type === search.type &&
            item.budget === search.budget &&
            item.verified === search.verified
        );

        if (!duplicate) savedSearches.unshift(search);
        localStorage.setItem("leaseaccomSavedSearches", JSON.stringify(savedSearches.slice(0, 10)));
        showMarketplaceToast(
            duplicate
                ? "This search is already saved. We will alert you when new matches appear."
                : "Search saved. We will alert you when new listings match."
        );
    });

    function checkSavedSearchAlerts() {
        try {
            var savedSearches = JSON.parse(localStorage.getItem("leaseaccomSavedSearches") || "[]") || [];
            if (!Array.isArray(savedSearches) || !savedSearches.length || !Array.isArray(properties)) return;
            var totalNew = 0;
            var updated = savedSearches.map(function (s) {
                if (!s || s.alertsEnabled === false) return s;
                var maxBudget = s.budget === "all" || s.budget == null ? Infinity : Number(s.budget);
                var ids = properties.filter(function (property) {
                    if (typeof isLeaseAccomPropertyPublic === "function" && !isLeaseAccomPropertyPublic(property)) return false;
                    var text = String(s.text || "").toLowerCase();
                    var searchMatch = !text ||
                        String(property.title || "").toLowerCase().includes(text) ||
                        String(property.location || "").toLowerCase().includes(text) ||
                        String(property.city || "").toLowerCase().includes(text);
                    var typeMatch = !s.type || s.type === "all" || property.type === s.type;
                    var budgetMatch = Number(property.price) <= maxBudget;
                    var verifiedMatch = !s.verified || (typeof isLeaseAccomPropertyVerified === "function" && isLeaseAccomPropertyVerified(property));
                    return searchMatch && typeMatch && budgetMatch && verifiedMatch;
                }).map(function (p) { return String(p.id); });
                var prev = Array.isArray(s.matchIds) ? s.matchIds.map(String) : [];
                var news = ids.filter(function (id) { return prev.indexOf(id) === -1; });
                totalNew += news.length;
                return Object.assign({}, s, {
                    matchIds: ids,
                    lastCheckedAt: new Date().toISOString(),
                    newCount: news.length
                });
            });
            localStorage.setItem("leaseaccomSavedSearches", JSON.stringify(updated.slice(0, 10)));
            if (totalNew > 0) {
                showMarketplaceToast(totalNew + " new listing(s) match your saved search" + (totalNew > 1 ? "es" : "") + ".");
            }
        } catch (e) {
            console.warn("saved search alerts", e);
        }
    }

    // Run after first marketplace paint
    setTimeout(checkSavedSearchAlerts, 800);

    document.getElementById("compareBtn")?.addEventListener("click", openComparison);
    document.getElementById("compareClose")?.addEventListener("click", closeComparison);
    document.getElementById("compareClear")?.addEventListener("click", () => {
        saveComparedProperties([]);
        updateCompareTray();
        document.querySelectorAll(".compare-card-btn").forEach(button => {
            button.classList.remove("selected");
        });
    });

    document.getElementById("compareModal")?.addEventListener("click", event => {
        if (event.target.id === "compareModal") closeComparison();
    });


    /* INITIAL */

    renderMarketplace();
    updateCompareTray();

}

/* ================= OPEN PROPERTY ================= */

function openProperty(id) {

    const propertyId = leaseaccomId(id);

    if (!propertyId) return;

    if (Array.isArray(properties)) {
        const property = properties.find(function (item) {
            return leaseaccomIdsEqual(item.id, propertyId);
        });
        if (property) {
            try {
                localStorage.setItem("selectedProperty", JSON.stringify(property));
            } catch (e) {}
        } else {
            try {
                localStorage.setItem("selectedProperty", propertyId);
            } catch (e) {}
        }
    } else {
        try {
            localStorage.setItem("selectedProperty", propertyId);
        } catch (e) {}
    }

    if (typeof addRecentlyViewed === "function") {
        addRecentlyViewed(propertyId);
    }

    window.location.href =
        "property-details.html?id=" + encodeURIComponent(propertyId);

}

/* ================= PROPERTY DETAILS ================= */

const propertyDetails =
    document.getElementById("propertyDetails");

if (
    propertyDetails &&
    document.body.dataset.leaseaccomPage !== "property-details"
) {

    let selectedId = "";
    try {
        const raw = localStorage.getItem("selectedProperty");
        if (raw) {
            if (String(raw).trim().charAt(0) === "{") {
                const obj = JSON.parse(raw);
                selectedId = leaseaccomId(obj && obj.id);
            } else {
                selectedId = leaseaccomId(raw);
            }
        }
    } catch (e) {
        selectedId = "";
    }

    const property =
        properties.find(
            item => leaseaccomIdsEqual(item.id, selectedId)
        );


    if (!property) {

        propertyDetails.innerHTML = `

            <div class="property-loading">

                <h2>
                    Property not found
                </h2>

                <p>
                    Please return to the marketplace.
                </p>

            </div>

        `;

    } else {

        const price =
            new Intl.NumberFormat(
                "en-NG"
            ).format(property.price);


        propertyDetails.innerHTML = `

            <div class="property-gallery">

                <div class="gallery-main">

                    <img
                        src="${property.image}"
                        alt="${property.title}"
                    >

                </div>

                <img
                    src="${property.image}"
                    alt="${property.title}"
                >

                <img
                    src="${property.image}"
                    alt="${property.title}"
                >

            </div>


            <div class="property-detail-content">

                <div>

                    <div class="property-detail-type">
                        ${property.type}
                    </div>

                    <h1 class="property-detail-title">
                        ${property.title}
                    </h1>

                    <div class="property-detail-location">
                        <i class="bx bx-map" aria-hidden="true"></i> ${property.location}
                    </div>


                    <div class="detail-price">
                        ₦${price}

                        <span>
                            / ${property.period}
                        </span>
                    </div>


                    <div class="verification-box">

                        <strong>
                            ✓ LeaseAccom Verified Property
                        </strong>

                        <p>
                            This is a prototype verification
                            badge. Real verification will be
                            connected to LeaseAccom's verification
                            system later.
                        </p>

                    </div>


                    <div class="detail-description">

                        <p>
                            This modern ${property.type.toLowerCase()}
                            is located in ${property.location}.
                            The property is presented as a
                            demo listing for the LeaseAccom
                            prototype.
                        </p>

                    </div>


                    <div class="amenities">

                        <h3>
                            Property information
                        </h3>

                        <div class="amenity-grid">

                            ${
                                property.bedrooms > 0
                                ?
                                `<div class="amenity">
                                    🛏 ${property.bedrooms} Bedrooms
                                </div>`
                                :
                                ""
                            }

                            <div class="amenity">
                                🚿 ${property.bathrooms} Bathrooms
                            </div>

                            <div class="amenity">
                                📍 ${property.city}
                            </div>

                            <div class="amenity">
                                <i class="bx bx-shield-check" aria-hidden="true"></i> Verified
                            </div>

                        </div>

                    </div>

                </div>


                <aside class="action-card">

                    <h3>
                        Interested in this property?
                    </h3>

                    <p>
                        Schedule a viewing or start a
                        conversation with the property owner.
                    </p>


                    <button
                        class="action-btn viewing-btn"
                        id="requestViewing"
                    >
                        <i class="bx bx-calendar" aria-hidden="true"></i> Request Viewing
                    </button>

                    <button
                         id="contactOwnerBtn"
                         class="primary-btn"
                          >
                        <i class="bx bx-message-rounded" aria-hidden="true"></i> Contact Owner
                    </button>

                    <a
                          href="apply.html?property=${property.id}"
                          class="primary-btn"
                    > 
                        <i class="bx bx-edit-alt" aria-hidden="true"></i> Apply Now
                     </a>


                    <button
                        class="action-btn contact-btn"
                        id="contactOwner"
                    >
                        <i class="bx bx-message-rounded" aria-hidden="true"></i> Contact Owner
                    </button>


                    <div class="owner-card">

                        <small>
                            Listed by
                        </small>

                        <div class="owner-name">
                            LeaseAccom Property Owner
                        </div>

                        <small>
                            ✓ Identity verification required
                        </small>

                    </div>

                </aside>

            </div>

        `;


        /* ================= VIEWING MODAL ================= */

        const modal =
            document.getElementById(
                "viewingModal"
            );

        const closeModal =
            document.getElementById(
                "closeModal"
            );

        const requestViewing =
            document.getElementById(
                "requestViewing"
            );


        requestViewing.addEventListener(
            "click",
            () => {

                modal.classList.add(
                    "active"
                );

            }
        );


        closeModal.addEventListener(
            "click",
            () => {

                modal.classList.remove(
                    "active"
                );

            }
        );


        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {

                    modal.classList.remove(
                        "active"
                    );

                }

            }
        );


        /* ================= VIEWING FORM ================= */

        const viewingForm =
            document.getElementById(
                "viewingForm"
            );


viewingForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();


        const currentUser =
            JSON.parse(
                localStorage.getItem(
                    "leaseaccomCurrentUser"
                )
            );


        if (
            !currentUser ||
            currentUser.accountType !== "tenant"
        ) {

            alert(
                "Please log in as a tenant before requesting a viewing."
            );

            window.location.href =
                "login.html";

            return;

        }


        const name =
            document.getElementById(
                "viewerName"
            ).value.trim();


        const date =
            document.getElementById(
                "viewingDate"
            ).value;


        const time =
            document.getElementById(
                "viewingTime"
            ).value;


        const viewingRequest = {

            id: Date.now(),

            propertyId:
                property.id,

            propertyTitle:
                property.title,

            name,

            date,

            time,

            status:
                "Pending"

        };


        currentUser.viewingRequests.push(
            viewingRequest
        );
        /* Save request for owner dashboard */

const ownerRequests =
    JSON.parse(
        localStorage.getItem(
            "viewingRequests"
        )
    ) || [];


ownerRequests.push({
    ...viewingRequest,
    tenantId: currentUser.id
});


localStorage.setItem(
    "viewingRequests",
    JSON.stringify(ownerRequests)
);

        localStorage.setItem(
            "leaseaccomCurrentUser",
            JSON.stringify(currentUser)
        );


        /* Update stored user */

        const users =
            JSON.parse(
                localStorage.getItem(
                    "leaseaccomUsers"
                )
            ) || [];


        const userIndex =
            users.findIndex(
                user =>
                    user.id === currentUser.id
            );


        if (userIndex !== -1) {

            users[userIndex] =
                currentUser;

            localStorage.setItem(
                "leaseaccomUsers",
                JSON.stringify(users)
            );

        }


        modal.classList.remove(
            "active"
        );


        viewingForm.reset();


        alert(
            "✅ Viewing request sent successfully!"
        );

    }
);


        /* ================= CONTACT ================= */

        const contactOwner =
            document.getElementById(
                "contactOwner"
            );


        contactOwner.addEventListener(
            "click",
            () => {

                alert(
                    "💬 LeaseAccom Messaging\\n\\n" +
                    "The tenant-owner chat system will be connected in the next stage."
                );

            }
        );

    }

};

/* ================= REGISTER ================= */

const authStatus =
    document.getElementById("authStatus");

function showAuthStatus(message, type = "error") {
    if (!authStatus) return;

    authStatus.textContent = message;
    authStatus.className = `form-status is-visible is-${type}`;
}


/* =========================================================
   SESSION — single canonical key (Phase 3 / Problem 11)
   Canonical: leaseaccomCurrentUser
   Legacy mirrors kept in sync so older scripts still work.
   ========================================================= */

var LEASEACCOM_SESSION_KEY = "leaseaccomCurrentUser";
var LEASEACCOM_SESSION_LEGACY = ["leaseaccomCurrentUser", "currentUser"];

function normalizeAccountType(value) {
    const v = String(value || "").trim().toLowerCase();
    if (!v) return "tenant";
    if (v === "owner" || v === "landlord" || v.includes("owner") || v.includes("business") || v.includes("landlord")) {
        return "owner";
    }
    return "tenant";
}

function getCurrentUser() {
    try {
        var raw =
            localStorage.getItem(LEASEACCOM_SESSION_KEY) ||
            localStorage.getItem("leaseaccomCurrentUser") ||
            localStorage.getItem("currentUser");
        if (!raw) return null;
        var user = JSON.parse(raw);
        if (!user || typeof user !== "object") return null;
        user.accountType = normalizeAccountType(user.accountType);
        // Migrate legacy → canonical so all pages share one source of truth
        try {
            var canonical = localStorage.getItem(LEASEACCOM_SESSION_KEY);
            if (!canonical || canonical !== JSON.stringify(user)) {
                saveCurrentUser(user);
            }
        } catch (e2) {}
        return user;
    } catch (e) {
        return null;
    }
}

function saveCurrentUser(user) {
    if (!user || typeof user !== "object") return;
    delete user.password;
    user.accountType = normalizeAccountType(user.accountType);
    var payload = JSON.stringify(user);
    localStorage.setItem(LEASEACCOM_SESSION_KEY, payload);
    // Keep legacy keys identical (read-only compatibility — never divergent)
    LEASEACCOM_SESSION_LEGACY.forEach(function (key) {
        try { localStorage.setItem(key, payload); } catch (e) {}
    });
}

function clearCurrentUser() {
    try { localStorage.removeItem(LEASEACCOM_SESSION_KEY); } catch (e) {}
    LEASEACCOM_SESSION_LEGACY.forEach(function (key) {
        try { localStorage.removeItem(key); } catch (e) {}
    });
    try { localStorage.removeItem("leaseaccom_session_token"); } catch (e) {}
}

function redirectAfterAuth(user) {
    const type = normalizeAccountType(user && user.accountType);
    const target = type === "owner" ? "owner-dashboard.html" : "tenant-dashboard.html";
    window.location.replace(target);
}

const registerForm =
    document.getElementById("registerForm");

if (registerForm) {

    registerForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();

            const accountType =
                document.getElementById(
                    "accountType"
                ).value;

            const name =
                document.getElementById(
                    "registerName"
                ).value.trim();

            const email =
                document.getElementById(
                    "registerEmail"
                ).value.trim().toLowerCase();

            const phone =
                document.getElementById(
                    "registerPhone"
                ).value.trim();

            const password =
                document.getElementById(
                    "registerPassword"
                ).value;

            if (!accountType) {
                showAuthStatus("Please select your account type.");
                return;
            }

            if (!name || !email || !password) {
                showAuthStatus("Please fill in name, email and password.");
                return;
            }

            if (password.length < 6) {
                showAuthStatus("Password must be at least 6 characters.");
                return;
            }

            const normalizedType = normalizeAccountType(accountType);
            showAuthStatus("Creating your account...", "success");

            /* ---- Phase 2: Supabase Auth first ---- */
            if (window.LeaseAccomAuth && typeof window.LeaseAccomAuth.signUp === "function") {
                try {
                    const { data, error } = await window.LeaseAccomAuth.signUp({
                        email,
                        password,
                        name,
                        phone,
                        accountType: normalizedType
                    });

                    if (error) {
                        showAuthStatus(error.message || "Could not create account on server.");
                        /* fall through to local demo account so you can still test UI */
                    } else if (data && data.user) {
                        const newUser = {
                            id: data.user.id,
                            accountType: normalizedType,
                            name,
                            email,
                            phone,
                            savedProperties: [],
                            viewingRequests: [],
                            applications: [],
                            properties: [],
                            verificationStatus: normalizedType === "owner" ? "unverified" : "n/a",
                            ownerVerificationStatus: normalizedType === "owner" ? "unverified" : "n/a",
                            _source: "supabase"
                        };
                        saveCurrentUser(newUser);
                        showAuthStatus("Account created! Redirecting...", "success");
                        setTimeout(function () { redirectAfterAuth(newUser); }, 200);
                        return;
                    }
                } catch (err) {
                    console.warn("Supabase signUp:", err);
                    showAuthStatus("Server signup failed. Saving account on this device only...");
                }
            }

            /* ---- Fallback: localStorage (Phase 1) ---- */
            let existingUsers = [];
            try {
                const parsedUsers = JSON.parse(
                    localStorage.getItem("leaseaccomUsers")
                );
                existingUsers = Array.isArray(parsedUsers)
                    ? parsedUsers
                    : [];
            } catch (error) {
                localStorage.removeItem("leaseaccomUsers");
            }

            const alreadyExists = existingUsers.some(
                user => user.email === email
            );

            if (alreadyExists) {
                showAuthStatus("An account with this email already exists on this device.");
                return;
            }

            const newUser = {
                id: Date.now(),
                accountType: normalizedType,
                name,
                email,
                phone,
                password,
                savedProperties: [],
                viewingRequests: [],
                applications: [],
                properties: [],
                verificationStatus: normalizedType === "owner" ? "unverified" : "n/a",
                ownerVerificationStatus: normalizedType === "owner" ? "unverified" : "n/a",
                _source: "local"
            };

            existingUsers.push(newUser);
            localStorage.setItem(
                "leaseaccomUsers",
                JSON.stringify(existingUsers)
            );

            saveCurrentUser(newUser);
            showAuthStatus("Account saved on this device. Redirecting...", "success");
            setTimeout(function () { redirectAfterAuth(newUser); }, 150);
        }
    );

}

/* ================= LOGIN ================= */

const loginForm =
    document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();

            const email =
                document.getElementById(
                    "loginEmail"
                ).value.trim().toLowerCase();

            const password =
                document.getElementById(
                    "loginPassword"
                ).value;

            if (!email || !password) {
                showAuthStatus("Enter email and password.");
                return;
            }

            showAuthStatus("Signing in...", "success");

            /* ---- Phase 2: Supabase Auth first ---- */
            if (window.LeaseAccomAuth && typeof window.LeaseAccomAuth.signIn === "function") {
                try {
                    const { data, error } = await window.LeaseAccomAuth.signIn(email, password);

                    if (!error && data && data.user) {
                        let profile = null;
                        try {
                            if (window.LeaseAccomData && window.LeaseAccomData.getProfile) {
                                profile = await window.LeaseAccomData.getProfile(data.user.id);
                            } else if (window.leaseaccomSupabase) {
                                const res = await window.leaseaccomSupabase
                                    .from("profiles")
                                    .select("*")
                                    .eq("id", data.user.id)
                                    .maybeSingle();
                                profile = res.data;
                            }
                        } catch (e) {}

                        const accountType = normalizeAccountType(
                            (profile && profile.account_type) ||
                            data.user.user_metadata?.account_type ||
                            "tenant"
                        );
                        const user = {
                            id: data.user.id,
                            email: data.user.email,
                            name:
                                (profile && profile.full_name) ||
                                data.user.user_metadata?.full_name ||
                                email,
                            phone:
                                (profile && profile.phone) ||
                                data.user.user_metadata?.phone ||
                                "",
                            accountType,
                            verificationStatus:
                                (profile && profile.verification_status) ||
                                (accountType === "owner" ? "unverified" : "n/a"),
                            ownerVerificationStatus:
                                (profile && profile.verification_status) ||
                                (accountType === "owner" ? "unverified" : "n/a"),
                            savedProperties: [],
                            viewingRequests: [],
                            applications: [],
                            properties: [],
                            _source: "supabase"
                        };
                        saveCurrentUser(user);
                        showAuthStatus("Login successful! Redirecting...", "success");
                        setTimeout(function () { redirectAfterAuth(user); }, 150);
                        return;
                    }

                    if (error) {
                        console.warn("Supabase signIn:", error.message);
                        /* fall through to local */
                    }
                } catch (err) {
                    console.warn("Supabase signIn exception:", err);
                }
            }

            /* ---- Fallback: localStorage ---- */
            let users = [];
            try {
                const parsedUsers = JSON.parse(
                    localStorage.getItem("leaseaccomUsers")
                );
                users = Array.isArray(parsedUsers)
                    ? parsedUsers
                    : [];
            } catch (error) {
                showAuthStatus("Your saved account data could not be read. Please register again.");
                return;
            }

            const user =
                users.find(account =>
                    String(account.email || "")
                        .trim()
                        .toLowerCase() === email &&
                    String(account.password || "") === password
                );

            if (!user) {
                showAuthStatus(
                    users.length === 0
                        ? "No account found. Register first, or check email confirmation in Supabase."
                        : "Incorrect email or password."
                );
                return;
            }

            user.accountType = normalizeAccountType(user.accountType);
            delete user.password;
            try {
                const idx = users.findIndex(u => Number(u.id) === Number(user.id) || String(u.email).toLowerCase() === email);
                if (idx >= 0) {
                    users[idx] = { ...users[idx], accountType: user.accountType };
                    localStorage.setItem("leaseaccomUsers", JSON.stringify(users));
                }
            } catch (e) {}

            saveCurrentUser(user);
            showAuthStatus("Login successful! Redirecting...", "success");
            setTimeout(function () { redirectAfterAuth(user); }, 150);
        }
    );

}

/* ================= TENANT DASHBOARD ================= */

const tenantDashboard =
    document.getElementById("savedProperties");

if (tenantDashboard) {

    const currentUser = getCurrentUser();

    if (!currentUser) {
        window.location.replace("login.html");
    } else if (normalizeAccountType(currentUser.accountType) !== "tenant") {
        window.location.replace("owner-dashboard.html");
    } else {

        const welcomeName =
            document.getElementById(
                "welcomeName"
            );

        const dashboardUserName =
            document.getElementById(
                "dashboardUserName"
            );


        welcomeName.textContent =
            `Welcome back, ${currentUser.name.split(" ")[0]}.`;

        dashboardUserName.textContent =
            currentUser.name;


        /* STATS */

        const savedPropertyIds =
            typeof getSavedProperties === "function"
                ? getSavedProperties().map(Number)
                : (currentUser.savedProperties || []).map(Number);
        const viewingRequests = Array.isArray(currentUser.viewingRequests)
            ? currentUser.viewingRequests
            : [];
        const applications = Array.isArray(currentUser.applications)
            ? currentUser.applications
            : [];

        document.getElementById(
            "savedCount"
        ).textContent =
            savedPropertyIds.length;


        document.getElementById(
            "viewingCount"
        ).textContent =
            viewingRequests.length;


        document.getElementById(
            "applicationCount"
        ).textContent =
            applications.length;


        /* SAVED PROPERTIES */

        const savedProperties =
            properties.filter(property =>
                savedPropertyIds.includes(Number(property.id))
            );


        const savedContainer =
            document.getElementById(
                "savedProperties"
            );

        const emptySaved =
            document.getElementById(
                "emptySaved"
            );


        if (savedProperties.length > 0) {

            emptySaved.style.display =
                "none";

            savedContainer.innerHTML =
                savedProperties
                    .map(createPropertyCard)
                    .join("");

            activateSaveButtons();

        } else {

            savedContainer.innerHTML = "";

            emptySaved.style.display =
                "block";

        }


        /* VIEWINGS */

        const viewingContainer =
            document.getElementById(
                "viewingRequests"
            );

        const emptyViewings =
            document.getElementById(
                "emptyViewings"
            );


        if (
            viewingRequests.length
            > 0
        ) {

            emptyViewings.style.display =
                "none";


            viewingContainer.innerHTML =
                viewingRequests
                    .map(request => `

                        <div class="viewing-item">

                            <div class="viewing-info">

                                <strong>
                                    ${request.propertyTitle}
                                </strong>

                                <p>
                                    <i class="bx bx-calendar" aria-hidden="true"></i> ${request.date}
                                    &nbsp; • &nbsp;
                                    ⏰ ${request.time}
                                </p>

                            </div>


                            <span class="viewing-status">
                                ${request.status}
                            </span>

                        </div>

                    `)
                    .join("");


        } else {

            viewingContainer.innerHTML = "";

            emptyViewings.style.display =
                "block";

        }


        /* LOGOUT */

        document
            .getElementById("logoutBtn")
            .addEventListener(
                "click",
                function() {

                    localStorage.removeItem(
                        "leaseaccomCurrentUser"
                    );

                    window.location.href =
                        "index.html";

                }
            );

    }

}

/* ================= OWNER DASHBOARD ================= */

const ownerPropertiesContainer =
    document.getElementById("ownerProperties");

if (ownerPropertiesContainer) {

    const currentUser = getCurrentUser();


    /* PROTECT PAGE — never loop: send wrong role to the right dashboard */

    if (!currentUser) {

        window.location.replace("login.html");

    } else if (normalizeAccountType(currentUser.accountType) !== "owner") {

        window.location.replace("tenant-dashboard.html");

    } else {

        const ownerPropertyIds = Array.isArray(currentUser.properties)
            ? currentUser.properties
            : [];

        const ownerWelcomeEl = document.getElementById("ownerWelcome");
        if (ownerWelcomeEl) {
            const hour = new Date().getHours();
            const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
            ownerWelcomeEl.textContent = `${hello}, ${currentUser.name.split(" ")[0]}`;
        }

        const ownerDashboardNameEl = document.getElementById("ownerDashboardName");
        if (ownerDashboardNameEl) {
            ownerDashboardNameEl.textContent = currentUser.name;
        }

        const sidebarName = document.getElementById("ownerSidebarName");
        if (sidebarName) sidebarName.textContent = currentUser.name;
        const sidebarInitial = document.getElementById("ownerSidebarInitial");
        if (sidebarInitial) sidebarInitial.textContent = (currentUser.name || "O").trim().charAt(0).toUpperCase();
        const ownerStoreTitle = document.getElementById("ownerStoreTitle");
        if (ownerStoreTitle && currentUser.name) ownerStoreTitle.textContent = currentUser.name;


        /* LISTING COUNT */

        document.getElementById(
            "ownerListingCount"
        ).textContent =
            ownerPropertyIds.length;


        /* PROPERTIES */

        const emptyProperties =
            document.getElementById(
                "emptyOwnerProperties"
            );


        if (
            ownerPropertyIds.length === 0
        ) {

            ownerPropertiesContainer.innerHTML =
                "";

            emptyProperties.style.display =
                "block";

        } else {

            emptyProperties.style.display =
                "none";


            const ownerListings =
                ownerPropertyIds
                    .map(id =>
                        properties.find(
                            property =>
                                String(property.id) === String(id)
                        )
                    )
                    .filter(Boolean);


            ownerPropertiesContainer.innerHTML =
                ownerListings
                    .map(property => {
                        const verificationStatus = getLeaseAccomVerificationStatus(property);
                        let listingSt = (typeof getListingStatus === "function")
                            ? getListingStatus(property)
                            : String(property.listingStatus || verificationStatus || "pending").toLowerCase();
                        /* Unverified owners cannot have Live listings on their dashboard */
                        if (typeof ownerIsVerified !== "undefined" && !ownerIsVerified) {
                            listingSt = "pending";
                        }
                        const statusClass = (listingSt === "live" || verificationStatus === "approved") && (typeof ownerIsVerified === "undefined" || ownerIsVerified)
                            ? "status-live"
                            : (listingSt === "rejected" || verificationStatus === "rejected")
                                ? "status-rejected"
                                : "status-pending";
                        let statusText = (listingSt === "live" || verificationStatus === "approved") && (typeof ownerIsVerified === "undefined" || ownerIsVerified)
                            ? "🟢 Live"
                            : (listingSt === "rejected" || verificationStatus === "rejected")
                                ? "⛔ Rejected"
                                : "⏳ Pending";
                        if (typeof ownerIsVerified !== "undefined" && !ownerIsVerified) {
                            statusText = "⏳ Pending — verify account";
                        }

                        return `

                        <div
                            class="owner-property-item"
                        >

                            <img
                                class="owner-property-image"
                                src="${property.image}"
                                alt="${property.title}"
                            >


                            <div class="owner-property-info">

                                <h3>
                                    ${property.title}
                                </h3>

                                <p>
                                    <i class="bx bx-map" aria-hidden="true"></i> ${property.location}
                                </p>

                                <div class="owner-property-price">

                                    ₦${new Intl.NumberFormat(
                                        "en-NG"
                                    ).format(property.price)}

                                    / ${property.period}

                                </div>


                                <div
                                    class="owner-property-actions"
                                >

                                    <button
                                        class="owner-small-btn"
                                        onclick="openProperty('${String(property.id).replace(/'/g, "")}')"
                                    >
                                        View
                                    </button>

                                </div>

                            </div>


                            <div class="owner-property-status">

                                <span
                                    class="status-badge ${statusClass}"
                                >
                                    ${statusText}
                                </span>

                            </div>

                        </div>

                        `;
                    })
                    .join("");

        }


        /* VIEWING REQUESTS */

        const ownerViewingContainer =
            document.getElementById(
                "ownerViewingRequests"
            );

        const emptyOwnerViewings =
            document.getElementById(
                "emptyOwnerViewings"
            );


        /*
         * For now this reads viewing requests
         * stored locally.
         *
         * A real backend will connect the
         * tenant and owner accounts.
         */

        const allViewingRequests =
            JSON.parse(
                localStorage.getItem(
                    "viewingRequests"
                )
            ) || [];


        if (
            allViewingRequests.length > 0
        ) {

            emptyOwnerViewings.style.display =
                "none";


            ownerViewingContainer.innerHTML =
                allViewingRequests
                    .map(request => `

                        <div class="viewing-item">

                            <div class="viewing-info">

                                <strong>
                                    ${request.propertyTitle}
                                </strong>

                                <p>
                                    <i class="bx bx-user" aria-hidden="true"></i> ${request.name}
                                    &nbsp; • &nbsp;
                                    <i class="bx bx-calendar" aria-hidden="true"></i> ${request.date}
                                    &nbsp; • &nbsp;
                                    ⏰ ${request.time}
                                </p>

                            </div>


                            <span class="viewing-status">
                                ${request.status}
                            </span>

                        </div>

                    `)
                    .join("");

        } else {

            ownerViewingContainer.innerHTML =
                "";

            emptyOwnerViewings.style.display =
                "block";

        }


        /* LOGOUT */

        document
            .getElementById(
                "ownerLogoutBtn"
            )
            .addEventListener(
                "click",
                () => {

                    localStorage.removeItem(
                        "leaseaccomCurrentUser"
                    );

                    window.location.href =
                        "index.html";

                }
            );

    }

}

/* ================= ADD PROPERTY ================= */

const addPropertyForm =
    document.getElementById("addPropertyForm");


if (
    addPropertyForm &&
    document.body.dataset.leaseaccomPage !== "add-property"
) {

    const currentUser =
        JSON.parse(
            localStorage.getItem(
                "leaseaccomCurrentUser"
            )
        );


    /* PROTECT PAGE */

    if (
        !currentUser ||
        currentUser.accountType !== "owner"
    ) {

        window.location.href =
            "login.html";

    }


    /* IMAGE PREVIEW */

    const imageInput =
        document.getElementById(
            "propertyImage"
        );

    const imagePreview =
        document.getElementById(
            "imagePreview"
        );


    imageInput.addEventListener(
        "change",
        function() {

            const file =
                this.files[0];

            if (!file) return;


            const reader =
                new FileReader();


            reader.onload =
                function(event) {

                    imagePreview.innerHTML = `

                        <img
                            src="${event.target.result}"
                            alt="Property preview"
                        >

                    `;

                };


            reader.readAsDataURL(file);

        }
    );


    /* SUBMIT PROPERTY */

    addPropertyForm.addEventListener(
        "submit",
        function(event) {

            event.preventDefault();


            const title =
                document.getElementById(
                    "propertyTitle"
                ).value.trim();


            const type =
                document.getElementById(
                    "propertyType"
                ).value;


            const purpose =
                document.getElementById(
                    "listingPurpose"
                ).value;


            const state =
                document.getElementById(
                    "propertyState"
                ).value;


            const city =
                document.getElementById(
                    "propertyCity"
                ).value.trim();


            const location =
                document.getElementById(
                    "propertyLocation"
                ).value.trim();


            const price =
                Number(
                    document.getElementById(
                        "propertyPrice"
                    ).value
                );


            const period =
                document.getElementById(
                    "propertyPeriod"
                ).value;


            const bedrooms =
                Number(
                    document.getElementById(
                        "propertyBedrooms"
                    ).value
                );


            const bathrooms =
                Number(
                    document.getElementById(
                        "propertyBathrooms"
                    ).value
                );


            const description =
                document.getElementById(
                    "propertyDescription"
                ).value.trim();


            /* AMENITIES */

            const selectedAmenities =
                Array.from(
                    document.querySelectorAll(
                        'input[name="amenity"]:checked'
                    )
                ).map(
                    checkbox =>
                        checkbox.value
                );


            /* IMAGE */

            const file =
                imageInput.files[0];


            if (!file) {

                alert(
                    "Please select a property image."
                );

                return;

            }


            const reader =
                new FileReader();


            reader.onload =
                function(event) {

                    const newProperty = {

                        id: Date.now(),

                        title,

                        type,

                        purpose,

                        state,

                        city,

                        location,

                        price,

                        period,

                        bedrooms,

                        bathrooms,

                        description,

                        amenities:
                            selectedAmenities,

                        image:
                            event.target.result,

                        verified: false,

                        verificationStatus:
                            "Pending Verification",

                        ownerId:
                            currentUser.id,

                        ownerName:
                            currentUser.name,

                        createdAt:
                            new Date().toISOString()

                    };


                    /* SAVE PROPERTY */

                    properties.push(
                        newProperty
                    );


                    localStorage.setItem(
                        "leaseaccomProperties",
                        JSON.stringify(
                            properties
                        )
                    );


                    /* ADD TO OWNER */

                    currentUser.properties.push(
                        newProperty.id
                    );


                    localStorage.setItem(
                        "leaseaccomCurrentUser",
                        JSON.stringify(
                            currentUser
                        )
                    );


                    /* UPDATE storeD USERS */

                    const users =
                        JSON.parse(
                            localStorage.getItem(
                                "leaseaccomUsers"
                            )
                        ) || [];


                    const userIndex =
                        users.findIndex(
                            user =>
                                user.id ===
                                currentUser.id
                        );


                    if (userIndex !== -1) {

                        users[userIndex] =
                            currentUser;

                        localStorage.setItem(
                            "leaseaccomUsers",
                            JSON.stringify(
                                users
                            )
                        );

                    }


                    alert(
                        "🏠 Property submitted successfully!\\n\\nYour listing is now Pending Verification."
                    );


                    window.location.href =
                        "owner-dashboard.html";

                };


            reader.readAsDataURL(file);

        }
    );

}

/* ================= ADMIN DASHBOARD ================= */

const pendingPropertiesContainer =
    document.getElementById(
        "pendingProperties"
    );


if (pendingPropertiesContainer) {

    const noPending =
        document.getElementById(
            "noPendingProperties"
        );


    function loadAdminDashboard() {

        /*
         * Reload properties from LocalStorage
         * so the admin always sees the newest data.
         */

        const storedProperties =
            JSON.parse(
                localStorage.getItem(
                    "leaseaccomProperties"
                )
            ) || [];


        /*
         * Make sure the global property
         * array also contains them.
         */

        storedProperties.forEach(
            savedProperty => {

                const index =
                    properties.findIndex(
                        property =>
                            property.id ===
                            savedProperty.id
                    );


                if (index === -1) {

                    properties.push(
                        savedProperty
                    );

                } else {

                    properties[index] =
                        savedProperty;

                }

            }
        );


        /* COUNTS */

        const pending =
            storedProperties.filter(
                property =>
                    getLeaseAccomVerificationStatus(property) === "pending"
            );


        const verified =
            storedProperties.filter(
                property =>
                    getLeaseAccomVerificationStatus(property) === "approved"
            );


        const rejected =
            storedProperties.filter(
                property =>
                    getLeaseAccomVerificationStatus(property) === "rejected"
            );


        document.getElementById(
            "pendingCount"
        ).textContent =
            pending.length;


        document.getElementById(
            "verifiedCount"
        ).textContent =
            verified.length;


        document.getElementById(
            "rejectedCount"
        ).textContent =
            rejected.length;


        document.getElementById(
            "totalPropertyCount"
        ).textContent =
            storedProperties.length;


        /* PENDING */

        if (pending.length === 0) {

            pendingPropertiesContainer.innerHTML =
                "";

            noPending.style.display =
                "block";

        } else {

            noPending.style.display =
                "none";


            pendingPropertiesContainer.innerHTML =
                pending.map(
                    property =>
                        createAdminPropertyCard(
                            property
                        )
                ).join("");

        }


        /* VERIFIED */

        const verifiedContainer =
            document.getElementById(
                "verifiedProperties"
            );


        if (verified.length === 0) {

            verifiedContainer.innerHTML = `

                <div class="dashboard-empty">

                    <div>
                        🏠
                    </div>

                    <h3>
                        No verified properties yet
                    </h3>

                    <p>
                        Approved properties will appear here.
                    </p>

                </div>

            `;

        } else {

            verifiedContainer.innerHTML =
                verified.map(
                    property =>
                        createAdminPropertyCard(
                            property,
                            true
                        )
                ).join("");

        }

    }


    /* PROPERTY CARD */

    function createAdminPropertyCard(
        property,
        isVerified = false
    ) {

        const price =
            new Intl.NumberFormat(
                "en-NG"
            ).format(
                property.price
            );


        return `

            <div
                class="admin-property-card"
            >

                <img
                    src="${property.image}"
                    alt="${property.title}"
                    class="admin-property-image"
                >


                <div
                    class="admin-property-info"
                >

                    <h3>
                        ${property.title}
                    </h3>


                    <p>
                        <i class="bx bx-map" aria-hidden="true"></i> ${property.location},
                        ${property.city},
                        ${property.state}
                    </p>


                    <p>
                        👤 Owner:
                        ${property.ownerName || "Unknown"}
                    </p>


                    <p>
                        ₦${price}
                        / ${property.period}
                    </p>


                    <div
                        class="admin-property-meta"
                    >

                        <span class="admin-meta-tag">
                            ${property.type}
                        </span>

                        <span class="admin-meta-tag">
                            ${property.bedrooms || 0}
                            bedrooms
                        </span>

                        <span class="admin-meta-tag">
                            ${property.bathrooms || 0}
                            bathrooms
                        </span>

                    </div>


                    ${
                        isVerified
                        ? `
                            <span
                                class="admin-verified-badge"
                            >
                                ✓ LeaseAccom Verified
                            </span>
                        `
                        : ""
                    }

                </div>


                <div
                    class="admin-property-actions"
                >

                    <button
                        class="admin-view-btn"
                        onclick="adminViewProperty(${property.id})"
                    >
                        View Details
                    </button>


                    ${
                        !isVerified
                        ? `

                            <button
                                class="admin-approve-btn"
                                onclick="approveProperty(${property.id})"
                            >
                                ✓ Approve
                            </button>


                            <button
                                class="admin-reject-btn"
                                onclick="rejectProperty(${property.id})"
                            >
                                ✕ Reject
                            </button>

                        `
                        : ""
                    }

                </div>

            </div>

        `;

    }


    /* APPROVE */

    window.approveProperty =
        function(propertyId) {

            const storedProperties =
                JSON.parse(
                    localStorage.getItem(
                        "leaseaccomProperties"
                    )
                ) || [];


            const property =
                storedProperties.find(
                    item =>
                        item.id ===
                        propertyId
                );


            if (!property) return;


            const confirmed =
                confirm(
                    `Approve "${property.title}" as a verified LeaseAccom property?`
                );


            if (!confirmed) return;


            property.verificationStatus =
                "Verified";


            property.verified =
                true;


            property.verifiedAt =
                new Date().toISOString();


            localStorage.setItem(
                "leaseaccomProperties",
                JSON.stringify(
                    storedProperties
                )
            );


            loadAdminDashboard();


            alert(
                "✅ Property verified successfully!"
            );

        };


    /* REJECT */

    window.rejectProperty =
        function(propertyId) {

            const reason =
                prompt(
                    "Why is this property being rejected?"
                );


            if (!reason) return;


            const storedProperties =
                JSON.parse(
                    localStorage.getItem(
                        "leaseaccomProperties"
                    )
                ) || [];


            const property =
                storedProperties.find(
                    item =>
                        item.id ===
                        propertyId
                );


            if (!property) return;


            property.verificationStatus =
                "Rejected";


            property.verified =
                false;


            property.rejectionReason =
                reason;


            localStorage.setItem(
                "leaseaccomProperties",
                JSON.stringify(
                    storedProperties
                )
            );


            loadAdminDashboard();


            alert(
                "Property rejected."
            );

        };


    /* VIEW */

    window.adminViewProperty =
        function(propertyId) {

            const property =
                properties.find(
                    item =>
                        item.id ===
                        propertyId
                );


            if (!property) return;


            alert(

                `PROPERTY REVIEW

Title:
${property.title}

Type:
${property.type}

Location:
${property.location}, ${property.city}, ${property.state}

Price:
₦${new Intl.NumberFormat("en-NG").format(property.price)}

Owner:
${property.ownerName || "Unknown"}

Bedrooms:
${property.bedrooms}

Bathrooms:
${property.bathrooms}

Description:
${property.description}

Verification:
${property.verificationStatus}`

            );

        };


    /* LOGOUT */

    const adminLogout =
        document.getElementById(
            "adminLogout"
        );


    if (adminLogout) {

        adminLogout.addEventListener(
            "click",
            function() {

                window.location.href =
                    "index.html";

            }
        );

    }


    loadAdminDashboard();

}

/* ================= MESSAGING ================= */

const conversationList =
    document.getElementById(
        "conversationList"
    );


if (
    conversationList &&
    document.body.dataset.leaseaccomPage !== "tenant-messages"
) {

    const currentUser =
        JSON.parse(
            localStorage.getItem(
                "leaseaccomCurrentUser"
            )
        );


    if (!currentUser) {

        window.location.href =
            "login.html";

    }


    let conversations =
        JSON.parse(
            localStorage.getItem(
                "leaseaccomConversations"
            )
        ) || [];


    let activeConversation = null;


    const chatEmpty =
        document.getElementById(
            "chatEmpty"
        );


    const chatContent =
        document.getElementById(
            "chatContent"
        );


    const noConversations =
        document.getElementById(
            "noConversations"
        );


    /* LOAD CONVERSATIONS */

    function loadConversations() {

        conversations =
            JSON.parse(
                localStorage.getItem(
                    "leaseaccomConversations"
                )
            ) || [];


        const userConversations =
            conversations.filter(
                conversation =>
                    conversation.participants.includes(
                        currentUser.id
                    )
            );


        if (
            userConversations.length === 0
        ) {

            conversationList.innerHTML =
                "";

            noConversations.style.display =
                "block";

            return;

        }


        noConversations.style.display =
            "none";


        conversationList.innerHTML =
            userConversations
                .map(
                    conversation =>
                        createConversation(
                            conversation
                        )
                )
                .join("");

    }


    /* CREATE CONVERSATION ITEM */

    function createConversation(
        conversation
    ) {

        const otherUser =
            conversation.participants.find(
                id =>
                    id !== currentUser.id
            );


        const name =
            conversation.ownerName ||
            conversation.tenantName ||
            "LeaseAccom User";


        const lastMessage =
            conversation.messages.length
            ? conversation.messages[
                conversation.messages.length - 1
              ].text
            : "No messages yet";


        return `

            <div
                class="conversation-item ${
                    activeConversation ===
                    conversation.id
                        ? "active"
                        : ""
                }"
                onclick="openConversation('${conversation.id}')"
            >

                <div class="conversation-avatar">

                    ${name.charAt(0).toUpperCase()}

                </div>


                <div class="conversation-info">

                    <strong>
                        ${name}
                    </strong>

                    <p>
                        ${conversation.propertyTitle}
                    </p>

                    <p>
                        ${lastMessage}
                    </p>

                </div>

            </div>

        `;

    }


    /* OPEN CONVERSATION */

    window.openConversation =
        function(conversationId) {

            activeConversation =
                conversationId;


            const conversation =
                conversations.find(
                    item =>
                        item.id ===
                        conversationId
                );


            if (!conversation) return;


            chatEmpty.style.display =
                "none";


            chatContent.style.display =
                "flex";


            document.getElementById(
                "chatPersonName"
            ).textContent =
                conversation.ownerName ||
                conversation.tenantName ||
                "LeaseAccom User";


            document.getElementById(
                "chatPropertyName"
            ).textContent =
                conversation.propertyTitle;


            renderMessages(
                conversation
            );


            loadConversations();

        };


    /* RENDER MESSAGES */

    function renderMessages(
        conversation
    ) {

        const messageContainer =
            document.getElementById(
                "chatMessages"
            );


        messageContainer.innerHTML =
            conversation.messages
                .map(
                    message => `

                        <div
                            class="message ${
                                message.senderId ===
                                currentUser.id
                                    ? "sent"
                                    : "received"
                            }"
                        >

                            ${message.text}

                            <span
                                class="message-time"
                            >
                                ${message.time}
                            </span>

                        </div>

                    `
                )
                .join("");


        messageContainer.scrollTop =
            messageContainer.scrollHeight;

    }


    /* SEND MESSAGE */

    const messageForm =
        document.getElementById(
            "messageForm"
        );


    messageForm.addEventListener(
        "submit",
        function(event) {

            event.preventDefault();


            if (!activeConversation)
                return;


            const input =
                document.getElementById(
                    "messageInput"
                );


            const text =
                input.value.trim();


            if (!text) return;


            const conversation =
                conversations.find(
                    item =>
                        item.id ===
                        activeConversation
                );


            if (!conversation) return;


            conversation.messages.push({

                id: Date.now(),

                senderId:
                    currentUser.id,

                text,

                time:
                    new Date()
                        .toLocaleTimeString(
                            [],
                            {
                                hour: "2-digit",
                                minute: "2-digit"
                            }
                        )

            });


            localStorage.setItem(
                "leaseaccomConversations",
                JSON.stringify(
                    conversations
                )
            );


            input.value = "";


            renderMessages(
                conversation
            );


            loadConversations();

        }
    );


    loadConversations();

}

/* ================= PROPERTY APPLICATION ================= */

const applicationForm =
    document.getElementById(
        "applicationForm"
    );


if (applicationForm) {

    const currentUser =
        JSON.parse(
            localStorage.getItem(
                "leaseaccomCurrentUser"
            )
        );


    /* LOGIN CHECK */

    if (!currentUser || currentUser.accountType !== "tenant") {

        alert(
            "Please log in as a tenant before applying."
        );

        window.location.href =
            "login.html";

    } else {


    /* GET PROPERTY ID */

    const params =
        new URLSearchParams(
            window.location.search
        );


    const propertyId =
        params.get("property") || "";


    const property =
        properties.find(
            item =>
                String(item.id) === propertyId
        );


    const propertyContainer =
        document.getElementById(
            "applicationProperty"
        );


    if (!property) {

        propertyContainer.innerHTML = `

            <h3>
                Property not found
            </h3>

            <p>
                This property may no longer be available.
            </p>

        `;

        applicationForm.style.display =
            "none";

    } else {

        const price =
            new Intl.NumberFormat(
                "en-NG"
            ).format(
                property.price
            );


        propertyContainer.innerHTML = `

            <img
                src="${property.image}"
                alt="${property.title}"
            >

            <div>

                <h3>
                    ${property.title}
                </h3>

                <p>
                    <i class="bx bx-map" aria-hidden="true"></i> ${property.location},
                    ${property.city},
                    ${property.state}
                </p>

                <p>
                    ₦${price}
                    / ${property.period}
                </p>

            </div>

        `;

    }


    /* PREFILL USER INFORMATION */

    const applicantName =
        document.getElementById(
            "applicantName"
        );


    const applicantEmail =
        document.getElementById(
            "applicantEmail"
        );


    if (currentUser) {

        applicantName.value =
            currentUser.name || "";


        applicantEmail.value =
            currentUser.email || "";

    }


    /* SUBMIT */

    applicationForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            if (!property) return;


            let applications =
                JSON.parse(
                    localStorage.getItem(
"rentalApplications"
                    )
                ) || [];


            /* CHECK FOR DUPLICATE */

            const existingApplication =
                applications.find(
                    application =>
                        String(application.propertyId) === String(property.id) &&
                        String(application.tenantId) === String(currentUser.id) &&
String(application.status || "pending").toLowerCase() ===
                            "pending"
                );


            if (existingApplication) {

                alert(
                    "You already have a pending application for this property."
                );

                return;

            }


            const newApplication = {

                id:
                    "application_" +
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

                ownerId:
                    property.ownerId,

                ownerName:
                    property.ownerName ||
                    "Property Owner",

                tenantId:
                    currentUser.id,

                applicantName:
                    applicantName.value.trim(),

                applicantEmail:
                    applicantEmail.value.trim(),

                applicantPhone:
                    document.getElementById(
                        "applicantPhone"
                    ).value.trim(),

                occupants:
                    Number(
                        document.getElementById(
                            "occupants"
                        ).value
                    ),

                moveInDate:
                    document.getElementById(
                        "moveInDate"
                    ).value,

                stayLength:
                    document.getElementById(
                        "stayLength"
                    ).value,

                employmentStatus:
                    document.getElementById(
                        "employmentStatus"
                    ).value,

                incomeRange:
                    document.getElementById(
                        "incomeRange"
                    ).value,

                message:
                    document.getElementById(
                        "applicationMessage"
                    ).value.trim(),

                status:
                    "pending",

                createdAt:
                    new Date().toISOString()

            };


            try {
                const response = await window.LeaseAccomApi?.createApplication({
                    property_id: String(property.id),
                    applicant_name: newApplication.applicantName,
                    applicant_phone: newApplication.applicantPhone,
                    move_in_date: newApplication.moveInDate,
                    occupants: newApplication.occupants,
                    stay_length: newApplication.stayLength,
                    income_range: newApplication.incomeRange,
                    employment_status: newApplication.employmentStatus,
                    message: newApplication.message
                });
                const savedApplication = response?.application;
                if (savedApplication) {
                    Object.assign(newApplication, {
                        id: savedApplication.id,
                        propertyId: savedApplication.property_id,
                        tenantId: savedApplication.tenant_id,
                        ownerId: savedApplication.owner_id,
                        status: savedApplication.status,
                        createdAt: savedApplication.created_at
                    });
                }
            } catch (error) {
                alert(error.message || "Unable to submit your application.");
                return;
            }


            applications.push(
                newApplication
            );


            localStorage.setItem(
                "rentalApplications",
                JSON.stringify(
                    applications
                )
            );

            if (!Array.isArray(currentUser.applications)) {
                currentUser.applications = [];
            }

            if (!currentUser.applications.some(id =>
                String(id) === String(newApplication.id)
            )) {
                currentUser.applications.push(newApplication.id);
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


            alert(
                "Application submitted successfully!"
            );


            window.location.href =
                "tenant-dashboard.html";

        }
    );

    }
}

/* =========================================================
   LEASEACCOM - APP.JS
   ========================================================= */

/* =========================================================
   GLOBAL HELPERS
   ========================================================= */

function getLeaseAccomVerificationStatus(property) {
    if (typeof normalizeVerificationStatus === "function") {
        try {
            var n = normalizeVerificationStatus(property);
            if (n) return n;
        } catch (e) {}
    }

    const status = String(
        property?.verificationStatus ||
        property?.verification_status ||
        property?.listing_status ||
        property?.listingStatus ||
        ""
    )
        .trim()
        .toLowerCase();

    if (status === "rejected") return "rejected";
    if (status === "pending" || status === "pending verification" || status === "review") return "pending";
    if (
        status === "approved" ||
        status === "verified" ||
        status === "live" ||
        property?.verified === true ||
        property?.verified === "true"
    ) {
        return "approved";
    }

    return "pending";
}

function isLeaseAccomPropertyPublic(property) {
    return getLeaseAccomVerificationStatus(property) !== "rejected";
}

function isLeaseAccomPropertyVerified(property) {
    return getLeaseAccomVerificationStatus(property) === "approved";
}


/* =========================================================
   ID HELPERS — support demo numeric IDs and Supabase UUIDs
   ========================================================= */

function leaseaccomId(value) {
    if (value == null || value === "") return "";
    return String(value);
}

function leaseaccomIdsEqual(a, b) {
    return leaseaccomId(a) !== "" && leaseaccomId(a) === leaseaccomId(b);
}

function leaseaccomNormalizeIdList(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    const seen = Object.create(null);
    list.forEach(function (item) {
        const id = leaseaccomId(item);
        if (!id || seen[id]) return;
        // Drop pure NaN from legacy Number() corruption
        if (id === "NaN") return;
        seen[id] = true;
        out.push(id);
    });
    return out;
}

function getSavedProperties() {
    const savedValue = localStorage.getItem("savedProperties");

    if (savedValue === null) {
        try {
            const currentUser = JSON.parse(
                localStorage.getItem("leaseaccomCurrentUser") || "null"
            );
            const migrated = Array.isArray(currentUser?.savedProperties)
                ? leaseaccomNormalizeIdList(currentUser.savedProperties)
                : [];

            if (migrated.length > 0) {
                localStorage.setItem("savedProperties", JSON.stringify(migrated));
            }

            return migrated;
        } catch (error) {
            return [];
        }
    }

    try {
        const saved = JSON.parse(savedValue || "[]");
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        return [];
    }
}

function saveSavedProperties(saved) {
    const normalized = leaseaccomNormalizeIdList(saved);

    localStorage.setItem("savedProperties", JSON.stringify(normalized));

    try {
        const currentUser = JSON.parse(
            localStorage.getItem("leaseaccomCurrentUser") || "null"
        );

        if (!currentUser) return;

        currentUser.savedProperties = normalized;
        localStorage.setItem(
            "leaseaccomCurrentUser",
            JSON.stringify(currentUser)
        );

        const users = JSON.parse(
            localStorage.getItem("leaseaccomUsers") || "[]"
        );
        const userIndex = Array.isArray(users)
            ? users.findIndex(user =>
                (currentUser.id && user.id === currentUser.id) ||
                user.email === currentUser.email
            )
            : -1;

        if (userIndex >= 0) {
            users[userIndex].savedProperties = normalized;
            localStorage.setItem("leaseaccomUsers", JSON.stringify(users));
        }
    } catch (error) {
        // The shared saved list remains usable if account data is malformed.
    }
}


/* =========================================================
   RECENTLY VIEWED
   Keeps the last 10 properties opened on this device.
   ========================================================= */

const RECENTLY_VIEWED_KEY = "leaseaccomRecentlyViewed";
const RECENTLY_VIEWED_LIMIT = 10;

function getRecentlyViewedIds() {
    try {
        const recentlyViewed = JSON.parse(
            localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]"
        );

        return leaseaccomNormalizeIdList(Array.isArray(recentlyViewed) ? recentlyViewed : []);
    } catch (error) {
        return [];
    }
}

function addRecentlyViewed(id) {
    const propertyId = leaseaccomId(id);

    if (!propertyId) return;

    const ids = getRecentlyViewedIds().filter(
        existingId => !leaseaccomIdsEqual(existingId, propertyId)
    );

    // Most recently viewed first.
    ids.unshift(propertyId);

    localStorage.setItem(
        RECENTLY_VIEWED_KEY,
        JSON.stringify(ids.slice(0, RECENTLY_VIEWED_LIMIT))
    );
}

function getRecentlyViewedProperties() {
    return getRecentlyViewedIds()
        .map(id =>
            properties.find(
                property => leaseaccomIdsEqual(property.id, id)
            )
        )
        .filter(Boolean)
        .filter(isLeaseAccomPropertyPublic)
        .slice(0, RECENTLY_VIEWED_LIMIT);
}

function renderRecentlyViewed() {
    const container = document.getElementById("recentlyViewed");
    const section = document.getElementById("recentlyViewedSection");

    if (!container || !section) return;

    const recent = getRecentlyViewedProperties();

    if (!recent.length) {
        section.hidden = true;
        container.innerHTML = "";
        return;
    }

    section.hidden = false;

    container.innerHTML = recent
        .map(createPropertyCard)
        .join("");

    activateSaveButtons();
}


/* =========================================================
   PROPERTY CARD
   ========================================================= */

function createPropertyCard(property) {
    const propertyId = String(property.id);
    const saved = typeof getSavedProperties === "function"
        ? getSavedProperties().some(id => String(id) === propertyId)
        : false;
    const verified = typeof isLeaseAccomPropertyVerified === "function"
        ? isLeaseAccomPropertyVerified(property)
        : property.verified === true;
    const images = Array.isArray(property.images) && property.images.length
        ? property.images
        : [property.image].filter(Boolean);
    const image = images[0] || "";
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
    const price = new Intl.NumberFormat("en-NG").format(Number(property.price) || 0);
    const icon = name => `<i class="bx ${name}" aria-hidden="true"></i>`;
    const title = esc(property.title || "Untitled property");
    const location = esc(property.location || property.city || "Nigeria");
    const type = esc(property.type || "Property");
    const period = esc(property.period || "year");
    const beds = Number(property.bedrooms) > 0
        ? `<span>${icon("bx-bed")}${property.bedrooms} bed${Number(property.bedrooms) === 1 ? "" : "s"}</span>` : "";
    const baths = Number(property.bathrooms) > 0
        ? `<span>${icon("bx-bath")}${property.bathrooms} bath${Number(property.bathrooms) === 1 ? "" : "s"}</span>` : "";
    const size = property.size
        ? `<span>${icon("bx-area")}${esc(property.size)}</span>` : "";

    return `
        <article class="property-card leaseaccom-enhanced-card" data-property-id="${esc(propertyId)}"
            onclick="openProperty('${esc(propertyId)}')">
            <div class="property-image">
                <img src="${esc(image)}" alt="${title}" loading="lazy">
                <div class="badge ${verified ? "" : "pending-badge"}">
                    ${icon(verified ? "bx-check-circle" : "bx-time-five")}
                    ${verified ? "Verified" : "Pending Verification"}
                </div>
                <button type="button" class="save-btn ${saved ? "saved" : ""}"
                    data-id="${esc(propertyId)}"
                    aria-label="${saved ? "Remove saved property" : "Save property"}"
                    onclick="event.stopPropagation()">
                    ${icon("bx-heart")}
                </button>
                <button type="button" class="compare-card-btn"
                    data-compare-id="${esc(propertyId)}"
                    aria-label="Add property to comparison"
                    onclick="event.stopPropagation()">
                    ${icon("bx-git-compare")} Compare
                </button>
            </div>
            <div class="property-info">
                <div class="property-type">${type}</div>
                <h3>${title}</h3>
                <div class="property-location">${icon("bx-map")}${location}</div>
                <div class="property-price">₦${price} <span>/ ${period}</span></div>
                <div class="property-meta">${beds}${baths}${size}</div>
                <button type="button" class="view-property-btn"
                    onclick="event.stopPropagation(); openProperty('${esc(propertyId)}');">
                    View Property ${icon("bx-arrow-right")}
                </button>
            </div>
        </article>`;
}

/* =========================================================
   SAVE PROPERTY BUTTONS
   ========================================================= */

function activateSaveButtons() {

    const buttons = document.querySelectorAll(".save-btn");

    buttons.forEach(button => {

        button.addEventListener("click", function (event) {

            event.stopPropagation();

            const propertyId = String(this.dataset.id);

            let saved = getSavedProperties();

            const index = saved
                .map(String)
                .indexOf(propertyId);

            const shouldSave = index === -1;

            if (shouldSave) {

                saved.push(propertyId);

                this.classList.add("saved");
                this.textContent = "♥";

            } else {

                saved.splice(index, 1);

                this.classList.remove("saved");
                this.textContent = "♡";
            }

            saveSavedProperties(saved);

            if (window.persistSavedProperty) {
                window.persistSavedProperty(propertyId, shouldSave).catch(function () {
                    // The Supabase write is best-effort; local storage remains the active fallback.
                });
            } else if (window.toggleSave) {
                window.toggleSave(propertyId).catch(function () {
                    // Supabase fallback is already handled by local storage mirroring.
                });
            }
        });

    });

    document.querySelectorAll(".compare-card-btn").forEach(button => {
        button.addEventListener("click", event => {
            event.stopPropagation();

            const id = String(button.dataset.compareId);
            const selected = getComparedProperties();

            if (selected.map(String).includes(id)) {
                saveComparedProperties(selected.filter(propertyId => String(propertyId) !== id));
                button.classList.remove("selected");
            } else if (selected.length < 3) {
                saveComparedProperties([...selected, id]);
                button.classList.add("selected");
            }

            updateCompareTray();
        });
    });
}


/* =========================================================
   OPEN PROPERTY
   ========================================================= */

function openProperty(id) {

    const propertyId = String(id);

    if (!Array.isArray(properties)) {
        console.error("Properties data was not loaded.");
        return;
    }

    const property = properties.find(
        item => String(item.id) === propertyId
    );

    if (!property) {
        console.error("Property not found:", propertyId);
        return;
    }

    localStorage.setItem(
        "selectedProperty",
        JSON.stringify(property)
    );

    // Track this property in the Recently Viewed list.
    addRecentlyViewed(propertyId);

    window.location.href = `property-details.html?id=${propertyId}`;
}


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {


    /* =====================================================
       MOBILE MENU
       ===================================================== */

    const menuToggle =
        document.getElementById("menuToggle");

    const navMenu =
        document.getElementById("navMenu");

    if (menuToggle && navMenu) {

        menuToggle.addEventListener("click", () => {

            navMenu.classList.toggle("active");

            menuToggle.classList.toggle("active");

        });

    }


    /* =====================================================
       NAVIGATION DROPDOWN
       ===================================================== */

    const dropdowns =
        document.querySelectorAll(".dropdown");

    dropdowns.forEach(dropdown => {

        const trigger =
            dropdown.querySelector(".dropdown-toggle");

        if (!trigger) return;

        trigger.addEventListener("click", event => {

            event.preventDefault();

            dropdown.classList.toggle("active");

        });

    });


    /* =====================================================
       GENERAL SAVE BUTTON SUPPORT
       ===================================================== */

    activateSaveButtons();

});

/* =========================================================
   MARKETPLACE
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const marketplaceContainer =
        document.getElementById("marketplaceProperties");

    if (!marketplaceContainer) {
        return;
    }

    function loadMarketplaceProperties(list) {

        marketplaceContainer.innerHTML =
            list
                .filter(isLeaseAccomPropertyPublic)
                .map(property => createPropertyCard(property))
                .join("");

        activateSaveButtons();

        const noResults =
            document.getElementById("noResults");

        if (noResults) {
            noResults.style.display =
                list.length === 0 ? "block" : "none";
        }
    }

    loadMarketplaceProperties(properties);

});


    /* =====================================================
       MARKETPLACE CONTROLS
       ===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const marketplaceContainer =
        document.getElementById("marketplaceProperties");

    if (!marketplaceContainer) {
        return;
    }

    const searchInput =
        document.getElementById("marketSearch");

    const searchButton =
        document.getElementById("marketSearchBtn");

    const typeFilter =
        document.getElementById("filterType");

    const budgetFilter =
        document.getElementById("filterBudget");

    const verifiedFilter =
        document.getElementById("verifiedOnly");

    const sortSelect =
        document.getElementById("sortProperties");

    const resultsCount =
        document.getElementById("resultsCount");

    const noResults =
        document.getElementById("noResults");

    const clearFiltersButton =
        document.getElementById("clearFiltersBtn");


    /* =====================================================
       CHECK PROPERTY DATA
       ===================================================== */

    if (!Array.isArray(properties)) {

        console.error(
            "LeaseAccom: properties data is not available."
        );

        if (resultsCount) {
            resultsCount.textContent =
                "Unable to load properties";
        }

        return;
    }


    /* =====================================================
       RENDER MARKETPLACE
       ===================================================== */

    function renderMarketplace() {

        const search =
            searchInput
                ? searchInput.value.trim().toLowerCase()
                : "";

        const type =
            typeFilter
                ? typeFilter.value
                : "all";

        const maxBudget =
            !budgetFilter ||
            budgetFilter.value === "all"
                ? Infinity
                : Number(budgetFilter.value);

        const verified =
            verifiedFilter
                ? verifiedFilter.checked
                : false;


        /* =================================================
           FILTER PROPERTIES
           ================================================= */

        let results = properties.filter(property => {

            if (!isLeaseAccomPropertyPublic(property)) return false;

            const location =
                String(
                    property.location || ""
                ).toLowerCase();

            const city =
                String(
                    property.city || ""
                ).toLowerCase();

            const title =
                String(
                    property.title || ""
                ).toLowerCase();


            const searchMatch =
                !search ||
                title.includes(search) ||
                location.includes(search) ||
                city.includes(search);


            const typeMatch =
                type === "all" ||
                property.type === type;


            const budgetMatch =
                Number(property.price) <= maxBudget;


            const verifiedMatch =
                !verified ||
                isLeaseAccomPropertyVerified(property);


            return (
                searchMatch &&
                typeMatch &&
                budgetMatch &&
                verifiedMatch
            );

        });


        /* =================================================
           SORT PROPERTIES
           ================================================= */

        if (sortSelect) {

            if (sortSelect.value === "low") {

                results.sort(
                    (a, b) =>
                        Number(a.price) -
                        Number(b.price)
                );

            }

            if (sortSelect.value === "high") {

                results.sort(
                    (a, b) =>
                        Number(b.price) -
                        Number(a.price)
                );

            }

        }


        /* =================================================
           RESULTS COUNT
           ================================================= */

        if (resultsCount) {

            resultsCount.textContent =
                `${results.length} ${
                    results.length === 1
                        ? "property"
                        : "properties"
                } found`;

        }


        /* =================================================
           NO RESULTS
           ================================================= */

        if (results.length === 0) {

            marketplaceContainer.innerHTML = "";

            if (noResults) {
                noResults.style.display = "block";
            }

            return;
        }


        /* =================================================
           SHOW RESULTS
           ================================================= */

        if (noResults) {
            noResults.style.display = "none";
        }


        marketplaceContainer.innerHTML =
            results
                .map(createPropertyCard)
                .join("");


        /* =================================================
           ACTIVATE SAVE BUTTONS
           ================================================= */

        activateSaveButtons();

    }


    /* =====================================================
       SEARCH BUTTON
       ===================================================== */

    if (searchButton) {

        searchButton.addEventListener(
            "click",
            renderMarketplace
        );

    }


    /* =====================================================
       SEARCH ENTER KEY
       ===================================================== */

    if (searchInput) {

        searchInput.addEventListener(
            "keyup",
            event => {

                if (event.key === "Enter") {
                    renderMarketplace();
                }

            }
        );

    }


    /* =====================================================
       TYPE FILTER
       ===================================================== */

    if (typeFilter) {

        typeFilter.addEventListener(
            "change",
            renderMarketplace
        );

    }


    /* =====================================================
       BUDGET FILTER
       ===================================================== */

    if (budgetFilter) {

        budgetFilter.addEventListener(
            "change",
            renderMarketplace
        );

    }


    /* =====================================================
       VERIFIED FILTER
       ===================================================== */

    if (verifiedFilter) {

        verifiedFilter.addEventListener(
            "change",
            renderMarketplace
        );

    }


    /* =====================================================
       SORT
       ===================================================== */

    if (sortSelect) {

        sortSelect.addEventListener(
            "change",
            renderMarketplace
        );

    }


    /* =====================================================
       CLEAR FILTERS
       ===================================================== */

    if (clearFiltersButton) {

        clearFiltersButton.addEventListener(
            "click",
            () => {

                if (searchInput) searchInput.value = "";

                if (typeFilter) typeFilter.value = "all";

                if (budgetFilter) budgetFilter.value = "all";

                if (verifiedFilter) verifiedFilter.checked = false;

                if (sortSelect) sortSelect.value = "recommended";

                renderMarketplace();

            }
        );

    }


    /* =====================================================
       INITIAL RENDER
       ===================================================== */

    renderMarketplace();

    if (window.loadLeaseAccomPropertyCatalog) {
        window.loadLeaseAccomPropertyCatalog().then(renderMarketplace).catch(() => {});
    }

    renderRecentlyViewed();

});


/* =========================================================
   OWNER DASHBOARD — VIEWING REQUESTS
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    // Only run this code on the owner dashboard
    const ownerViewingContainer =
        document.getElementById("ownerViewingRequests");

    if (!ownerViewingContainer) {
        return;
    }

    const ownerViewingCount =
        document.getElementById("ownerViewingCount");

    const emptyOwnerViewings =
        document.getElementById("emptyOwnerViewings");


    /* ---------------------------------------------------------
       GET VIEWING REQUESTS
       --------------------------------------------------------- */

    function getViewingRequests() {

        try {

            return JSON.parse(
                localStorage.getItem("viewingRequests")
            ) || [];

        } catch (error) {

            console.error(
                "Could not load viewing requests:",
                error
            );

            return [];

        }

    }


    /* ---------------------------------------------------------
       SAVE VIEWING REQUESTS
       --------------------------------------------------------- */

    function saveViewingRequests(requests) {

        localStorage.setItem(
            "viewingRequests",
            JSON.stringify(requests)
        );

    }


    /* ---------------------------------------------------------
       GET OWNER PROPERTIES
       --------------------------------------------------------- */

    function getOwnerProperties() {

        try {

            const savedProperties =
                JSON.parse(
                    localStorage.getItem("leaseaccomProperties")
                ) || [];

            return savedProperties;

        } catch (error) {

            console.error(
                "Could not load owner properties:",
                error
            );

            return [];

        }

    }


    /* ---------------------------------------------------------
       DISPLAY VIEWING REQUESTS
       --------------------------------------------------------- */

    function renderOwnerViewingRequests() {

        const requests = getViewingRequests();
        const ownerProperties = getOwnerProperties();


        /*
         * Find requests connected to properties
         * that were added by the owner.
         *
         * For now, if there are no saved owner properties,
         * we also check the global properties array.
         */

        let propertiesToCheck = ownerProperties;

        if (
            propertiesToCheck.length === 0 &&
            typeof properties !== "undefined"
        ) {

            propertiesToCheck = properties;

        }


        // Get property IDs belonging to this owner
        const ownerPropertyIds =
            propertiesToCheck.map(function (property) {

                return String(property.id);

            });


        /*
         * Filter requests so the owner only sees
         * requests for their properties.
         */

        let ownerRequests =
            requests.filter(function (request) {

                return ownerPropertyIds.includes(
                    String(request.propertyId)
                );

            });


        /*
         * If we don't yet have owner IDs attached to
         * properties, display all requests.
         *
         * This makes the current demo system work
         * immediately.
         */

        if (
            ownerPropertyIds.length === 0 &&
            requests.length > 0
        ) {

            ownerRequests = requests;

        }


        // Update number at top of dashboard
        if (ownerViewingCount) {

            ownerViewingCount.textContent =
                ownerRequests.length;

        }


        // Clear existing requests
        ownerViewingContainer.innerHTML = "";


        // No requests
        if (ownerRequests.length === 0) {

            ownerViewingContainer.style.display = "none";

            if (emptyOwnerViewings) {
                emptyOwnerViewings.style.display = "block";
            }

            return;

        }


        // Show request area
        ownerViewingContainer.style.display = "grid";

        if (emptyOwnerViewings) {
            emptyOwnerViewings.style.display = "none";
        }


        /*
         * Newest requests first
         */

        ownerRequests
            .slice()
            .reverse()
            .forEach(function (request) {

                const card =
                    document.createElement("div");

                card.className = "viewing-request-card";


                const status = window.LeaseAccomStatus
                    ? window.LeaseAccomStatus.normalizeViewingStatus(request.status)
                    : (request.status || "pending");

                let statusClass = "pending";
                if (status === "accepted" || status === "completed") statusClass = "accepted";
                if (status === "declined" || status === "cancelled") statusClass = "declined";
                const statusLabel = window.LeaseAccomStatus
                    ? window.LeaseAccomStatus.viewingLabel(status)
                    : status;
                const timelineHtml = window.LeaseAccomStatus
                    ? window.LeaseAccomStatus.timelineHtml("viewing", status)
                    : "";


                /*
                 * Format date
                 */

                let formattedDate =
                    request.viewingDate || "Not specified";

                if (request.viewingDate) {

                    const date =
                        new Date(request.viewingDate);

                    if (!isNaN(date)) {

                        formattedDate =
                            date.toLocaleDateString(
                                "en-NG",
                                {
                                    weekday: "short",
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric"
                                }
                            );

                    }

                }


                card.innerHTML = `

                    <div class="viewing-request-header">

                        <div>

                            <span class="request-label">
                                VIEWING REQUEST
                            </span>

                            <h3>
                                ${request.propertyTitle || "Property"}
                            </h3>

                        </div>

                        <span class="
                            request-status
                            status-${statusClass}
                        ">
                            ${statusLabel}
                        </span>

                    </div>


                    <div class="viewing-request-details">

                        <div class="request-detail">

                            <span class="detail-icon">
                                👤
                            </span>

                            <div>

                                <small>
                                    Tenant
                                </small>

                                <strong>
                                    ${request.viewerName || "Tenant"}
                                </strong>

                            </div>

                        </div>


                        <div class="request-detail">

                            <span class="detail-icon">
                                📅
                            </span>

                            <div>

                                <small>
                                    Viewing date
                                </small>

                                <strong>
                                    ${formattedDate}
                                </strong>

                            </div>

                        </div>


                        <div class="request-detail">

                            <span class="detail-icon">
                                <i class="bx bx-time-five" aria-hidden="true"></i>
                            </span>

                            <div>

                                <small>
                                    Viewing time
                                </small>

                                <strong>
                                    ${request.viewingTime || "Not specified"}
                                </strong>

                            </div>

                        </div>

                    </div>


                    ${
                        status === "requested" || status === "pending"

                        ? `

                            <div class="viewing-request-actions">

                                <button
                                    class="accept-viewing-btn"
                                    data-request-id="${request.id}"
                                >
                                    ✓ Accept Request
                                </button>

                                <button
                                    class="decline-viewing-btn"
                                    data-request-id="${request.id}"
                                >
                                    ✕ Decline
                                </button>

                            </div>

                        `

                        : status === "accepted"

                        ? `

                            <div class="viewing-request-actions">
                                <button
                                    class="accept-viewing-btn"
                                    data-complete-viewing="1"
                                    data-request-id="${request.id}"
                                >
                                    ✓ Mark completed
                                </button>
                            </div>
                            <div class="viewing-request-result">
                                ✓ Accepted — mark completed after the visit.
                            </div>

                        `

                        : `

                            <div class="viewing-request-result">

                                ${
                                    status === "completed"
                                    ? "✓ Viewing completed."
                                    : status === "declined"
                                    ? "✕ You declined this viewing request."
                                    : "Status updated."
                                }

                            </div>

                        `
                    }

                    ${timelineHtml}

                `;


                ownerViewingContainer.appendChild(card);

            });


        activateViewingButtons();

    }


    /* ---------------------------------------------------------
       ACCEPT / DECLINE BUTTONS
       --------------------------------------------------------- */

    function activateViewingButtons() {

        const acceptButtons =
            document.querySelectorAll(
                ".accept-viewing-btn"
            );


        const declineButtons =
            document.querySelectorAll(
                ".decline-viewing-btn"
            );


        /* ACCEPT */

        acceptButtons.forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    const requestId =
                        Number(
                            button.dataset.requestId
                        );


                    updateViewingStatus(
                        requestId,
                        "accepted"
                    );

                }
            );

        });


        /* DECLINE */

        declineButtons.forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    const requestId =
                        Number(
                            button.dataset.requestId
                        );


                    updateViewingStatus(
                        requestId,
                        "declined"
                    );

                }
            );

        });

        var completeButtons =
            ownerViewingContainer.querySelectorAll(
                "[data-complete-viewing]"
            );

        completeButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                const requestId = Number(button.dataset.requestId);
                updateViewingStatus(requestId, "completed");
            });
        });

        var reviewAppButtons =
            document.querySelectorAll("[data-app-status]");
        reviewAppButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                const appId = button.getAttribute("data-app-id");
                const next = button.getAttribute("data-app-status");
                updateApplicationStatusShared(appId, next);
            });
        });

    }

    function updateApplicationStatusShared(appId, newStatus) {
        try {
            var apps = JSON.parse(localStorage.getItem("rentalApplications") || "[]") || [];
            var app = apps.find(function (a) { return String(a.id) === String(appId); });
            if (!app) return;
            var normalized = newStatus;
            if (window.LeaseAccomStatus) {
                normalized = window.LeaseAccomStatus.normalizeApplicationStatus(newStatus);
                window.LeaseAccomStatus.pushHistory(app, normalized, "owner");
            }
            app.status = normalized;
            app.updatedAt = new Date().toISOString();
            localStorage.setItem("rentalApplications", JSON.stringify(apps));
            if (typeof renderOwnerApplications === "function") {
                renderOwnerApplications();
            } else {
                window.location.reload();
            }
        } catch (e) {
            console.error(e);
        }
    }


    /* ---------------------------------------------------------
       UPDATE REQUEST STATUS
       --------------------------------------------------------- */

    function updateViewingStatus(
        requestId,
        newStatus
    ) {

        const requests =
            getViewingRequests();


        const request =
            requests.find(function (item) {

                return Number(item.id) ===
                    Number(requestId);

            });


        if (!request) {

            console.error(
                "Viewing request not found."
            );

            return;

        }


        var normalized = newStatus;
        if (window.LeaseAccomStatus) {
            normalized = window.LeaseAccomStatus.normalizeViewingStatus(newStatus);
            window.LeaseAccomStatus.pushHistory(request, normalized, "owner");
        }

        request.status = normalized;

        request.updatedAt =
            new Date().toISOString();


        saveViewingRequests(requests);


        renderOwnerViewingRequests();

    }


    /* ---------------------------------------------------------
       INITIAL LOAD
       --------------------------------------------------------- */

    renderOwnerViewingRequests();


});

/* =========================================================
   LANDING PAGE LOCATION MAP
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    const mapElement = document.getElementById("landingMap");
    const searchForm = document.getElementById("locationMapForm");
    const searchInput = document.getElementById("locationMapInput");
    const locationButton = document.getElementById("useMyLocation");
    const status = document.getElementById("locationMapStatus");

    if (!mapElement || typeof L === "undefined") return;

    const coordinates = {
        Lagos: [6.5244, 3.3792],
        Abuja: [9.0765, 7.3986],
        "Port Harcourt": [4.8156, 7.0498],
        Ibadan: [7.3775, 3.9470],
        "Benin City": [6.3350, 5.6037],
        Enugu: [6.4584, 7.5464],
        Kano: [12.0022, 8.5920],
        Kaduna: [10.5105, 7.4165],
        Nsukka: [6.8567, 7.3950]
    };

    const landingMap = L.map(mapElement).setView([7.5, 6.5], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(landingMap);

    properties.forEach(property => {
        const position = coordinates[property.city];
        if (!position) return;

        L.marker(position)
            .addTo(landingMap)
            .bindPopup(`<strong>${property.title}</strong><br>${property.location}<br>₦${new Intl.NumberFormat("en-NG").format(property.price)} / ${property.period}`);
    });

    function searchLocation(query) {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return;

        const property = properties.find(item =>
            item.city.toLowerCase().includes(normalizedQuery) ||
            item.location.toLowerCase().includes(normalizedQuery)
        );

        if (!property) {
            status.textContent = "We couldn't find that place in the current property listings.";
            return;
        }

        const position = coordinates[property.city];
        landingMap.setView(position, 11);
        status.textContent = `Showing properties near ${property.location}.`;
    }

    searchForm?.addEventListener("submit", event => {
        event.preventDefault();
        searchLocation(searchInput.value);
    });

    locationButton?.addEventListener("click", () => {
        if (!navigator.geolocation) {
            status.textContent = "Location services are not available in this browser.";
            return;
        }

        status.textContent = "Finding your location...";
        navigator.geolocation.getCurrentPosition(
            position => {
                const userPosition = [position.coords.latitude, position.coords.longitude];
                landingMap.setView(userPosition, 13);
                L.marker(userPosition)
                    .addTo(landingMap)
                    .bindPopup("You are here")
                    .openPopup();
                status.textContent = "Showing your current location.";
            },
            () => {
                status.textContent = "We couldn't access your location. Search for a city instead.";
            }
        );
    });
});

/* =========================================================
   LANDING PAGE STATISTICS
   Fixed: set real numbers immediately so users never see stuck "0".
   Still animates when the stats section scrolls into view.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    const statNumbers = document.querySelectorAll("[data-stat]");
    if (!statNumbers.length || !Array.isArray(properties)) return;

    const publicFn = typeof isLeaseAccomPropertyPublic === "function"
        ? isLeaseAccomPropertyPublic
        : function () { return true; };
    const verifiedFn = typeof isLeaseAccomPropertyVerified === "function"
        ? isLeaseAccomPropertyVerified
        : function (p) { return p && p.verified; };

    const publicProperties = properties.filter(publicFn);

    const values = {
        properties: publicProperties.length,
        verified: publicProperties.filter(verifiedFn).length,
        cities: new Set(
            publicProperties.map(function (property) { return property.city; }).filter(Boolean)
        ).size
    };

    // Set correct numbers immediately (never leave stuck at 0)
    statNumbers.forEach(function (el) {
        const key = el.dataset.stat;
        if (key === "direct") return;
        if (values[key] !== undefined) {
            el.textContent = String(values[key]);
        }
    });

    function animateStat(element, target) {
        if (element.dataset.stat === "direct") return;

        const duration = 900;
        const start = performance.now();

        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            element.textContent = Math.round(progress * target).toLocaleString();
            if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            const target = values[entry.target.dataset.stat];
            if (target !== undefined) animateStat(entry.target, target);
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.2 });

    statNumbers.forEach(function (stat) { observer.observe(stat); });
});

/* =========================================================
   OWNER RENTAL APPLICATIONS
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const applicationsContainer =
        document.getElementById("ownerRentalApplications");

    if (!applicationsContainer) {
        return;
    }

    // The dedicated applications UI owns this dashboard section when loaded.
    // Keep this legacy renderer available only as a fallback on older pages.
    if (document.querySelector('script[src$="applications-ui.js"]')) {
        return;
    }

    const emptyApplications =
        document.getElementById("emptyOwnerApplications");

    const applicationCount =
        document.getElementById("ownerApplicationCount");


    function getApplications() {
        try {
            const storedApplications = JSON.parse(
                localStorage.getItem("rentalApplications") || "[]"
            );

            return Array.isArray(storedApplications)
                ? storedApplications
                : [];
        } catch (error) {
            console.warn("LeaseAccom applications could not be read.", error);
            return [];
        }
    }


    function getOwnerProperties() {
        try {
            const storedProperties = JSON.parse(
                localStorage.getItem("leaseaccomProperties") || "[]"
            );

            return Array.isArray(storedProperties)
                ? storedProperties
                : [];
        } catch (error) {
            console.warn("LeaseAccom owner properties could not be read.", error);
            return [];
        }
    }


    function loadOwnerApplications() {

        const applications = getApplications();
        const properties = getOwnerProperties();


        /*
         * Find the properties belonging to this owner.
         * The owner name is taken from the owner profile.
         */

        let ownerProfile = {};

        try {
            ownerProfile = JSON.parse(
                localStorage.getItem("leaseaccomOwnerProfile") || "{}"
            ) || {};
        } catch (error) {
            ownerProfile = {};
        }

        const currentUser = (() => {
            try {
                return JSON.parse(
                    localStorage.getItem("leaseaccomCurrentUser") || "null"
                );
            } catch (error) {
                return null;
            }
        })();

        const ownerId = currentUser?.id;
        const ownerName =
            ownerProfile.name ||
            ownerProfile.fullName ||
            ownerProfile.ownerName ||
            currentUser?.name ||
            "";

        const ownerProperties = properties.filter(property => {
            if (ownerId !== undefined && ownerId !== null && property.ownerId !== undefined) {
                return String(property.ownerId) === String(ownerId);
            }

            return Boolean(ownerName) && property.ownerName === ownerName;
        });


        const ownerPropertyIds =
            ownerProperties.map(property => String(property.id));


        let ownerApplications =
            applications.filter(application => {

                return ownerPropertyIds.includes(
                    String(application.propertyId)
                );

            });

        /* Demo fallback: show all applications if owner has no matched property ids */
        if (ownerApplications.length === 0 && applications.length > 0) {
            ownerApplications = applications.slice();
        }


        /* Update application count */

        if (applicationCount) {

            applicationCount.textContent =
                ownerApplications.length;

        }


        /* No applications */

        if (ownerApplications.length === 0) {

            applicationsContainer.innerHTML = "";

            if (emptyApplications) {
                emptyApplications.style.display = "block";
            }

            return;

        }


        if (emptyApplications) {
            emptyApplications.style.display = "none";
        }


        applicationsContainer.innerHTML =
            ownerApplications
                .sort((a, b) => {

                    return new Date(b.createdAt) -
                           new Date(a.createdAt);

                })
                .map(application => {

                    return createApplicationCard(
                        application
                    );

                })
                .join("");


        attachApplicationActions();

    }


    function createApplicationCard(application) {

        const S = window.LeaseAccomStatus;
        const status = S
            ? S.normalizeApplicationStatus(application.status)
            : String(application.status || "submitted").toLowerCase();

        const statusText = S ? S.applicationLabel(status) : status;
        let statusClass = "pending-badge";
        if (status === "accepted") statusClass = "verified-badge";
        if (status === "rejected" || status === "withdrawn") statusClass = "rejected-badge";
        if (status === "under_review") statusClass = "review-badge";

        const timelineHtml = S ? S.timelineHtml("application", status) : "";

        const moveInDate =
            application.moveInDate
                ? new Date(application.moveInDate).toLocaleDateString("en-NG", {
                    day: "numeric", month: "long", year: "numeric"
                  })
                : "Not specified";

        const submittedDate =
            application.createdAt || application.submittedAt
                ? new Date(application.createdAt || application.submittedAt).toLocaleDateString("en-NG", {
                    day: "numeric", month: "long", year: "numeric"
                  })
                : "Unknown";

        const openActions = (status === "submitted" || status === "pending");
        const reviewActions = (status === "under_review");

        let actionsHtml = "";
        if (openActions) {
            actionsHtml = `
                <div class="application-actions">
                    <button type="button" class="secondary-btn application-review-btn" data-application-id="${application.id}">
                        Mark under review
                    </button>
                    <button type="button" class="primary-btn application-accept-btn" data-application-id="${application.id}">
                        Accept
                    </button>
                    <button type="button" class="secondary-btn application-reject-btn" data-application-id="${application.id}">
                        Reject
                    </button>
                </div>`;
        } else if (reviewActions) {
            actionsHtml = `
                <div class="application-actions">
                    <button type="button" class="primary-btn application-accept-btn" data-application-id="${application.id}">
                        Accept
                    </button>
                    <button type="button" class="secondary-btn application-reject-btn" data-application-id="${application.id}">
                        Reject
                    </button>
                </div>`;
        } else {
            actionsHtml = `
                <div class="application-status-message">
                    ${status === "accepted"
                        ? "✓ You accepted this rental application."
                        : status === "rejected"
                        ? "This rental application was rejected."
                        : "Status updated."}
                </div>`;
        }

        return `
            <article class="viewing-card application-card lh-status-card">
                <div class="viewing-card-top">
                    <div>
                        <span class="section-label">RENTAL APPLICATION</span>
                        <h3>${escapeApplicationText(application.propertyTitle || "Property")}</h3>
                    </div>
                    <span class="${statusClass}">${statusText}</span>
                </div>
                <div class="viewing-card-body">
                    <p><strong>Applicant:</strong> ${escapeApplicationText(application.applicantName || application.name || "Tenant")}</p>
                    <p><strong>Email:</strong> ${escapeApplicationText(application.applicantEmail || application.email || "—")}</p>
                    <p><strong>Phone:</strong> ${escapeApplicationText(application.applicantPhone || application.phone || "—")}</p>
                    <p><strong>Move-in:</strong> ${moveInDate}</p>
                    <p><strong>Submitted:</strong> ${submittedDate}</p>
                    ${application.message ? `<p><strong>Note:</strong> ${escapeApplicationText(application.message)}</p>` : ""}
                </div>
                ${timelineHtml}
                ${actionsHtml}
                <p class="lh-status-hint">Tenant sees the same status on their dashboard.</p>
            </article>
        `;

    }


    function attachApplicationActions() {

        const acceptButtons =
            document.querySelectorAll(
                ".application-accept-btn"
            );


        const rejectButtons =
            document.querySelectorAll(
                ".application-reject-btn"
            );


        acceptButtons.forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    updateApplicationStatus(
                        button.dataset.applicationId,
                        "accepted"
                    );

                }
            );

        });


        rejectButtons.forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    updateApplicationStatus(
                        button.dataset.applicationId,
                        "rejected"
                    );

                }
            );

        });

    }


        document.querySelectorAll(".application-review-btn").forEach(function (button) {
            button.addEventListener("click", function () {
                updateApplicationStatus(button.dataset.applicationId, "under_review");
            });
        });


    function updateApplicationStatus(
        applicationId,
        newStatus
    ) {

        const applications = getApplications();


        const applicationIndex =
            applications.findIndex(
                application =>
                    String(application.id) ===
                    String(applicationId)
            );


        if (applicationIndex === -1) {

            alert(
                "Application could not be found."
            );

            return;

        }


        var normalized = newStatus;
        if (window.LeaseAccomStatus) {
            normalized = window.LeaseAccomStatus.normalizeApplicationStatus(newStatus);
            window.LeaseAccomStatus.pushHistory(applications[applicationIndex], normalized, "owner");
        }

        applications[applicationIndex].status = normalized;
        applications[applicationIndex].updatedAt = new Date().toISOString();

        localStorage.setItem(
            "rentalApplications",
            JSON.stringify(applications)
        );

        loadOwnerApplications();

        if (normalized === "accepted") {
            window.location.href =
                "rental-agreement.html?applicationId=" +
                encodeURIComponent(applications[applicationIndex].id);
            return;
        }

        var msg = "Application status updated.";
        if (normalized === "under_review") msg = "Marked as Under review.";
        if (normalized === "rejected") msg = "Rental application rejected.";
        alert(msg);

    }


    function escapeApplicationText(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    loadOwnerApplications();


    window.addEventListener(
        "storage",
        loadOwnerApplications
    );

});

/* =========================================================
   LEASEACCOM — LOADING SYSTEM
   ========================================================= */

(function () {
    "use strict";

    /* ---------- PAGE LOADER ---------- */

    function createPageLoader() {
        if (document.getElementById("leaseaccomPageLoader")) {
            return;
        }

        const loader = document.createElement("div");

        loader.id = "leaseaccomPageLoader";

        loader.innerHTML = `
            <div class="leaseaccom-loader-content">
                <img
                    class="leaseaccom-loader-logo"
                    src="IMAGES/leaseaccom-logo-full.png"
                    alt="LeaseAccom"
                >

                <div
                    class="leaseaccom-loader-spinner"
                    aria-hidden="true"
                ></div>

                <div class="leaseaccom-loader-text">
                    Loading LeaseAccom...
                </div>
            </div>
        `;

        document.body.prepend(loader);
    }


    window.showPageLoader = function () {
        createPageLoader();

        const loader =
            document.getElementById("leaseaccomPageLoader");

        if (!loader) return;

        loader.classList.remove("is-hidden");
    };


    window.hidePageLoader = function () {
        const loader =
            document.getElementById("leaseaccomPageLoader");

        if (!loader) return;

        loader.classList.add("is-hidden");
    };


    /* ---------- BUTTON LOADING ---------- */

    window.setButtonLoading = function (button, loading) {
        if (!button) return;

        if (loading) {
            if (button.classList.contains("leaseaccom-btn-loading")) {
                return;
            }

            button.dataset.originalText = button.innerHTML;

            button.classList.add("leaseaccom-btn-loading");
            button.setAttribute("aria-busy", "true");
            button.disabled = true;

            const spinner = document.createElement("span");

            spinner.className = "leaseaccom-btn-spinner";
            spinner.setAttribute("aria-hidden", "true");

            button.appendChild(spinner);

        } else {
            button.classList.remove("leaseaccom-btn-loading");
            button.removeAttribute("aria-busy");

            button.disabled = false;

            if (button.dataset.originalText !== undefined) {
                button.innerHTML = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    };


    /* ---------- IMAGE LOADING ---------- */

    function setupImageLoading() {
        const images = document.querySelectorAll(
            "img:not(.leaseaccom-loader-logo)"
        );

        images.forEach(function (image) {

            if (
                image.complete &&
                image.naturalWidth > 0
            ) {
                image.classList.add(
                    "leaseaccom-image-loaded"
                );

                return;
            }

            image.classList.add(
                "leaseaccom-image-loading"
            );

            image.addEventListener(
                "load",
                function () {
                    image.classList.remove(
                        "leaseaccom-image-loading"
                    );

                    image.classList.add(
                        "leaseaccom-image-loaded"
                    );
                },
                { once: true }
            );

            image.addEventListener(
                "error",
                function () {
                    image.classList.remove(
                        "leaseaccom-image-loading"
                    );

                    image.classList.add(
                        "leaseaccom-image-loaded"
                    );
                },
                { once: true }
            );
        });
    }


    /* ---------- CONTENT FADE ---------- */

    function setupContentFade() {
        const elements = document.querySelectorAll(
            "main > section, .property-card, .category-card, .step, .stat-item"
        );

        elements.forEach(function (element) {
            element.classList.add(
                "leaseaccom-content-ready"
            );
        });
    }


    /* ---------- INITIALIZE ---------- */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        createPageLoader();

        setupImageLoading();

        setupContentFade();

        setTimeout(function () {
            hidePageLoader();
        }, 3000);
    }
);
})();
/* =========================================================
   LEASEACCOM — FINAL UX POLISH
   ========================================================= */
(function () {
    "use strict";
    const icon = name => `<i class="bx ${name}" aria-hidden="true"></i>`;
    function syncCompareButtons() {
        let selected=[]; try { selected=JSON.parse(localStorage.getItem("compareProperties")||"[]").map(Number); } catch {}
        document.querySelectorAll(".compare-card-btn[data-compare-id]").forEach(btn => btn.classList.toggle("selected", selected.includes(Number(btn.dataset.compareId))));
    }
    function bindEnhancedSaveAndCompare() {
        document.querySelectorAll(".save-btn[data-id]").forEach(button => {
            if (button.dataset.leaseaccomSaveBound) return;
            button.dataset.leaseaccomSaveBound="1";
            button.addEventListener("click", event => {
                event.stopPropagation();
                const id=Number(button.dataset.id);
                let saved=typeof getSavedProperties==="function"?getSavedProperties():[];
                const exists=saved.map(Number).includes(id);
                saved=exists?saved.filter(x=>Number(x)!==id):[...saved,id];
                if(typeof saveSavedProperties==="function")saveSavedProperties(saved);
                button.classList.toggle("saved",!exists);
                button.setAttribute("aria-label",!exists?"Remove saved property":"Save property");
                button.innerHTML=icon("bx-heart");
                button.animate?.([{transform:"scale(1)"},{transform:"scale(1.2)"},{transform:"scale(1)"}],{duration:280});
                if(typeof leaseaccomToast==="function")leaseaccomToast(exists?"Removed from saved properties":"Property saved");
            });
        });
        document.querySelectorAll(".compare-card-btn[data-compare-id]").forEach(button => {
            if(button.dataset.leaseaccomCompareBound)return;
            button.dataset.leaseaccomCompareBound="1";
            button.addEventListener("click",event=>{
                event.stopPropagation();
                const id=Number(button.dataset.compareId);
                const current=typeof getComparedProperties==="function"?getComparedProperties().map(Number):[];
                if(current.includes(id)) saveComparedProperties(current.filter(x=>x!==id));
                else if(current.length<3) saveComparedProperties([...current,id]);
                else { if(typeof leaseaccomToast==="function")leaseaccomToast("Compare up to 3 properties","error"); return; }
                if(typeof updateCompareTray==="function")updateCompareTray();
                syncCompareButtons();
            });
        });
        syncCompareButtons();
    }
    function patchApplicationModal() {
        const modal=document.getElementById("applicationModal"), content=modal?.querySelector(".modal-content");
        if(!modal||!content||content.dataset.leaseaccomPatched)return;
        content.dataset.leaseaccomPatched="1";
        const close=()=>{modal.classList.remove("active");document.body.classList.remove("modal-open");};
        content.querySelector("#closeApplicationModal")?.addEventListener("click",close);
        modal.addEventListener("click",e=>{if(e.target===modal)close();});
        document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal.classList.contains("active"))close();});
        const back=document.createElement("button"); back.type="button"; back.className="application-modal-back";
        back.innerHTML=`${icon("bx-arrow-back")} Back to property`; back.addEventListener("click",close);
        const label=content.querySelector(".section-label"); if(label)content.insertBefore(back,label);
    }
    document.addEventListener("DOMContentLoaded",()=>{patchApplicationModal();bindEnhancedSaveAndCompare();document.querySelectorAll(".property-grid").forEach(g=>g.classList.add("leaseaccom-stagger"));});
})();
