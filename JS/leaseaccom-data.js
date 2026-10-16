/**
 * LeaseAccom hybrid data layer — Supabase first, local fallback.
 */
(function (global) {
  function hasSb() {
    return !!(global.leaseaccomSupabase && global.leaseaccomSupabase.from);
  }

  async function getSessionUser() {
    if (!hasSb()) return null;
    try {
      const { data, error } = await global.leaseaccomSupabase.auth.getUser();
      if (error || !data?.user) return null;
      return data.user;
    } catch (e) {
      return null;
    }
  }

  async function getProfile(userId) {
    if (!hasSb() || !userId) return null;
    try {
      const { data, error } = await global.leaseaccomSupabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function toLegacyUser(authUser, profile) {
    if (!authUser) return null;
    const p = profile || {};
    return {
      id: authUser.id,
      email: authUser.email,
      name: p.full_name || p.name || authUser.user_metadata?.full_name || "",
      phone: p.phone || authUser.user_metadata?.phone || "",
      accountType: p.account_type || authUser.user_metadata?.account_type || "tenant",
      verificationStatus: p.verification_status || "unverified",
      ownerVerificationStatus: p.verification_status || "unverified",
      avatar: p.avatar_url || "",
      properties: []
    };
  }

  async function syncLegacySession() {
    const authUser = await getSessionUser();
    if (!authUser) return null;
    const profile = await getProfile(authUser.id);
    const legacy = toLegacyUser(authUser, profile);
    try {
      localStorage.setItem("leaseaccomCurrentUser", JSON.stringify(legacy));
      localStorage.setItem("leaseaccomCurrentUser", JSON.stringify(legacy));
    } catch (e) {}
    return legacy;
  }

  function mapPropertyRow(row) {
    const images = Array.isArray(row.images) ? row.images : [];
    const v =
      String(row.listing_status || row.verification_status || "pending").toLowerCase();
    const live = v === "live" || v === "approved";
    return {
      id: row.id,
      title: row.title,
      type: row.type,
      location: row.location,
      city: row.city,
      state: row.state || "",
      price: Number(row.price) || 0,
      period: row.period || "year",
      serviceCharge: row.service_charge,
      cautionFee: row.caution_fee,
      agencyFee: row.agency_fee,
      description: row.description || "",
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      listingStatus: live ? "live" : v,
      verificationStatus: live ? "approved" : v,
      verified: live,
      ownerVerified: true,
      image: row.cover_image || row.image || images[0] || "",
      images: images.length ? images : [row.cover_image || row.image].filter(Boolean),
      ownerId: row.owner_id,
      ownerName: row.owner_name || "LeaseAccom Owner",
      amenities: row.amenities || []
    };
  }

  async function fetchLiveProperties() {
    if (!hasSb()) return null;
    try {
      // Prefer listing_status=live; also accept verification_status=approved
      let { data, error } = await global.leaseaccomSupabase
        .from("properties")
        .select("*")
        .or("listing_status.eq.live,verification_status.eq.approved")
        .order("updated_at", { ascending: false });

      if (error) {
        // Fallback older schema
        const res2 = await global.leaseaccomSupabase
          .from("properties")
          .select("*")
          .eq("verification_status", "approved")
          .order("created_at", { ascending: false });
        if (res2.error) {
          console.warn("LeaseAccom properties:", error.message || res2.error.message);
          return null;
        }
        data = res2.data;
      }
      return (data || []).map(mapPropertyRow);
    } catch (e) {
      return null;
    }
  }

  async function fetchOwnerProperties(ownerId) {
    if (!hasSb() || !ownerId) return null;
    try {
      const { data, error } = await global.leaseaccomSupabase
        .from("properties")
        .select("*")
        .eq("owner_id", ownerId)
        .order("updated_at", { ascending: false });
      if (error) {
        console.warn("Owner properties:", error.message);
        return null;
      }
      return (data || []).map(mapPropertyRow);
    } catch (e) {
      return null;
    }
  }

  /**
   * Insert listing into Supabase. Images as data URLs may be large —
   * we Property Page  cover + up to 12 images; Storage can replace this later.
   */
  async function createProperty(payload) {
    if (!hasSb()) return { ok: false, offline: true };

    const user = await getSessionUser();
    if (!user) return { ok: false, error: "Not signed in to Supabase" };

    const images = Array.isArray(payload.images) ? payload.images.slice(0, 12) : [];
    const cover = payload.image || images[0] || "";

    // Align with both column naming styles used in the project
    const row = {
      id: String(payload.id || Date.now()),
      owner_id: user.id,
      owner_name: payload.ownerName || "",
      title: payload.title,
      type: payload.type,
      purpose: payload.purpose || null,
      state: payload.state || null,
      city: payload.city || null,
      location: payload.location || "",
      price: Number(payload.price) || 0,
      period: payload.period || "year",
      bedrooms: payload.bedrooms != null ? Number(payload.bedrooms) : null,
      bathrooms: payload.bathrooms != null ? Number(payload.bathrooms) : null,
      description: payload.description || "",
      amenities: payload.amenities || [],
      images: images,
      cover_image: cover,
      image: cover,
      service_charge: payload.serviceCharge != null ? Number(payload.serviceCharge) : null,
      caution_fee: payload.cautionFee != null ? Number(payload.cautionFee) : null,
      listing_status: "pending",
      verification_status: "pending",
      updated_at: new Date().toISOString()
    };

    const { data, error } = await global.leaseaccomSupabase
      .from("properties")
      .insert(row)
      .select()
      .maybeSingle();

    if (error) {
      // Retry minimal columns if schema is stricter
      const minimal = {
        id: row.id,
        owner_id: row.owner_id,
        title: row.title,
        type: row.type,
        location: row.location,
        city: row.city,
        price: row.price,
        description: row.description,
        images: row.images,
        verification_status: "pending"
      };
      const res2 = await global.leaseaccomSupabase.from("properties").insert(minimal).select().maybeSingle();
      if (res2.error) return { ok: false, error: error.message || res2.error.message };
      return { ok: true, data: res2.data, mapped: mapPropertyRow(res2.data || minimal) };
    }

    return { ok: true, data, mapped: data ? mapPropertyRow(data) : mapPropertyRow(row) };
  }

  async function createViewing(payload) {
    const user = await getSessionUser();
    if (!hasSb() || !user) return { ok: false, offline: true };
    const { data, error } = await global.leaseaccomSupabase
      .from("viewings")
      .insert({
        property_id: String(payload.propertyId),
        tenant_id: user.id,
        owner_id: payload.ownerId,
        status: "requested",
        viewing_date: payload.viewingDate || null,
        message: payload.message || null
      })
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  }

  global.LeaseAccomData = {
    getSessionUser,
    getProfile,
    syncLegacySession,
    fetchLiveProperties,
    fetchOwnerProperties,
    createProperty,
    createViewing,
    toLegacyUser,
    mapPropertyRow,
    hasSupabase: hasSb
  };
})(window);
