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
    const tenantId = row.tenant_id || row.tenantId || "";
    const ownerId = row.owner_id || row.ownerId || "";
    return {
      id: String(row.id),
      propertyId: row.property_id || row.propertyId || "",
      propertyTitle: row.property_title || "Property",
      propertyImage: row.property_image || "",
      propertyLocation: row.property_location || "Nigeria",
      ownerName: row.owner_name || "Property Owner",
      ownerId: ownerId,
      ownerAvatar: row.owner_avatar || "",
      tenantName: row.tenant_name || "Tenant",
      tenantId: tenantId,
      tenantAvatar: row.tenant_avatar || "",
      participants: { tenantId: String(tenantId), ownerId: String(ownerId) },
      lastMessage: row.last_message || "",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || row.created_at || "",
      unread: 0,
      messages: [],
      serverBacked: true
    };
  }

  function cacheConversation(conversation) {
    let conversations = [];
    try {
      conversations = JSON.parse(localStorage.getItem("leaseaccomMessages") || "[]");
    } catch (error) {
      console.warn("Unable to read cached conversations:", error);
    }
    if (!Array.isArray(conversations)) conversations = [];

    const sameThread = (item) => String(item.id) === String(conversation.id) ||
      (String(item.propertyId || "") === String(conversation.propertyId || "") &&
        String(item.ownerId || "") === String(conversation.ownerId || "") &&
        (!item.tenantId || String(item.tenantId) === String(conversation.tenantId)));
    const previous = conversations.find(sameThread);
    const merged = {
      ...previous,
      ...conversation,
      messages: previous?.messages || conversation.messages || [],
      serverBacked: true
    };
    conversations = conversations.filter((item) => !sameThread(item));
    conversations.unshift(merged);
    localStorage.setItem("leaseaccomMessages", JSON.stringify(conversations));

    const oldActiveId = localStorage.getItem("activeConversationId");
    if (previous && String(oldActiveId) === String(previous.id)) {
      localStorage.setItem("activeConversationId", merged.id);
    }
    if (previous && String(localStorage.getItem("ownerActiveConversationId")) === String(previous.id)) {
      localStorage.setItem("ownerActiveConversationId", merged.id);
    }
    return merged;
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
      const cloud = window.LeaseAccomCloud;
      if (cloud?.listConversations) {
        try {
          const result = await cloud.listConversations();
          if (result?.ok) return (result.data || []).map(mapConversation);
          if (result?.error) console.warn("Supabase conversations could not be loaded:", result.error);
        } catch (error) {
          console.warn("Supabase conversations could not be loaded:", error);
        }
      }
      const response = await request("/conversations");
      return Array.isArray(response?.conversations)
        ? response.conversations.map(mapConversation)
        : null;
    },

    async getConversationById(id) {
      const cloud = window.LeaseAccomCloud;
      if (!cloud?.getConversationById) return null;
      try {
        const result = await cloud.getConversationById(id);
        if (!result?.ok || !result.data) {
          if (result?.error && result.error !== "Conversation not found") {
            console.warn("Supabase conversation could not be loaded:", result.error);
          }
          return null;
        }
        return mapConversation(result.data);
      } catch (error) {
        console.warn("Supabase conversation could not be loaded:", error);
        return null;
      }
    },

    async createConversation(property) {
      const propertyId = typeof property === "object" ? property?.propertyId || property?.property_id : property;
      const cloud = window.LeaseAccomCloud;
      const ownerId = property?.ownerId || property?.owner_id;
      if (cloud?.getOrCreateConversation && typeof property === "object" && ownerId) {
        try {
          const result = await cloud.getOrCreateConversation(
            propertyId,
            ownerId,
            property.tenantId
          );
          if (result?.ok && result.data) {
            const row = result.data;
            return cacheConversation(mapConversation({
              ...row,
              property_title: property.propertyTitle || property.property_title,
              property_image: property.propertyImage || property.property_image,
              property_location: property.propertyLocation || property.property_location,
              owner_name: property.ownerName || property.owner_name,
              owner_avatar: property.ownerAvatar || property.owner_avatar,
              tenant_name: property.tenantName || property.tenant_name,
              tenant_avatar: property.tenantAvatar || property.tenant_avatar
            }));
          }
          if (result?.error) {
            console.warn("Could not create conversation in Supabase:", result.error);
            return null;
          }
        } catch (error) {
          console.warn("Supabase conversation creation failed:", error);
          return null;
        }
      }
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


(function (global) {
  var chatApi = global.LeaseAccomChatApi || {};
  var restSendMessage = chatApi.sendMessage;
  var restListMessages = chatApi.listMessages;

  global.LeaseAccomChatApi = Object.assign({}, chatApi, {
    async sendMessage(conversation, body) {
      var cloud = global.LeaseAccomCloud;
      if (cloud && typeof cloud.sendMessage === "function") {
        try {
          var result = await cloud.sendMessage(conversation.id, body);
          if (result?.ok) {
            var userId = await cloud.uid();
            var tenantSent = String(userId) === String(conversation.tenantId);
            var recipientId = tenantSent ? conversation.ownerId : conversation.tenantId;
            if (recipientId && cloud.notify) {
              var notification = await cloud.notify(
                recipientId,
                "New message",
                body.slice(0, 180),
                "info",
                tenantSent ? "owner-messages.html" : "messages.html"
              );
              if (!notification?.ok) console.warn("Message sent, but its notification could not be saved.", notification?.error);
            }
            return {
              id: result.data?.id,
              sender_id: userId,
              sender: tenantSent ? "tenant" : "owner",
              text: body,
              body: body,
              createdAt: result.data?.created_at
            };
          }
          if (result?.error) console.warn("Supabase could not send the message:", result.error);
        } catch (error) {
          console.warn("Supabase message send failed:", error);
        }
      }
      return restSendMessage ? restSendMessage(conversation, body) : null;
    },

    async listMessages(conversation) {
      var cloud = global.LeaseAccomCloud;
      if (cloud && typeof cloud.listMessages === "function") {
        try {
          var result = await cloud.listMessages(conversation.id);
          if (result?.ok) {
            return (result.data || []).map(function (message) {
              var isTenant = String(message.sender_id) === String(conversation.tenantId);
              return {
                id: message.id,
                sender_id: message.sender_id,
                sender: isTenant ? "tenant" : "owner",
                senderName: isTenant ? conversation.tenantName : conversation.ownerName,
                senderAvatar: isTenant ? conversation.tenantAvatar : conversation.ownerAvatar,
                text: message.body || "",
                createdAt: message.created_at || ""
              };
            });
          }
          if (result?.error) console.warn("Supabase messages could not be loaded:", result.error);
        } catch (error) {
          console.warn("Supabase message loading failed:", error);
        }
      }
      return restListMessages ? restListMessages(conversation) : null;
    }
  });
})(window);
