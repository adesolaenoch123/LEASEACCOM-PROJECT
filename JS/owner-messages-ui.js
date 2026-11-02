document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const profileDrawer = document.getElementById("profileDrawer");
  const profileBackdrop = document.getElementById("profileBackdrop");
  const openProfile = document.getElementById("openProfileBtn");
  const closeProfile = document.getElementById("closeProfileBtn");
  const chatBack = document.getElementById("chatBackBtn");
  const conversations = document.getElementById("ownerConversationList");
  const emptyList = document.getElementById("ownerNoConversations");
  const filters = Array.from(document.querySelectorAll(".message-filter"));
  const search = document.getElementById("conversationSearch");
  const messageInput = document.getElementById("ownerMessageInput");
  const emojiButton = document.getElementById("ownerEmojiBtn");
  const attachButton = document.getElementById("ownerAttachBtn");
  const cameraButton = document.getElementById("ownerCameraBtn");
  const micButton = document.getElementById("ownerMicBtn");
  const attachmentInput = document.getElementById("ownerAttachmentInput");

  const showProfile = (visible) => {
    profileDrawer?.classList.toggle("open", visible);
    body.classList.toggle("om-profile-open", visible);
  };

  openProfile?.addEventListener("click", () => showProfile(true));
  closeProfile?.addEventListener("click", () => showProfile(false));
  profileBackdrop?.addEventListener("click", () => showProfile(false));
  chatBack?.addEventListener("click", () => {
    body.classList.remove("chat-open");
    document.querySelector(".messages-shell")?.classList.remove("chat-open");
  });

  const applyFilter = () => {
    const activeFilter = filters.find((filter) => filter.classList.contains("active"))?.dataset.filter || "all";
    const query = (search?.value || "").trim().toLowerCase();
    const items = Array.from(conversations?.querySelectorAll(".conversation-item") || []);
    let visibleCount = 0;

    items.forEach((item) => {
      const categoryMatches = activeFilter === "all" || item.dataset.category === activeFilter;
      const searchMatches = item.textContent.toLowerCase().includes(query);
      item.style.display = categoryMatches && searchMatches ? "flex" : "none";
      if (item.style.display !== "none") visibleCount += 1;
    });

    if (emptyList) {
      const title = emptyList.querySelector("strong");
      const detail = emptyList.querySelector("p");
      const isEmpty = visibleCount === 0;
      emptyList.style.display = isEmpty ? "flex" : "none";
      if (title) title.textContent = query ? "No matching messages" : activeFilter === "updates" ? "No property updates" : activeFilter === "notifications" ? "No notifications" : "No conversations yet";
      if (detail) detail.textContent = query ? "Try another name, property, or message." : activeFilter === "updates" ? "Property activity will appear here when available." : activeFilter === "notifications" ? "New message alerts will appear here." : "Tenant conversations and property updates will appear here.";
    }
  };

  filters.forEach((filter) => filter.addEventListener("click", () => {
    filters.forEach((button) => button.classList.toggle("active", button === filter));
    applyFilter();
  }));
  search?.addEventListener("input", applyFilter);
  if (conversations) {
    new MutationObserver(applyFilter).observe(conversations, { childList: true });
  }

  emojiButton?.addEventListener("click", () => {
    if (!messageInput) return;
    const start = messageInput.selectionStart ?? messageInput.value.length;
    const end = messageInput.selectionEnd ?? start;
    messageInput.setRangeText("🙂", start, end, "end");
    messageInput.focus();
  });

  const openAttachmentPicker = () => attachmentInput?.click();
  attachButton?.addEventListener("click", openAttachmentPicker);
  cameraButton?.addEventListener("click", openAttachmentPicker);
  micButton?.addEventListener("click", () => {
    if (typeof window.leaseaccomToast === "function") {
      window.leaseaccomToast("Voice messages are not available in this chat yet.", "info");
    }
  });
  attachmentInput?.addEventListener("change", () => {
    if (attachmentInput.files?.length && typeof window.leaseaccomToast === "function") {
      window.leaseaccomToast("File sharing is not available in this chat yet.", "info");
    }
    attachmentInput.value = "";
  });

  document.querySelector(".om-compose")?.addEventListener("click", () => {
    if (typeof window.leaseaccomToast === "function") {
      window.leaseaccomToast("Open a tenant conversation to start a message.", "info");
    }
  });

  applyFilter();
});
