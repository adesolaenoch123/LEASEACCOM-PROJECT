/**
 * LeaseAccom cloud API — single place for Supabase reads/writes.
 * Use this as features go fully cloud. Falls back gracefully if offline.
 */
(function (global) {
  "use strict";

  function sb() {
    return global.leaseaccomSupabase || global.leasehubSupabase || null;
  }
  function hasSb() {
    return !!(sb() && typeof sb().from === "function");
  }

  async function uid() {
    if (!hasSb()) return null;
    try {
      const { data } = await sb().auth.getUser();
      return data && data.user ? data.user.id : null;
    } catch (e) {
      return null;
    }
  }

  async function notify(userId, title, message, type, link) {
    if (!hasSb() || !userId) return;
    try {
      await sb().from("notifications").insert({
        user_id: userId,
        title: title || "LeaseAccom",
        message: message || "",
        type: type || "info",
        link: link || null
      });
    } catch (e) {}
  }

  // ---- Properties ----
  async function listLiveProperties() {
    if (!hasSb()) return { ok: false, offline: true, data: [] };
    const { data, error } = await sb()
      .from("properties")
      .select("*")
      .or("listing_status.eq.live,verification_status.eq.approved")
      .order("updated_at", { ascending: false });
    if (error) return { ok: false, error: error.message, data: [] };
    return { ok: true, data: data || [] };
  }

  async function listOwnerProperties(ownerId) {
    if (!hasSb()) return { ok: false, offline: true, data: [] };
    const id = ownerId || (await uid());
    const { data, error } = await sb()
      .from("properties")
      .select("*")
      .eq("owner_id", id)
      .order("updated_at", { ascending: false });
    if (error) return { ok: false, error: error.message, data: [] };
    return { ok: true, data: data || [] };
  }

  function dataUrlToBlob(dataUrl) {
    try {
      var parts = String(dataUrl).split(",");
      var mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/jpeg";
      var bin = atob(parts[1] || "");
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch (e) {
      return null;
    }
  }

  async function createProperty(row) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in" };
    const images = Array.isArray(row.images) ? row.images : [];
    const videos = Array.isArray(row.videos) ? row.videos : [];
    const cover = row.image || row.cover_image || images[0] || "";
    const payload = {
      id: String(row.id || (global.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now())),
      owner_id: userId,
      owner_name: row.ownerName || row.owner_name || "",
      title: row.title,
      type: row.type || null,
      purpose: row.purpose || null,
      state: row.state || null,
      city: row.city || null,
      location: row.location || "",
      price: Number(row.price) || 0,
      period: row.period || "year",
      bedrooms: row.bedrooms != null ? Number(row.bedrooms) : null,
      bathrooms: row.bathrooms != null ? Number(row.bathrooms) : null,
      size: row.size || null,
      description: row.description || "",
      amenities: row.amenities || [],
      images: images,
      videos: videos,
      cover_image: cover,
      image: cover,
      listing_status: "pending",
      verification_status: "pending",
      views_count: 0
    };
    var res = await sb().from("properties").insert(payload).select().maybeSingle();
    if (res.error) {
      // minimal fallback
      var minimal = {
        id: payload.id,
        owner_id: userId,
        title: payload.title,
        location: payload.location,
        city: payload.city,
        price: payload.price,
        description: payload.description,
        images: images,
        verification_status: "pending"
      };
      res = await sb().from("properties").insert(minimal).select().maybeSingle();
      if (res.error) return { ok: false, error: res.error.message };
    }
    return { ok: true, data: res.data };
  }

  // ---- Media (Storage) ----
  async function uploadMedia(bucket, path, fileOrBlob, contentType) {
    if (!hasSb()) return { ok: false, offline: true };
    const { data, error } = await sb().storage.from(bucket).upload(path, fileOrBlob, {
      contentType: contentType || "application/octet-stream",
      upsert: true
    });
    if (error) return { ok: false, error: error.message };
    const pub = sb().storage.from(bucket).getPublicUrl(path);
    return { ok: true, path: data && data.path ? data.path : path, publicUrl: pub && pub.data ? pub.data.publicUrl : null };
  }

  /** Upload data-URL images/videos to property-media/{userId}/... */
  async function uploadListingMedia(imageDataUrls, videoItems) {
    if (!hasSb()) return { ok: false, offline: true, images: [], videos: [] };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in", images: [], videos: [] };
    const stamp = Date.now();
    const imageUrls = [];
    const videoUrls = [];
    const imgs = Array.isArray(imageDataUrls) ? imageDataUrls : [];
    for (var i = 0; i < imgs.length; i++) {
      var blob = dataUrlToBlob(imgs[i]);
      if (!blob) continue;
      var path = userId + "/" + stamp + "-img-" + i + ".jpg";
      var up = await uploadMedia("property-media", path, blob, blob.type || "image/jpeg");
      if (up.ok && up.publicUrl) imageUrls.push(up.publicUrl);
      else if (up.error) console.warn("image upload", up.error);
    }
    const vids = Array.isArray(videoItems) ? videoItems : [];
    for (var j = 0; j < vids.length; j++) {
      var v = vids[j];
      var vBlob = typeof v === "string" ? dataUrlToBlob(v) : dataUrlToBlob(v && v.dataUrl);
      if (!vBlob) continue;
      var vPath = userId + "/" + stamp + "-vid-" + j + ".mp4";
      var vUp = await uploadMedia("property-media", vPath, vBlob, vBlob.type || "video/mp4");
      if (vUp.ok && vUp.publicUrl) videoUrls.push(vUp.publicUrl);
      else if (vUp.error) console.warn("video upload", vUp.error);
    }
    return { ok: imageUrls.length > 0 || imgs.length === 0, images: imageUrls, videos: videoUrls };
  }

  // ---- Viewings ----
  async function createViewing(payload) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in" };
    const row = {
      property_id: String(payload.propertyId),
      tenant_id: userId,
      owner_id: payload.ownerId || null,
      preferred_date: payload.date || payload.preferredDate || null,
      preferred_time: payload.time || payload.preferredTime || null,
      message: payload.message || "",
      status: "requested"
    };
    const { data, error } = await sb().from("viewings").insert(row).select().maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (payload.ownerId) {
      await notify(payload.ownerId, "New viewing request", "A tenant requested a viewing.", "info", "owner-dashboard.html");
    }
    return { ok: true, data: data };
  }

  async function listMyViewings(role) {
    if (!hasSb()) return { ok: false, offline: true, data: [] };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in", data: [] };
    const col = role === "owner" ? "owner_id" : "tenant_id";
    const { data, error } = await sb().from("viewings").select("*").eq(col, userId).order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message, data: [] };
    return { ok: true, data: data || [] };
  }

  async function updateViewingStatus(id, status) {
    if (!hasSb()) return { ok: false, offline: true };
    const { data, error } = await sb().from("viewings").update({ status: status, updated_at: new Date().toISOString() }).eq("id", id).select().maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data };
  }

  // ---- Applications ----
  async function createApplication(payload) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in" };
    const row = {
      property_id: String(payload.propertyId),
      tenant_id: userId,
      owner_id: payload.ownerId || null,
      applicant_name: payload.name || payload.applicantName,
      applicant_email: payload.email || payload.applicantEmail,
      applicant_phone: payload.phone || payload.applicantPhone,
      move_in_date: payload.moveInDate || null,
      message: payload.message || "",
      property_title: payload.propertyTitle || "",
      status: "submitted"
    };
    const { data, error } = await sb().from("applications").insert(row).select().maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (payload.ownerId) {
      await notify(payload.ownerId, "New rental application", "A tenant applied for your property.", "info", "owner-dashboard.html");
    }
    return { ok: true, data: data };
  }

  async function listMyApplications(role) {
    if (!hasSb()) return { ok: false, offline: true, data: [] };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in", data: [] };
    const col = role === "owner" ? "owner_id" : "tenant_id";
    const { data, error } = await sb().from("applications").select("*").eq(col, userId).order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message, data: [] };
    return { ok: true, data: data || [] };
  }

  // ---- Notifications ----
  async function listNotifications() {
    if (!hasSb()) return { ok: false, offline: true, data: [] };
    const userId = await uid();
    if (!userId) return { ok: false, data: [] };
    const { data, error } = await sb()
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { ok: false, error: error.message, data: [] };
    return { ok: true, data: data || [] };
  }

  async function markNotificationRead(id) {
    if (!hasSb()) return { ok: false };
    const { error } = await sb().from("notifications").update({ read: true }).eq("id", id);
    return { ok: !error };
  }

  // ---- Saved ----
  async function toggleSaved(propertyId) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in" };
    const { data: existing } = await sb()
      .from("saved_properties")
      .select("property_id")
      .eq("user_id", userId)
      .eq("property_id", String(propertyId))
      .maybeSingle();
    if (existing) {
      await sb().from("saved_properties").delete().eq("user_id", userId).eq("property_id", String(propertyId));
      return { ok: true, saved: false };
    }
    const { error } = await sb().from("saved_properties").insert({ user_id: userId, property_id: String(propertyId) });
    if (error) return { ok: false, error: error.message };
    return { ok: true, saved: true };
  }

  async function listSaved() {
    if (!hasSb()) return { ok: false, offline: true, data: [] };
    const userId = await uid();
    if (!userId) return { ok: false, data: [] };
    const { data, error } = await sb().from("saved_properties").select("property_id, created_at").eq("user_id", userId);
    if (error) return { ok: false, error: error.message, data: [] };
    return { ok: true, data: data || [] };
  }

  // ---- Owner verification ----
  async function submitOwnerVerification(payload) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in" };
    const row = Object.assign({}, payload, { user_id: userId, status: "pending" });
    const { data, error } = await sb().from("owner_verifications").insert(row).select().maybeSingle();
    if (error) return { ok: false, error: error.message };
    await sb().from("profiles").update({ verification_status: "pending" }).eq("id", userId);
    return { ok: true, data: data };
  }

  // ---- Views ----
  async function recordView(propertyId) {
    if (!hasSb() || !propertyId) return { ok: false };
    try {
      await sb().rpc("record_property_view", { p_id: String(propertyId) });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  // ---- Messages ----
  async function getOrCreateConversation(propertyId, ownerId, tenantId) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    const tId = tenantId || userId;
    const { data: existing } = await sb()
      .from("conversations")
      .select("*")
      .eq("property_id", String(propertyId))
      .eq("tenant_id", tId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (existing) return { ok: true, data: existing };
    const { data, error } = await sb()
      .from("conversations")
      .insert({ property_id: String(propertyId), tenant_id: tId, owner_id: ownerId })
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data };
  }

  async function sendMessage(conversationId, body) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in" };
    const { data, error } = await sb()
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: userId, body: body })
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    await sb().from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
    return { ok: true, data: data };
  }

  async function listMessages(conversationId) {
    if (!hasSb()) return { ok: false, data: [] };
    const { data, error } = await sb()
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message, data: [] };
    return { ok: true, data: data || [] };
  }

  global.LeaseAccomCloud = {
    hasSb: hasSb,
    uid: uid,
    listLiveProperties: listLiveProperties,
    listOwnerProperties: listOwnerProperties,
    createProperty: createProperty,
    uploadMedia: uploadMedia,
    uploadListingMedia: uploadListingMedia,
    createViewing: createViewing,
    listMyViewings: listMyViewings,
    updateViewingStatus: updateViewingStatus,
    createApplication: createApplication,
    listMyApplications: listMyApplications,
    listNotifications: listNotifications,
    markNotificationRead: markNotificationRead,
    toggleSaved: toggleSaved,
    listSaved: listSaved,
    submitOwnerVerification: submitOwnerVerification,
    recordView: recordView,
    getOrCreateConversation: getOrCreateConversation,
    sendMessage: sendMessage,
    listMessages: listMessages,
    notify: notify
  };
})(window);
