/**
 * LeaseHub Phase 2 — hybrid data layer
 * Tries Supabase when session exists; falls back to localStorage / data.js
 */
(function (global) {
  const hasSb = () => typeof global.leasehubSupabase !== "undefined" && global.leasehubSupabase;

  async function getSessionUser() {
    if (!hasSb()) return null;
    try {
      const { data, error } = await global.leasehubSupabase.auth.getUser();
      if (error || !data.user) return null;
      return data.user;
    } catch (e) {
      return null;
    }
  }

  async function getProfile(userId) {
    if (!hasSb() || !userId) return null;
    const { data, error } = await global.leasehubSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.warn("LeaseHub profile:", error.message);
      return null;
    }
    return data;
  }

  /** Map profile + auth user → shape old pages expect */
  function toLegacyUser(authUser, profile) {
    if (!authUser) return null;
    const accountType = (profile && profile.account_type) || authUser.user_metadata?.account_type || "tenant";
    return {
      id: authUser.id,
      email: authUser.email,
      name: (profile && profile.full_name) || authUser.user_metadata?.full_name || authUser.email,
      phone: (profile && profile.phone) || authUser.user_metadata?.phone || "",
      accountType: accountType,
      verificationStatus: (profile && profile.verification_status) || "unverified",
      ownerVerificationStatus: (profile && profile.verification_status) || "unverified",
      properties: [],
      _source: "supabase"
    };
  }

  async function syncLegacySession() {
    const authUser = await getSessionUser();
    if (!authUser) return null;
    const profile = await getProfile(authUser.id);
    const legacy = toLegacyUser(authUser, profile);
    try {
      localStorage.setItem("leasehubCurrentUser", JSON.stringify(legacy));
      localStorage.setItem("leaseHubCurrentUser", JSON.stringify(legacy));
    } catch (e) {}
    return legacy;
  }

  async function fetchLiveProperties() {
    if (!hasSb()) return null;
    try {
      const { data, error } = await global.leasehubSupabase
        .from("properties")
        .select("*")
        .eq("verification_status", "approved")
        .order("updated_at", { ascending: false });
      if (error) {
        console.warn("LeaseHub properties:", error.message);
        return null;
      }
      return (data || []).map(mapPropertyRow);
    } catch (e) {
      return null;
    }
  }

  function mapPropertyRow(row) {
    const images = Array.isArray(row.images) ? row.images : [];
    return {
      id: row.id,
      title: row.title,
      type: row.type,
      location: row.location,
      city: row.city,
      price: Number(row.price) || 0,
      period: row.period || "year",
      serviceCharge: row.service_charge,
      cautionFee: row.caution_fee,
      agencyFee: row.agency_fee,
      description: row.description || "",
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      listingStatus: row.verification_status === "approved" ? "live" : row.verification_status,
      verificationStatus: row.verification_status,
      verified: row.verification_status === "approved",
      ownerVerified: true,
      image: row.cover_image || images[0] || "",
      images: images,
      ownerId: row.owner_id,
      ownerName: row.owner_name || "LeaseHub Owner"
    };
  }

  async function createViewing(payload) {
    const user = await getSessionUser();
    if (!hasSb() || !user) return { ok: false, offline: true };
    const { data, error } = await global.leasehubSupabase.from("viewings").insert({
      property_id: payload.propertyId,
      tenant_id: user.id,
      owner_id: payload.ownerId,
      status: "requested",
      viewing_date: payload.viewingDate || null,
      message: payload.message || null
    }).select().single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  }

  global.LeaseHubData = {
    getSessionUser,
    getProfile,
    syncLegacySession,
    fetchLiveProperties,
    createViewing,
    toLegacyUser,
    hasSupabase: hasSb
  };
})(window);
