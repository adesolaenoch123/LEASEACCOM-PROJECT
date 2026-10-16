document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("verificationForm");

    const requestList = document.getElementById("requestList");

    const successPopup = document.getElementById("successPopup");

    const closePopup = document.getElementById("closePopup");


    /*
    ==========================================
    LOAD VERIFICATION REQUESTS
    ==========================================
    */

    let requests =
        JSON.parse(
            localStorage.getItem("leaseaccomVerificationRequests")
        ) || [

            {
                id: 1,

                type: "Property",

                name: "Modern 3 Bedroom Apartment",

                location: "Lekki, Lagos",

                owner: "Daniel Ade",

                status: "pending",

                date: new Date().toLocaleDateString()
            },

            {
                id: 2,

                type: "Landlord",

                name: "Michael Johnson",

                location: "Ikeja, Lagos",

                owner: "Michael Johnson",

                status: "verified",

                date: new Date().toLocaleDateString()
            }

        ];


    saveRequests();

    renderRequests();

    updateStats();



    /*
    ==========================================
    SUBMIT VERIFICATION
    ==========================================
    */

    form.addEventListener("submit", (event) => {

        event.preventDefault();


        const type =
            document.getElementById("verificationType").value;

        const name =
            document.getElementById("name").value.trim();

        const location =
            document.getElementById("location").value.trim();

        const owner =
            document.getElementById("owner").value.trim();


        if (!type || !name || !location || !owner) {

            alert("Please complete all required fields.");

            return;
        }


        const newRequest = {

            id: Date.now(),

            type: type,

            name: name,

            location: location,

            owner: owner,

            status: "pending",

            date: new Date().toLocaleDateString()

        };


        requests.unshift(newRequest);

        saveRequests();

        renderRequests();

        updateStats();


        form.reset();

        successPopup.classList.add("show");

    });



    /*
    ==========================================
    SAVE DATA
    ==========================================
    */

    function saveRequests() {

        localStorage.setItem(
            "leaseaccomVerificationRequests",
            JSON.stringify(requests)
        );

    }



    /*
    ==========================================
    RENDER REQUESTS
    ==========================================
    */

    function renderRequests(filter = "all") {

        requestList.innerHTML = "";


        let filteredRequests = requests;


        if (filter !== "all") {

            filteredRequests =
                requests.filter(
                    request => request.status === filter
                );

        }


        if (filteredRequests.length === 0) {

            requestList.innerHTML = `

                <div class="empty-state">

                    <i class="fa-solid fa-folder-open"></i>

                    <h3>No requests found</h3>

                    <p>
                        There are no verification requests
                        in this category yet.
                    </p>

                </div>

            `;

            return;
        }


        filteredRequests.forEach(request => {

            const item =
                document.createElement("div");

            item.className = "request-item";


            const icon =
                request.type === "Property"
                    ? "fa-house"
                    : "fa-user";


            const iconClass =
                request.type === "Property"
                    ? "property"
                    : "landlord";


            const statusClass =
                request.status === "pending"
                    ? "status-pending"
                    : request.status === "verified"
                    ? "status-verified"
                    : "status-rejected";


            const statusText =
                request.status === "pending"
                    ? "Pending"
                    : request.status === "verified"
                    ? "Verified"
                    : "Rejected";


            item.innerHTML = `

                <div class="request-info">

                    <div class="request-icon ${iconClass}">

                        <i class="fa-solid ${icon}"></i>

                    </div>


                    <div>

                        <h4>
                            ${escapeHTML(request.name)}
                        </h4>

                        <p>
                            ${request.type}
                            •
                            ${escapeHTML(request.location)}
                            •
                            ${escapeHTML(request.owner)}
                        </p>

                    </div>

                </div>


                <div class="request-actions">

                    <span class="status-badge ${statusClass}">

                        ${statusText}

                    </span>


                    ${
                        request.status === "pending"

                        ? `

                            <button
                                class="action-btn approve-btn"
                                data-action="approve"
                                data-id="${request.id}"
                            >
                                <i class="fa-solid fa-check"></i>
                                Approve
                            </button>


                            <button
                                class="action-btn reject-btn"
                                data-action="reject"
                                data-id="${request.id}"
                            >
                                <i class="fa-solid fa-xmark"></i>
                                Reject
                            </button>

                        `

                        : ""

                    }

                </div>

            `;


            requestList.appendChild(item);

        });

    }



    /*
    ==========================================
    APPROVE / REJECT
    ==========================================
    */

    requestList.addEventListener("click", (event) => {

        const button =
            event.target.closest("[data-action]");


        if (!button) return;


        const id =
            Number(button.dataset.id);

        const action =
            button.dataset.action;


        const request =
            requests.find(
                item => item.id === id
            );


        if (!request) return;


        if (action === "approve") {

            request.status = "verified";

        }


        if (action === "reject") {

            request.status = "rejected";

        }


        saveRequests();

        renderRequests();

        updateStats();

    });



    /*
    ==========================================
    FILTERS
    ==========================================
    */

    const filterButtons =
        document.querySelectorAll(".filter-btn");


    filterButtons.forEach(button => {

        button.addEventListener("click", () => {

            filterButtons.forEach(btn => {

                btn.classList.remove("active");

            });


            button.classList.add("active");


            const filter =
                button.dataset.filter;


            renderRequests(filter);

        });

    });



    /*
    ==========================================
    STATISTICS
    ==========================================
    */

    function updateStats() {

        const total =
            requests.length;


        const pending =
            requests.filter(
                request =>
                    request.status === "pending"
            ).length;


        const verified =
            requests.filter(
                request =>
                    request.status === "verified"
            ).length;


        const verifiedLandlords =
            requests.filter(
                request =>
                    request.status === "verified" &&
                    request.type === "Landlord"
            ).length;


        document.getElementById(
            "totalRequests"
        ).textContent = total;


        document.getElementById(
            "pendingRequests"
        ).textContent = pending;


        document.getElementById(
            "verifiedRequests"
        ).textContent = verified;


        document.getElementById(
            "verifiedLandlords"
        ).textContent = verifiedLandlords;

    }



    /*
    ==========================================
    CLOSE POPUP
    ==========================================
    */

    closePopup.addEventListener("click", () => {

        successPopup.classList.remove("show");

    });


    successPopup.addEventListener("click", (event) => {

        if (event.target === successPopup) {

            successPopup.classList.remove("show");

        }

    });



    /*
    ==========================================
    BASIC HTML ESCAPING
    ==========================================
    */

    function escapeHTML(value) {

        return String(value)

            .replaceAll("&", "&amp;")

            .replaceAll("<", "&lt;")

            .replaceAll(">", "&gt;")

            .replaceAll('"', "&quot;")

            .replaceAll("'", "&#039;");

    }

});