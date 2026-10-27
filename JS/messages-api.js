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


  // Bridge to Supabase when LeaseAccomCloud is available
  var _orig = global.LeaseAccomMessagesApi || {};
  global.LeaseAccomMessagesApi = Object.assign({}, _orig, {
    async listConversations() {
      if (global.LeaseAccomCloud && global.LeaseAccomCloud.hasSb && global.LeaseAccomCloud.hasSb()) {
        try {
          var client = global.leaseaccomSupabase || global.leasehubSupabase;
          var uid = await global.LeaseAccomCloud.uid();
          if (client && uid) {
            var { data, error } = await client.from("conversations").select("*")
              .or("tenant_id.eq." + uid + ",owner_id.eq." + uid)
              .order("last_message_at", { ascending: false });
            if (!error && data) {
              return data.map(function (c) {
                return {
                  id: c.id,
                  propertyId: c.property_id,
                  tenantId: c.tenant_id,
                  ownerId: c.owner_id,
                  subject: c.subject || "Property enquiry",
                  propertyTitle: c.subject || "Property enquiry",
                  ownerName: "Property Owner",
                  updatedAt: c.last_message_at,
                  serverBacked: true,
                  messages: []
                };
              });
            }
          }
        } catch (e) { console.warn(e); }
      }
      if (_orig.listConversations) return _orig.listConversations();
      return null;
    },
    async sendMessage(conversation, body) {
      if (global.LeaseAccomCloud && typeof global.LeaseAccomCloud.sendMessage === "function") {
        var id = conversation && (conversation.id || conversation);
        var r = await global.LeaseAccomCloud.sendMessage(id, body);
        if (r && r.ok) return { id: r.data && r.data.id, body: body, createdAt: r.data && r.data.created_at };
      }
      if (_orig.sendMessage) return _orig.sendMessage(conversation, body);
      return null;
    },
    async listMessages(conversation) {
      if (global.LeaseAccomCloud && typeof global.LeaseAccomCloud.listMessages === "function") {
        var id = conversation && (conversation.id || conversation);
        var r = await global.LeaseAccomCloud.listMessages(id);
        if (r && r.ok) {
          return (r.data || []).map(function (m) {
            return { id: m.id, body: m.body, senderId: m.sender_id, createdAt: m.created_at };
          });
        }
      }
      if (_orig.listMessages) return _orig.listMessages(conversation);
      return null;
    }
  });
