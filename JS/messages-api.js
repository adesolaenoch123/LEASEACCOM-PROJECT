(function () {
  function hasSession() {
    return Boolean(
      window.LeaseAccomApi?.isConfigured?.() &&
      window.LeaseAccomAuth?.getAccessToken
    );
  }

  async function request(path, options) {
    if (!hasSession()) return null;
    try {
      const token = await window.LeaseAccomAuth.getAccessToken();
      if (!token) return null;
      return await window.LeaseAccomApi.request(path, options);
    } catch (error) {
      console.warn("LeaseAccom chat API unavailable:", error.message);
      return null;
    }
  }

  function mapConversation(row) {
    return {
      id: String(row.id),
      propertyId: row.property_id || "",
      propertyTitle: row.property_title || "Property",
      propertyImage: row.property_image || "",
      propertyLocation: row.property_location || "Nigeria",
      ownerName: row.owner_name || "Property Owner",
      ownerId: row.owner_id || "",
      ownerAvatar: row.owner_avatar || "",
      tenantName: row.tenant_name || "Tenant",
      tenantId: row.tenant_id || "",
      tenantAvatar: row.tenant_avatar || "",
      lastMessage: row.last_message || "",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || row.created_at || "",
      unread: 0,
      messages: [],
      serverBacked: true
    };
  }

  function mapMessage(row, conversation) {
    const isTenant = String(row.sender_id) === String(conversation.tenantId);
    return {
      id: row.id,
      sender: isTenant ? "tenant" : "owner",
      senderName: isTenant ? conversation.tenantName : conversation.ownerName,
      senderAvatar: isTenant ? conversation.tenantAvatar : conversation.ownerAvatar,
      text: row.body || "",
      createdAt: row.created_at || ""
    };
  }

  window.LeaseAccomChatApi = {
    async listConversations() {
      const response = await request("/conversations");
      return response ? response.conversations.map(mapConversation) : null;
    },

    async createConversation(propertyId) {
      const response = await request("/conversations", {
        method: "POST",
        body: { property_id: String(propertyId) }
      });
      return response?.conversation ? mapConversation(response.conversation) : null;
    },

    async listMessages(conversation) {
      const response = await request(
        `/conversations/${encodeURIComponent(conversation.id)}/messages`
      );
      return response ? response.messages.map((message) => mapMessage(message, conversation)) : null;
    },

    async sendMessage(conversation, body) {
      const response = await request(
        `/conversations/${encodeURIComponent(conversation.id)}/messages`,
        { method: "POST", body: { body } }
      );
      return response?.message ? mapMessage(response.message, conversation) : null;
    }
  };
})();
