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
        document.getElementById("ownerChatTenantName");

    const chatPropertyName =
        document.getElementById("ownerChatPropertyName");

    const chatMessages =
        document.getElementById("ownerChatMessages");

    const messageForm =
        document.getElementById("ownerMessageForm");

    const messageInput =
        document.getElementById("ownerMessageInput");

    const tenantAvatar =
        document.getElementById("ownerChatTenantAvatar");

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
                localStorage.getItem("leasehubOwnerProfile")
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
            "leasehubOwnerProfile",
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
                localStorage.getItem("leasehubMessages")
            ) || [];

        } catch (error) {

            console.error(
                "Unable to load LeaseHub messages.",
                error
            );

            return [];

        }

    }


    function saveConversations(conversations) {

        localStorage.setItem(
            "leasehubMessages",
            JSON.stringify(conversations)
        );

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
                    "leasehubTenantProfile"
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
                            "LeaseHub Property"
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

        const conversation =
            conversations.find(
                item => item.id === id
            );


        if (!conversation) {
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
            "LeaseHub Property";


        tenantAvatar.src =
            conversation.tenantAvatar ||
            tenantProfile.avatar ||
            defaultTenantAvatar;


        renderMessages(
            conversation
        );


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
        event => {

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


            if (!conversation.messages) {

                conversation.messages = [];

            }


            conversation.messages.push({

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


    openProfileBtn.addEventListener(
        "click",
        () => {

            profileDrawer.classList.add(
                "open"
            );

        }
    );


    closeProfileBtn.addEventListener(
        "click",
        () => {

            profileDrawer.classList.remove(
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

    if (activeConversationId) {

        openConversation(
            activeConversationId
        );

    } else {

        renderConversations();

    }


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
 const active=()=>{const id=localStorage.getItem("ownerActiveConversationId")||localStorage.getItem("activeConversationId");return read("leasehubMessages").find(c=>String(c.id)===String(id));};
 document.getElementById("ownerChatCallBtn")?.addEventListener("click",()=>{const c=active();const phone=c?.tenantPhone;if(phone){const clean=String(phone).replace(/\D/g,"");location.href=`tel:${clean.startsWith("0")?"+234"+clean.slice(1):"+"+clean}`;}else if(typeof leaseHubToast==="function")leaseHubToast("Calling is available after the tenant shares a contact number.","info");});
 document.getElementById("ownerChatVideoBtn")?.addEventListener("click",()=>{if(typeof leaseHubToast==="function")leaseHubToast("Video calling is not connected yet. It will be enabled with the real-time backend.","info");});
});
