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
        typeof isLeaseHubPropertyVerified === "function"
            ? isLeaseHubPropertyVerified(property)
            : property.verified === true &&
              String(property.verificationStatus || "approved").toLowerCase() !== "rejected";

    const isRejected =
        typeof isLeaseHubPropertyPublic === "function"
            ? !isLeaseHubPropertyPublic(property)
            : String(property.verificationStatus || "").toLowerCase() === "rejected";

    // Rejected properties should not appear
    // on the public marketplace.
    if (isRejected) {
        return "";
    }

    return `

        <article
            class="property-card"
            onclick="openProperty(${property.id})"
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
                    <div class="badge">
                        ✓ Verified
                    </div>
                    `
                    :
                    `
                    <div class="badge pending-badge">
                        Pending Verification
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

    if (!featuredContainer) return;

    const visibleProperties =
        properties
            .filter(isLeaseHubPropertyPublic)
            .slice(0, 6);

    featuredContainer.innerHTML =
        visibleProperties
            .map(createPropertyCard)
            .join("");

    activateSaveButtons();
}

    /* ================= SAVE PROPERTY ================= */

    function activateSaveButtons() {

        document
            .querySelectorAll(".save-btn")
            .forEach(button => {

                button.addEventListener("click", () => {

                    const id =
                        normalizeLeaseHubPropertyId(button.dataset.id);

                    let saved =
                        JSON.parse(
                            localStorage.getItem("savedProperties")
                        ) || [];
                    saved = saved.map(normalizeLeaseHubPropertyId);

                    if (saved.includes(id)) {

                        saved =
                            saved.filter(
                                propertyId =>
                                    propertyId !== id
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
                "leasehubSearchResults",
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
        const request = parseAssistantRequest(query);
        const matches = properties.filter((property) => (
            isLeaseHubPropertyPublic(property) &&
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
            addAssistantMessage("I’m LeaseHub Assistant. I can chat with you, explain how LeaseHub works, and find properties by location, type, bedrooms, and budget.");
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
            addAssistantMessage("Verified badges identify listings approved by LeaseHub. You can also use the Verified Only filter when browsing properties.");
            return;
        }

        if (/\b(account|register|sign up|login|log in|password)\b/.test(normalizedQuery)) {
            addAssistantMessage("Use Register to create a tenant or owner account, then use Login to access your dashboard and LeaseHub features.");
            return;
        }

        if (/\b(leasehub|how does this work|how it works|safe|verified|agent fee|fees)\b/.test(normalizedQuery) &&
            !/\b(apartment|house|duplex|shortlet|office|shop|bedroom|under|below|rent|property)\b/.test(normalizedQuery)) {
            addAssistantMessage("LeaseHub connects you directly with property owners and highlights verified listings, helping you search without unnecessary traditional agent fees.");
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
            addAssistantMessage("I can chat about LeaseHub or help you find a property. Try “a house in Abuja” or “an apartment under ₦3m”.");
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


    /* Mobile navigation is handled centrally by JS/leasehub-polish.js. */


    /* ================= INITIALIZE ================= */

    if (window.loadLeaseHubPropertyCatalog) {
        window.loadLeaseHubPropertyCatalog().then(loadFeatured);
    } else {
        loadFeatured();
    }

});

function getComparedProperties() {
    return (JSON.parse(localStorage.getItem("compareProperties")) || []).map(normalizeLeaseHubPropertyId);
}

function normalizeLeaseHubPropertyId(value) {
    const id = String(value ?? "").trim();
    return /^\d+$/.test(id) ? Number(id) : id;
}

function saveComparedProperties(ids) {
    localStorage.setItem("compareProperties", JSON.stringify(ids.map(normalizeLeaseHubPropertyId).slice(0, 3)));
}

function updateCompareTray() {
    const tray = document.getElementById("compareTray");
    const selectedContainer = document.getElementById("compareSelected");
    const count = document.getElementById("compareCount");
    const compareButton = document.getElementById("compareBtn");

    if (!tray || !selectedContainer || !count || !compareButton) return;

    const selected = getComparedProperties()
        .map(id => properties.find(property => normalizeLeaseHubPropertyId(property.id) === id))
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
        .map(id => properties.find(property => normalizeLeaseHubPropertyId(property.id) === id))
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

            if (!isLeaseHubPropertyPublic(property)) return false;

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
                    isLeaseHubPropertyVerified(property);

                const savedMatch =
                    !savedOnly ||
                    getSavedProperties().includes(property.id);


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
        const savedSearches = JSON.parse(localStorage.getItem("leasehubSavedSearches")) || [];
        const search = {
            text: searchInput.value.trim(),
            type: typeFilter.value,
            budget: budgetFilter.value,
            verified: verifiedFilter.checked,
            createdAt: new Date().toISOString()
        };

        const duplicate = savedSearches.some(item =>
            item.text === search.text &&
            item.type === search.type &&
            item.budget === search.budget &&
            item.verified === search.verified
        );

        if (!duplicate) savedSearches.unshift(search);
        localStorage.setItem("leasehubSavedSearches", JSON.stringify(savedSearches.slice(0, 10)));
        showMarketplaceToast(duplicate ? "This search is already saved." : "Search saved to your LeaseHub profile.");
    });

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

    localStorage.setItem(
        "selectedProperty",
        id
    );

    window.location.href =
        "property-details.html";

}

/* ================= PROPERTY DETAILS ================= */

const propertyDetails =
    document.getElementById("propertyDetails");

if (
    propertyDetails &&
    document.body.dataset.leasehubPage !== "property-details"
) {

    const selectedId =
        Number(
            localStorage.getItem(
                "selectedProperty"
            )
        );

    const property =
        properties.find(
            item => item.id === selectedId
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
                            ✓ LeaseHub Verified Property
                        </strong>

                        <p>
                            This is a prototype verification
                            badge. Real verification will be
                            connected to LeaseHub's verification
                            system later.
                        </p>

                    </div>


                    <div class="detail-description">

                        <p>
                            This modern ${property.type.toLowerCase()}
                            is located in ${property.location}.
                            The property is presented as a
                            demo listing for the LeaseHub
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
                            LeaseHub Property Owner
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
                    "leasehubCurrentUser"
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
            "leasehubCurrentUser",
            JSON.stringify(currentUser)
        );


        /* Update stored user */

        const users =
            JSON.parse(
                localStorage.getItem(
                    "leasehubUsers"
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
                "leasehubUsers",
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
                    "💬 LeaseHub Messaging\\n\\n" +
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


function getCurrentUser() {
    try {
        const raw =
            localStorage.getItem("leasehubCurrentUser") ||
            localStorage.getItem("leaseHubCurrentUser") ||
            localStorage.getItem("currentUser");
        if (!raw) return null;
        const user = JSON.parse(raw);
        if (!user || typeof user !== "object") return null;
        user.accountType = normalizeAccountType(user.accountType);
        return user;
    } catch (e) {
        return null;
    }
}

function normalizeAccountType(value) {
    const v = String(value || "").trim().toLowerCase();
    if (!v) return "tenant";
    if (v === "owner" || v === "landlord" || v.includes("owner") || v.includes("business") || v.includes("landlord")) {
        return "owner";
    }
    return "tenant";
}

function saveCurrentUser(user) {
    const payload = JSON.stringify(user);
    localStorage.setItem("leasehubCurrentUser", payload);
    // compatibility with older/owner-shell keys
    localStorage.setItem("leaseHubCurrentUser", payload);
    localStorage.setItem("currentUser", payload);
}

function redirectAfterAuth(user) {
    const type = normalizeAccountType(user && user.accountType);
    const target = type === "owner" ? "owner-dashboard.html" : "tenant-dashboard.html";
    window.location.replace(target);
}

const registerForm =
    document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const rawAccountType = document.getElementById("accountType").value;
        if (!rawAccountType) {
            showAuthStatus("Please select your account type.");
            return;
        }

        const accountType = normalizeAccountType(rawAccountType);
        const name = document.getElementById("registerName").value.trim();
        const email = document.getElementById("registerEmail").value.trim().toLowerCase();
        const phone = document.getElementById("registerPhone").value.trim();
        const password = document.getElementById("registerPassword").value;

        try {
            const { data, error } = await window.LeaseHubAuth.signUp({
                email,
                password,
                name,
                phone,
                accountType
            });
            if (error) throw error;
            if (!data.session) {
                showAuthStatus("Account created. Check your email to confirm it, then log in.", "success");
                return;
            }
            const user = data.user;
            const currentUser = {
                id: user.id,
                accountType,
                name,
                email,
                phone,
                savedProperties: [],
                viewingRequests: [],
                applications: [],
                properties: [],
                verificationStatus: accountType === "owner" ? "unverified" : "n/a",
                ownerVerificationStatus: accountType === "owner" ? "unverified" : "n/a"
            };
            localStorage.setItem("leasehub_session_token", data.session.access_token);
            saveCurrentUser(currentUser);
            redirectAfterAuth(currentUser);
        } catch (error) {
            showAuthStatus(error.message || "Unable to create your account. Please try again.");
        }
    });
}

/* ================= LOGIN ================= */

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = document.getElementById("loginEmail").value.trim().toLowerCase();
        const password = document.getElementById("loginPassword").value;

        try {
            const { data, error } = await window.LeaseHubAuth.signIn(email, password);
            if (error) throw error;
            const user = data.user;
            const metadata = user.user_metadata || {};
            const accountType = normalizeAccountType(metadata.account_type);
            const currentUser = {
                id: user.id,
                accountType,
                name: metadata.full_name || metadata.name || email.split("@")[0],
                email,
                phone: metadata.phone || "",
                savedProperties: [],
                viewingRequests: [],
                applications: [],
                properties: [],
                verificationStatus: accountType === "owner" ? "unverified" : "n/a",
                ownerVerificationStatus: accountType === "owner" ? "unverified" : "n/a"
            };
            localStorage.setItem("leasehub_session_token", data.session.access_token);
            saveCurrentUser(currentUser);
            redirectAfterAuth(currentUser);
        } catch (error) {
            showAuthStatus(error.message || "Email or password is incorrect.");
        }
    });
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

        document.getElementById(
            "savedCount"
        ).textContent =
            savedPropertyIds.length;


        document.getElementById(
            "viewingCount"
        ).textContent =
            currentUser.viewingRequests.length;


        document.getElementById(
            "applicationCount"
        ).textContent =
            currentUser.applications.length;


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
            currentUser.viewingRequests.length
            > 0
        ) {

            emptyViewings.style.display =
                "none";


            viewingContainer.innerHTML =
                currentUser.viewingRequests
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
                        "leasehubCurrentUser"
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
        const storeTitle = document.getElementById("ownerStoreTitle");
        if (storeTitle && currentUser.name) storeTitle.textContent = currentUser.name;


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
                        const verificationStatus = getLeaseHubVerificationStatus(property);
                        const listingSt = (typeof getListingStatus === "function")
                            ? getListingStatus(property)
                            : String(property.listingStatus || verificationStatus || "pending").toLowerCase();
                        const statusClass = (listingSt === "live" || verificationStatus === "approved")
                            ? "status-live"
                            : (listingSt === "rejected" || verificationStatus === "rejected")
                                ? "status-rejected"
                                : "status-pending";
                        const statusText = (listingSt === "live" || verificationStatus === "approved")
                            ? "🟢 Live"
                            : (listingSt === "rejected" || verificationStatus === "rejected")
                                ? "⛔ Rejected"
                                : "⏳ Pending review";

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
                                        onclick="openProperty(${property.id})"
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
                        "leasehubCurrentUser"
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
    document.body.dataset.leasehubPage !== "add-property"
) {

    const currentUser =
        JSON.parse(
            localStorage.getItem(
                "leasehubCurrentUser"
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
                        "leasehubProperties",
                        JSON.stringify(
                            properties
                        )
                    );


                    /* ADD TO OWNER */

                    currentUser.properties.push(
                        newProperty.id
                    );


                    localStorage.setItem(
                        "leasehubCurrentUser",
                        JSON.stringify(
                            currentUser
                        )
                    );


                    /* UPDATE STORED USERS */

                    const users =
                        JSON.parse(
                            localStorage.getItem(
                                "leasehubUsers"
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
                            "leasehubUsers",
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
                    "leasehubProperties"
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
                    getLeaseHubVerificationStatus(property) === "pending"
            );


        const verified =
            storedProperties.filter(
                property =>
                    getLeaseHubVerificationStatus(property) === "approved"
            );


        const rejected =
            storedProperties.filter(
                property =>
                    getLeaseHubVerificationStatus(property) === "rejected"
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
                                ✓ LeaseHub Verified
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
                        "leasehubProperties"
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
                    `Approve "${property.title}" as a verified LeaseHub property?`
                );


            if (!confirmed) return;


            property.verificationStatus =
                "Verified";


            property.verified =
                true;


            property.verifiedAt =
                new Date().toISOString();


            localStorage.setItem(
                "leasehubProperties",
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
                        "leasehubProperties"
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
                "leasehubProperties",
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
    document.body.dataset.leasehubPage !== "tenant-messages"
) {

    const currentUser =
        JSON.parse(
            localStorage.getItem(
                "leasehubCurrentUser"
            )
        );


    if (!currentUser) {

        window.location.href =
            "login.html";

    }


    let conversations =
        JSON.parse(
            localStorage.getItem(
                "leasehubConversations"
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
                    "leasehubConversations"
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
            "LeaseHub User";


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
                "LeaseHub User";


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
                "leasehubConversations",
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
                "leasehubCurrentUser"
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
        Number(
            params.get("property")
        );


    const property =
        properties.find(
            item =>
                item.id === propertyId
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
        function(event) {

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
                        application.propertyId ===
                            property.id &&
                        application.tenantId ===
                            currentUser.id &&
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
   LEASEHUB - APP.JS
   ========================================================= */

/* =========================================================
   GLOBAL HELPERS
   ========================================================= */

function getLeaseHubVerificationStatus(property) {
    if (typeof normalizeVerificationStatus === "function") {
        return normalizeVerificationStatus(property);
    }

    const status = String(property?.verificationStatus || "")
        .trim()
        .toLowerCase();

    if (status === "rejected") return "rejected";
    if (status === "pending" || status === "pending verification") return "pending";
    if (status === "approved" || status === "verified" || property?.verified === true) {
        return "approved";
    }

    return "pending";
}

function isLeaseHubPropertyPublic(property) {
    return getLeaseHubVerificationStatus(property) !== "rejected";
}

function isLeaseHubPropertyVerified(property) {
    return getLeaseHubVerificationStatus(property) === "approved";
}

function getSavedProperties() {
    const storedValue = localStorage.getItem("savedProperties");

    if (storedValue === null) {
        try {
            const currentUser = JSON.parse(
                localStorage.getItem("leasehubCurrentUser") || "null"
            );
            const migrated = Array.isArray(currentUser?.savedProperties)
                ? [...new Set(currentUser.savedProperties.map(normalizeLeaseHubPropertyId).filter(Boolean))]
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
        const saved = JSON.parse(storedValue || "[]");
        return Array.isArray(saved) ? saved.map(normalizeLeaseHubPropertyId).filter(Boolean) : [];
    } catch (error) {
        return [];
    }
}

function saveSavedProperties(saved) {
    const normalized = [...new Set(saved.map(normalizeLeaseHubPropertyId).filter(Boolean))];

    localStorage.setItem("savedProperties", JSON.stringify(normalized));

    try {
        const currentUser = JSON.parse(
            localStorage.getItem("leasehubCurrentUser") || "null"
        );

        if (!currentUser) return;

        currentUser.savedProperties = normalized;
        localStorage.setItem(
            "leasehubCurrentUser",
            JSON.stringify(currentUser)
        );

        const users = JSON.parse(
            localStorage.getItem("leasehubUsers") || "[]"
        );
        const userIndex = Array.isArray(users)
            ? users.findIndex(user =>
                (currentUser.id && user.id === currentUser.id) ||
                user.email === currentUser.email
            )
            : -1;

        if (userIndex >= 0) {
            users[userIndex].savedProperties = normalized;
            localStorage.setItem("leasehubUsers", JSON.stringify(users));
        }
    } catch (error) {
        // The shared saved list remains usable if account data is malformed.
    }
}


/* =========================================================
   RECENTLY VIEWED
   Keeps the last 10 properties opened on this device.
   ========================================================= */

const RECENTLY_VIEWED_KEY = "leasehubRecentlyViewed";
const RECENTLY_VIEWED_LIMIT = 10;

function getRecentlyViewedIds() {
    try {
        const stored = JSON.parse(
            localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]"
        );

        return Array.isArray(stored)
            ? stored
                .map(Number)
                .filter(id => !Number.isNaN(id))
            : [];
    } catch (error) {
        return [];
    }
}

function addRecentlyViewed(id) {
    const propertyId = Number(id);

    if (Number.isNaN(propertyId)) return;

    const ids = getRecentlyViewedIds().filter(
        existingId => existingId !== propertyId
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
                property => Number(property.id) === id
            )
        )
        .filter(Boolean)
        .filter(isLeaseHubPropertyPublic)
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
        ? getSavedProperties().map(String).includes(propertyId)
        : false;
    const verified = typeof isLeaseHubPropertyVerified === "function"
        ? isLeaseHubPropertyVerified(property)
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
        <article class="property-card leasehub-enhanced-card" data-property-id="${esc(propertyId)}"
            onclick='openProperty(${JSON.stringify(propertyId)})'>
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
                    onclick='event.stopPropagation(); openProperty(${JSON.stringify(propertyId)});'>
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

            const propertyId = normalizeLeaseHubPropertyId(this.dataset.id);

            let saved = getSavedProperties();

            const index = saved
                .map(normalizeLeaseHubPropertyId)
                .indexOf(propertyId);

            if (index === -1) {

                saved.push(propertyId);

                this.classList.add("saved");
                this.textContent = "♥";

            } else {

                saved.splice(index, 1);

                this.classList.remove("saved");
                this.textContent = "♡";
            }

            saveSavedProperties(saved);
        });

    });

    document.querySelectorAll(".compare-card-btn").forEach(button => {
        button.addEventListener("click", event => {
            event.stopPropagation();

            const id = normalizeLeaseHubPropertyId(button.dataset.compareId);
            const selected = getComparedProperties();

            if (selected.includes(id)) {
                saveComparedProperties(selected.filter(propertyId => propertyId !== id));
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
    if (/^\d+$/.test(propertyId) && typeof addRecentlyViewed === "function") {
        addRecentlyViewed(Number(propertyId));
    }

    window.location.href = `property-details.html?id=${encodeURIComponent(propertyId)}`;
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
                .filter(isLeaseHubPropertyPublic)
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

    if (window.loadLeaseHubPropertyCatalog) {
        window.loadLeaseHubPropertyCatalog().then(() => loadMarketplaceProperties(properties));
    } else {
        loadMarketplaceProperties(properties);
    }

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
            "LeaseHub: properties data is not available."
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

            if (!isLeaseHubPropertyPublic(property)) return false;

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
                isLeaseHubPropertyVerified(property);


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
                    localStorage.getItem("leasehubProperties")
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


                const status =
                    request.status || "pending";


                let statusClass = "pending";

                if (status === "accepted") {
                    statusClass = "accepted";
                }

                if (status === "declined") {
                    statusClass = "declined";
                }


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
                            ${status.toUpperCase()}
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
                        status === "pending"

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

                        : `

                            <div class="viewing-request-result">

                                ${
                                    status === "accepted"

                                    ? "✓ You accepted this viewing request."

                                    : "✕ You declined this viewing request."
                                }

                            </div>

                        `
                    }

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


        request.status = newStatus;

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
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    const statNumbers = document.querySelectorAll("[data-stat]");
    if (!statNumbers.length || !Array.isArray(properties)) return;

    const publicProperties = properties.filter(isLeaseHubPropertyPublic);

    const values = {
        properties: publicProperties.length,
        verified: publicProperties.filter(isLeaseHubPropertyVerified).length,
        cities: new Set(publicProperties.map(property => property.city)).size
    };

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

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const target = values[entry.target.dataset.stat];
            if (target !== undefined) animateStat(entry.target, target);
            observer.unobserve(entry.target);
        });
    }, { threshold: .6 });

    statNumbers.forEach(stat => observer.observe(stat));
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
            console.warn("LeaseHub applications could not be read.", error);
            return [];
        }
    }


    function getOwnerProperties() {
        try {
            const storedProperties = JSON.parse(
                localStorage.getItem("leasehubProperties") || "[]"
            );

            return Array.isArray(storedProperties)
                ? storedProperties
                : [];
        } catch (error) {
            console.warn("LeaseHub owner properties could not be read.", error);
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
                localStorage.getItem("leasehubOwnerProfile") || "{}"
            ) || {};
        } catch (error) {
            ownerProfile = {};
        }

        const currentUser = (() => {
            try {
                return JSON.parse(
                    localStorage.getItem("leasehubCurrentUser") || "null"
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


        const ownerApplications =
            applications.filter(application => {

                return ownerPropertyIds.includes(
                    String(application.propertyId)
                );

            });


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

        const status =
            application.status || "pending";


        let statusClass = "pending-badge";
        let statusText = "Pending";


        if (status === "accepted") {

            statusClass = "verified-badge";
            statusText = "Accepted";

        }


        if (status === "rejected") {

            statusClass = "rejected-badge";
            statusText = "Rejected";

        }


        const moveInDate =
            application.moveInDate
                ? new Date(
                    application.moveInDate
                  ).toLocaleDateString(
                    "en-NG",
                    {
                        day: "numeric",
                        month: "long",
                        year: "numeric"
                    }
                  )
                : "Not specified";


        const submittedDate =
            application.createdAt
                ? new Date(
                    application.createdAt
                  ).toLocaleDateString(
                    "en-NG",
                    {
                        day: "numeric",
                        month: "long",
                        year: "numeric"
                    }
                  )
                : "Unknown";


        return `

            <article class="viewing-card application-card">

                <div class="viewing-card-top">

                    <div>

                        <span class="section-label">
                            RENTAL APPLICATION
                        </span>

                        <h3>
                            ${escapeApplicationText(
                                application.propertyTitle ||
                                "Property"
                            )}
                        </h3>

                    </div>

                    <span class="${statusClass}">
                        ${statusText}
                    </span>

                </div>


                <div class="application-details">

                    <p>
                        <strong>Applicant:</strong>
                        ${escapeApplicationText(
                            application.applicantName ||
                            "Not provided"
                        )}
                    </p>


                    <p>
                        <strong>Email:</strong>
                        ${escapeApplicationText(
                            application.applicantEmail ||
                            "Not provided"
                        )}
                    </p>


                    <p>
                        <strong>Phone:</strong>
                        ${escapeApplicationText(
                            application.applicantPhone ||
                            "Not provided"
                        )}
                    </p>


                    <p>
                        <strong>Move-in date:</strong>
                        ${moveInDate}
                    </p>


                    <p>
                        <strong>Submitted:</strong>
                        ${submittedDate}
                    </p>


                    ${
                        application.message
                            ? `
                                <div class="application-message">

                                    <strong>
                                        Message from applicant
                                    </strong>

                                    <p>
                                        ${escapeApplicationText(
                                            application.message
                                        )}
                                    </p>

                                </div>
                              `
                            : ""
                    }

                </div>


                ${
                    status === "pending"
                        ? `

                            <div class="application-actions">

                                <button
                                    type="button"
                                    class="primary-btn application-accept-btn"
                                    data-application-id="${application.id}"
                                >
                                    Accept Application
                                </button>


                                <button
                                    type="button"
                                    class="secondary-btn application-reject-btn"
                                    data-application-id="${application.id}"
                                >
                                    Reject
                                </button>

                            </div>

                          `
                        : `
                            <div class="application-status-message">

                                ${
                                    status === "accepted"
                                        ? "✓ You accepted this rental application."
                                        : "This rental application was rejected."
                                }

                            </div>
                          `
                }

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


        applications[
            applicationIndex
        ].status = newStatus;


        applications[
            applicationIndex
        ].updatedAt =
            new Date().toISOString();


        localStorage.setItem(
            "rentalApplications",
            JSON.stringify(applications)
        );


        loadOwnerApplications();
        if (newStatus === "accepted") {

    window.location.href =
        "rental-agreement.html?applicationId=" +
        encodeURIComponent(
            applications[applicationIndex].id
        );

    return;
}


        alert(
            newStatus === "accepted"
                ? "Rental application accepted."
                : "Rental application rejected."
        );

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
   LEASEHUB — LOADING SYSTEM
   ========================================================= */

(function () {
    "use strict";

    /* ---------- PAGE LOADER ---------- */

    function createPageLoader() {
        if (document.getElementById("leasehubPageLoader")) {
            return;
        }

        const loader = document.createElement("div");

        loader.id = "leasehubPageLoader";

        loader.innerHTML = `
            <div class="leasehub-loader-content">
                <img
                    class="leasehub-loader-logo"
                    src="IMAGES/Lease Hub logo.png"
                    alt="LeaseHub"
                >

                <div
                    class="leasehub-loader-spinner"
                    aria-hidden="true"
                ></div>

                <div class="leasehub-loader-text">
                    Loading LeaseHub...
                </div>
            </div>
        `;

        document.body.prepend(loader);
    }


    window.showPageLoader = function () {
        createPageLoader();

        const loader =
            document.getElementById("leasehubPageLoader");

        if (!loader) return;

        loader.classList.remove("is-hidden");
    };


    window.hidePageLoader = function () {
        const loader =
            document.getElementById("leasehubPageLoader");

        if (!loader) return;

        loader.classList.add("is-hidden");
    };


    /* ---------- BUTTON LOADING ---------- */

    window.setButtonLoading = function (button, loading) {
        if (!button) return;

        if (loading) {
            if (button.classList.contains("leasehub-btn-loading")) {
                return;
            }

            button.dataset.originalText = button.innerHTML;

            button.classList.add("leasehub-btn-loading");
            button.setAttribute("aria-busy", "true");
            button.disabled = true;

            const spinner = document.createElement("span");

            spinner.className = "leasehub-btn-spinner";
            spinner.setAttribute("aria-hidden", "true");

            button.appendChild(spinner);

        } else {
            button.classList.remove("leasehub-btn-loading");
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
            "img:not(.leasehub-loader-logo)"
        );

        images.forEach(function (image) {

            if (
                image.complete &&
                image.naturalWidth > 0
            ) {
                image.classList.add(
                    "leasehub-image-loaded"
                );

                return;
            }

            image.classList.add(
                "leasehub-image-loading"
            );

            image.addEventListener(
                "load",
                function () {
                    image.classList.remove(
                        "leasehub-image-loading"
                    );

                    image.classList.add(
                        "leasehub-image-loaded"
                    );
                },
                { once: true }
            );

            image.addEventListener(
                "error",
                function () {
                    image.classList.remove(
                        "leasehub-image-loading"
                    );

                    image.classList.add(
                        "leasehub-image-loaded"
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
                "leasehub-content-ready"
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
   LEASEHUB — FINAL UX POLISH
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
            if (button.dataset.leasehubSaveBound) return;
            button.dataset.leasehubSaveBound="1";
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
                if(typeof leaseHubToast==="function")leaseHubToast(exists?"Removed from saved properties":"Property saved");
            });
        });
        document.querySelectorAll(".compare-card-btn[data-compare-id]").forEach(button => {
            if(button.dataset.leasehubCompareBound)return;
            button.dataset.leasehubCompareBound="1";
            button.addEventListener("click",event=>{
                event.stopPropagation();
                const id=Number(button.dataset.compareId);
                const current=typeof getComparedProperties==="function"?getComparedProperties().map(Number):[];
                if(current.includes(id)) saveComparedProperties(current.filter(x=>x!==id));
                else if(current.length<3) saveComparedProperties([...current,id]);
                else { if(typeof leaseHubToast==="function")leaseHubToast("Compare up to 3 properties","error"); return; }
                if(typeof updateCompareTray==="function")updateCompareTray();
                syncCompareButtons();
            });
        });
        syncCompareButtons();
    }
    function patchApplicationModal() {
        const modal=document.getElementById("applicationModal"), content=modal?.querySelector(".modal-content");
        if(!modal||!content||content.dataset.leasehubPatched)return;
        content.dataset.leasehubPatched="1";
        const close=()=>{modal.classList.remove("active");document.body.classList.remove("modal-open");};
        content.querySelector("#closeApplicationModal")?.addEventListener("click",close);
        modal.addEventListener("click",e=>{if(e.target===modal)close();});
        document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal.classList.contains("active"))close();});
        const back=document.createElement("button"); back.type="button"; back.className="application-modal-back";
        back.innerHTML=`${icon("bx-arrow-back")} Back to property`; back.addEventListener("click",close);
        const label=content.querySelector(".section-label"); if(label)content.insertBefore(back,label);
    }
    document.addEventListener("DOMContentLoaded",()=>{patchApplicationModal();bindEnhancedSaveAndCompare();document.querySelectorAll(".property-grid").forEach(g=>g.classList.add("leasehub-stagger"));});
})();
