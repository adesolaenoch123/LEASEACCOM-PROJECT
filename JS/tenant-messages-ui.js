document.addEventListener("DOMContentLoaded", () => {
  const filters = Array.from(document.querySelectorAll(".message-filter"));
  const list = document.getElementById("conversationList");
  const search = document.getElementById("tenantConversationSearch");
  const emptyState = document.getElementById("noConversations");
  const input = document.getElementById("messageInput");
  const attachmentInput = document.getElementById("tenantAttachmentInput");

  const notifyUnavailable = (message) => {
    if (typeof window.leaseaccomToast === "function") {
      window.leaseaccomToast(message, "info");
    } else {
      window.alert(message);
    }
  };

  const applyConversationFilters = () => {
    const filter = filters.find((button) => button.classList.contains("active"))?.dataset.filter || "all";
    const query = (search?.value || "").trim().toLowerCase();
    const items = Array.from(list?.querySelectorAll(".conversation-item") || []);
    let visibleItems = 0;

    items.forEach((item) => {
      const belongsToCategory = filter === "all"
        || (filter === "unread" && item.dataset.unread === "true")
        || (filter === "starred" && item.dataset.starred === "true")
        || (filter === "notifications" && item.dataset.notification === "true");
      const matchesSearch = item.textContent.toLowerCase().includes(query);
      item.style.display = belongsToCategory && matchesSearch ? "flex" : "none";
      if (item.style.display !== "none") visibleItems += 1;
    });

    filters.forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === filter);
    });

    if (emptyState && items.length) {
      emptyState.style.display = visibleItems ? "none" : "block";
      const title = emptyState.querySelector("strong");
      const detail = emptyState.querySelector("p");
      if (title) title.textContent = query
        ? "No matching conversations"
        : filter === "notifications"
          ? "No notifications"
          : "No conversations";
      if (detail) detail.textContent = query
        ? "Try another person, property, or message."
        : filter === "unread"
          ? "You're all caught up. New unread messages will appear here."
          : filter === "starred"
            ? "Starred conversations will appear here."
            : filter === "notifications"
              ? "Your message notifications will appear here."
          : "Start a conversation with a property owner to ask about a listing.";
    }
  };

  filters.forEach((button) => {
    button.addEventListener("click", applyConversationFilters);
  });
  search?.addEventListener("input", applyConversationFilters);
  if (list) {
    new MutationObserver(applyConversationFilters).observe(list, { childList: true });
  }

  document.getElementById("tenantEmojiBtn")?.addEventListener("click", () => {
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.setRangeText("🙂", start, end, "end");
    input.focus();
  });

  const openFilePicker = () => attachmentInput?.click();
  document.getElementById("tenantAttachBtn")?.addEventListener("click", openFilePicker);
  document.getElementById("tenantCameraBtn")?.addEventListener("click", openFilePicker);
  attachmentInput?.addEventListener("change", () => {
    if (attachmentInput.files?.length) {
      notifyUnavailable("Photo and file sharing are not available in chat yet.");
    }
    attachmentInput.value = "";
  });

  document.getElementById("tenantMicBtn")?.addEventListener("click", () => {
    notifyUnavailable("Voice messages are not available in chat yet.");
  });

  document.getElementById("tenantChatCallBtn")?.addEventListener("click", () => {
    const activeId = localStorage.getItem("activeConversationId");
    let conversations = [];
    try {
      conversations = JSON.parse(localStorage.getItem("leaseaccomMessages") || "[]");
    } catch (error) {
      console.error("Unable to read active conversation for call action.", error);
    }
    const conversation = conversations.find((item) => String(item.id) === String(activeId));
    const phone = conversation?.ownerPhone;
    if (phone) {
      const digits = String(phone).replace(/[^\d+]/g, "");
      window.location.href = `tel:${digits}`;
      return;
    }
    notifyUnavailable("Calling is available when the property owner shares a phone number.");
  });

  document.querySelector(".conversation-search .search-icon")?.addEventListener("click", () => {
    search?.focus();
  });

  applyConversationFilters();
});
