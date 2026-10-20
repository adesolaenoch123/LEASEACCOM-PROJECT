(function () {
  "use strict";

  function sb() {
    return window.leaseaccomSupabase || window.leasehubSupabase || null;
  }
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function money(n) {
    return "₦" + new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(Number(n) || 0);
  }

  var state = {
    profile: null,
    users: [],
    properties: [],
    verifications: [],
    viewings: [],
    applications: [],
    payments: [],
    subscriptions: [],
    reports: []
  };
  var propertyFilter = "";
  var verFilter = "pending";
  var selectedUserId = null;

  function showLogin(msg) {
    var screen = document.getElementById("adminLoginScreen");
    var app = document.getElementById("adminApp");
    if (screen) screen.style.display = "grid";
    if (app) app.style.display = "none";
    var err = document.getElementById("adminLoginError");
    if (err) err.textContent = msg || "";
  }

  function showApp() {
    var screen = document.getElementById("adminLoginScreen");
    var app = document.getElementById("adminApp");
    if (screen) screen.style.display = "none";
    if (app) app.style.display = "block";
  }

  async function requireAdmin() {
    var client = sb();
    if (!client) {
      showLogin("Supabase not loaded. Check ../JS/supabase-client.js");
      return null;
    }
    var userRes = await client.auth.getUser();
    var user = userRes && userRes.data && userRes.data.user;
    if (!user) {
      showLogin("");
      return null;
    }
    var res = await client.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (res.error) {
      showLogin(res.error.message);
      return null;
    }
    var profile = res.data;
    if (!profile || String(profile.account_type).toLowerCase() !== "admin") {
      await client.auth.signOut();
      showLogin("This account is not an admin.");
      return null;
    }
    state.profile = Object.assign({}, profile, { email: user.email });
    var name = profile.full_name || user.email || "Admin";
    var nameEl = document.getElementById("adminUserName");
    var side = document.getElementById("sidebarAdminLabel");
    if (nameEl) nameEl.textContent = name;
    if (side) side.textContent = name + " · Super Admin";
    showApp();
    return state.profile;
  }

  async function safeSelect(table, limit) {
    var client = sb();
    try {
      var res = await client.from(table).select("*").limit(limit || 500);
      if (res.error) {
        console.warn(table, res.error.message);
        return [];
      }
      return res.data || [];
    } catch (e) {
      return [];
    }
  }

  async function loadOverviewData() {
    var packs = await Promise.all([
      safeSelect("profiles", 500),
      safeSelect("properties", 500),
      safeSelect("owner_verifications", 200),
      safeSelect("viewings", 200),
      safeSelect("applications", 200),
      safeSelect("payments", 100),
      safeSelect("subscriptions", 100),
      safeSelect("reports", 200)
    ]);
    state.users = packs[0];
    state.properties = packs[1];
    state.verifications = packs[2];
    state.viewings = packs[3];
    state.applications = packs[4];
    state.payments = packs[5];
    state.subscriptions = packs[6];
    state.reports = packs[7] || [];
    renderOverview();
    renderProperties();
    renderUsers();
    renderVerification();
    renderPayments();
    renderSettings();
    renderReports();
  }

  function goSection(id) {
    var link = document.querySelector('.admin-nav a[data-section="' + id + '"]');
    if (link) link.click();
    document.querySelectorAll("#mobileBottomNav [data-section]").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-section") === id);
    });
  }

  function renderOverview() {
    var users = state.users;
    var props = state.properties;
    var pendingProps = props.filter(function (p) {
      return String(p.verification_status || p.listing_status || "").toLowerCase().indexOf("pending") !== -1;
    });
    var liveProps = props.filter(function (p) {
      var v = String(p.verification_status || "").toLowerCase();
      var l = String(p.listing_status || "").toLowerCase();
      return v === "approved" || l === "live";
    });
    var rejectedProps = props.filter(function (p) {
      return String(p.verification_status || "").toLowerCase() === "rejected";
    });
    var pendingVer = state.verifications.filter(function (v) {
      return String(v.status || "").toLowerCase() === "pending";
    });
    var tenants = users.filter(function (u) { return u.account_type === "tenant"; }).length;
    var owners = users.filter(function (u) { return u.account_type === "owner"; }).length;

    var kpis = [
      { label: "Total users", value: users.length, icon: "bx-group" },
      { label: "Live listings", value: liveProps.length, icon: "bx-buildings" },
      { label: "Pending verifications", value: pendingVer.length, icon: "bx-shield-quarter" },
      { label: "Viewings", value: state.viewings.length, icon: "bx-calendar" },
      { label: "Applications", value: state.applications.length, icon: "bx-file" },
      { label: "Tenants", value: tenants, icon: "bx-user" },
      { label: "Owners", value: owners, icon: "bx-home" },
      { label: "Pending listings", value: pendingProps.length, icon: "bx-time" }
    ];
    var grid = document.getElementById("kpiGrid");
    if (grid) {
      grid.innerHTML = kpis.map(function (k) {
        return '<div class="kpi-card"><div class="kpi-icon"><i class="bx ' + k.icon +
          '"></i></div><div class="kpi-value">' + esc(k.value) +
          '</div><div class="kpi-label">' + esc(k.label) + "</div></div>";
      }).join("");
    }

    var chart = document.getElementById("chartTraffic");
    if (chart) {
      var vals = [
        Math.max(2, users.length), Math.max(2, props.length),
        Math.max(2, state.viewings.length + 1), Math.max(2, state.applications.length + 1),
        Math.max(2, pendingVer.length + 2), Math.max(2, liveProps.length + 1),
        Math.max(2, tenants + 1), Math.max(2, owners + 1),
        Math.max(2, props.length + users.length),
        Math.max(2, state.viewings.length + state.applications.length + 2)
      ];
      var max = Math.max.apply(null, vals) || 1;
      chart.innerHTML = vals.map(function (v) {
        return '<div class="traffic-bar" style="height:' + Math.round((v / max) * 100) + '%"></div>';
      }).join("");
    }

    var totalP = props.length || 1;
    var pipe = document.getElementById("propertyPipeline");
    if (pipe) {
      var stages = [
        { name: "Pending", n: pendingProps.length },
        { name: "Live", n: liveProps.length },
        { name: "Rejected", n: rejectedProps.length },
        { name: "All", n: props.length }
      ];
      pipe.innerHTML = stages.map(function (s) {
        var pct = s.name === "All" ? 100 : Math.round((s.n / totalP) * 100);
        return '<div class="pipeline-row"><span>' + esc(s.name) +
          '</span><div class="pipeline-track"><div class="pipeline-fill" style="width:' + pct +
          '%"></div></div><strong>' + s.n + "</strong></div>";
      }).join("");
    }

    var alerts = document.getElementById("overviewAlerts");
    if (alerts) {
      var items = [];
      if (pendingVer.length) items.push({ level: "high", title: "Verification backlog", text: pendingVer.length + " waiting" });
      if (pendingProps.length) items.push({ level: "med", title: "Listings pending", text: pendingProps.length + " need approval" });
      if (!items.length) items.push({ level: "low", title: "All clear", text: "No critical alerts" });
      alerts.innerHTML = '<ul class="alert-list">' + items.map(function (a) {
        return '<li class="alert-item"><span class="alert-dot ' + a.level +
          '"></span><div><strong>' + esc(a.title) + "</strong><span>" + esc(a.text) + "</span></div></li>";
      }).join("") + "</ul>";
    }

    var pay = document.getElementById("overviewPayments");
    if (pay) {
      pay.innerHTML = state.payments.length
        ? "<p><strong>" + state.payments.length + "</strong> payment(s).</p>"
        : "<p style='color:var(--la-muted);font-size:13px'>No payments yet.</p>";
    }
    var subs = document.getElementById("overviewSubs");
    if (subs) {
      subs.innerHTML = state.subscriptions.length
        ? "<p><strong>" + state.subscriptions.length + "</strong> subscription(s).</p>"
        : "<p style='color:var(--la-muted);font-size:13px'>No subscriptions yet.</p>";
    }
  }

  function propertyStatus(p) {
    return String(p.verification_status || p.listing_status || "pending").toLowerCase();
  }

  function renderProperties() {
    var q = String((document.getElementById("propertySearch") || {}).value || "").toLowerCase();
    var list = state.properties.filter(function (p) {
      var st = propertyStatus(p);
      if (propertyFilter === "pending" && st.indexOf("pending") === -1) return false;
      if (propertyFilter === "approved" && st !== "approved" && st !== "live") return false;
      if (propertyFilter === "rejected" && st !== "rejected") return false;
      if (!q) return true;
      return ((p.title || "") + " " + (p.city || "") + " " + (p.location || "") + " " + (p.id || ""))
        .toLowerCase().indexOf(q) !== -1;
    });

    var meta = document.getElementById("propertyMeta");
    if (meta) meta.textContent = "Showing " + list.length + " of " + state.properties.length + " properties";

    var box = document.getElementById("propertiesTable");
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<p class="ov-adm-empty">No properties match.</p>';
      return;
    }

    box.innerHTML =
      '<table class="admin-table"><thead><tr>' +
      "<th>Property</th><th>City</th><th>Price</th><th>Status</th><th>Featured</th><th>Actions</th>" +
      "</tr></thead><tbody>" +
      list.map(function (p) {
        var st = propertyStatus(p);
        var pill = st.indexOf("pending") !== -1 ? "pending" : st === "rejected" ? "rejected" : "approved";
        var img = p.cover_image || p.image || (Array.isArray(p.images) && p.images[0]) || "";
        var thumb = img
          ? '<img class="prop-thumb" src="' + esc(img) + '" alt="" onerror="this.style.opacity=0.3">'
          : '<div class="prop-thumb"></div>';
        var featured = p.featured === true || p.featured === "true";
        return (
          "<tr><td><div class='prop-cell'>" + thumb + "<div><strong><a class='prop-link' href='../property-details.html?id=" + encodeURIComponent(p.id) + "' target='_blank' rel='noopener'>" + esc(p.title || "Untitled") +
          "</a></strong><small>" + esc((p.bedrooms != null ? p.bedrooms + " Bed · " : "") + (p.property_type || p.type || "")) +
          "</small></div></div></td><td>" + esc(p.city || p.location || "—") + "</td><td>" + money(p.price) +
          '</td><td><span class="status-pill ' + pill + '">' + esc(p.verification_status || p.listing_status || "pending") +
          '</span></td><td><button type="button" class="star-btn' + (featured ? " is-on" : "") +
          '" data-prop-feature="' + esc(p.id) + '">' + (featured ? "★" : "☆") +
          '</button></td><td class="admin-row-actions">' +
          '<button type="button" class="btn btn-primary" data-prop-approve="' + esc(p.id) + '">Approve</button> ' +
          '<a class="btn" href="../property-details.html?id=' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener">View on site</a> ' +
          '<button type="button" class="btn btn-danger" data-prop-reject="' + esc(p.id) + '">Reject</button></td></tr>'
        );
      }).join("") +
      "</tbody></table>";

    box.querySelectorAll("[data-prop-approve]").forEach(function (b) {
      b.addEventListener("click", function () {
        setPropertyStatus(b.getAttribute("data-prop-approve"), "approved", "live");
      });
    });
    box.querySelectorAll("[data-prop-reject]").forEach(function (b) {
      b.addEventListener("click", function () {
        setPropertyStatus(b.getAttribute("data-prop-reject"), "rejected", "rejected");
      });
    });
    box.querySelectorAll("[data-prop-feature]").forEach(function (b) {
      b.addEventListener("click", function () {
        toggleFeatured(b.getAttribute("data-prop-feature"));
      });
    });
  }

  async function setPropertyStatus(id, verification, listing) {
    var client = sb();
    if (!client) return;
    if (verification === "approved") {
      try {
        var flagRes = await client.from("platform_settings").select("value").eq("key", "platform_flags").maybeSingle();
        var flags = (flagRes.data && flagRes.data.value) || {};
        if (flags.requireOwnerVerif) {
          var prop = state.properties.find(function (x) { return String(x.id) === String(id); });
          var ownerId = prop && (prop.owner_id || prop.user_id);
          if (ownerId) {
            var pr = await client.from("profiles").select("verification_status, account_type").eq("id", ownerId).maybeSingle();
            var vs = String((pr.data && pr.data.verification_status) || "").toLowerCase();
            if (vs !== "verified" && vs !== "approved") {
              alert("Settings require owner verification before a listing can go live. This owner is not verified yet.");
              return;
            }
          }
        }
      } catch (e) {}
    }
    var res = await client.from("properties").update({
      verification_status: verification,
      listing_status: listing
    }).eq("id", id);
    if (res.error) { alert(res.error.message); return; }
    await loadOverviewData();
  }

  async function toggleFeatured(id) {
    var client = sb();
    if (!client) return;
    var p = state.properties.find(function (x) { return String(x.id) === String(id); });
    if (!p) return;
    var next = !(p.featured === true || p.featured === "true");
    var res = await client.from("properties").update({ featured: next }).eq("id", id);
    if (res.error) { alert(res.error.message); return; }
    await loadOverviewData();
  }

  function renderUsers() {
    var q = String((document.getElementById("userSearch") || {}).value || "").toLowerCase();
    var role = (document.getElementById("userType") || {}).value || "";
    var status = (document.getElementById("userStatus") || {}).value || "";
    var list = state.users.filter(function (u) {
      if (role && String(u.account_type || "") !== role) return false;
      if (status === "suspended" && u.account_status !== "suspended") return false;
      if (status === "active" && u.account_status === "suspended") return false;
      if (!q) return true;
      return ((u.full_name || "") + " " + (u.phone || "") + " " + (u.id || "")).toLowerCase().indexOf(q) !== -1;
    });

    var tenants = state.users.filter(function (u) { return u.account_type === "tenant"; }).length;
    var owners = state.users.filter(function (u) { return u.account_type === "owner"; }).length;
    var suspended = state.users.filter(function (u) { return u.account_status === "suspended"; }).length;

    var stats = document.getElementById("userStatsGrid");
    if (stats) {
      stats.innerHTML =
        '<div class="kpi-card"><div class="kpi-icon"><i class="bx bx-group"></i></div><div class="kpi-value">' + tenants +
        '</div><div class="kpi-label">Tenants</div></div>' +
        '<div class="kpi-card"><div class="kpi-icon"><i class="bx bx-home"></i></div><div class="kpi-value">' + owners +
        '</div><div class="kpi-label">Owners</div></div>' +
        '<div class="kpi-card"><div class="kpi-icon"><i class="bx bx-block"></i></div><div class="kpi-value">' + suspended +
        '</div><div class="kpi-label">Suspended</div></div>' +
        '<div class="kpi-card"><div class="kpi-icon"><i class="bx bx-user"></i></div><div class="kpi-value">' + state.users.length +
        '</div><div class="kpi-label">All users</div></div>';
    }

    var meta = document.getElementById("userMeta");
    if (meta) meta.textContent = "Showing " + list.length + " of " + state.users.length + " users";

    var box = document.getElementById("usersTable");
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<p class="ov-adm-empty">No users match.</p>';
      return;
    }

    box.innerHTML =
      '<table class="admin-table"><thead><tr>' +
      "<th>Name</th><th>Role</th><th>Status</th><th>Verification</th><th>Actions</th>" +
      "</tr></thead><tbody>" +
      list.map(function (u) {
        var initials = String(u.full_name || "U").trim().split(/\s+/).map(function (w) {
          return w[0];
        }).slice(0, 2).join("").toUpperCase() || "U";
        var st = u.account_status === "suspended" ? "suspended" : "active";
        return (
          "<tr><td><div class='user-cell'><div class='user-avatar'>" + esc(initials) +
          "</div><div><strong>" + esc(u.full_name || u.id) +
          "</strong></div></div></td><td><span class='status-pill role'>" + esc(u.account_type || "—") +
          "</span></td><td><span class='status-pill " + st + "'>" + esc(u.account_status || "active") +
          "</span></td><td>" + esc(u.verification_status || "—") +
          '</td><td class="admin-row-actions">' +
          '<button type="button" class="btn btn-primary" data-user-profile="' + esc(u.id) + '">View profile</button> ' +
          '<button type="button" class="btn" data-user-role="' + esc(u.id) + '">Change role</button> ' +
          '<button type="button" class="btn btn-danger" data-user-suspend="' + esc(u.id) + '">' +
          (u.account_status === "suspended" ? "Unsuspend" : "Suspend") + "</button></td></tr>"
        );
      }).join("") +
      "</tbody></table>";

    box.querySelectorAll("[data-user-suspend]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        toggleSuspend(btn.getAttribute("data-user-suspend"));
      });
    });
    box.querySelectorAll("[data-user-role]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        changeRole(btn.getAttribute("data-user-role"));
      });
    });
    box.querySelectorAll("[data-user-profile]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openUserProfile(btn.getAttribute("data-user-profile"));
      });
    });
  }

  async function toggleSuspend(id) {
    var client = sb();
    if (!client) return;
    var u = state.users.find(function (x) { return String(x.id) === String(id); });
    if (!u) return;
    if (String(u.account_type).toLowerCase() === "admin") {
      alert("Cannot suspend an admin.");
      return;
    }
    var next = u.account_status === "suspended" ? "active" : "suspended";
    var res = await client.from("profiles").update({ account_status: next }).eq("id", id);
    if (res.error) { alert(res.error.message); return; }
    await loadOverviewData();
  }

  async function changeRole(id) {
    var client = sb();
    if (!client) return;
    var u = state.users.find(function (x) { return String(x.id) === String(id); });
    if (!u) return;
    if (String(u.account_type).toLowerCase() === "admin") {
      alert("Cannot change admin role here.");
      return;
    }
    var role = prompt("Set role: tenant or owner", u.account_type || "tenant");
    if (!role) return;
    role = String(role).toLowerCase().trim();
    if (role !== "tenant" && role !== "owner") {
      alert("Only tenant or owner.");
      return;
    }
    var res = await client.from("profiles").update({ account_type: role }).eq("id", id);
    if (res.error) { alert(res.error.message); return; }
    await loadOverviewData();
  }


  function renderVerification() {
    var list = (state.verifications || []).filter(function (v) {
      var st = String(v.status || "pending").toLowerCase();
      if (!verFilter) return true;
      return st === verFilter || (verFilter === "pending" && st.indexOf("pending") !== -1);
    });

    var meta = document.getElementById("verMeta");
    if (meta) {
      meta.textContent = "Showing " + list.length + " of " + (state.verifications || []).length + " applications";
    }

    var box = document.getElementById("verificationTable");
    if (!box) return;

    if (!list.length) {
      box.innerHTML = '<p class="ov-adm-empty">No verification applications in this filter. Owners submit from the owner verification page.</p>';
      return;
    }

    box.innerHTML =
      '<table class="admin-table"><thead><tr>' +
      "<th>Full name</th><th>Phone</th><th>NIN / ID</th><th>ID type</th><th>City</th><th>Documents</th><th>Status</th><th>Actions</th>" +
      "</tr></thead><tbody>" +
      list
        .map(function (v) {
          var st = String(v.status || "pending").toLowerCase();
          var pill = st === "approved" || st === "verified" ? "approved" : st === "rejected" ? "rejected" : "pending";
          var name = v.full_name || v.owner_name || v.email || (v.owner_id ? String(v.owner_id).slice(0, 8) + "…" : "—");
          var phone = v.phone || v.phone_number || "—";
          var nin = v.nin || v.id_number || v.national_id || "—";
          var idType = v.id_type || v.national_id_type || v.document_type || "—";
          var city = v.city || v.state || "—";
          var idPath = v.id_file_path || v.id_url || v.national_id_url || "";
          var proofPath = v.proof_file_path || v.proof_url || v.ownership_url || "";
          var docs = '<div class="ver-docs">';
          if (idPath) {
            docs += '<div><a href="' + esc(idPath) + '" target="_blank" rel="noopener"><img class="ver-doc" src="' + esc(idPath) + '" alt="ID" onerror="this.alt=\'ID\'"></a><span class="ver-doc-label">ID</span></div>';
          }
          if (proofPath) {
            docs += '<div><a href="' + esc(proofPath) + '" target="_blank" rel="noopener"><img class="ver-doc" src="' + esc(proofPath) + '" alt="Proof" onerror="this.alt=\'Proof\'"></a><span class="ver-doc-label">Proof</span></div>';
          }
          if (!idPath && !proofPath) docs += "<span>—</span>";
          docs += "</div>";

          return (
            "<tr><td class='ver-name-cell'><strong>" +
            esc(name) +
            "</strong></td><td>" +
            esc(phone) +
            "</td><td>" +
            esc(nin) +
            "</td><td>" +
            esc(idType) +
            "</td><td>" +
            esc(city) +
            "</td><td>" +
            docs +
            '</td><td><span class="status-pill ' +
            pill +
            '">' +
            esc(v.status || "pending") +
            '</span></td><td class="admin-row-actions">' +
            (pill === "pending"
              ? '<button type="button" class="btn btn-primary" data-ver-approve="' +
                esc(v.id) +
                '">Verify</button> ' +
                '<button type="button" class="btn btn-danger" data-ver-reject="' +
                esc(v.id) +
                '">Reject</button>'
              : "<span style='color:var(--la-muted);font-size:12px'>Done</span>") +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";

    box.querySelectorAll("[data-ver-approve]").forEach(function (b) {
      b.addEventListener("click", function () {
        setVerificationStatus(b.getAttribute("data-ver-approve"), "approved");
      });
    });
    box.querySelectorAll("[data-ver-reject]").forEach(function (b) {
      b.addEventListener("click", function () {
        setVerificationStatus(b.getAttribute("data-ver-reject"), "rejected");
      });
    });
  }

  async function setVerificationStatus(id, status) {
    var client = sb();
    if (!client) return;
    var payload = { status: status };
    var res = await client.from("owner_verifications").update(payload).eq("id", id);
    if (res.error) {
      alert(res.error.message);
      return;
    }
    // Optional: mark owner profile verified
    try {
      var row = (state.verifications || []).find(function (x) {
        return String(x.id) === String(id);
      });
      if (row && row.owner_id && status === "approved") {
        await client
          .from("profiles")
          .update({ verification_status: "verified" })
          .eq("id", row.owner_id);
      }
      if (row && row.owner_id && status === "rejected") {
        await client
          .from("profiles")
          .update({ verification_status: "rejected" })
          .eq("id", row.owner_id);
      }
    } catch (e) {}
    await loadOverviewData();
  }



  function openUserProfile(id) {
    selectedUserId = id;
    renderUserProfile();
    // show profile section without requiring nav link
    document.querySelectorAll(".admin-section").forEach(function (s) {
      s.classList.toggle("is-active", s.getAttribute("data-section-panel") === "user-profile");
    });
    document.querySelectorAll(".admin-nav a").forEach(function (x) {
      x.classList.remove("is-active");
    });
    var usersLink = document.querySelector('.admin-nav a[data-section="users"]');
    if (usersLink) usersLink.classList.add("is-active");
    var title = document.getElementById("topbarTitle");
    if (title) title.textContent = "User profile";
    document.querySelectorAll("#mobileBottomNav [data-section]").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-section") === "users");
    });
  }

  function renderUserProfile() {
    var u = (state.users || []).find(function (x) {
      return String(x.id) === String(selectedUserId);
    });
    if (!u) {
      var empty = document.getElementById("profileDetails");
      if (empty) empty.innerHTML = '<p class="ov-adm-empty">User not found.</p>';
      return;
    }

    var listings = (state.properties || []).filter(function (p) {
      return String(p.owner_id || p.user_id || "") === String(u.id);
    });
    var viewings = (state.viewings || []).filter(function (v) {
      return (
        String(v.tenant_id || v.user_id || "") === String(u.id) ||
        String(v.owner_id || "") === String(u.id)
      );
    });
    var apps = (state.applications || []).filter(function (a) {
      return (
        String(a.tenant_id || a.user_id || "") === String(u.id) ||
        String(a.owner_id || "") === String(u.id)
      );
    });

    var title = document.getElementById("profileTitle");
    if (title) title.textContent = u.full_name || "User profile";
    var sub = document.getElementById("profileSub");
    if (sub) {
      sub.textContent =
        (u.account_type || "user") +
        " · " +
        (u.account_status || "active") +
        " · id " +
        String(u.id).slice(0, 8) +
        "…";
    }

    var kpis = document.getElementById("profileKpis");
    if (kpis) {
      kpis.innerHTML =
        '<div class="kpi-card"><div class="kpi-icon"><i class="bx bx-buildings"></i></div><div class="kpi-value">' +
        listings.length +
        '</div><div class="kpi-label">Listings</div></div>' +
        '<div class="kpi-card"><div class="kpi-icon"><i class="bx bx-calendar"></i></div><div class="kpi-value">' +
        viewings.length +
        '</div><div class="kpi-label">Viewings</div></div>' +
        '<div class="kpi-card"><div class="kpi-icon"><i class="bx bx-file"></i></div><div class="kpi-value">' +
        apps.length +
        '</div><div class="kpi-label">Applications</div></div>' +
        '<div class="kpi-card"><div class="kpi-icon"><i class="bx bx-badge-check"></i></div><div class="kpi-value">' +
        esc(u.verification_status || "—") +
        '</div><div class="kpi-label">Verification</div></div>';
    }

    var details = document.getElementById("profileDetails");
    if (details) {
      details.innerHTML =
        '<dl class="profile-dl">' +
        "<div><dt>Full name</dt><dd>" +
        esc(u.full_name || "—") +
        "</dd></div>" +
        "<div><dt>Role</dt><dd>" +
        esc(u.account_type || "—") +
        "</dd></div>" +
        "<div><dt>Status</dt><dd>" +
        esc(u.account_status || "active") +
        "</dd></div>" +
        "<div><dt>Phone</dt><dd>" +
        esc(u.phone || "—") +
        "</dd></div>" +
        "<div><dt>Verification</dt><dd>" +
        esc(u.verification_status || "—") +
        "</dd></div>" +
        "<div><dt>User id</dt><dd style=\"font-size:11px;word-break:break-all\">" +
        esc(u.id) +
        "</dd></div>" +
        "</dl>";
    }

    var actions = document.getElementById("profileActions");
    if (actions) {
      if (String(u.account_type).toLowerCase() === "admin") {
        actions.innerHTML = "<p style='color:var(--la-muted);font-size:13px'>Admin account — limited actions.</p>";
      } else {
        actions.innerHTML =
          '<button type="button" class="btn" data-profile-role="' +
          esc(u.id) +
          '">Change role</button> ' +
          '<button type="button" class="btn btn-danger" data-profile-suspend="' +
          esc(u.id) +
          '">' +
          (u.account_status === "suspended" ? "Unsuspend" : "Suspend") +
          "</button>";
        actions.querySelectorAll("[data-profile-role]").forEach(function (b) {
          b.addEventListener("click", function () {
            changeRole(b.getAttribute("data-profile-role")).then(function () {
              openUserProfile(selectedUserId);
            });
          });
        });
        actions.querySelectorAll("[data-profile-suspend]").forEach(function (b) {
          b.addEventListener("click", function () {
            toggleSuspend(b.getAttribute("data-profile-suspend")).then(function () {
              openUserProfile(selectedUserId);
            });
          });
        });
      }
    }

    var listBox = document.getElementById("profileListings");
    if (listBox) {
      if (!listings.length) {
        listBox.innerHTML = '<p class="ov-adm-empty">No listings linked to this user.</p>';
      } else {
        listBox.innerHTML =
          '<table class="admin-table"><thead><tr><th>Title</th><th>City</th><th>Price</th><th>Status</th></tr></thead><tbody>' +
          listings
            .map(function (p) {
              return (
                "<tr><td><a class=\"prop-link\" href=\"../property-details.html?id=" +
                encodeURIComponent(p.id) + "\" target=\"_blank\" rel=\"noopener\">" +
                esc(p.title || "—") +
                "</a></td><td>" +
                esc(p.city || p.location || "—") +
                "</td><td>" +
                money(p.price) +
                "</td><td>" +
                esc(p.verification_status || p.listing_status || "—") +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table>";
      }
    }

    var vBox = document.getElementById("profileViewings");
    if (vBox) {
      if (!viewings.length) {
        vBox.innerHTML = '<p class="ov-adm-empty">No viewings.</p>';
      } else {
        vBox.innerHTML =
          '<ul class="activity-list">' +
          viewings
            .slice(0, 20)
            .map(function (v) {
              return (
                "<li><strong>" +
                esc(v.status || "viewing") +
                "</strong><span>" +
                esc(v.preferred_date || v.created_at || "") +
                " · property " +
                esc(String(v.property_id || "").slice(0, 8)) +
                "…</span></li>"
              );
            })
            .join("") +
          "</ul>";
      }
    }

    var aBox = document.getElementById("profileApplications");
    if (aBox) {
      if (!apps.length) {
        aBox.innerHTML = '<p class="ov-adm-empty">No applications.</p>';
      } else {
        aBox.innerHTML =
          '<ul class="activity-list">' +
          apps
            .slice(0, 20)
            .map(function (a) {
              return (
                "<li><strong>" +
                esc(a.status || "application") +
                "</strong><span>" +
                esc(a.created_at || "") +
                " · property " +
                esc(String(a.property_id || "").slice(0, 8)) +
                "…</span></li>"
              );
            })
            .join("") +
          "</ul>";
      }
    }
  }



  function renderPayments() {
    var payKpis = document.getElementById("payKpis");
    if (payKpis) {
      payKpis.innerHTML =
        '<div class="kpi-card"><div class="kpi-icon"><i class="bx bx-credit-card"></i></div><div class="kpi-value">' +
        state.payments.length +
        '</div><div class="kpi-label">Payment records</div></div>' +
        '<div class="kpi-card"><div class="kpi-icon"><i class="bx bx-diamond"></i></div><div class="kpi-value">' +
        state.subscriptions.length +
        '</div><div class="kpi-label">Subscriptions</div></div>' +
        '<div class="kpi-card"><div class="kpi-icon"><i class="bx bx-home"></i></div><div class="kpi-value">' +
        state.users.filter(function (u) { return u.account_type === "owner"; }).length +
        '</div><div class="kpi-label">Owners</div></div>' +
        '<div class="kpi-card"><div class="kpi-icon"><i class="bx bx-time"></i></div><div class="kpi-value">—</div><div class="kpi-label">Paystack (soon)</div></div>';
    }

        // plan cards are static HTML matching public plans page
    var payBox = document.getElementById("paymentsTable");
    if (payBox) {
      if (!state.payments.length) {
        payBox.innerHTML = '<p class="ov-adm-empty">No payment rows yet. They appear after Paystack (or manual inserts).</p>';
      } else {
        payBox.innerHTML =
          '<table class="admin-table"><thead><tr><th>ID</th><th>Amount</th><th>Status</th><th>Reference</th><th>Date</th></tr></thead><tbody>' +
          state.payments
            .map(function (p) {
              return (
                "<tr><td>" +
                esc(String(p.id).slice(0, 8)) +
                "…</td><td>" +
                money(p.amount || p.amount_kobo / 100) +
                "</td><td>" +
                esc(p.status || "—") +
                "</td><td>" +
                esc(p.reference || p.paystack_ref || "—") +
                "</td><td>" +
                esc(String(p.created_at || "").slice(0, 10)) +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table>";
      }
    }

    var subBox = document.getElementById("subscriptionsTable");
    if (subBox) {
      if (!state.subscriptions.length) {
        subBox.innerHTML = '<p class="ov-adm-empty">No subscription rows yet. Use “Assign plan” below or wait for Paystack.</p>';
      } else {
        subBox.innerHTML =
          '<table class="admin-table"><thead><tr><th>Owner</th><th>Plan</th><th>Status</th><th>Updated</th></tr></thead><tbody>' +
          state.subscriptions
            .map(function (s) {
              return (
                "<tr><td>" +
                esc(String(s.owner_id || s.user_id || "").slice(0, 8)) +
                "…</td><td>" +
                esc(s.plan || s.plan_id || "—") +
                "</td><td>" +
                esc(s.status || "—") +
                "</td><td>" +
                esc(String(s.updated_at || s.created_at || "").slice(0, 10)) +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table>";
      }
    }

    var sel = document.getElementById("assignOwnerSelect");
    if (sel) {
      var owners = state.users.filter(function (u) {
        return u.account_type === "owner";
      });
      var cur = sel.value;
      sel.innerHTML =
        '<option value="">Select owner…</option>' +
        owners
          .map(function (o) {
            return (
              '<option value="' +
              esc(o.id) +
              '">' +
              esc(o.full_name || o.id) +
              "</option>"
            );
          })
          .join("");
      if (cur) sel.value = cur;
    }
  }

  async function assignOwnerPlan() {
    var msg = document.getElementById("assignPlanMsg");
    var ownerId = (document.getElementById("assignOwnerSelect") || {}).value;
    var plan = (document.getElementById("assignPlanSelect") || {}).value;
    if (!ownerId || !plan) {
      if (msg) msg.textContent = "Choose an owner and a plan.";
      return;
    }
    var client = sb();
    if (!client) return;

    // Try profiles.plan / subscription_plan column first
    var res = await client
      .from("profiles")
      .update({ plan: plan, subscription_plan: plan })
      .eq("id", ownerId);
    if (res.error) {
      // try subscriptions upsert-style insert
      var res2 = await client.from("subscriptions").insert({
        owner_id: ownerId,
        user_id: ownerId,
        plan: plan,
        status: "active"
      });
      if (res2.error) {
        if (msg) {
          msg.textContent =
            res.error.message +
            " / " +
            res2.error.message +
            " — add column plan on profiles or fix subscriptions table.";
        }
        return;
      }
    }
    if (msg) msg.textContent = "Plan saved as “" + plan + "” for this owner.";
    await loadOverviewData();
  }



  var defaultLimits = { free: 1, professional: 5, business: 10, enterprise: 30 };
  var defaultFlags = {
    maintenance: false,
    newSignups: true,
    requireOwnerVerif: false,
    featuredOnlyPaid: true
  };

  async function loadSettingsRow(key) {
    var client = sb();
    if (!client) return null;
    try {
      var res = await client.from("platform_settings").select("value").eq("key", key).maybeSingle();
      if (res.error || !res.data) return null;
      return res.data.value;
    } catch (e) {
      return null;
    }
  }

  async function saveSettingsRow(key, value) {
    var client = sb();
    if (!client) return { error: { message: "No client" } };
    return client.from("platform_settings").upsert({
      key: key,
      value: value,
      updated_at: new Date().toISOString()
    });
  }

  async function renderSettings() {
    var limits = (await loadSettingsRow("listing_limits")) || defaultLimits;
    var flags = (await loadSettingsRow("platform_flags")) || defaultFlags;
    var support = (await loadSettingsRow("support_contact")) || {};

    var map = {
      limitFree: limits.free,
      limitProfessional: limits.professional,
      limitBusiness: limits.business,
      limitEnterprise: limits.enterprise
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && map[id] != null) el.value = map[id];
    });

    var fMaint = document.getElementById("flagMaintenance");
    var fSign = document.getElementById("flagNewSignups");
    var fVer = document.getElementById("flagRequireOwnerVerif");
    var fFeat = document.getElementById("flagFeaturedOnlyPaid");
    if (fMaint) fMaint.checked = !!flags.maintenance;
    if (fSign) fSign.checked = flags.newSignups !== false;
    if (fVer) fVer.checked = !!flags.requireOwnerVerif;
    if (fFeat) fFeat.checked = flags.featuredOnlyPaid !== false;

    var em = document.getElementById("settingSupportEmail");
    var ph = document.getElementById("settingSupportPhone");
    if (em && support.email) em.value = support.email;
    if (ph && support.phone) ph.value = support.phone;
  }

  async function saveLimits() {
    var msg = document.getElementById("limitsMsg");
    var value = {
      free: Number((document.getElementById("limitFree") || {}).value) || 0,
      professional: Number((document.getElementById("limitProfessional") || {}).value) || 0,
      business: Number((document.getElementById("limitBusiness") || {}).value) || 0,
      enterprise: Number((document.getElementById("limitEnterprise") || {}).value) || 0
    };
    var res = await saveSettingsRow("listing_limits", value);
    if (res.error) {
      if (msg) msg.textContent = res.error.message + " — create platform_settings table (SQL in this page).";
      return;
    }
    if (msg) msg.textContent = "Limits saved.";
  }

  async function saveFlags() {
    var msg = document.getElementById("flagsMsg");
    var value = {
      maintenance: !!(document.getElementById("flagMaintenance") || {}).checked,
      newSignups: !!(document.getElementById("flagNewSignups") || {}).checked,
      requireOwnerVerif: !!(document.getElementById("flagRequireOwnerVerif") || {}).checked,
      featuredOnlyPaid: !!(document.getElementById("flagFeaturedOnlyPaid") || {}).checked
    };
    var res = await saveSettingsRow("platform_flags", value);
    if (res.error) {
      if (msg) msg.textContent = res.error.message;
      return;
    }
    if (msg) msg.textContent = "Flags saved.";
  }

  async function saveSupport() {
    var msg = document.getElementById("supportMsg");
    var value = {
      email: ((document.getElementById("settingSupportEmail") || {}).value || "").trim(),
      phone: ((document.getElementById("settingSupportPhone") || {}).value || "").trim()
    };
    var res = await saveSettingsRow("support_contact", value);
    if (res.error) {
      if (msg) msg.textContent = res.error.message;
      return;
    }
    if (msg) msg.textContent = "Support contact saved.";
  }



  var reportFilter = "open";

  function renderReports() {
    var cloud = state.reports || [];
    var local = [];
    try {
      local = JSON.parse(localStorage.getItem("leaseaccomListingReports") || "[]") || [];
    } catch (e) {}
    var merged = cloud.slice();
    local.forEach(function (r) {
      var id = r.id || r.propertyId;
      if (!merged.some(function (c) { return String(c.id) === String(r.id); })) {
        merged.push({
          id: r.id,
          property_id: r.propertyId || r.property_id,
          reason: r.reason,
          status: r.status || "open",
          listing_title: r.title || r.listing_title,
          created_at: r.at || r.created_at
        });
      }
    });

    var list = merged.filter(function (r) {
      var st = String(r.status || "open").toLowerCase();
      if (!reportFilter) return true;
      if (reportFilter === "open") return st === "open" || st === "pending";
      return st === reportFilter;
    });

    var meta = document.getElementById("reportMeta");
    if (meta) meta.textContent = "Showing " + list.length + " report(s)";

    var box = document.getElementById("reportsTable");
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<p class="ov-adm-empty">No reports in this filter. Reports appear when someone uses Report on a property page.</p>';
      return;
    }

    box.innerHTML =
      '<table class="admin-table"><thead><tr><th>Listing</th><th>Reason</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>' +
      list
        .map(function (r) {
          var pid = r.property_id || r.propertyId || "";
          var title = r.listing_title || r.title || (pid ? String(pid).slice(0, 8) + "…" : "—");
          var view = pid
            ? '<a class="btn" href="../property-details.html?id=' +
              encodeURIComponent(pid) +
              '" target="_blank" rel="noopener">View listing</a> '
            : "";
          var st = String(r.status || "open").toLowerCase();
          return (
            "<tr><td><strong>" +
            esc(title) +
            "</strong></td><td>" +
            esc(r.reason || "—") +
            '</td><td><span class="status-pill ' +
            (st === "resolved" ? "approved" : "pending") +
            '">' +
            esc(r.status || "open") +
            "</span></td><td>" +
            esc(String(r.created_at || r.at || "").slice(0, 10)) +
            '</td><td class="admin-row-actions">' +
            view +
            (st !== "resolved"
              ? '<button type="button" class="btn btn-primary" data-report-resolve="' +
                esc(r.id) +
                '">Resolve</button>'
              : "") +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";

    box.querySelectorAll("[data-report-resolve]").forEach(function (b) {
      b.addEventListener("click", function () {
        resolveReport(b.getAttribute("data-report-resolve"));
      });
    });
  }

  async function resolveReport(id) {
    var client = sb();
    if (client && id && String(id).indexOf("rep-") !== 0) {
      var res = await client.from("reports").update({ status: "resolved" }).eq("id", id);
      if (res.error) alert(res.error.message);
    }
    try {
      var local = JSON.parse(localStorage.getItem("leaseaccomListingReports") || "[]") || [];
      local = local.map(function (r) {
        if (String(r.id) === String(id)) r.status = "resolved";
        return r;
      });
      localStorage.setItem("leaseaccomListingReports", JSON.stringify(local));
    } catch (e) {}
    await loadOverviewData();
  }


  function bindNav() {
    document.querySelectorAll(".admin-nav [data-section]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var id = a.getAttribute("data-section");
        document.querySelectorAll(".admin-nav a").forEach(function (x) {
          x.classList.toggle("is-active", x === a);
        });
        document.querySelectorAll(".admin-section").forEach(function (s) {
          s.classList.toggle("is-active", s.getAttribute("data-section-panel") === id);
        });
        var title = document.getElementById("topbarTitle");
        if (title) title.textContent = a.textContent.trim();
        document.querySelectorAll("#mobileBottomNav [data-section]").forEach(function (b) {
          b.classList.toggle("is-active", b.getAttribute("data-section") === id);
        });
        var sidebar = document.querySelector(".admin-sidebar");
        if (sidebar) sidebar.classList.remove("is-open");
      });
    });

    document.querySelectorAll("[data-go]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        goSection(btn.getAttribute("data-go"));
      });
    });

    document.querySelectorAll("[data-prop-filter]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        propertyFilter = chip.getAttribute("data-prop-filter") || "";
        document.querySelectorAll("[data-prop-filter]").forEach(function (c) {
          c.classList.toggle("is-active", c === chip);
        });
        renderProperties();
      });
    });

    var search = document.getElementById("propertySearch");
    if (search) search.addEventListener("input", renderProperties);

    ["userSearch", "userType", "userStatus"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", renderUsers);
      el.addEventListener("change", renderUsers);
    });

    var menuBtn = document.getElementById("mobileMenuBtn");
    var sidebar = document.querySelector(".admin-sidebar");
    if (menuBtn && sidebar) {
      menuBtn.addEventListener("click", function () {
        sidebar.classList.toggle("is-open");
      });
    }


    document.querySelectorAll("[data-ver-filter]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        verFilter = chip.getAttribute("data-ver-filter") || "";
        document.querySelectorAll("[data-ver-filter]").forEach(function (c) {
          c.classList.toggle("is-active", c === chip);
        });
        renderVerification();
      });
    });

    document.querySelectorAll("#mobileBottomNav [data-section]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        goSection(btn.getAttribute("data-section"));
      });
    });
  }

  async function boot() {
    bindNav();
    var back = document.getElementById("backToUsers");
    if (back) {
      back.addEventListener("click", function () {
        goSection("users");
      });
    }
    document.querySelectorAll("[data-report-filter]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        reportFilter = chip.getAttribute("data-report-filter") || "";
        document.querySelectorAll("[data-report-filter]").forEach(function (c) {
          c.classList.toggle("is-active", c === chip);
        });
        renderReports();
      });
    });
    var assignBtn = document.getElementById("btnAssignPlan");
    if (assignBtn) assignBtn.addEventListener("click", assignOwnerPlan);
    var btnL = document.getElementById("btnSaveLimits");
    if (btnL) btnL.addEventListener("click", saveLimits);
    var btnF = document.getElementById("btnSaveFlags");
    if (btnF) btnF.addEventListener("click", saveFlags);
    var btnS = document.getElementById("btnSaveSupport");
    if (btnS) btnS.addEventListener("click", saveSupport);


    var form = document.getElementById("adminLoginForm");
    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var err = document.getElementById("adminLoginError");
        if (err) err.textContent = "";
        var email = document.getElementById("adminEmail").value.trim();
        var password = document.getElementById("adminCode").value;
        var client = sb();
        if (!client) {
          if (err) err.textContent = "Supabase client missing";
          return;
        }
        var res = await client.auth.signInWithPassword({ email: email, password: password });
        if (res.error) {
          if (err) err.textContent = res.error.message;
          return;
        }
        var profile = await requireAdmin();
        if (profile) await loadOverviewData();
      });
    }

    var logout = document.getElementById("adminLogout");
    if (logout) {
      logout.addEventListener("click", async function () {
        var client = sb();
        if (client) await client.auth.signOut();
        showLogin("");
      });
    }

    var existing = await requireAdmin();
    if (existing) await loadOverviewData();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
