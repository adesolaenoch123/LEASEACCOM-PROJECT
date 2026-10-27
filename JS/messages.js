document.addEventListener("DOMContentLoaded", () => {

    /* =========================================
       ELEMENTS
    ========================================= */

    const conversationList =
        document.getElementById("conversationList");

    const noConversations =
        document.getElementById("noConversations");

    const chatEmpty =
        document.getElementById("chatEmpty");

    const chatContent =
        document.getElementById("chatContent");

    const chatPersonName =
        document.getElementById("chatPersonName");

    const chatPropertyName =
        document.getElementById("chatPropertyName");

    const chatMessages =
        document.getElementById("chatMessages");

    const messageForm =
        document.getElementById("messageForm");

    const messageInput =
        document.getElementById("messageInput");


    /* =========================================
       DEFAULT AVATARS
    ========================================= */

    const DEFAULT_TENANT_AVATAR =
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80";

    const DEFAULT_OWNER_AVATAR =
        "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80";


    /* =========================================
       TENANT PROFILE
    ========================================= */

    let tenantProfile = {
        name: "Tenant",
        accountType: "tenant",
        bio: "LeaseAccom tenant",
        avatar: DEFAULT_TENANT_AVATAR
    };

    try {

        const savedProfile =
            JSON.parse(
                localStorage.getItem(
                    "leaseaccomTenantProfile"
                )
            );

        if (savedProfile) {

            tenantProfile = {
                ...tenantProfile,
                ...savedProfile
            };
        }

    } catch (error) {

        console.error(
            "Unable to load tenant profile:",
            error
        );
    }


    /* =========================================
       PROFILE ELEMENTS
    ========================================= */

    const openProfileBtn =
        document.getElementById(
            "openTenantProfileBtn"
        );

    const closeProfileBtn =
        document.getElementById(
            "closeTenantProfileBtn"
        );

    const profileDrawer =
        document.getElementById(
            "tenantProfileDrawer"
        );

    const profilePreview =
        document.getElementById(
            "tenantProfilePreview"
        );

    const profilePictureInput =
        document.getElementById(
            "tenantProfilePictureInput"
        );

    const displayNameInput =
        document.getElementById(
            "tenantDisplayName"
        );

    const accountTypeInput =
        document.getElementById(
            "tenantAccountType"
        );

    const bioInput =
        document.getElementById(
            "tenantBio"
        );

    const saveProfileBtn =
        document.getElementById(
            "saveTenantProfileBtn"
        );

    const profileMessage =
        document.getElementById(
            "tenantProfileMessage"
        );

    const topProfileAvatar =
        document.getElementById(
            "tenantTopProfileAvatar"
        );

    const topProfileName =
        document.getElementById(
            "tenantTopProfileName"
        );

    const chatOwnerAvatar =
        document.getElementById(
            "tenantChatOwnerAvatar"
        );


    /* =========================================
       UPDATE PROFILE UI
    ========================================= */

    function updateProfileUI() {

        if (topProfileAvatar) {

            topProfileAvatar.src =
                tenantProfile.avatar ||
                DEFAULT_TENANT_AVATAR;
        }

        if (topProfileName) {

            topProfileName.textContent =
                tenantProfile.name ||
                "Tenant";
        }

        if (profilePreview) {

            profilePreview.src =
                tenantProfile.avatar ||
                DEFAULT_TENANT_AVATAR;
        }

        if (displayNameInput) {

            displayNameInput.value =
                tenantProfile.name ||
                "";
        }

        if (accountTypeInput) {

            accountTypeInput.value =
                tenantProfile.accountType ||
                "tenant";
        }

        if (bioInput) {

            bioInput.value =
                tenantProfile.bio ||
                "";
        }
    }

    updateProfileUI();


    /* =========================================
       PROFILE DRAWER
    ========================================= */

    if (openProfileBtn && profileDrawer) {

        openProfileBtn.addEventListener(
            "click",
            () => {

                updateProfileUI();

                profileDrawer.classList.add(
                    "open"
                );
            }
        );
    }


    if (closeProfileBtn) {

        closeProfileBtn.addEventListener(
            "click",
            () => {

                profileDrawer?.classList.remove(
                    "open"
                );
            }
        );
    }


    /* =========================================
       PROFILE IMAGE
    ========================================= */

    if (profilePictureInput) {

        profilePictureInput.addEventListener(
            "change",
            (event) => {

                const file =
                    event.target.files[0];

                if (!file) return;

                if (!file.type.startsWith("image/")) {

                    alert(
                        "Please select an image file."
                    );

                    return;
                }

                const reader =
                    new FileReader();

                reader.onload =
                    (e) => {

                        tenantProfile.avatar =
                            e.target.result;

                        if (profilePreview) {

                            profilePreview.src =
                                tenantProfile.avatar;
                        }

                        if (topProfileAvatar) {

                            topProfileAvatar.src =
                                tenantProfile.avatar;
                        }
                    };

                reader.readAsDataURL(file);
            }
        );
    }


    /* =========================================
       SAVE PROFILE
    ========================================= */

    if (saveProfileBtn) {

        saveProfileBtn.addEventListener(
            "click",
            () => {

                const name =
                    displayNameInput?.value.trim();

                const accountType =
                    accountTypeInput?.value;

                const bio =
                    bioInput?.value.trim();

                tenantProfile = {

                    name:
                        name || "Tenant",

                    accountType:
                        accountType || "tenant",

                    bio:
                        bio || "LeaseAccom tenant",

                    avatar:
                        tenantProfile.avatar ||
                        DEFAULT_TENANT_AVATAR
                };

                localStorage.setItem(
                    "leaseaccomTenantProfile",
                    JSON.stringify(
                        tenantProfile
                    )
                );

                updateProfileUI();

                if (profileMessage) {

                    profileMessage.textContent =
                        "Profile saved successfully";

                    profileMessage.style.display =
                        "block";

                    setTimeout(
                        () => {

                            profileMessage.style.display =
                                "none";

                        },
                        2500
                    );
                }
            }
        );
    }


    /* =========================================
       CONVERSATIONS
    ========================================= */

    function getConversations() {

        try {

            const saved =
                localStorage.getItem(
                    "leaseaccomMessages"
                );

            if (!saved) return [];

            const conversations =
                JSON.parse(saved);

            return Array.isArray(
                conversations
            )
                ? conversations
                : [];

        } catch (error) {

            console.error(
                "Unable to load conversations:",
                error
            );

            return [];
        }
    }

    function canUseLocalFallback() {
        const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
        const apiConfigured = Boolean(
            window.LeaseAccomApi &&
            typeof window.LeaseAccomApi.isConfigured === "function" &&
            window.LeaseAccomApi.isConfigured()
        );
        return (window.LeaseAccomLiveMode ? window.LeaseAccomLiveMode.allowLocalFallback() : isLocalHost);
    }


    function saveConversations(
        conversations
    ) {

        localStorage.setItem(
            "leaseaccomMessages",
            JSON.stringify(
                conversations
            )
        );
    }


    async function syncRemoteConversations() {
        const remote = await window.LeaseAccomChatApi?.listConversations?.();
        if (!Array.isArray(remote)) {
            if (!canUseLocalFallback()) saveConversations([]);
            return;
        }

        const local = getConversations();
        const used = new Set();
        const merged = remote.map((conversation) => {
            const previous = local.find((item) =>
                !used.has(String(item.id)) &&
                (String(item.id) === String(conversation.id) ||
                    String(item.propertyId) === String(conversation.propertyId))
            );
            if (previous) used.add(String(previous.id));
            if (previous && String(previous.id) === localStorage.getItem("activeConversationId")) {
                localStorage.setItem("activeConversationId", conversation.id);
            }
            return {
                ...previous,
                ...conversation,
                messages: previous?.messages || [],
                serverBacked: true
            };
        });

        saveConversations(merged);
    }


    async function refreshRemoteMessages(conversation) {
        if (!conversation.serverBacked) return;
        const remote = await window.LeaseAccomChatApi?.listMessages?.(conversation);
        if (!Array.isArray(remote)) {
            if (canUseLocalFallback()) return;
            conversation.messages = [];
        } else {
            conversation.messages = remote.sort(
            (left, right) => new Date(left.createdAt) - new Date(right.createdAt)
            );
        }
        const conversations = getConversations();
        const index = conversations.findIndex((item) => String(item.id) === String(conversation.id));
        if (index >= 0) conversations[index] = conversation;
        saveConversations(conversations);
        if (localStorage.getItem("activeConversationId") === String(conversation.id)) {
            renderMessages(conversation);
            renderConversations();
        }
    }


    /* =========================================
       ESCAPE HTML
    ========================================= */

    function escapeHTML(value) {

        const div =
            document.createElement("div");

        div.textContent =
            value || "";

        return div.innerHTML;
    }


    /* =========================================
       TIME
    ========================================= */

    function formatTime(dateString) {

        if (!dateString) return "";

        const date =
            new Date(dateString);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }


    /* =========================================
       RENDER CONVERSATIONS
    ========================================= */

    function renderConversations() {

        if (!conversationList) return;

        const conversations =
            getConversations();

        conversationList.innerHTML = "";

        if (
            conversations.length === 0
        ) {

            if (noConversations) {

                noConversations.style.display =
                    "block";
            }

            return;
        }

        if (noConversations) {

            noConversations.style.display =
                "none";
        }


        conversations.forEach(
            (conversation) => {

                const messages =
                    Array.isArray(
                        conversation.messages
                    )
                        ? conversation.messages
                        : [];

                const lastMessage =
                    messages[
                        messages.length - 1
                    ];

                const item =
                    document.createElement(
                        "button"
                    );

                item.type = "button";

                item.className =
                    "conversation-item";

                item.dataset.conversationId =
                    conversation.id;


                item.innerHTML = `

                    <img
                        class="conversation-avatar"
                        src="${
                            conversation.ownerAvatar ||
                            DEFAULT_OWNER_AVATAR
                        }"
                        alt="Property Owner"
                    >

                    <div class="conversation-info">

                        <div class="conversation-top">

                            <span class="conversation-name">

                                ${escapeHTML(
                                    conversation.ownerName ||
                                    "Property Owner"
                                )}

                            </span>

                            <span class="conversation-time">

                                ${
                                    lastMessage
                                        ? formatTime(
                                            lastMessage.createdAt
                                        )
                                        : ""
                                }

                            </span>

                        </div>

                        <div class="conversation-property">

                            ${escapeHTML(
                                conversation.propertyTitle ||
                                "Property"
                            )}

                        </div>

                        <div class="conversation-preview">

                            ${
                                lastMessage
                                    ? escapeHTML(
                                        lastMessage.text
                                    )
                                    : "Start a conversation"
                            }

                        </div>

                    </div>
                `;


                item.addEventListener(
                    "click",
                    () => {

                        openConversation(
                            conversation.id
                        );
                    }
                );


                conversationList.appendChild(
                    item
                );
            }
        );
    }


    /* =========================================
       OPEN CONVERSATION
    ========================================= */

    function openConversation(
        conversationId
    ) {

        let conversations =
            getConversations();

        let conversation =
            conversations.find(
                (item) =>
                    String(item.id) ===
                    String(conversationId)
            );

        // Also match by propertyId if id was local "property-xxx"
        if (!conversation && conversationId) {
            conversation = conversations.find(
                (item) =>
                    String(item.propertyId) === String(conversationId) ||
                    String(item.id) === "property-" + String(conversationId) ||
                    String(conversationId) === "property-" + String(item.propertyId || "")
            );
        }

        if (!conversation) {
            // Try one remote refresh then re-open
            console.warn("Conversation not in local list, syncing...", conversationId);
            (async function () {
                try {
                    if (typeof syncRemoteConversations === "function") {
                        await syncRemoteConversations();
                    }
                    if (window.LeaseAccomCloud && typeof window.LeaseAccomCloud.hasSb === "function" && window.LeaseAccomCloud.hasSb()) {
                        var client = window.leaseaccomSupabase || window.leasehubSupabase;
                        if (client) {
                            var row = null;
                            var byId = await client.from("conversations").select("*").eq("id", conversationId).maybeSingle();
                            if (byId && byId.data) row = byId.data;
                            if (!row && String(conversationId).indexOf("property-") === 0) {
                                var pid = String(conversationId).replace(/^property-/, "");
                                var byProp = await client.from("conversations").select("*").eq("property_id", pid).limit(1).maybeSingle();
                                if (byProp && byProp.data) row = byProp.data;
                            }
                            if (row) {
                                var list = getConversations();
                                var mapped = {
                                    id: row.id,
                                    propertyId: row.property_id,
                                    tenantId: row.tenant_id,
                                    ownerId: row.owner_id,
                                    ownerName: "Property Owner",
                                    propertyTitle: "Listing",
                                    messages: [],
                                    serverBacked: true,
                                    updatedAt: row.last_message_at
                                };
                                var exists = list.some(function (c) { return String(c.id) === String(row.id); });
                                if (!exists) {
                                    list.unshift(mapped);
                                    saveConversations(list);
                                }
                                localStorage.setItem("activeConversationId", row.id);
                                renderConversations();
                                openConversation(row.id);
                                return;
                            }
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
                if (chatEmpty) chatEmpty.style.display = "flex";
                if (chatContent) chatContent.style.display = "none";
                var tip = document.getElementById("chatEmpty");
                if (tip) {
                    var p = tip.querySelector("p");
                    if (p) p.textContent = "Conversation not found. Open the property page and tap Message again.";
                }
            })();
            return;
        }


        localStorage.setItem(
            "activeConversationId",
            conversation.id
        );


        if (chatEmpty) {

            chatEmpty.style.display =
                "none";
        }


        if (chatContent) {

            chatContent.style.display =
                "flex";
        }

        // Mobile: show conversation full-screen
        const shell = document.querySelector(".messages-shell");
        if (shell) shell.classList.add("chat-open");


        if (chatPersonName) {

            chatPersonName.textContent =
                conversation.ownerName ||
                "Property Owner";
        }


        if (chatPropertyName) {

            chatPropertyName.textContent =
                conversation.propertyTitle ||
                "Property";
        }


        if (chatOwnerAvatar) {

            chatOwnerAvatar.src =
                conversation.ownerAvatar ||
                DEFAULT_OWNER_AVATAR;
        }


        renderMessages(
            conversation
        );

        refreshRemoteMessages(conversation);


        document
            .querySelectorAll(
                ".conversation-item"
            )
            .forEach(
                (item) => {

                    item.classList.toggle(
                        "active",
                        String(
                            item.dataset.conversationId
                        ) ===
                        String(
                            conversation.id
                        )
                    );
                }
            );
    }


    /* =========================================
       RENDER MESSAGES
    ========================================= */

    function renderMessages(
        conversation
    ) {

        if (!chatMessages) return;

        chatMessages.innerHTML = "";

        const messages =
            Array.isArray(
                conversation.messages
            )
                ? conversation.messages
                : [];


        if (messages.length === 0) {

            chatMessages.innerHTML = `

                <div
                    class="chat-start-message"
                    style="
                        text-align:center;
                        padding:40px 20px;
                        color:#667085;
                    "
                >

                    <div
                        class="chat-start-icon"
                        style="font-size:35px;"
                    >
                        <i
                            class="bx bx-message-rounded"
                            aria-hidden="true"
                        ></i>
                    </div>

                    <strong>
                        Start your conversation
                    </strong>

                    <p>
                        Ask the property owner
                        about the property,
                        viewing times or availability.
                    </p>

                </div>

            `;

            return;
        }


        let previousDay = "";

        messages.forEach(
            (message) => {

                const messageDate = new Date(message.createdAt);
                const dayKey = Number.isNaN(messageDate.getTime())
                    ? ""
                    : messageDate.toDateString();

                if (dayKey && dayKey !== previousDay) {
                    const separator = document.createElement("div");
                    separator.className = "chat-date-separator";
                    separator.textContent = dayKey === new Date().toDateString()
                        ? "Today"
                        : messageDate.toLocaleDateString("en-NG", {
                            weekday: "short",
                            day: "numeric",
                            month: "short"
                        });
                    chatMessages.appendChild(separator);
                    previousDay = dayKey;
                }

                const isTenant =
                    message.sender ===
                    "tenant";


                const row =
                    document.createElement(
                        "div"
                    );


                /* =================================
                   MESSAGE ROW
                ================================= */

                row.className =
                    `message-row ${
                        isTenant
                            ? "tenant"
                            : "owner"
                    }`;


                const avatar =
                    message.senderAvatar ||
                    (
                        isTenant
                            ? tenantProfile.avatar
                            : (
                                conversation.ownerAvatar ||
                                DEFAULT_OWNER_AVATAR
                            )
                    );


                const senderName =
                    message.senderName ||
                    (
                        isTenant
                            ? (
                                tenantProfile.name ||
                                "Tenant"
                            )
                            : (
                                conversation.ownerName ||
                                "Property Owner"
                            )
                    );


                row.innerHTML = `

                    ${
                        !isTenant
                            ? `
                                <img
                                    class="message-avatar"
                                    src="${escapeHTML(avatar)}"
                                    alt="${escapeHTML(senderName)}"
                                >
                              `
                            : ""
                    }

                    <div class="message-content">

                        <div
                            class="message-role"
                        >
                            ${
                                isTenant
                                    ? "TENANT"
                                    : "OWNER"
                            }
                        </div>

                        <div
                            class="message-bubble"
                        >

                            <div
                                class="message-text"
                            >
                                ${escapeHTML(
                                    message.text
                                )}
                            </div>

                            <div
                                class="message-meta"
                            >

                                ${formatTime(
                                    message.createdAt
                                )}

                                ${
                                    isTenant
                                        ? `<span class="message-check">✓✓</span>`
                                        : ""
                                }

                            </div>

                        </div>

                    </div>

                    ${
                        isTenant
                            ? `
                                <img
                                    class="message-avatar"
                                    src="${escapeHTML(avatar)}"
                                    alt="${escapeHTML(senderName)}"
                                >
                              `
                            : ""
                    }

                `;


                chatMessages.appendChild(
                    row
                );
            }
        );


        chatMessages.scrollTop =
            chatMessages.scrollHeight;
    }


    /* =========================================
       SEND MESSAGE
    ========================================= */

    if (messageForm) {

        messageForm.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();


                const text =
                    messageInput
                        ?.value
                        .trim();


                if (!text) return;


                const activeConversationId =
                    localStorage.getItem(
                        "activeConversationId"
                    );


                if (!activeConversationId) {

                    alert(
                        "Please select a conversation first."
                    );

                    return;
                }


                const conversations =
                    getConversations();


                const conversation =
                    conversations.find(
                        (item) =>
                            String(item.id) ===
                            String(
                                activeConversationId
                            )
                    );


                if (!conversation) {

                    alert(
                        "This conversation could not be found."
                    );

                    return;
                }

                if (!conversation.serverBacked && conversation.propertyId) {
                    const remoteConversation = await window.LeaseAccomChatApi?.createConversation?.(
                        conversation.propertyId
                    );
                    if (remoteConversation) {
                        const oldId = String(conversation.id);
                        Object.assign(conversation, remoteConversation, {
                            messages: conversation.messages || [],
                            serverBacked: true
                        });
                        localStorage.setItem("activeConversationId", conversation.id);
                        const oldIndex = conversations.findIndex((item) => String(item.id) === oldId);
                        if (oldIndex >= 0) conversations[oldIndex] = conversation;
                    }
                }

                if (!conversation.serverBacked && !canUseLocalFallback()) {
                    alert("This conversation is not connected to the messaging service.");
                    return;
                }


                if (
                    !Array.isArray(
                        conversation.messages
                    )
                ) {

                    conversation.messages = [];
                }


                const remoteMessage = conversation.serverBacked
                    ? await window.LeaseAccomChatApi?.sendMessage?.(conversation, text)
                    : null;

                if (conversation.serverBacked && !remoteMessage && !canUseLocalFallback()) {
                    alert("Message could not be sent. Please try again.");
                    return;
                }

                const newMessage = remoteMessage || {

                    id:
                        Date.now(),

                    sender:
                        "tenant",

                    senderName:
                        tenantProfile.name ||
                        "Tenant",

                    senderAvatar:
                        tenantProfile.avatar ||
                        DEFAULT_TENANT_AVATAR,

                    text:
                        text,

                    createdAt:
                        new Date().toISOString()
                };


                conversation.messages.push(
                    newMessage
                );


                /* Mark conversation as read */

                conversation.unread = 0;


                saveConversations(
                    conversations
                );


                messageInput.value = "";


                renderMessages(
                    conversation
                );


                renderConversations();


                /* Re-select active conversation */

                const activeItem =
                    Array.from(
                        document.querySelectorAll(
                            ".conversation-item"
                        )
                    ).find(
                        (item) =>
                            String(
                                item.dataset.conversationId
                            ) ===
                            String(
                                conversation.id
                            )
                    );

                if (activeItem) {

                    activeItem.classList.add(
                        "active"
                    );
                }
            }
        );
    }


    /* =========================================
       SEARCH
    ========================================= */

    const conversationSearch =
        document.getElementById(
            "tenantConversationSearch"
        );


    if (conversationSearch) {

        conversationSearch.addEventListener(
            "input",
            () => {

                const search =
                    conversationSearch.value
                        .toLowerCase()
                        .trim();


                document
                    .querySelectorAll(
                        ".conversation-item"
                    )
                    .forEach(
                        (item) => {

                            const matches =
                                item.textContent
                                    .toLowerCase()
                                    .includes(
                                        search
                                    );

                            item.style.display =
                                matches
                                    ? ""
                                    : "none";
                        }
                    );
            }
        );
    }


    /* =========================================
       FILTER BUTTONS
    ========================================= */

    const filterButtons =
        document.querySelectorAll(
            ".message-filter"
        );


    filterButtons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    filterButtons.forEach(
                        (btn) =>
                            btn.classList.remove(
                                "active"
                            )
                    );

                    button.classList.add(
                        "active"
                    );


                    const filter =
                        button.dataset.filter;


                    const conversations =
                        getConversations();


                    document
                        .querySelectorAll(
                            ".conversation-item"
                        )
                        .forEach(
                            (item) => {

                                const conversation =
                                    conversations.find(
                                        (c) =>
                                            String(
                                                c.id
                                            ) ===
                                            String(
                                                item.dataset
                                                    .conversationId
                                            )
                                    );


                                if (!conversation) return;


                                if (
                                    filter ===
                                    "unread"
                                ) {

                                    item.style.display =
                                        conversation.unread >
                                        0
                                            ? ""
                                            : "none";

                                } else if (
                                    filter ===
                                    "starred"
                                ) {

                                    item.style.display =
                                        conversation.starred
                                            ? ""
                                            : "none";

                                } else {

                                    item.style.display =
                                        "";
                                }
                            }
                        );
                }
            );
        }
    );


    /* =========================================
       START
    ========================================= */

    (async () => {
        await syncRemoteConversations();
        renderConversations();

        const activeConversationId = localStorage.getItem("activeConversationId");
        if (activeConversationId) openConversation(activeConversationId);
    })();


    /* =========================================
       REFRESH WHEN STORAGE CHANGES
    ========================================= */

    window.addEventListener(
        "storage",
        () => {

            renderConversations();

            const activeId =
                localStorage.getItem(
                    "activeConversationId"
                );

            if (activeId) {

                openConversation(
                    activeId
                );
            }

            updateProfileUI();
        }
    );


    window.addEventListener(
        "pageshow",
        () => {

            renderConversations();

            const activeId =
                localStorage.getItem(
                    "activeConversationId"
                );

            if (activeId) {

                openConversation(
                    activeId
                );
            }

            updateProfileUI();
        }
    );

});


/* =========================================================
   LEASEACCOM OWNER PROFILE + CHAT ACTION CONTROLS
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        function esc(value) {

            return String(
                value ?? ""
            ).replace(
                /[&<>"']/g,
                (character) => {

                    const entities = {
                        "&": "&amp;",
                        "<": "&lt;",
                        ">": "&gt;",
                        '"': "&quot;",
                        "'": "&#039;"
                    };

                    return entities[character];
                }
            );
        }


        function read(
            key,
            fallback
        ) {

            try {

                const value =
                    JSON.parse(
                        localStorage.getItem(
                            key
                        ) || "null"
                    );

                return value ?? fallback;

            } catch {

                return fallback;
            }
        }


        function conversations() {

            const data =
                read(
                    "leaseaccomMessages",
                    []
                );

            return Array.isArray(data)
                ? data
                : [];
        }


        function activeConversation() {

            const id =
                localStorage.getItem(
                    "activeConversationId"
                );

            return conversations().find(
                (conversation) =>
                    String(
                        conversation.id
                    ) ===
                    String(id)
            );
        }


        const ownerProfileBtn =
            document.getElementById(
                "chatOwnerProfileBtn"
            );

        const callBtn =
            document.getElementById(
                "chatCallBtn"
            );

        const videoBtn =
            document.getElementById(
                "chatVideoBtn"
            );


        /* =========================================
           OPEN OWNER PROFILE
        ========================================= */

        function openOwnerProfile() {

            const conversation =
                activeConversation();

            if (!conversation) return;


            const ownerId =
                conversation.ownerId;


            const all =
                Array.isArray(
                    window.properties
                )
                    ? window.properties
                    : read(
                        "leaseaccomProperties",
                        []
                    );


            const ownerProperties =
                all
                    .filter(
                        (property) => {

                            if (
                                ownerId != null
                            ) {

                                return (
                                    String(
                                        property.ownerId
                                    ) ===
                                    String(
                                        ownerId
                                    )
                                );
                            }

                            return (
                                String(
                                    property.ownerName ||
                                    ""
                                ).toLowerCase()
                                ===
                                String(
                                    conversation.ownerName ||
                                    ""
                                ).toLowerCase()
                            );
                        }
                    )
                    .filter(
                        (property) =>
                            String(
                                property.verificationStatus ||
                                ""
                            ).toLowerCase() !==
                            "rejected"
                    );


            let panel =
                document.getElementById(
                    "ownerProfilePanel"
                );


            if (!panel) {

                panel =
                    document.createElement(
                        "div"
                    );

                panel.id =
                    "ownerProfilePanel";

                panel.className =
                    "owner-profile-panel";

                document.body.appendChild(
                    panel
                );
            }


            const avatar =
                conversation.ownerAvatar ||
                ownerProperties[0]?.ownerAvatar ||
                DEFAULT_OWNER_AVATAR;


            panel.innerHTML = `

                <aside
                    class="owner-profile-card"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Property owner profile"
                >

                    <button
                        type="button"
                        class="owner-profile-close"
                        id="closeOwnerProfile"
                        aria-label="Close owner profile"
                    >
                        <i
                            class="bx bx-x"
                            aria-hidden="true"
                        ></i>
                    </button>


                    <div class="owner-profile-head">

                        <img
                            class="owner-profile-avatar"
                            src="${esc(avatar)}"
                            alt="${esc(
                                conversation.ownerName ||
                                "Property Owner"
                            )}"
                        >


                        <div>

                            <h2>
                                ${esc(
                                    conversation.ownerName ||
                                    "Property Owner"
                                )}
                            </h2>

                            <p>

                                <i
                                    class="bx bx-user-check"
                                    aria-hidden="true"
                                ></i>

                                LeaseAccom property owner

                            </p>

                        </div>

                    </div>


                    <div class="owner-profile-bio">

                        ${esc(
                            conversation.ownerBio ||
                            ownerProperties[0]?.ownerBio ||
                            "Property owner on LeaseAccom. Contact them through LeaseAccom before sharing personal details."
                        )}

                    </div>


                    <h3
                        style="
                            margin:22px 0 8px;
                            font-size:14px;
                        "
                    >
                        Properties by this owner
                    </h3>


                    <div class="owner-profile-list">

                        ${
                            ownerProperties
                                .slice(0, 4)
                                .map(
                                    (property) => `

                                        <a
                                            class="owner-profile-property"
                                            href="property-details.html?id=${encodeURIComponent(
                                                property.id
                                            )}"
                                        >

                                            <img
                                                src="${esc(
                                                    property.image ||
                                                    property.images?.[0] ||
                                                    "IMAGES/leaseaccom-logo-horizontal.svg"
                                                )}"
                                                alt=""
                                            >

                                            <div>

                                                <strong>
                                                    ${esc(
                                                        property.title ||
                                                        "Property"
                                                    )}
                                                </strong>

                                                <span>

                                                    ${esc(
                                                        property.location ||
                                                        property.city ||
                                                        "Nigeria"
                                                    )}

                                                    · ₦${new Intl.NumberFormat(
                                                        "en-NG"
                                                    ).format(
                                                        Number(
                                                            property.price
                                                        ) || 0
                                                    )}

                                                    /
                                                    ${esc(
                                                        property.period ||
                                                        ""
                                                    )}

                                                </span>

                                            </div>

                                        </a>

                                    `
                                )
                                .join("")
                            ||
                            `
                                <div class="owner-profile-bio">
                                    This owner has no other public properties yet.
                                </div>
                            `
                        }

                    </div>


                    <button
                        type="button"
                        class="owner-profile-viewmore"
                        id="ownerViewMoreBtn"
                    >

                        View More Properties

                        <i
                            class="bx bx-right-arrow-alt"
                            aria-hidden="true"
                        ></i>

                    </button>

                </aside>

            `;


            panel.classList.add(
                "is-open"
            );

            document.body.classList.add(
                "modal-open"
            );


            const closeButton =
                panel.querySelector(
                    "#closeOwnerProfile"
                );


            closeButton?.addEventListener(
                "click",
                () => {

                    panel.classList.remove(
                        "is-open"
                    );

                    document.body.classList.remove(
                        "modal-open"
                    );
                }
            );


            panel.addEventListener(
                "click",
                (event) => {

                    if (
                        event.target ===
                        panel
                    ) {

                        panel.classList.remove(
                            "is-open"
                        );

                        document.body.classList.remove(
                            "modal-open"
                        );
                    }
                },
                {
                    once: true
                }
            );


            const viewMoreButton =
                panel.querySelector(
                    "#ownerViewMoreBtn"
                );


            viewMoreButton?.addEventListener(
                "click",
                () => {

                    const query =
                        ownerId != null

                            ? `ownerId=${encodeURIComponent(
                                ownerId
                            )}`

                            : `ownerName=${encodeURIComponent(
                                conversation.ownerName ||
                                ""
                            )}`;


                    window.location.href =
                        `owner-properties.html?${query}`;
                }
            );
        }


        /* =========================================
           OWNER PROFILE BUTTON
        ========================================= */

        ownerProfileBtn?.addEventListener(
            "click",
            openOwnerProfile
        );


        /* =========================================
           CLICK OWNER HEADER
        ========================================= */

        document
            .querySelector(
                ".chat-person"
            )
            ?.addEventListener(
                "click",
                (event) => {

                    if (
                        !event.target.closest(
                            "button"
                        )
                    ) {

                        openOwnerProfile();
                    }
                }
            );


        /* =========================================
           CALL OWNER
        ========================================= */

        callBtn?.addEventListener(
            "click",
            () => {

                const conversation =
                    activeConversation();

                const phone =
                    conversation?.ownerPhone;


                if (phone) {

                    const cleanPhone =
                        String(
                            phone
                        ).replace(
                            /\D/g,
                            ""
                        );


                    const internationalPhone =
                        cleanPhone.startsWith(
                            "0"
                        )
                            ? "+234" +
                              cleanPhone.slice(1)
                            : "+" +
                              cleanPhone;


                    window.location.href =
                        `tel:${internationalPhone}`;

                } else {

                    if (
                        typeof window.leaseaccomToast ===
                        "function"
                    ) {

                        window.leaseaccomToast(
                            "Calling is available after the owner shares a contact number.",
                            "info"
                        );

                    } else {

                        alert(
                            "Calling is available after the owner shares a contact number."
                        );
                    }
                }
            }
        );


        /* =========================================
           VIDEO CALL
        ========================================= */

        videoBtn?.addEventListener(
            "click",
            () => {

                const message =
                    "Video calling is not connected yet. It will be enabled with the real-time backend.";


                if (
                    typeof window.leaseaccomToast ===
                    "function"
                ) {

                    window.leaseaccomToast(
                        message,
                        "info"
                    );

                } else {

                    alert(message);
                }
            }
        );

    }
);

/* Mobile back to conversation list (shared with inline script) */
document.addEventListener("DOMContentLoaded", function () {
  var backBtn = document.getElementById("chatBackBtn");
  if (!backBtn || backBtn.dataset.lhBound) return;
  backBtn.dataset.lhBound = "1";
  backBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var shell = document.querySelector(".messages-shell");
    if (shell) shell.classList.remove("chat-open");
    var content = document.getElementById("chatContent");
    var empty = document.getElementById("chatEmpty");
    if (content) content.style.display = "none";
    if (empty) empty.style.display = "flex";
    try { localStorage.removeItem("activeConversationId"); } catch (err) {}
  });
});
