/**
 * LeaseAccom cloud API — single place for Supabase reads/writes.
 * Use this as features go fully cloud. Falls back gracefully if offline.
 */
(function (global) {
  "use strict";

  function sb() {
    return global.leaseaccomSupabase || global.leaseaccomSupabase || null;
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
    if (!hasSb() || !userId) return { ok: false, offline: !hasSb() };
    try {
      const { error } = await sb().from("notifications").insert({
        user_id: userId,
        title: title || "LeaseAccom",
        message: message || "",
        type: type || "info",
        link: link || null
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
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

  async function updateApplicationStatus(id, status) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in" };
    const { data, error } = await sb()
      .from("applications")
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", userId)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Application was not found or cannot be changed." };
    return { ok: true, data: data };
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

  async function listSavedSearches() {
    if (!hasSb()) return { ok: false, offline: true, data: [] };
    const userId = await uid();
    if (!userId) return { ok: false, data: [] };
    const { data, error } = await sb().from("saved_searches").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
    return error ? { ok: false, error: error.message, data: [] } : { ok: true, data: data || [] };
  }

  async function saveSearch(search) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in" };
    const row = { user_id: userId, label: search.label || "Saved search", criteria: search.criteria || search, updated_at: new Date().toISOString() };
    const query = search.id
      ? sb().from("saved_searches").update(row).eq("id", search.id).eq("user_id", userId).select().single()
      : sb().from("saved_searches").insert(row).select().single();
    const { data, error } = await query;
    return error ? { ok: false, error: error.message } : { ok: true, data };
  }

  async function deleteSearch(id) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in" };
    const { error } = await sb().from("saved_searches").delete().eq("id", id).eq("user_id", userId);
    return { ok: !error, error: error?.message };
  }

  async function recordRecentlyViewed(propertyId) {
    if (!hasSb() || !propertyId) return { ok: false };
    const userId = await uid();
    if (!userId) return { ok: false };
    const { error } = await sb().from("recently_viewed_properties").upsert({ user_id: userId, property_id: String(propertyId), viewed_at: new Date().toISOString() }, { onConflict: "user_id,property_id" });
    return { ok: !error, error: error?.message };
  }

  async function listRecentlyViewed(limit) {
    if (!hasSb()) return { ok: false, offline: true, data: [] };
    const userId = await uid();
    if (!userId) return { ok: false, data: [] };
    const { data, error } = await sb().from("recently_viewed_properties").select("property_id, viewed_at").eq("user_id", userId).order("viewed_at", { ascending: false }).limit(limit || 20);
    return error ? { ok: false, error: error.message, data: [] } : { ok: true, data: data || [] };
  }

  async function getOwnerStorefront() {
    if (!hasSb()) return { ok: false, offline: true, data: null };
    const userId = await uid();
    if (!userId) return { ok: false, data: null };
    const { data, error } = await sb().from("owner_storefronts").select("*").eq("owner_id", userId).maybeSingle();
    return error ? { ok: false, error: error.message } : { ok: true, data };
  }

  async function saveOwnerStorefront(store) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in" };
    const row = { owner_id: userId, name: store.name || "", tagline: store.tagline || "", goal: store.goal || "", banner_url: store.banner || store.banner_url || "", logo_url: store.logo || store.logo_url || "", published: !!store.published, updated_at: new Date().toISOString() };
    const { data, error } = await sb().from("owner_storefronts").upsert(row, { onConflict: "owner_id" }).select().single();
    return error ? { ok: false, error: error.message } : { ok: true, data };
  }

  async function getPayoutAccount() {
    if (!hasSb()) return { ok: false, offline: true, data: null };
    const userId = await uid();
    if (!userId) return { ok: false, data: null };
    const { data, error } = await sb().from("owner_payout_accounts").select("bank_name, account_name, account_number").eq("owner_id", userId).maybeSingle();
    return error ? { ok: false, error: error.message } : { ok: true, data };
  }

  async function savePayoutAccount(account) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in" };
    const row = { owner_id: userId, bank_name: account.bank || "", account_name: account.name || "", account_number: account.number || "", updated_at: new Date().toISOString() };
    const { error } = await sb().from("owner_payout_accounts").upsert(row, { onConflict: "owner_id" });
    return { ok: !error, error: error?.message };
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


  // ---- Owner verification (NIN + docs to Storage) ----
  async function uploadVerificationFile(fileOrBlob, kind, fileName) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in" };
    var blob = fileOrBlob;
    if (typeof fileOrBlob === "string" && fileOrBlob.indexOf("data:") === 0) {
      blob = dataUrlToBlob(fileOrBlob);
    }
    if (!blob) return { ok: false, error: "Invalid file" };
    var ext = "bin";
    var name = fileName || (kind + ".bin");
    if (/\.([a-zA-Z0-9]+)$/.test(name)) ext = name.match(/\.([a-zA-Z0-9]+)$/)[1].toLowerCase();
    else if (blob.type && blob.type.indexOf("jpeg") >= 0) ext = "jpg";
    else if (blob.type && blob.type.indexOf("png") >= 0) ext = "png";
    else if (blob.type && blob.type.indexOf("pdf") >= 0) ext = "pdf";
    var path = userId + "/" + kind + "-" + Date.now() + "." + ext;
    var up = await uploadMedia("verification-docs", path, blob, blob.type || "application/octet-stream");
    if (!up.ok) return up;
    return { ok: true, path: up.path, publicUrl: up.publicUrl };
  }

  async function submitOwnerVerificationFull(payload) {
    if (!hasSb()) return { ok: false, offline: true };
    const userId = await uid();
    if (!userId) return { ok: false, error: "Not signed in" };

    var idPath = payload.idFilePath || null;
    var idUrl = payload.idFileUrl || null;
    var proofPath = payload.proofFilePath || null;
    var proofUrl = payload.proofFileUrl || null;

    if (payload.idFileBlob || payload.idDataUrl) {
      var idUp = await uploadVerificationFile(payload.idFileBlob || payload.idDataUrl, "id", payload.idFileName);
      if (!idUp.ok && !idUp.offline) return { ok: false, error: "ID upload failed: " + (idUp.error || "") };
      if (idUp.ok) { idPath = idUp.path; idUrl = idUp.publicUrl; }
    }
    if (payload.proofFileBlob || payload.proofDataUrl) {
      var pUp = await uploadVerificationFile(payload.proofFileBlob || payload.proofDataUrl, "proof", payload.proofFileName);
      if (!pUp.ok && !pUp.offline) return { ok: false, error: "Proof upload failed: " + (pUp.error || "") };
      if (pUp.ok) { proofPath = pUp.path; proofUrl = pUp.publicUrl; }
    }

    var row = {
      owner_id: userId,
      status: "pending",
      full_name: payload.fullName || payload.full_name || "",
      phone: payload.phone || "",
      email: payload.email || "",
      city: payload.city || "",
      state: payload.state || "",
      address: payload.address || "",
      listing_role: payload.listingRole || payload.listing_role || "",
      business_name: payload.businessName || payload.business_name || "",
      id_type: payload.idType || payload.id_type || "",
      id_number: payload.idNumber || payload.id_number || "",
      proof_type: payload.proofType || payload.proof_type || "",
      proof_note: payload.proofNote || payload.proof_note || "",
      id_file_path: idPath,
      proof_file_path: proofPath,
      id_file_url: idUrl,
      proof_file_url: proofUrl,
      notes: payload.notes || ("NIN/ID: " + (payload.idType || "") + " " + (payload.idNumber || "")),
      submitted_at: new Date().toISOString()
    };

    // Mark previous pending as superseded is optional; insert new
    var { data, error } = await sb().from("owner_verifications").insert(row).select().maybeSingle();
    if (error) {
      // minimal columns fallback
      var minimal = {
        owner_id: userId,
        status: "pending",
        full_name: row.full_name,
        phone: row.phone,
        id_type: row.id_type,
        id_number: row.id_number,
        notes: row.notes
      };
      var res2 = await sb().from("owner_verifications").insert(minimal).select().maybeSingle();
      if (res2.error) return { ok: false, error: error.message || res2.error.message };
      data = res2.data;
    }

    try {
      await sb().from("profiles").update({
        verification_status: "pending",
        full_name: row.full_name || undefined,
        phone: row.phone || undefined
      }).eq("id", userId);
    } catch (e) {}

    return { ok: true, data: data, idPath: idPath, proofPath: proofPath };
  }

  async function listOwnerVerifications(statusFilter) {
    if (!hasSb()) return { ok: false, offline: true, data: [] };
    var q = sb().from("owner_verifications").select("*").order("submitted_at", { ascending: false });
    if (statusFilter && statusFilter !== "all") q = q.eq("status", statusFilter);
    var { data, error } = await q.limit(100);
    if (error) return { ok: false, error: error.message, data: [] };
    return { ok: true, data: data || [] };
  }

  async function reviewOwnerVerification(id, status, reviewNote) {
    if (!hasSb()) return { ok: false, offline: true };
    var userId = await uid();
    var { data, error } = await sb().from("owner_verifications").update({
      status: status,
      review_note: reviewNote || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId
    }).eq("id", id).select().maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (data && data.owner_id) {
      var profileStatus = status === "verified" ? "verified" : status === "rejected" ? "rejected" : "pending";
      await sb().from("profiles").update({ verification_status: profileStatus }).eq("id", data.owner_id);
    }
    return { ok: true, data: data };
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
    updateApplicationStatus: updateApplicationStatus,
    listNotifications: listNotifications,
    markNotificationRead: markNotificationRead,
    toggleSaved: toggleSaved,
    listSaved: listSaved,
    listSavedSearches: listSavedSearches,
    saveSearch: saveSearch,
    deleteSearch: deleteSearch,
    recordRecentlyViewed: recordRecentlyViewed,
    listRecentlyViewed: listRecentlyViewed,
    getOwnerStorefront: getOwnerStorefront,
    saveOwnerStorefront: saveOwnerStorefront,
    getPayoutAccount: getPayoutAccount,
    savePayoutAccount: savePayoutAccount,
    submitOwnerVerification: submitOwnerVerification,
    submitOwnerVerificationFull: submitOwnerVerificationFull,
    uploadVerificationFile: uploadVerificationFile,
    listOwnerVerifications: listOwnerVerifications,
    reviewOwnerVerification: reviewOwnerVerification,
    recordView: recordView,
    getOrCreateConversation: getOrCreateConversation,
    sendMessage: sendMessage,
    listMessages: listMessages,
    notify: notify
  };
})(window);
