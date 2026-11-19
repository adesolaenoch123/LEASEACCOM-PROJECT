/**
 * LeaseAccom — admin review of landlord verification documents
 */
(function () {
  "use strict";

  var QUEUE_KEY = "leaseaccomOwnerVerifications";
  var USERS_KEY = "leaseaccomUsers";
  var CURRENT_KEY = "leaseaccomCurrentUser";
  var filter = "pending";

  function readJSON(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function applyOwnerVerifiedAndPromo(userOrProfile) {
    var verifiedAt = (userOrProfile && (userOrProfile.verified_at || userOrProfile.verifiedAt)) || new Date().toISOString();
    var user = Object.assign({}, userOrProfile || {}, {
      verificationStatus: "verified",
      ownerVerificationStatus: "verified",
      verification_status: "verified",
      verified: true,
      verified_at: verifiedAt,
      verifiedAt: verifiedAt
    });
    if (window.LeaseAccomPlans && typeof window.LeaseAccomPlans.grantFoundingPromo === "function") {
      return window.LeaseAccomPlans.grantFoundingPromo(user) || user;
    }
    return user;
  }

  async function cloudReview(id, status, note) {
    if (window.LeaseAccomCloud && typeof window.LeaseAccomCloud.reviewOwnerVerification === "function" && id && String(id).indexOf("ov-") !== 0) {
      try {
        return await window.LeaseAccomCloud.reviewOwnerVerification(id, status, note);
      } catch (e) {
        console.warn(e);
        return { ok: false, error: e.message || "Could not save the verification decision" };
      }
    }
    return { ok: false, error: "Cloud owner verification review is unavailable" };
  }

  async function loadCloudOwnerProfile(userId) {
    var client = window.leaseaccomSupabase || window.leasehubSupabase;
    if (!client || !userId) return null;
    try {
      var result = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (result && result.error) {
        console.warn("Could not load the verified owner's profile:", result.error);
        return null;
      }
      return result && result.data || null;
    } catch (error) {
      console.warn("Could not load the verified owner's profile:", error);
      return null;
    }
  }

  function mergeOwnerProfile(profile, user) {
    var merged = Object.assign({}, user || {}, profile || {});
    if (profile) {
      merged.email = merged.email || profile.email;
      merged.promoType = profile.promo_type || profile.promoType || merged.promoType;
      merged.promoEndsAt = profile.promo_ends_at || profile.promoEndsAt || merged.promoEndsAt;
    }
    return merged;
  }

  function setUserStatus(email, userId, status, note, cloudProfile) {
    var matchesUser = function (user) {
      return (userId != null && user.id != null && String(user.id) === String(userId)) ||
        (!!email && String(user.email || "").toLowerCase() === String(email).toLowerCase());
    };
    var users = readJSON(USERS_KEY, []);
    var promoUser = cloudProfile ? mergeOwnerProfile(cloudProfile, { email: email }) : null;
    if (Array.isArray(users)) {
      users.forEach(function (u, i) {
        if (matchesUser(u)) {
          users[i] = Object.assign({}, u, {
            verificationStatus: status,
            ownerVerificationStatus: status,
            verificationNote: note || "",
            verification_status: status,
            verified: status === "verified",
            verified_at: status === "verified" ? (u.verified_at || u.verifiedAt || new Date().toISOString()) : null,
            verifiedAt: status === "verified" ? (u.verifiedAt || new Date().toISOString()) : null
          });
          if (!promoUser) promoUser = users[i];
        }
      });
      writeJSON(USERS_KEY, users);
    }
    try {
      var cur = readJSON(CURRENT_KEY, null);
      if (cur && matchesUser(cur)) {
        cur = Object.assign({}, cur, {
          verificationStatus: status,
          ownerVerificationStatus: status,
          verification_status: status,
          verificationNote: note || "",
          verified: status === "verified",
          verified_at: status === "verified" ? (cur.verified_at || cur.verifiedAt || new Date().toISOString()) : null,
          verifiedAt: status === "verified" ? (cur.verifiedAt || new Date().toISOString()) : null
        });
        if (status === "verified") promoUser = mergeOwnerProfile(cloudProfile, cur);
        writeJSON(CURRENT_KEY, cur);
        writeJSON("leasehubCurrentUser", cur);
        writeJSON("currentUser", cur);
      }
    } catch (e) {}

    if (status === "verified") {
      promoUser = applyOwnerVerifiedAndPromo(promoUser || { id: userId, email: email });
      users = readJSON(USERS_KEY, []);
      if (Array.isArray(users)) {
        users.forEach(function (u, i) {
          if (matchesUser(u)) users[i] = Object.assign({}, u, promoUser);
        });
        writeJSON(USERS_KEY, users);
      }
      try {
        var current = readJSON(CURRENT_KEY, null);
        if (current && matchesUser(current)) {
          current = Object.assign({}, current, promoUser);
          writeJSON(CURRENT_KEY, current);
          writeJSON("leasehubCurrentUser", current);
          writeJSON("currentUser", current);
        }
      } catch (e) {}
    }
    return promoUser;
  }

  async function loadCloudQueue() {
    if (!window.LeaseAccomCloud || typeof window.LeaseAccomCloud.listOwnerVerifications !== "function") {
      return null;
    }
    try {
      var res = await window.LeaseAccomCloud.listOwnerVerifications("all");
      if (!res || !res.ok || !Array.isArray(res.data)) return null;
      return res.data.map(function (row) {
        return {
          id: row.id,
          userId: row.owner_id,
          email: row.email || "",
          status: row.status || "pending",
          createdAt: row.submitted_at || row.created_at,
          cloud: true,
          application: {
            fullName: row.full_name,
            phone: row.phone,
            email: row.email,
            city: row.city,
            state: row.state,
            address: row.address,
            idType: row.id_type,
            idNumber: row.id_number,
            listingRole: row.listing_role,
            businessName: row.business_name,
            proofType: row.proof_type,
            proofNote: row.proof_note,
            idFileName: row.id_file_path || "",
            proofFileName: row.proof_file_path || "",
            idFileUrl: row.id_file_url,
            proofFileUrl: row.proof_file_url,
            submittedAt: row.submitted_at
          }
        };
      });
    } catch (e) {
      console.warn(e);
      return null;
    }
  }

  var cloudQueue = [];

  async function render() {
    var cloudList = await loadCloudQueue();
    if (cloudList === null) {
      cloudQueue = [];
      paintQueue([], "Could not load owner verifications from Supabase. Check the admin RLS policies and try again.");
      return;
    }
    cloudQueue = cloudList;
    writeJSON(QUEUE_KEY, cloudList.slice(0, 100));
    paintQueue(cloudList);
  }

  function paintQueue(queue, errorMessage) {
    if (!Array.isArray(queue)) queue = [];

    var box = document.getElementById("admOwnerQueue");
    if (errorMessage) {
      box.innerHTML = '<div class="ov-adm-empty">' + escapeHtml(errorMessage) + "</div>";
      return;
    }

    var pending = queue.filter(function (q) { return q.status === "pending"; }).length;
    var verified = queue.filter(function (q) { return q.status === "verified"; }).length;
    var rejected = queue.filter(function (q) { return q.status === "rejected"; }).length;
    var stats = document.getElementById("ovAdmStats");
    if (stats) {
      stats.innerHTML =
        '<span style="background:#fff8e8;padding:6px 12px;border-radius:999px">Pending ' + pending + "</span>" +
        '<span style="background:#e9f7ef;padding:6px 12px;border-radius:999px">Verified ' + verified + "</span>" +
        '<span style="background:#fff1f0;padding:6px 12px;border-radius:999px">Rejected ' + rejected + "</span>";
    }

    var list = queue.filter(function (q) {
      if (filter === "all") return true;
      return q.status === filter;
    });

    if (!list.length) {
      box.innerHTML = '<div class="ov-adm-empty">No applications in this filter.</div>';
      return;
    }

    box.innerHTML = list
      .map(function (item) {
        var a = item.application || {};
        var docs = [];
        if (a.idFileName) docs.push("ID: " + a.idFileName);
        if (a.proofFileName) docs.push("Proof: " + a.proofFileName);
        if (a.idType) docs.push(a.idType);
        if (a.proofType) docs.push(a.proofType);

        var previews = "";
        if (a.idPreview || a.idFileUrl) {
          previews +=
            '<div style="margin-top:10px"><div style="font-size:11px;font-weight:700;margin-bottom:4px">ID document</div><img src="' +
            (a.idPreview || a.idFileUrl) +
            '" alt="ID" style="max-width:180px;border-radius:8px;border:1px solid #e3e8e5" onerror="this.style.display=\'none\'"></div>';
        }
        if (a.proofPreview) {
          previews +=
            '<div style="margin-top:10px"><div style="font-size:11px;font-weight:700;margin-bottom:4px">Proof preview</div><img src="' +
            a.proofPreview +
            '" alt="Proof" style="max-width:180px;border-radius:8px;border:1px solid #e3e8e5"></div>';
        }

        return (
          '<article class="ov-adm-card">' +
          "<h3>" +
          escapeHtml(a.fullName || item.email) +
          ' <small style="color:#888;font-weight:600">(' +
          escapeHtml(item.status) +
          ")</small></h3>" +
          '<div class="ov-adm-meta">' +
          "<div><strong>Email:</strong> " + escapeHtml(item.email || a.email || "—") + "</div>" +
          "<div><strong>Phone:</strong> " + escapeHtml(a.phone || "—") + "</div>" +
          "<div><strong>Role:</strong> " + escapeHtml(a.listingRole || "—") +
          (a.businessName ? " · " + escapeHtml(a.businessName) : "") +
          "</div>" +
          "<div><strong>Location:</strong> " + escapeHtml(a.city || "—") + ", " + escapeHtml(a.state || "—") + "</div>" +
          "<div><strong>Address:</strong> " + escapeHtml(a.address || "—") + "</div>" +
          "<div><strong>ID:</strong> " + escapeHtml(a.idType || "—") + " · " + escapeHtml(a.idNumber || "—") + "</div>" +
          "<div><strong>Proof type:</strong> " + escapeHtml(a.proofType || "—") + "</div>" +
          (a.proofNote ? "<div><strong>Note:</strong> " + escapeHtml(a.proofNote) + "</div>" : "") +
          "<div><strong>Submitted:</strong> " + escapeHtml(item.createdAt || a.submittedAt || "—") + "</div>" +
          (item.reviewNote ? "<div><strong>Review note:</strong> " + escapeHtml(item.reviewNote) + "</div>" : "") +
          "</div>" +
          '<div class="ov-adm-docs">' +
          docs.map(function (d) { return "<span>" + escapeHtml(d) + "</span>"; }).join("") +
          "</div>" +
          previews +
          (item.status === "pending"
            ? '<div class="ov-adm-actions">' +
              '<button type="button" class="ov-adm-approve" data-approve="' + escapeHtml(item.id) + '">Approve (verify)</button>' +
              '<button type="button" class="ov-adm-reject" data-reject="' + escapeHtml(item.id) + '">Reject</button>' +
              "</div>"
            : '<p class="ov-adm-meta" style="margin-top:10px">Already <strong>' + escapeHtml(item.status) + "</strong></p>") +
          "</article>"
        );
      })
      .join("");

    box.querySelectorAll("[data-approve]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        updateItem(btn.getAttribute("data-approve"), "verified");
      });
    });
    box.querySelectorAll("[data-reject]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var note = prompt(
          "Rejection reason (shown to landlord):",
          "Details could not be confirmed. Please resubmit clearer documents."
        );
        updateItem(btn.getAttribute("data-reject"), "rejected", note || "Rejected");
      });
    });
  }

  async function updateItem(id, status, note) {
    var queue = cloudQueue.slice();
    var item = queue.find(function (q) {
      return String(q.id) === String(id);
    });
    if (!item) return;

    if (String(id).indexOf("ov-") === 0) {
      alert("This legacy local request is not stored in Supabase and cannot be reviewed here.");
      return;
    }
    var cloudResult = await cloudReview(id, status, note);
    if (!cloudResult || !cloudResult.ok) {
      alert("Could not save the verification decision to Supabase: " + ((cloudResult && cloudResult.error) || "Please try again."));
      return;
    }
    var cloudProfile = status === "verified"
      ? (cloudResult.profile || await loadCloudOwnerProfile(item.userId))
      : null;
    item.status = status;
    item.reviewedAt = new Date().toISOString();
    item.reviewNote = note || "";
    cloudQueue = queue;
    writeJSON(QUEUE_KEY, queue.slice(0, 100));
    var updatedUser = setUserStatus(item.email, item.userId, status, note, cloudProfile);
    if (status === "verified" && updatedUser && updatedUser.promoType && updatedUser.promoEndsAt) {
      var client = window.leaseaccomSupabase || window.leasehubSupabase;
      try {
        var promoResult = await client.from("profiles").update({
          promo_type: updatedUser.promoType,
          promo_ends_at: updatedUser.promoEndsAt
        }).eq("id", item.userId);
        if (promoResult.error) throw new Error(promoResult.error.message);
      } catch (error) {
        await render();
        alert("Owner verified, but the launch promo could not be saved: " + (error.message || "Please try again."));
        return;
      }
    }
    render();
    alert(
      status === "verified"
        ? "Landlord verified. They can proceed to list properties."
        : "Application rejected. Reason saved for the owner."
    );
  }

  async function hasAdminAccess() {
    var client = window.leaseaccomSupabase || window.leasehubSupabase || null;
    if (!client || !client.auth || typeof client.auth.getUser !== "function") return false;
    try {
      var userResult = await client.auth.getUser();
      var user = userResult && userResult.data && userResult.data.user;
      if (!user) return false;
      var profileResult = await client
        .from("profiles")
        .select("account_type,account_status")
        .eq("id", user.id)
        .maybeSingle();
      return !!(
        profileResult &&
        !profileResult.error &&
        profileResult.data &&
        String(profileResult.data.account_type || "").toLowerCase() === "admin" &&
        String(profileResult.data.account_status || "active").toLowerCase() === "active"
      );
    } catch (e) {
      console.warn("Admin verification access check failed:", e);
      return false;
    }
  }

  async function startAdminVerificationPage() {
    document.body.style.visibility = "hidden";
    document.body.setAttribute("aria-busy", "true");
    if (!(await hasAdminAccess())) {
      window.location.replace("admin/admin.html");
      return;
    }
    document.body.style.visibility = "";
    document.body.removeAttribute("aria-busy");
    document.querySelectorAll("[data-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        filter = btn.getAttribute("data-filter");
        document.querySelectorAll("[data-filter]").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        render();
      });
    });
    render();
  }

  startAdminVerificationPage();
})();
