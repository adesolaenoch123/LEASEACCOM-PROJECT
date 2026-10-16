/**
 * LeaseAccom — Supabase as primary store (localStorage fallback)
 * Include AFTER supabase-client.js on every page that needs data.
 *
 * window.LeaseAccomStore = {
 *   profiles, properties, viewings, applications,
 *   payments, subscriptions, plans, reports, settings, audit
 * }
 */
(function (global) {
  "use strict";

  function sb() {
    return global.leaseaccomSupabase || null;
  }
  function hasSb() {
    return !!sb();
  }

  async function uid() {
    if (!hasSb()) return null;
    try {
      var res = await sb().auth.getUser();
      return res.data && res.data.user ? res.data.user.id : null;
    } catch (e) {
      return null;
    }
  }

  /* ---------- PROFILES / USERS ---------- */
  async function listProfiles() {
    if (!hasSb()) {
      try {
        return JSON.parse(localStorage.getItem("leaseaccomUsers") || "[]");
      } catch (e) {
        return [];
      }
    }
    var { data, error } = await sb()
      .from("profiles")
      .select("id, full_name, phone, account_type, account_status, verification_status, plan, created_at, avatar_url")
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("profiles", error.message);
      return [];
    }
    return (data || []).map(function (p) {
      return {
        id: p.id,
        name: p.full_name || "",
        email: "", // email lives on auth.users — fill via admin edge later
        phone: p.phone || "",
        accountType: p.account_type || "tenant",
        accountStatus: p.account_status || "active",
        verificationStatus: p.verification_status || "unverified",
        plan: p.plan || "free",
        createdAt: p.created_at,
        avatar: p.avatar_url || ""
      };
    });
  }

  async function setProfileStatus(userId, status) {
    if (!hasSb()) return { error: "offline" };
    var { error } = await sb()
      .from("profiles")
      .update({ account_status: status, updated_at: new Date().toISOString() })
      .eq("id", userId);
    return { error: error };
  }

  /* ---------- PROPERTIES ---------- */
  async function listProperties(opts) {
    opts = opts || {};
    if (!hasSb()) {
      try {
        return JSON.parse(localStorage.getItem("leaseaccomProperties") || "[]");
      } catch (e) {
        return [];
      }
    }
    var q = sb().from("properties").select("*").order("created_at", { ascending: false });
    if (opts.status) q = q.eq("verification_status", opts.status);
    if (opts.ownerId) q = q.eq("owner_id", opts.ownerId);
    if (opts.liveOnly) q = q.eq("verification_status", "approved");
    var { data, error } = await q;
    if (error) {
      console.warn("properties", error.message);
      return [];
    }
    return (data || []).map(mapProperty);
  }

  function mapProperty(row) {
    var images = Array.isArray(row.images) ? row.images : [];
    var v = String(row.verification_status || "pending").toLowerCase();
    return {
      id: row.id,
      title: row.title,
      type: row.type,
      location: row.location,
      city: row.city,
      price: Number(row.price) || 0,
      period: row.period || "year",
      description: row.description || "",
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      verificationStatus: v,
      verified: v === "approved",
      image: row.image || row.cover_image || images[0] || "",
      images: images.length ? images : [row.image].filter(Boolean),
      ownerId: row.owner_id,
      ownerName: row.owner_name || "Owner",
      createdAt: row.created_at
    };
  }

  async function setPropertyStatus(propertyId, status, reason) {
    if (!hasSb()) return { error: "offline" };
    var patch = {
      verification_status: status,
      updated_at: new Date().toISOString()
    };
    if (reason) patch.rejection_reason = reason;
    var { error } = await sb().from("properties").update(patch).eq("id", propertyId);
    return { error: error };
  }

  async function createProperty(payload) {
    if (!hasSb()) return { data: null, error: { message: "offline" } };
    var owner = payload.ownerId || (await uid());
    var row = {
      owner_id: owner,
      title: payload.title,
      type: payload.type || "apartment",
      location: payload.location || payload.city || "",
      city: payload.city || "",
      price: Number(payload.price) || 0,
      period: payload.period || "year",
      description: payload.description || "",
      bedrooms: Number(payload.bedrooms) || 0,
      bathrooms: Number(payload.bathrooms) || 0,
      image: payload.image || (payload.images && payload.images[0]) || "",
      images: payload.images || [],
      owner_name: payload.ownerName || "Owner",
      verification_status: "pending"
    };
    return await sb().from("properties").insert(row).select().single();
  }

  /* ---------- VIEWINGS ---------- */
  async function listViewings(opts) {
    opts = opts || {};
    if (!hasSb()) {
      try {
        return JSON.parse(localStorage.getItem("viewingRequests") || "[]");
      } catch (e) {
        return [];
      }
    }
    var q = sb().from("viewings").select("*").order("created_at", { ascending: false });
    if (opts.ownerId) q = q.eq("owner_id", opts.ownerId);
    if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
    var { data, error } = await q;
    if (error) return [];
    return data || [];
  }

  async function createViewing(payload) {
    if (!hasSb()) return { data: null, error: { message: "offline" } };
    var tenant = payload.tenantId || (await uid());
    var row = {
      property_id: String(payload.propertyId),
      tenant_id: tenant,
      owner_id: payload.ownerId,
      status: "requested",
      preferred_date: payload.date || payload.preferredDate || null,
      preferred_time: payload.time || payload.preferredTime || null,
      message: payload.message || "",
      notes: payload.notes || ""
    };
    return await sb().from("viewings").insert(row).select().single();
  }

  /* ---------- APPLICATIONS ---------- */
  async function listApplications(opts) {
    opts = opts || {};
    if (!hasSb()) {
      try {
        return JSON.parse(localStorage.getItem("rentalApplications") || "[]");
      } catch (e) {
        return [];
      }
    }
    var q = sb().from("applications").select("*").order("created_at", { ascending: false });
    if (opts.ownerId) q = q.eq("owner_id", opts.ownerId);
    if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
    var { data, error } = await q;
    if (error) return [];
    return data || [];
  }

  async function createApplication(payload) {
    if (!hasSb()) return { data: null, error: { message: "offline" } };
    var tenant = payload.tenantId || (await uid());
    var row = {
      property_id: String(payload.propertyId),
      tenant_id: tenant,
      owner_id: payload.ownerId,
      status: "submitted",
      applicant_name: payload.name || payload.applicantName,
      applicant_email: payload.email || payload.applicantEmail,
      applicant_phone: payload.phone || payload.applicantPhone,
      property_title: payload.propertyTitle || "Property",
      message: payload.message || "",
      move_in_date: payload.moveInDate || null
    };
    return await sb().from("applications").insert(row).select().single();
  }

  /* ---------- PAYMENTS ---------- */
  async function listPayments() {
    if (!hasSb()) {
      try {
        return JSON.parse(localStorage.getItem("leaseaccomPayments") || "[]");
      } catch (e) {
        return [];
      }
    }
    var { data, error } = await sb()
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.warn("payments", error.message);
      return [];
    }
    return data || [];
  }

  async function updatePaymentStatus(id, status) {
    if (!hasSb()) return { error: "offline" };
    return await sb()
      .from("payments")
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  /* ---------- SUBSCRIPTIONS & PLANS ---------- */
  async function listPlans() {
    if (!hasSb()) {
      return [
        { id: "professional", name: "Professional", price_monthly: 5000 },
        { id: "business", name: "Business", price_monthly: 10000 },
        { id: "enterprise", name: "Enterprise", price_monthly: 20000 }
      ];
    }
    var { data } = await sb()
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    return data || [];
  }

  async function listSubscriptions() {
    if (!hasSb()) {
      try {
        return JSON.parse(localStorage.getItem("leaseaccomSubscriptions") || "[]");
      } catch (e) {
        return [];
      }
    }
    var { data, error } = await sb()
      .from("subscriptions")
      .select("*, subscription_plans(name)")
      .order("created_at", { ascending: false });
    if (error) return [];
    return data || [];
  }

  /* ---------- REPORTS ---------- */
  async function listReports() {
    if (!hasSb()) {
      try {
        return JSON.parse(localStorage.getItem("leaseaccomReports") || "[]");
      } catch (e) {
        return [];
      }
    }
    var { data } = await sb().from("reports").select("*").order("created_at", { ascending: false });
    return data || [];
  }

  async function updateReport(id, status) {
    if (!hasSb()) return { error: "offline" };
    return await sb()
      .from("reports")
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  /* ---------- SETTINGS / BRAND ---------- */
  async function getSetting(key) {
    if (!hasSb()) {
      if (key === "brand") {
        try {
          return JSON.parse(localStorage.getItem("leaseaccomBrandConfig") || "null");
        } catch (e) {
          return null;
        }
      }
      return null;
    }
    var { data } = await sb().from("platform_settings").select("value").eq("key", key).maybeSingle();
    return data ? data.value : null;
  }

  async function setSetting(key, value) {
    if (!hasSb()) {
      if (key === "brand") {
        localStorage.setItem("leaseaccomBrandConfig", JSON.stringify(value));
        localStorage.setItem("leaseaccomCmsPublished", JSON.stringify(value));
      }
      return { error: null };
    }
    var { error } = await sb()
      .from("platform_settings")
      .upsert({ key: key, value: value, updated_at: new Date().toISOString() });
    return { error: error };
  }

  /* ---------- AUDIT ---------- */
  async function writeAudit(action, detail, entity) {
    var entry = {
      action: action,
      detail: detail || "",
      entity_type: entity && entity.type,
      entity_id: entity && entity.id,
      created_at: new Date().toISOString()
    };
    try {
      var local = JSON.parse(localStorage.getItem("leaseaccomAdminAuditLog") || "[]");
      local.unshift(entry);
      localStorage.setItem("leaseaccomAdminAuditLog", JSON.stringify(local.slice(0, 200)));
    } catch (e) {}
    if (!hasSb()) return;
    try {
      var user = await sb().auth.getUser();
      entry.actor_id = user.data && user.data.user ? user.data.user.id : null;
      entry.actor_email = user.data && user.data.user ? user.data.user.email : null;
      await sb().from("audit_logs").insert(entry);
    } catch (e) {}
  }

  async function listAudit() {
    if (!hasSb()) {
      try {
        return JSON.parse(localStorage.getItem("leaseaccomAdminAuditLog") || "[]");
      } catch (e) {
        return [];
      }
    }
    var { data } = await sb().from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
    return data || [];
  }

  /* ---------- STATS (admin overview) ---------- */
  async function platformStats() {
    var [profiles, properties, payments, subs, reports] = await Promise.all([
      listProfiles(),
      listProperties(),
      listPayments(),
      listSubscriptions(),
      listReports()
    ]);
    var approved = properties.filter(function (p) {
      return p.verificationStatus === "approved";
    }).length;
    var pending = properties.filter(function (p) {
      return p.verificationStatus === "pending";
    }).length;
    var revenue = payments
      .filter(function (p) {
        return p.status === "paid";
      })
      .reduce(function (s, p) {
        return s + Math.max(0, Number(p.amount) || 0);
      }, 0);
    var activeSubs = subs.filter(function (s) {
      return s.status === "active";
    }).length;
    var openReports = reports.filter(function (r) {
      return /open|investigating/i.test(r.status);
    }).length;
    return {
      users: profiles.length,
      tenants: profiles.filter(function (u) {
        return u.accountType === "tenant";
      }).length,
      owners: profiles.filter(function (u) {
        return u.accountType === "owner";
      }).length,
      properties: properties.length,
      approved: approved,
      pending: pending,
      revenue: revenue,
      activeSubs: activeSubs,
      openReports: openReports
    };
  }

  global.LeaseAccomStore = {
    hasSb: hasSb,
    listProfiles: listProfiles,
    setProfileStatus: setProfileStatus,
    listProperties: listProperties,
    setPropertyStatus: setPropertyStatus,
    createProperty: createProperty,
    listViewings: listViewings,
    createViewing: createViewing,
    listApplications: listApplications,
    createApplication: createApplication,
    listPayments: listPayments,
    updatePaymentStatus: updatePaymentStatus,
    listPlans: listPlans,
    listSubscriptions: listSubscriptions,
    listReports: listReports,
    updateReport: updateReport,
    getSetting: getSetting,
    setSetting: setSetting,
    writeAudit: writeAudit,
    listAudit: listAudit,
    platformStats: platformStats,
    mapProperty: mapProperty
  };
})(typeof window !== "undefined" ? window : globalThis);
