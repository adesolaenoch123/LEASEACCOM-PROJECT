/**
 * LeaseAccom Admin — Live Command Centre (Supabase)
 */
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
  function fmtDate(d) {
    if (!d) return "—";
    try { return new Date(d).toLocaleString(); } catch (e) { return String(d); }
  }

  var state = {
    profile: null,
    users: [],
    properties: [],
    verifications: [],
    viewings: [],
    applications: [],
    reports: [],
    payments: [],
    subscriptions: [],
    audit: []
  };

  function showLogin(msg) {
    var screen = document.getElementById("adminLoginScreen");
    var app = document.getElementById("adminApp");
    if (screen) screen.style.display = "flex";
    if (app) app.style.display = "none";
    var err = document.getElementById("adminLoginError");
    if (err) err.textContent = msg || "";
  }

  function showApp() {
    var screen = document.getElementById("adminLoginScreen");
    var app = document.getElementById("adminApp");
    if (screen) screen.style.display = "none";
    if (app) app.style.display = "flex";
  }

  async function requireAdmin() {
    var client = sb();
    if (!client) {
      showLogin("Supabase not loaded. Check JS/supabase-client.js keys.");
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
      showLogin("This account is not an admin. Only your admin email can enter.");
      return null;
    }
    state.profile = Object.assign({}, profile, { email: user.email });
    var nameEl = document.getElementById("adminUserName");
    if (nameEl) nameEl.textContent = profile.full_name || user.email || "Admin";
    showApp();
    return state.profile;
  }

  async function auditLog(action, detail) {
    state.audit.unshift({
      action: action,
      detail: detail,
      at: new Date().toISOString(),
      actor: (state.profile && (state.profile.full_name || state.profile.email)) || "Admin"
    });
    var client = sb();
    if (!client) return;
    try {
      await client.from("audit_logs").insert({
        actor_id: state.profile && state.profile.id,
        action: action,
        entity_type: "admin",
        meta: { detail: detail }
      });
    } catch (e) {}
  }

  async function safeSelect(table, limit) {
    var client = sb();
    try {
      var res = await client.from(table).select("*").limit(limit || 300);
      if (res.error) {
        console.warn(table, res.error.message);
        return [];
      }
      return res.data || [];
    } catch (e) {
      return [];
    }
  }

  async function loadAll() {
    var packs = await Promise.all([
      safeSelect("profiles", 500),
      safeSelect("properties", 500),
      safeSelect("owner_verifications", 200),
      safeSelect("viewings", 200),
      safeSelect("applications", 200),
      safeSelect("reports", 100),
      safeSelect("payments", 100),
      safeSelect("subscriptions", 100)
    ]);
    state.users = packs[0];
    state.properties = packs[1];
    state.verifications = packs[2];
    state.viewings = packs[3];
    state.applications = packs[4];
    state.reports = packs[5];
    state.payments = packs[6];
    state.subscriptions = packs[7];
    renderOverview();
    renderUsers();
    renderProperties();
    renderVerification();
    renderViewings();
    renderApplications();
    renderReports();
    renderPayments();
    renderSubscriptions();
    renderNotificationsPanel();
    renderStaff();
    renderAudit();
  }

  function renderOverview() {
    var users = state.users;
    var props = state.properties;
    var pendingProps = props.filter(function (p) {
      var v = String(p.verification_status || p.listing_status || "").toLowerCase();
      return v.indexOf("pending") !== -1;
    });
    var liveProps = props.filter(function (p) {
      var v = String(p.verification_status || "").toLowerCase();
      var l = String(p.listing_status || "").toLowerCase();
      return v === "approved" || l === "live";
    });
    var pendingVer = state.verifications.filter(function (v) {
      return String(v.status || "").toLowerCase() === "pending";
    });
    var kpis = [
      { label: "Total users", value: users.length },
      { label: "Tenants", value: users.filter(function (u) { return u.account_type === "tenant"; }).length },
      { label: "Owners", value: users.filter(function (u) { return u.account_type === "owner"; }).length },
      { label: "Live listings", value: liveProps.length },
      { label: "Pending listings", value: pendingProps.length },
      { label: "Pending verifications", value: pendingVer.length },
      { label: "Viewings", value: state.viewings.length },
      { label: "Applications", value: state.applications.length }
    ];
    var grid = document.getElementById("kpiGrid");
    if (grid) {
      grid.innerHTML = kpis.map(function (k) {
        return '<div class="kpi-card"><div class="kpi-value">' + esc(k.value) + '</div><div class="kpi-label">' + esc(k.label) + "</div></div>";
      }).join("");
    }
    var pipe = document.getElementById("propertyPipeline");
    if (pipe) {
      pipe.innerHTML = "<p><strong>Pending:</strong> " + pendingProps.length + " · <strong>Live:</strong> " + liveProps.length + " · <strong>Total:</strong> " + props.length + "</p>";
    }
    var alerts = document.getElementById("overviewAlerts");
    if (alerts) {
      var lines = [];
      if (pendingVer.length) lines.push(pendingVer.length + " landlord verification(s) waiting");
      if (pendingProps.length) lines.push(pendingProps.length + " listing(s) pending approval");
      if (!lines.length) lines.push("No critical alerts.");
      alerts.innerHTML = "<ul>" + lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>";
    }
    var pay = document.getElementById("overviewPayments");
    if (pay) pay.innerHTML = state.payments.length ? "<p>" + state.payments.length + " payment record(s).</p>" : "<p>No payments yet (Paystack later).</p>";
    var subs = document.getElementById("overviewSubs");
    if (subs) subs.innerHTML = state.subscriptions.length ? "<p>" + state.subscriptions.length + " subscription row(s).</p>" : "<p>No subscriptions recorded yet.</p>";
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
    var stats = document.getElementById("userStatsGrid");
    if (stats) {
      stats.innerHTML =
        '<div class="kpi-card"><div class="kpi-value">' + state.users.length + '</div><div class="kpi-label">All</div></div>' +
        '<div class="kpi-card"><div class="kpi-value">' + state.users.filter(function (u) { return u.account_type === "tenant"; }).length + '</div><div class="kpi-label">Tenants</div></div>' +
        '<div class="kpi-card"><div class="kpi-value">' + state.users.filter(function (u) { return u.account_type === "owner"; }).length + '</div><div class="kpi-label">Owners</div></div>' +
        '<div class="kpi-card"><div class="kpi-value">' + state.users.filter(function (u) { return u.account_status === "suspended"; }).length + '</div><div class="kpi-label">Suspended</div></div>';
    }
    var box = document.getElementById("usersTable");
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<p class="ov-adm-empty">No users match.</p>';
      return;
    }
    box.innerHTML =
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Verified</th><th>Actions</th></tr></thead><tbody>' +
      list.map(function (u) {
        return "<tr><td>" + esc(u.full_name || u.id) + "</td><td>" + esc(u.account_type) + "</td><td>" + esc(u.account_status || "active") + "</td><td>" + esc(u.verification_status || "—") +
          '</td><td class="admin-row-actions">' +
          '<button type="button" class="btn" data-user-role="' + esc(u.id) + '">Role</button> ' +
          '<button type="button" class="btn" data-user-suspend="' + esc(u.id) + '">' + (u.account_status === "suspended" ? "Unsuspend" : "Suspend") + "</button></td></tr>";
      }).join("") +
      "</tbody></table></div>";
    box.querySelectorAll("[data-user-suspend]").forEach(function (btn) {
      btn.addEventListener("click", function () { toggleSuspend(btn.getAttribute("data-user-suspend")); });
    });
    box.querySelectorAll("[data-user-role]").forEach(function (btn) {
      btn.addEventListener("click", function () { changeRole(btn.getAttribute("data-user-role")); });
    });
  }

  async function toggleSuspend(id) {
    var client = sb();
    var u = state.users.find(function (x) { return String(x.id) === String(id); });
    if (!u || u.account_type === "admin") {
      alert("Cannot suspend admin.");
      return;
    }
    var next = u.account_status === "suspended" ? "active" : "suspended";
    var res = await client.from("profiles").update({ account_status: next }).eq("id", id);
    if (res.error) return alert(res.error.message);
    await auditLog("user_status", id + " → " + next);
    await loadAll();
  }

  async function changeRole(id) {
    var client = sb();
    var u = state.users.find(function (x) { return String(x.id) === String(id); });
    if (!u) return;
    var role = prompt("Set role: tenant or owner", u.account_type || "tenant");
    if (!role) return;
    role = String(role).toLowerCase().trim();
    if (role !== "tenant" && role !== "owner") {
      alert("Use tenant or owner only.");
      return;
    }
    var res = await client.from("profiles").update({ account_type: role }).eq("id", id);
    if (res.error) return alert(res.error.message);
    await auditLog("user_role", id + " → " + role);
    await loadAll();
  }

  function renderProperties() {
    var q = String((document.getElementById("propertySearch") || {}).value || "").toLowerCase();
    var st = (document.getElementById("propertyStatus") || {}).value || "";
    var list = state.properties.filter(function (p) {
      var vs = String(p.verification_status || p.listing_status || "").toLowerCase();
      if (st === "pending" && vs.indexOf("pending") === -1) return false;
      if ((st === "approved" || st === "live") && vs !== "approved" && vs !== "live") return false;
      if (st === "rejected" && vs !== "rejected") return false;
      if (!q) return true;
      return ((p.title || "") + " " + (p.city || "") + " " + (p.location || "")).toLowerCase().indexOf(q) !== -1;
    });
    var box = document.getElementById("propertiesTable");
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<p class="ov-adm-empty">No properties.</p>';
      return;
    }
    box.innerHTML =
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Title</th><th>City</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
      list.map(function (p) {
        return "<tr><td>" + esc(p.title) + "</td><td>" + esc(p.city || p.location) + "</td><td>" + money(p.price) + "</td><td>" + esc(p.verification_status || p.listing_status) +
          '</td><td class="admin-row-actions">' +
          '<button type="button" class="btn-primary btn" data-prop-approve="' + esc(p.id) + '">Approve</button> ' +
          '<button type="button" class="btn" data-prop-reject="' + esc(p.id) + '">Reject</button></td></tr>';
      }).join("") +
      "</tbody></table></div>";
    box.querySelectorAll("[data-prop-approve]").forEach(function (b) {
      b.addEventListener("click", function () { setPropertyStatus(b.getAttribute("data-prop-approve"), "approved", "live"); });
    });
    box.querySelectorAll("[data-prop-reject]").forEach(function (b) {
      b.addEventListener("click", function () { setPropertyStatus(b.getAttribute("data-prop-reject"), "rejected", "rejected"); });
    });
  }

  async function setPropertyStatus(id, verification, listing) {
    var client = sb();
    var res = await client.from("properties").update({ verification_status: verification, listing_status: listing }).eq("id", id);
    if (res.error) return alert(res.error.message);
    await auditLog("property_status", id + " → " + verification);
    await loadAll();
  }

  function renderVerification() {
    var section = document.getElementById("section-verification");
    if (!section) return;
    var panel = section.querySelector(".panel");
    if (!panel) return;
    var host = panel;
    var list = state.verifications.slice().sort(function (a, b) {
      return new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0);
    });
    if (!list.length) {
      host.innerHTML = '<p class="ov-adm-empty">No verification applications in cloud yet.</p>';
      return;
    }
    host.innerHTML = list.map(function (v) {
      return '<article style="margin-bottom:12px;padding:14px;border:1px solid #e3e8e5;border-radius:12px">' +
        "<h3>" + esc(v.full_name || "Owner") + " · " + esc(v.status) + "</h3>" +
        "<p>ID: " + esc(v.id_type) + " " + esc(v.id_number) + "</p>" +
        "<p>" + esc(v.phone) + " · " + esc(v.city) + "</p>" +
        "<p>" + esc(fmtDate(v.submitted_at)) + "</p>" +
        (v.status === "pending"
          ? '<button type="button" class="btn-primary btn" data-ver-ok="' + esc(v.id) + '">Verify</button> ' +
            '<button type="button" class="btn" data-ver-no="' + esc(v.id) + '">Reject</button>'
          : "") +
        "</article>";
    }).join("");
    host.querySelectorAll("[data-ver-ok]").forEach(function (b) {
      b.addEventListener("click", function () { reviewVerification(b.getAttribute("data-ver-ok"), "verified"); });
    });
    host.querySelectorAll("[data-ver-no]").forEach(function (b) {
      b.addEventListener("click", function () {
        var note = prompt("Rejection reason", "Please resubmit clearer documents.");
        reviewVerification(b.getAttribute("data-ver-no"), "rejected", note);
      });
    });
  }

  async function reviewVerification(id, status, note) {
    var client = sb();
    if (window.LeaseAccomCloud && window.LeaseAccomCloud.reviewOwnerVerification) {
      var r = await window.LeaseAccomCloud.reviewOwnerVerification(id, status, note || "");
      if (!r.ok) return alert(r.error || "Failed");
    } else {
      var res = await client.from("owner_verifications").update({
        status: status,
        review_note: note || null,
        reviewed_at: new Date().toISOString()
      }).eq("id", id).select().maybeSingle();
      if (res.error) return alert(res.error.message);
      if (res.data && res.data.owner_id) {
        await client.from("profiles").update({
          verification_status: status === "verified" ? "verified" : "rejected"
        }).eq("id", res.data.owner_id);
      }
    }
    await auditLog("verification", id + " → " + status);
    await loadAll();
  }

  function renderViewings() {
    var box = document.getElementById("viewingsTable");
    if (!box) return;
    if (!state.viewings.length) {
      box.innerHTML = '<p class="ov-adm-empty">No viewing requests yet.</p>';
      return;
    }
    box.innerHTML = '<table class="admin-table"><thead><tr><th>Property</th><th>Status</th><th>Date</th><th>Created</th></tr></thead><tbody>' +
      state.viewings.map(function (v) {
        return "<tr><td>" + esc(v.property_id) + "</td><td>" + esc(v.status) + "</td><td>" + esc(v.preferred_date || "—") + "</td><td>" + esc(fmtDate(v.created_at)) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function renderApplications() {
    var box = document.getElementById("applicationsTable");
    if (!box) return;
    if (!state.applications.length) {
      box.innerHTML = '<p class="ov-adm-empty">No applications yet.</p>';
      return;
    }
    box.innerHTML = '<table class="admin-table"><thead><tr><th>Property</th><th>Applicant</th><th>Status</th><th>Created</th></tr></thead><tbody>' +
      state.applications.map(function (a) {
        return "<tr><td>" + esc(a.property_title || a.property_id) + "</td><td>" + esc(a.applicant_name || a.applicant_email) + "</td><td>" + esc(a.status) + "</td><td>" + esc(fmtDate(a.created_at)) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function renderReports() {
    var box = document.getElementById("reportsTable");
    if (!box) return;
    var seed = document.getElementById("btnSeedReport");
    if (seed) seed.remove();
    if (!state.reports.length) {
      box.innerHTML = '<p class="ov-adm-empty">No reports yet.</p>';
      return;
    }
    box.innerHTML = '<table class="admin-table"><thead><tr><th>Property</th><th>Reason</th><th>Status</th></tr></thead><tbody>' +
      state.reports.map(function (r) {
        return "<tr><td>" + esc(r.property_id) + "</td><td>" + esc(r.reason) + "</td><td>" + esc(r.status) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function renderPayments() {
    var box = document.getElementById("paymentsTable");
    if (!box) return;
    var seed = document.getElementById("btnSeedPayment");
    if (seed) seed.remove();
    if (!state.payments.length) {
      box.innerHTML = '<p class="ov-adm-empty">No payments yet.</p>';
      return;
    }
    box.innerHTML = '<table class="admin-table"><thead><tr><th>Amount</th><th>Status</th><th>Purpose</th></tr></thead><tbody>' +
      state.payments.map(function (p) {
        return "<tr><td>" + money(p.amount) + "</td><td>" + esc(p.status) + "</td><td>" + esc(p.purpose) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function renderSubscriptions() {
    var plans = document.getElementById("planCards");
    if (plans) {
      plans.innerHTML =
        '<div class="kpi-card"><strong>Free</strong></div><div class="kpi-card"><strong>Professional ₦5k</strong></div>' +
        '<div class="kpi-card"><strong>Business ₦10k</strong></div><div class="kpi-card"><strong>Enterprise ₦20k</strong></div>';
    }
    var box = document.getElementById("subscriptionsTable");
    if (!box) return;
    if (!state.subscriptions.length) {
      box.innerHTML = '<p class="ov-adm-empty">No subscription rows yet.</p>';
      return;
    }
    box.innerHTML = '<table class="admin-table"><thead><tr><th>User</th><th>Plan</th><th>Status</th></tr></thead><tbody>' +
      state.subscriptions.map(function (s) {
        return "<tr><td>" + esc(s.user_id) + "</td><td>" + esc(s.plan_id) + "</td><td>" + esc(s.status) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function renderNotificationsPanel() {
    var box = document.getElementById("notificationsPanel");
    if (!box) return;
    box.innerHTML =
      "<p>Send a notification to a user (profile UUID from Users table).</p>" +
      '<input id="notifUserId" placeholder="User UUID" style="width:100%;padding:8px;margin:6px 0">' +
      '<input id="notifTitle" value="LeaseAccom" style="width:100%;padding:8px;margin:6px 0">' +
      '<textarea id="notifBody" rows="3" style="width:100%;padding:8px;margin:6px 0" placeholder="Message"></textarea>' +
      '<button type="button" class="btn-primary btn" id="btnSendNotif">Send</button>';
    document.getElementById("btnSendNotif").onclick = async function () {
      var client = sb();
      var uid = document.getElementById("notifUserId").value.trim();
      var title = document.getElementById("notifTitle").value.trim();
      var message = document.getElementById("notifBody").value.trim();
      if (!uid || !message) return alert("User id and message required");
      var res = await client.from("notifications").insert({ user_id: uid, title: title || "LeaseAccom", message: message, type: "admin" });
      if (res.error) alert(res.error.message);
      else { alert("Sent"); await auditLog("notify", uid); }
    };
  }

  function renderStaff() {
    var box = document.getElementById("staffPanel");
    if (!box) return;
    var admins = state.users.filter(function (u) { return u.account_type === "admin"; });
    box.innerHTML =
      "<p><strong>Signed in as:</strong> " + esc((state.profile && state.profile.email) || "") + "</p>" +
      "<p>Admin accounts in database: " + admins.length + "</p>" +
      "<p>Bookmark this page for 24/7 access. Only admin role can enter.</p>";
  }

  function renderAudit() {
    var section = document.getElementById("section-audit");
    if (!section) return;
    var panel = section.querySelector(".panel") || section;
    panel.innerHTML = "<h3>Session actions</h3><ul>" +
      state.audit.slice(0, 30).map(function (a) {
        return "<li>" + esc(a.at) + " — " + esc(a.action) + ": " + esc(a.detail) + "</li>";
      }).join("") + (state.audit.length ? "" : "<li>No actions yet this session.</li>") + "</ul>";
  }

  function bindNav() {
    document.querySelectorAll("[data-section]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var id = a.getAttribute("data-section");
        document.querySelectorAll(".admin-nav a").forEach(function (x) { x.classList.toggle("is-active", x === a); });
        document.querySelectorAll(".admin-section").forEach(function (s) {
          s.classList.toggle("is-active", s.getAttribute("data-section-panel") === id);
        });
        var title = document.getElementById("topbarTitle");
        if (title) title.textContent = a.textContent.trim();
      });
    });
    document.querySelectorAll("[data-go]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var link = document.querySelector('.admin-nav a[data-section="' + btn.getAttribute("data-go") + '"]');
        if (link) link.click();
      });
    });
  }

  function bindFilters() {
    ["userSearch", "userType", "userStatus"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener("input", renderUsers); el.addEventListener("change", renderUsers); }
    });
    ["propertySearch", "propertyStatus"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener("input", renderProperties); el.addEventListener("change", renderProperties); }
    });
  }

  async function boot() {
    var setup = document.getElementById("adminSetupBox");
    if (setup) setup.hidden = true;
    var hint = document.getElementById("adminLoginHint");
    if (hint) hint.textContent = "Sign in with your admin email and password. Only account_type = admin can enter.";
    var codeInput = document.getElementById("adminCode");
    if (codeInput) { codeInput.placeholder = "Password"; codeInput.autocomplete = "current-password"; }

    bindNav();
    bindFilters();

    document.getElementById("adminLoginForm").addEventListener("submit", async function (e) {
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
      if (profile) await loadAll();
    });

    var logout = document.getElementById("adminLogout");
    if (logout) {
      logout.addEventListener("click", async function () {
        var client = sb();
        if (client) await client.auth.signOut();
        showLogin("");
      });
    }

    ["btnSeedPayment", "btnSeedReport"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });

    var existing = await requireAdmin();
    if (existing) await loadAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
