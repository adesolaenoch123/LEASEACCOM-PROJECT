document.addEventListener("DOMContentLoaded", () => {

    const conversationList =
        document.getElementById("ownerConversationList");

    const noConversations =
        document.getElementById("ownerNoConversations");

    const chatEmpty =
        document.getElementById("ownerChatEmpty");

    const chatContent =
        document.getElementById("ownerChatContent");

    const chatTenantName =
        document.getElementById("chatPersonName");

    const chatPropertyName =
        document.getElementById("chatPropertyName");

    const chatMessages =
        document.getElementById("ownerChatMessages");

    const messageForm =
        document.getElementById("ownerMessageForm");

    const messageInput =
        document.getElementById("ownerMessageInput");

    const tenantAvatar =
        document.getElementById("tenantChatOwnerAvatar");

    const topProfileAvatar =
        document.getElementById("topProfileAvatar");

    const topProfileName =
        document.getElementById("topProfileName");


    /* ==========================================
       DEFAULT PROFILE IMAGES
    ========================================== */

    const defaultOwnerAvatar =
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80";

    const defaultTenantAvatar =
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80";


    /* ==========================================
       PROFILE
    ========================================== */

    function getOwnerProfile() {

        try {

            return JSON.parse(
                localStorage.getItem("leaseaccomOwnerProfile")
            ) || {
                name: "Property Owner",
                accountType: "owner",
                bio: "",
                avatar: defaultOwnerAvatar
            };

        } catch (error) {

            return {
                name: "Property Owner",
                accountType: "owner",
                bio: "",
                avatar: defaultOwnerAvatar
            };

        }

    }


    function saveOwnerProfile(profile) {

        localStorage.setItem(
            "leaseaccomOwnerProfile",
            JSON.stringify(profile)
        );

    }


    let ownerProfile = getOwnerProfile();


    function updateOwnerProfileUI() {

        topProfileName.textContent =
            ownerProfile.name || "Property Owner";

        topProfileAvatar.src =
            ownerProfile.avatar || defaultOwnerAvatar;

        const preview =
            document.getElementById("profilePreview");

        if (preview) {
            preview.src =
                ownerProfile.avatar || defaultOwnerAvatar;
        }

        const nameInput =
            document.getElementById("ownerDisplayName");

        const typeInput =
            document.getElementById("ownerAccountType");

        const bioInput =
            document.getElementById("ownerBio");

        if (nameInput) {
            nameInput.value =
                ownerProfile.name || "";
        }

        if (typeInput) {
            typeInput.value =
                ownerProfile.accountType || "owner";
        }

        if (bioInput) {
            bioInput.value =
                ownerProfile.bio || "";
        }

    }


    updateOwnerProfileUI();


    /* ==========================================
       CONVERSATIONS
    ========================================== */

    function getConversations() {

        try {

            return JSON.parse(
                localStorage.getItem("leaseaccomMessages")
            ) || [];

        } catch (error) {

            console.error(
                "Unable to load LeaseAccom messages.",
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


    function saveConversations(conversations) {

        localStorage.setItem(
            "leaseaccomMessages",
            JSON.stringify(conversations)
        );

    }


    async function syncRemoteConversations() {
        const remote = await window.LeaseAccomChatApi?.listConversations?.();
        if (!Array.isArray(remote)) {
            if (!canUseLocalFallback()) {
                conversations = [];
                saveConversations(conversations);
            }
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
            if (previous && String(previous.id) === String(activeConversationId)) {
                activeConversationId = conversation.id;
                localStorage.setItem("activeConversationId", conversation.id);
                localStorage.setItem("ownerActiveConversationId", conversation.id);
            }
            return {
                ...previous,
                ...conversation,
                messages: previous?.messages || [],
                serverBacked: true
            };
        });

        conversations = merged;
        saveConversations(conversations);
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
        const current = getConversations();
        const index = current.findIndex((item) => String(item.id) === String(conversation.id));
        if (index >= 0) current[index] = conversation;
        conversations = current;
        saveConversations(conversations);
        if (String(activeConversationId) === String(conversation.id)) {
            renderMessages(conversation);
            renderConversations();
        }
    }


    let conversations = getConversations();

    let activeConversationId =
        localStorage.getItem(
            "activeConversationId"
        );


    /* ==========================================
       TIME FORMAT
    ========================================== */

    function formatTime(dateString) {

        if (!dateString) {
            return "";
        }

        const date =
            new Date(dateString);

        return date.toLocaleTimeString(
            [],
            {
                hour: "numeric",
                minute: "2-digit"
            }
        );

    }


    /* ==========================================
       ESCAPE HTML
    ========================================== */

    function escapeHTML(value) {

        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    /* ==========================================
       GET TENANT PROFILE
    ========================================== */

    function getTenantProfile() {

        try {

            return JSON.parse(
                localStorage.getItem(
                    "leaseaccomTenantProfile"
                )
            ) || {
                name: "Tenant",
                avatar: defaultTenantAvatar
            };

        } catch (error) {

            return {
                name: "Tenant",
                avatar: defaultTenantAvatar
            };

        }

    }


    /* ==========================================
       RENDER CONVERSATIONS
    ========================================== */

    function renderConversations() {

        conversations = getConversations();

        conversationList.innerHTML = "";

        if (!conversations.length) {

            noConversations.style.display =
                "block";

            return;

        }

        noConversations.style.display =
            "none";


        conversations.forEach(conversation => {

            const messages =
                conversation.messages || [];

            const lastMessage =
                messages[messages.length - 1];

            const tenantProfile =
                getTenantProfile();


            const tenantName =
                conversation.tenantName ||
                tenantProfile.name ||
                "Tenant";


            const tenantImage =
                conversation.tenantAvatar ||
                tenantProfile.avatar ||
                defaultTenantAvatar;


            const item =
                document.createElement("div");

            item.className =
                "conversation-item";


            if (
                conversation.id ===
                activeConversationId
            ) {

                item.classList.add("active");

            }


            item.innerHTML = `

                <img
                    class="conversation-avatar"
                    src="${tenantImage}"
                    alt="Tenant"
                >

                <div class="conversation-info">

                    <div class="conversation-top">

                        <span class="conversation-name">
                            ${escapeHTML(tenantName)}
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
                            "LeaseAccom Property"
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

                ${
                    conversation.unread > 0
                        ? `
                            <span class="unread-count">
                                ${conversation.unread}
                            </span>
                          `
                        : ""
                }

            `;


            item.addEventListener(
                "click",
                () => {

                    openConversation(
                        conversation.id
                    );

                }
            );


            conversationList.appendChild(item);

        });

    }


    /* ==========================================
       OPEN CONVERSATION
    ========================================== */

    function openConversation(id) {

        conversations =
            getConversations();

        let conversation =
            conversations.find(
                item => String(item.id) === String(id)
            );

        if (!conversation) {
            conversation = conversations.find(
                item =>
                    String(item.propertyId) === String(id) ||
                    String(id) === "property-" + String(item.propertyId || "")
            );
        }

        if (!conversation) {
            console.warn("Owner conversation not found, reloading list", id);
            try {
                if (typeof renderConversations === "function") renderConversations();
            } catch (e) {}
            return;
        }


        activeConversationId =
            conversation.id;


        localStorage.setItem(
            "activeConversationId",
            activeConversationId
        );


        conversation.unread = 0;

        saveConversations(
            conversations
        );


        chatEmpty.style.display =
            "none";

        chatContent.style.display =
            "flex";

        document.body.classList.add("chat-open");
        const shellEl = document.querySelector(".messages-shell");
        if (shellEl) shellEl.classList.add("chat-open");


        const tenantProfile =
            getTenantProfile();


        chatTenantName.textContent =
            conversation.tenantName ||
            tenantProfile.name ||
            "Tenant";


        chatPropertyName.textContent =
            conversation.propertyTitle ||
            "LeaseAccom Property";


        tenantAvatar.src =
            conversation.tenantAvatar ||
            tenantProfile.avatar ||
            defaultTenantAvatar;


        renderMessages(
            conversation
        );

        refreshRemoteMessages(conversation);


        renderConversations();

    }


    /* ==========================================
       RENDER MESSAGES
    ========================================== */

    function renderMessages(
        conversation
    ) {

        chatMessages.innerHTML = "";


        const messages =
            conversation.messages || [];


        const tenantProfile =
            getTenantProfile();


        messages.forEach(message => {

            const isOwner =
                message.sender === "owner";


            const row =
                document.createElement("div");


            row.className =
                `message-row ${
                    isOwner
                        ? "owner"
                        : "tenant"
                }`;


            const avatar =
                isOwner
                    ? ownerProfile.avatar ||
                      defaultOwnerAvatar
                    : conversation.tenantAvatar ||
                      tenantProfile.avatar ||
                      defaultTenantAvatar;


            const senderName =
                isOwner
                    ? ownerProfile.name
                    : conversation.tenantName ||
                      tenantProfile.name ||
                      "Tenant";


            row.innerHTML = `

                ${
                    !isOwner
                        ? `
                            <img
                                class="message-avatar"
                                src="${avatar}"
                                alt="${escapeHTML(senderName)}"
                            >
                          `
                        : ""
                }

                <div class="message-bubble">

                    <span class="message-role">
                        ${
                            isOwner
                                ? "OWNER"
                                : "TENANT"
                        }
                    </span>

                    <div class="message-text">
                        ${escapeHTML(message.text)}
                    </div>

                    <div class="message-meta">

                        ${formatTime(
                            message.createdAt
                        )}

                        ${
                            isOwner
                                ? `
                                    <span class="message-check">
                                        <i class="bx bx-check-double" aria-hidden="true"></i>
                                    </span>
                                  `
                                : ""
                        }

                    </div>

                </div>

                ${
                    isOwner
                        ? `
                            <img
                                class="message-avatar"
                                src="${avatar}"
                                alt="${escapeHTML(senderName)}"
                            >
                          `
                        : ""
                }

            `;


            chatMessages.appendChild(
                row
            );

        });


        chatMessages.scrollTop =
            chatMessages.scrollHeight;

    }


    /* ==========================================
       SEND MESSAGE
    ========================================== */

    messageForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const text =
                messageInput.value.trim();


            if (!text) {
                return;
            }


            conversations =
                getConversations();


            const conversation =
                conversations.find(
                    item =>
                        item.id ===
                        activeConversationId
                );


            if (!conversation) {
                return;
            }

            if (!conversation.serverBacked && !canUseLocalFallback()) {
                alert("This conversation is not connected to the messaging service.");
                return;
            }


            if (!conversation.messages) {

                conversation.messages = [];

            }


            const remoteMessage = conversation.serverBacked
                ? await window.LeaseAccomChatApi?.sendMessage?.(conversation, text)
                : null;

            if (conversation.serverBacked && !remoteMessage && !canUseLocalFallback()) {
                alert("Message could not be sent. Please try again.");
                return;
            }

            conversation.messages.push(remoteMessage || {

                id: Date.now(),

                sender: "owner",

                senderName:
                    ownerProfile.name ||
                    "Property Owner",

                senderAvatar:
                    ownerProfile.avatar ||
                    defaultOwnerAvatar,

                text: text,

                createdAt:
                    new Date().toISOString()

            });


            conversation.unread = 0;


            saveConversations(
                conversations
            );


            messageInput.value = "";


            renderMessages(
                conversation
            );


            renderConversations();

        }
    );


    /* ==========================================
       PROFILE DRAWER
    ========================================== */

    const profileDrawer =
        document.getElementById(
            "profileDrawer"
        );

    const openProfileBtn =
        document.getElementById(
            "openProfileBtn"
        );

    const closeProfileBtn =
        document.getElementById(
            "closeProfileBtn"
        );


    openProfileBtn?.addEventListener(
        "click",
        () => {

            profileDrawer?.classList.add(
                "open"
            );

        }
    );


    closeProfileBtn?.addEventListener(
        "click",
        () => {

            profileDrawer?.classList.remove(
                "open"
            );

        }
    );


    /* ==========================================
       PROFILE IMAGE UPLOAD
    ========================================== */

    const profilePictureInput =
        document.getElementById(
            "profilePictureInput"
        );

    const profilePreview =
        document.getElementById(
            "profilePreview"
        );


    profilePictureInput.addEventListener(
        "change",
        event => {

            const file =
                event.target.files[0];


            if (!file) {
                return;
            }


            if (!file.type.startsWith("image/")) {

                alert(
                    "Please choose an image file."
                );

                return;

            }


            const reader =
                new FileReader();


            reader.onload = event => {

                profilePreview.src =
                    event.target.result;


                ownerProfile.avatar =
                    event.target.result;

            };


            reader.readAsDataURL(
                file
            );

        }
    );


    /* ==========================================
       SAVE PROFILE
    ========================================== */

    const saveProfileBtn =
        document.getElementById(
            "saveProfileBtn"
        );


    saveProfileBtn.addEventListener(
        "click",
        () => {

            const name =
                document.getElementById(
                    "ownerDisplayName"
                ).value.trim();


            const accountType =
                document.getElementById(
                    "ownerAccountType"
                ).value;


            const bio =
                document.getElementById(
                    "ownerBio"
                ).value.trim();


            ownerProfile = {

                name:
                    name ||
                    "Property Owner",

                accountType,

                bio,

                avatar:
                    ownerProfile.avatar ||
                    defaultOwnerAvatar

            };


            saveOwnerProfile(
                ownerProfile
            );


            updateOwnerProfileUI();


            const message =
                document.getElementById(
                    "profileMessage"
                );


            message.style.display =
                "block";


            setTimeout(() => {

                message.style.display =
                    "none";

            }, 2500);


            if (activeConversationId) {

                const conversation =
                    getConversations().find(
                        item =>
                            item.id ===
                            activeConversationId
                    );


                if (conversation) {

                    renderMessages(
                        conversation
                    );

                }

            }

        }
    );


    /* ==========================================
       CONVERSATION SEARCH
    ========================================== */

    const searchInput =
        document.getElementById(
            "conversationSearch"
        );


    searchInput.addEventListener(
        "input",
        () => {

            const query =
                searchInput.value
                    .toLowerCase()
                    .trim();


            const items =
                document.querySelectorAll(
                    ".conversation-item"
                );


            items.forEach(item => {

                const text =
                    item.textContent
                        .toLowerCase();


                item.style.display =
                    text.includes(query)
                        ? "flex"
                        : "none";

            });

        }
    );


    /* ==========================================
       FILTER BUTTONS
    ========================================== */

    document
        .querySelectorAll(".message-filter")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".message-filter"
                        )
                        .forEach(btn =>
                            btn.classList.remove(
                                "active"
                            )
                        );


                    button.classList.add(
                        "active"
                    );


                    const filter =
                        button.dataset.filter;


                    const items =
                        document.querySelectorAll(
                            ".conversation-item"
                        );


                    conversations =
                        getConversations();


                    items.forEach(item => {

                        const conversation =
                            conversations.find(
                                c =>
                                    item.classList.contains(
                                        "active"
                                    )
                            );


                        if (
                            filter ===
                            "unread"
                        ) {

                            const hasUnread =
                                conversations.some(
                                    c =>
                                        c.unread > 0
                                );


                            item.style.display =
                                hasUnread
                                    ? "flex"
                                    : "none";

                        } else {

                            item.style.display =
                                "flex";

                        }

                    });

                }
            );

        });


    /* ==========================================
       AUTO OPEN ACTIVE CHAT
    ========================================== */

    (async () => {
        await syncRemoteConversations();
        activeConversationId = localStorage.getItem("ownerActiveConversationId") ||
            localStorage.getItem("activeConversationId");
        if (activeConversationId) openConversation(activeConversationId);
        else renderConversations();
    })();


    /* ==========================================
       REFRESH WHEN STORAGE CHANGES
    ========================================== */

    window.addEventListener(
        "storage",
        () => {

            conversations =
                getConversations();

            renderConversations();


            if (activeConversationId) {

                const conversation =
                    conversations.find(
                        c =>
                            c.id ===
                            activeConversationId
                    );


                if (conversation) {

                    renderMessages(
                        conversation
                    );

                }

            }

        }
    );


});
document.addEventListener("DOMContentLoaded",()=>{
 const read=k=>{try{return JSON.parse(localStorage.getItem(k)||"[]")}catch{return[]}};
 const active=()=>{const id=localStorage.getItem("ownerActiveConversationId")||localStorage.getItem("activeConversationId");return read("leaseaccomMessages").find(c=>String(c.id)===String(id));};
 document.getElementById("ownerChatCallBtn")?.addEventListener("click",()=>{const c=active();const phone=c?.tenantPhone;if(phone){const clean=String(phone).replace(/\D/g,"");location.href=`tel:${clean.startsWith("0")?"+234"+clean.slice(1):"+"+clean}`;}else if(typeof leaseaccomToast==="function")leaseaccomToast("Calling is available after the tenant shares a contact number.","info");});
 document.getElementById("ownerChatVideoBtn")?.addEventListener("click",()=>{if(typeof leaseaccomToast==="function")leaseaccomToast("Video calling is not connected yet. It will be enabled with the real-time backend.","info");});
});
