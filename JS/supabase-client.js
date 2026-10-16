/**
 * LeaseAccom Supabase client — safe init
 * Never crashes the page if the CDN fails or the key is invalid.
 * Exposes both client names used by the frontend data layers.
 */
(function () {
  "use strict";

  var SUPABASE_URL = "https://jxbraodoqfwagefsynlc.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_Nm3qt7mlkERuA3F-sss9iw_CXTjKBCc";

  var leasehubSupabase = null;

  try {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      leasehubSupabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
      );
    } else {
      console.warn(
        "LeaseAccom: Supabase library not loaded. Demo data will be used."
      );
    }
  } catch (err) {
    console.warn("LeaseAccom: Supabase client could not be created.", err);
    leasehubSupabase = null;
  }

  // Always expose so LeaseAccomData.hasSb() and other code can check safely
  window.leasehubSupabase = leasehubSupabase;
  window.leaseaccomSupabase = leasehubSupabase;

  function rememberSessionToken(token) {
    if (token) {
      localStorage.setItem("leasehub_session_token", String(token));
      return token;
    }
    localStorage.removeItem("leasehub_session_token");
    return null;
  }

  window.LeaseAccomAuth = {
    async signIn(email, password) {
      if (!leasehubSupabase) {
        return { data: null, error: { message: "Supabase offline — use demo login" } };
      }
      var result = await leasehubSupabase.auth.signInWithPassword({ email: email, password: password });
      if (!result.error && result.data && result.data.session && result.data.session.access_token) {
        rememberSessionToken(result.data.session.access_token);
      }
      return result;
    },

    async signUp(opts) {
      if (!leasehubSupabase) {
        return { data: null, error: { message: "Supabase offline — use demo register" } };
      }
      var result = await leasehubSupabase.auth.signUp({
        email: opts.email,
        password: opts.password,
        options: {
          data: {
            full_name: opts.name,
            phone: opts.phone,
            account_type: opts.accountType
          }
        }
      });
      if (!result.error && result.data && result.data.session && result.data.session.access_token) {
        rememberSessionToken(result.data.session.access_token);
      }
      return result;
    },

    async getAccessToken() {
      var storedToken = localStorage.getItem("leasehub_session_token");
      if (storedToken) return storedToken;
      if (!leasehubSupabase) return null;
      try {
        var result = await leasehubSupabase.auth.getSession();
        if (result && result.error) throw result.error;
        var token = result && result.data && result.data.session && result.data.session.access_token;
        if (token) rememberSessionToken(token);
        return token || null;
      } catch (e) {
        return null;
      }
    },

    async signOut() {
      if (leasehubSupabase) {
        var result = await leasehubSupabase.auth.signOut();
        if (result.error) throw result.error;
      }
      try {
        localStorage.removeItem("leasehub_session_token");
        localStorage.removeItem("leasehubCurrentUser");
        localStorage.removeItem("leaseHubCurrentUser");
        localStorage.removeItem("leaseaccomCurrentUser");
        localStorage.removeItem("currentUser");
      } catch (e) {}
    },

    /** Send password recovery email */
    async resetPasswordForEmail(email) {
      if (!leasehubSupabase) {
        return { data: null, error: { message: "Supabase offline" } };
      }
      var redirectTo = window.location.origin + window.location.pathname.replace(/[^/]*$/, "") + "reset-password.html";
      // Prefer absolute site root if served from root
      try {
        redirectTo = new URL("reset-password.html", window.location.href).href;
      } catch (e) {}
      return leasehubSupabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
    },

    /** Set new password after recovery link (user must have recovery session) */
    async updatePassword(newPassword) {
      if (!leasehubSupabase) {
        return { data: null, error: { message: "Supabase offline" } };
      }
      return leasehubSupabase.auth.updateUser({ password: newPassword });
    },

    /** Google OAuth — redirects away from the page */
    async signInWithGoogle(accountType) {
      if (!leasehubSupabase) {
        return { data: null, error: { message: "Supabase offline" } };
      }
      try {
        if (accountType) {
          sessionStorage.setItem("leaseaccom_pending_account_type", accountType);
        }
      } catch (e) {}
      var redirectTo = new URL("auth-callback.html", window.location.href).href;
      return leasehubSupabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo,
          queryParams: { access_type: "offline", prompt: "select_account" }
        }
      });
    },

    async getSession() {
      if (!leasehubSupabase) return null;
      try {
        var result = await leasehubSupabase.auth.getSession();
        return result && result.data ? result.data.session : null;
      } catch (e) {
        return null;
      }
    }
  };

  /* ================= CURRENT USER ================= */

  async function getCurrentUser() {
    if (!leasehubSupabase) return null;

    try {
      var authResult = await leasehubSupabase.auth.getUser();
      if (authResult.error) {
        console.error("getCurrentUser error:", authResult.error);
        return null;
      }
      var user = authResult.data && authResult.data.user;
      if (!user) return null;

      var profileResult = await leasehubSupabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileResult.error) {
        console.error("getCurrentUser profile error:", profileResult.error);
        return Object.assign({}, user, { profile: null });
      }

      return Object.assign({}, user, { profile: profileResult.data });
    } catch (e) {
      console.error("getCurrentUser failed:", e);
      return null;
    }
  }

  /* ================= REQUIRE AUTH ================= */

  async function requireAuth() {
    var user = await getCurrentUser();
    if (!user) {
      window.location.href = "login.html";
      return null;
    }
    return user;
  }

  /* ================= FETCH PROPERTIES ================= */

  async function fetchProperties(filters) {
    filters = filters || {};
    if (!leasehubSupabase) return [];

    try {
      var query = leasehubSupabase
        .from("properties")
        .select("*")
        .or("listing_status.eq.live,verification_status.eq.approved")
        .order("created_at", { ascending: false });

      if (filters.city) {
        query = query.ilike("city", "%" + filters.city + "%");
      }
      if (filters.type && filters.type !== "all") {
        query = query.eq("type", filters.type);
      }
      if (filters.maxPrice) {
        query = query.lte("price", filters.maxPrice);
      }

      var result = await query;
      if (result.error) {
        console.warn("fetchProperties:", result.error.message);
        return [];
      }

      return (result.data || []).map(function (property) {
        var verificationStatus = String(
          property.verification_status || "pending"
        ).toLowerCase();
        var image = property.image || property.cover_image || "";
        return Object.assign({}, property, {
          id: String(property.id),
          ownerId: property.owner_id,
          ownerName: property.owner_name || "Property Owner",
          verificationStatus: verificationStatus,
          listingStatus:
            verificationStatus === "approved" ? "live" : verificationStatus,
          verified: verificationStatus === "approved",
          image: image,
          images:
            Array.isArray(property.images) && property.images.length
              ? property.images
              : [image].filter(Boolean)
        });
      });
    } catch (e) {
      console.warn("fetchProperties failed:", e);
      return [];
    }
  }

  var propertyCatalogRequest = null;

  /**
   * Load live listings from Supabase when available.
   * NEVER wipes demo data if Supabase returns empty or fails.
   */
  window.loadLeaseAccomPropertyCatalog = function () {
    if (propertyCatalogRequest) return propertyCatalogRequest;

    propertyCatalogRequest = (async function () {
      try {
        var listings =
          window.LeaseAccomData &&
          typeof window.LeaseAccomData.fetchLiveProperties === "function"
            ? await window.LeaseAccomData.fetchLiveProperties()
            : await fetchProperties();
        var target =
          typeof properties !== "undefined" && Array.isArray(properties)
            ? properties
            : Array.isArray(window.properties)
              ? window.properties
              : null;

        // A successful empty result must not leave demo listings visible.
        if (Array.isArray(listings) && target) {
          target.splice(0, target.length);
          for (var i = 0; i < listings.length; i++) {
            target.push(listings[i]);
          }
        }
        return target || [];
      } catch (e) {
        console.warn("Catalog load failed, keeping demo data.", e);
        return typeof properties !== "undefined" ? properties : [];
      } finally {
        propertyCatalogRequest = null;
      }
    })();

    return propertyCatalogRequest;
  };

  /* ================= SAVED PROPERTIES ================= */

  async function getSavedPropertyIds() {
    var user = await getCurrentUser();
    if (!user || !leasehubSupabase) return null;

    try {
      var result = await leasehubSupabase
        .from("saved_properties")
        .select("property_id")
        .eq("user_id", user.id);

      if (result.error) {
        console.error("getSavedPropertyIds error:", result.error);
        return null;
      }
      return (result.data || []).map(function (row) {
        return row.property_id;
      });
    } catch (e) {
      return null;
    }
  }

  /* ================= TOGGLE SAVE ================= */

  async function toggleSave(propertyId) {
    var user = await getCurrentUser();
    if (!user || !leasehubSupabase) {
      alert("Please log in to save properties");
      window.location.href = "login.html";
      return false;
    }

    var id = String(propertyId);

    try {
      var existingResult = await leasehubSupabase
        .from("saved_properties")
        .select("*")
        .eq("user_id", user.id)
        .eq("property_id", id)
        .maybeSingle();

      if (existingResult.error) {
        console.error("toggleSave lookup error:", existingResult.error);
        return false;
      }

      if (existingResult.data) {
        var delResult = await leasehubSupabase
          .from("saved_properties")
          .delete()
          .eq("user_id", user.id)
          .eq("property_id", id);
        if (delResult.error) {
          console.error("toggleSave delete error:", delResult.error);
          return false;
        }
        return false;
      }

      var insResult = await leasehubSupabase.from("saved_properties").upsert({
        user_id: user.id,
        property_id: id
      }, { onConflict: "user_id,property_id" });
      if (insResult.error) {
        console.error("toggleSave insert error:", insResult.error);
        return false;
      }
      return true;
    } catch (e) {
      console.error("toggleSave failed:", e);
      return false;
    }
  }

  async function persistSavedProperty(propertyId, shouldSave) {
    var user = await getCurrentUser();
    if (!user || !leasehubSupabase) return false;
    var id = String(propertyId);

    try {
      if (shouldSave) {
        var upsertResult = await leasehubSupabase
          .from("saved_properties")
          .upsert({ user_id: user.id, property_id: id }, { onConflict: "user_id,property_id" });
        if (upsertResult.error) {
          console.error("persistSavedProperty upsert error:", upsertResult.error);
          return false;
        }
        return true;
      }

      var deleteResult = await leasehubSupabase
        .from("saved_properties")
        .delete()
        .eq("user_id", user.id)
        .eq("property_id", id);
      if (deleteResult.error) {
        console.error("persistSavedProperty delete error:", deleteResult.error);
        return false;
      }
      return true;
    } catch (e) {
      console.error("persistSavedProperty failed:", e);
      return false;
    }
  }

  async function persistViewingRequest(viewingRequest) {
    if (!viewingRequest || !leasehubSupabase) return false;
    var user = await getCurrentUser();
    if (!user) return false;

    try {
      var payload = {
        property_id: String(viewingRequest.propertyId || viewingRequest.property_id || ""),
        tenant_id: user.id,
        owner_id: viewingRequest.ownerId || viewingRequest.owner_id || null,
        status: viewingRequest.status || "requested",
        preferred_date: viewingRequest.viewingDate || null,
        preferred_time: viewingRequest.viewingTime || null,
        notes: viewingRequest.message || null,
        status_history: Array.isArray(viewingRequest.statusHistory) ? viewingRequest.statusHistory : [{ status: viewingRequest.status || "requested", at: new Date().toISOString(), by: "tenant" }]
      };

      if (viewingRequest.id) {
        var updateResult = await leasehubSupabase
          .from("viewings")
          .update(payload)
          .eq("id", viewingRequest.id)
          .select()
          .maybeSingle();
        return !updateResult.error && !!updateResult.data;
      }

      var insertResult = await leasehubSupabase
        .from("viewings")
        .insert(payload)
        .select()
        .maybeSingle();

      if (insertResult.error) {
        console.error("persistViewingRequest insert error:", insertResult.error);
        return false;
      }

      if (insertResult.data) {
        viewingRequest.id = insertResult.data.id;
      }
      return true;
    } catch (e) {
      console.error("persistViewingRequest failed:", e);
      return false;
    }
  }

  async function persistApplication(application) {
    if (!application || !leasehubSupabase) return false;
    var user = await getCurrentUser();
    if (!user) return false;

    try {
      var payload = {
        property_id: String(application.propertyId || application.property_id || ""),
        tenant_id: user.id,
        owner_id: application.ownerId || application.owner_id || null,
        status: application.status || "submitted",
        applicant_name: application.applicantName || application.applicant_name || user.name || "Applicant",
        applicant_email: application.applicantEmail || application.applicant_email || user.email || null,
        applicant_phone: application.applicantPhone || application.applicant_phone || null,
        move_in_date: application.moveInDate || application.move_in_date || null,
        property_title: application.propertyTitle || application.property_title || "Property",
        property_image: application.propertyImage || application.property_image || "",
        property_location: application.propertyLocation || application.property_location || "Nigeria",
        property_price: application.propertyPrice || application.property_price || null,
        property_period: application.propertyPeriod || application.property_period || "year",
        owner_name: application.ownerName || application.owner_name || "Property Owner",
        occupants: Number(application.occupants || 1),
        stay_length: application.stayLength || application.stay_length || null,
        income_range: application.incomeRange || application.income_range || null,
        employment_status: application.employmentStatus || application.employment_status || null,
        message: application.message || null,
        status_history: Array.isArray(application.statusHistory) ? application.statusHistory : [{ status: application.status || "submitted", at: new Date().toISOString(), by: "tenant" }]
      };

      if (application.id) {
        var updateResult = await leasehubSupabase
          .from("applications")
          .update(payload)
          .eq("id", application.id)
          .select()
          .maybeSingle();
        return !updateResult.error && !!updateResult.data;
      }

      var insertResult = await leasehubSupabase
        .from("applications")
        .insert(payload)
        .select()
        .maybeSingle();

      if (insertResult.error) {
        console.error("persistApplication insert error:", insertResult.error);
        return false;
      }

      if (insertResult.data) {
        application.id = insertResult.data.id;
      }
      return true;
    } catch (e) {
      console.error("persistApplication failed:", e);
      return false;
    }
  }

  // Expose helpers globally (same as original)
  window.getCurrentUser = getCurrentUser;
  window.requireAuth = requireAuth;
  window.fetchProperties = fetchProperties;
  window.getSavedPropertyIds = getSavedPropertyIds;
  window.toggleSave = toggleSave;
  window.persistSavedProperty = persistSavedProperty;
  window.persistViewingRequest = persistViewingRequest;
  window.persistApplication = persistApplication;
})();
