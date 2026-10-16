/**
 * LeaseAccom Admin — Command Centre
 * Working modules: overview charts, users, properties, verification,
 * viewings, applications, payments, subscriptions, reports, audit, CMS, settings.
 */
(function () {
  "use strict";

  var K = {
    staff: "leaseaccomAdminConfig",
    session: "leaseaccomAdminSession",
    props: "leaseaccomProperties",
    users: "leaseaccomUsers",
    reports: "leaseaccomReports",
    payments: "leaseaccomPayments",
    subscriptions: "leaseaccomSubscriptions",
    cms: "leaseaccomCmsPublished",
    settings: "leaseaccomPlatformSettings",
    audit: "leaseaccomAdminAuditLog",
    viewings: "viewingRequests",
    applications: "rentalApplications"
  };

  /* ---------- storage helpers ---------- */
  function read(key, fallback) {
    try {
      var x = JSON.parse(localStorage.getItem(key) || "null");
      return x == null ? fallback : x;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
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
  function audit(action, detail) {
    var a = read(K.audit, []);
    var s = read(K.session, {}) || {};
    a.unshift({
      action: action,
      detail: detail,
      at: new Date().toISOString(),
      actor: s.name || "Admin"
    });
    write(K.audit, a.slice(0, 200));
  }

  /* ---------- auth (hashed access codes) ---------- */
  async function hashAccessCode(code) {
    var data = new TextEncoder().encode(String(code) + "|leaseaccom-admin-v1");
    if (window.crypto && crypto.subtle) {
      var buf = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf))
        .map(function (b) {
          return b.toString(16).padStart(2, "0");
        })
        .join("");
    }
    var h = 0;
    var s = String(code) + "|leaseaccom-admin-v1";
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return "fb_" + Math.abs(h).toString(16);
  }

  function getStaffConfig() {
    // migrate old key if present
    var cfg = read(K.staff, null);
    if (!cfg) {
      var old = read("leaseaccomAdminConfig", null);
      if (old) {
        write(K.staff, old);
        cfg = old;
      }
    }
    return Array.isArray(cfg) ? cfg : [];
  }

  function sessionValid(s) {
    if (!s || !s.email || !s.role) return false;
    if (s.expiresAt && Date.now() > Number(s.expiresAt)) return false;
    return true;
  }

  var loginScreen = document.getElementById("adminLoginScreen");
  var app = document.getElementById("adminApp");
  var adminLoginError = document.getElementById("adminLoginError");

  function currentSession() {
    var s = read(K.session, null) || read("leaseaccomAdminSession", null);
    if (s && !sessionValid(s)) {
      localStorage.removeItem(K.session);
      return null;
    }
    return s;
  }

  function updateLoginMode() {
    var cfg = getStaffConfig();
    var setupBox = document.getElementById("adminSetupBox");
    var hint = document.getElementById("adminLoginHint");
    if (!cfg.length) {
      if (setupBox) setupBox.hidden = false;
      if (hint)
        hint.textContent =
          "First-time setup: create the Super Admin account. Access codes are stored as hashes only.";
    } else {
      if (setupBox) setupBox.hidden = true;
      if (hint) hint.textContent = "Sign in with an approved staff email and access code.";
    }
  }

  function showApp() {
    var s = currentSession();
    if (!s) {
      loginScreen.style.display = "";
      app.classList.remove("is-visible");
      updateLoginMode();
      return;
    }
    loginScreen.style.display = "none";
    app.classList.add("is-visible");
    document.getElementById("adminUserName").textContent = s.name || "Admin";
    document.getElementById("adminRolePill").textContent = s.role || "Staff";
    document.getElementById("sidebarRole").textContent = s.role || "Staff";
    ensureSeedData();
    renderAll();
    openSection(location.hash.replace("#", "") || "overview");
  }

  document.getElementById("adminLoginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    adminLoginError.textContent = "";
    var email = document.getElementById("adminEmail").value.trim().toLowerCase();
    var code = document.getElementById("adminCode").value;
    var cfg = getStaffConfig();
    var codeHash = await hashAccessCode(code);
    var u = cfg.find(function (x) {
      return String(x.email).toLowerCase() === email && x.codeHash === codeHash;
    });
    if (!u) {
      adminLoginError.textContent = "Access denied. Invalid staff credentials.";
      return;
    }
    write(K.session, {
      email: u.email,
      name: u.name,
      role: u.role,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      auth: "local"
    });
    audit("Staff login", "Signed into command centre");
    showApp();
  });

  var setupForm = document.getElementById("adminSetupForm");
  if (setupForm) {
    setupForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (getStaffConfig().length) {
        adminLoginError.textContent = "Staff already configured.";
        return;
      }
      var name = document.getElementById("setupName").value.trim() || "LeaseAccom Admin";
      var email = document.getElementById("setupEmail").value.trim().toLowerCase();
      var code = document.getElementById("setupCode").value;
      var code2 = document.getElementById("setupCode2").value;
      if (!email || !code) {
        adminLoginError.textContent = "Email and code required.";
        return;
      }
      if (code.length < 8) {
        adminLoginError.textContent = "Access code must be at least 8 characters.";
        return;
      }
      if (code !== code2) {
        adminLoginError.textContent = "Access codes do not match.";
        return;
      }
      var codeHash = await hashAccessCode(code);
      write(K.staff, [
        { email: email, name: name, role: "Super Admin", codeHash: codeHash, createdAt: new Date().toISOString() }
      ]);
      write(K.session, {
        email: email,
        name: name,
        role: "Super Admin",
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        auth: "local"
      });
      audit("Admin setup", "First Super Admin created");
      showApp();
    });
  }

  document.getElementById("adminLogout").onclick = function () {
    audit("Staff logout", "Signed out");
    localStorage.removeItem(K.session);
    localStorage.removeItem("leaseaccomAdminSession");
    location.reload();
  };

  /* ---------- seed / load domain data ---------- */
  function users() {
    var u = read(K.users, []);
    if (u.length) return u;
    u = [
      { id: "u1", name: "Amara Okafor", email: "amara@example.com", accountType: "tenant", accountStatus: "active", createdAt: new Date(Date.now() - 12 * 864e5).toISOString() },
      { id: "u2", name: "David Adeyemi", email: "david@example.com", accountType: "owner", accountStatus: "active", createdAt: new Date(Date.now() - 20 * 864e5).toISOString() },
      { id: "u3", name: "Rita Bello", email: "rita@example.com", accountType: "owner", accountStatus: "active", createdAt: new Date(Date.now() - 5 * 864e5).toISOString() },
      { id: "u4", name: "Tunde Musa", email: "tunde@example.com", accountType: "tenant", accountStatus: "suspended", createdAt: new Date(Date.now() - 40 * 864e5).toISOString() }
    ];
    write(K.users, u);
    return u;
  }

  function props() {
    var p = read(K.props, null);
    if (Array.isArray(p) && p.length) return p;
    if (Array.isArray(window.properties) && window.properties.length) {
      p = window.properties.map(function (x) {
        return Object.assign({}, x, {
          verificationStatus: x.verified ? "approved" : x.verificationStatus || "pending"
        });
      });
      write(K.props, p);
      return p;
    }
    p = [
      { id: "1", title: "Modern 2 Bedroom Apartment", city: "Lekki", price: 2800000, verificationStatus: "approved", ownerName: "David Adeyemi" },
      { id: "2", title: "Studio in Yaba", city: "Yaba", price: 900000, verificationStatus: "pending", ownerName: "Rita Bello" },
      { id: "3", title: "Office Space Ikeja", city: "Ikeja", price: 4500000, verificationStatus: "pending", ownerName: "David Adeyemi" },
      { id: "4", title: "Student Room UI", city: "Ibadan", price: 450000, verificationStatus: "rejected", ownerName: "Rita Bello" }
    ];
    write(K.props, p);
    return p;
  }

  function payments() {
    var list = read(K.payments, []);
    if (list.length) return list;
    list = [
      { id: "pay1", user: "David Adeyemi", email: "david@example.com", type: "Subscription · Professional", amount: 5000, status: "paid", at: new Date(Date.now() - 2 * 864e5).toISOString() },
      { id: "pay2", user: "Amara Okafor", email: "amara@example.com", type: "Application fee", amount: 3500, status: "paid", at: new Date(Date.now() - 1 * 864e5).toISOString() },
      { id: "pay3", user: "Rita Bello", email: "rita@example.com", type: "Listing fee", amount: 5000, status: "failed", at: new Date(Date.now() - 3 * 36e5).toISOString() },
      { id: "pay4", user: "Tunde Musa", email: "tunde@example.com", type: "Refund", amount: -7500, status: "refunded", at: new Date(Date.now() - 5 * 864e5).toISOString() }
    ];
    write(K.payments, list);
    return list;
  }

  function subscriptions() {
    var list = read(K.subscriptions, []);
    if (list.length) return list;
    list = [
      { id: "sub1", user: "David Adeyemi", plan: "Professional", status: "active", amount: 5000, renews: new Date(Date.now() + 20 * 864e5).toISOString() },
      { id: "sub2", user: "Rita Bello", plan: "Free", status: "active", amount: 0, renews: null },
      { id: "sub3", user: "Agency NG", plan: "Enterprise", status: "past_due", amount: 20000, renews: new Date(Date.now() - 2 * 864e5).toISOString() }
    ];
    write(K.subscriptions, list);
    return list;
  }

  function reports() {
    var list = read(K.reports, []);
    if (list.length) return list;
    list = [
      { id: "r1", subject: "Suspicious listing photos", property: "Studio in Yaba", status: "Open", at: new Date().toISOString() },
      { id: "r2", subject: "Payment not reflected", property: "—", status: "Investigating", at: new Date(Date.now() - 864e5).toISOString() }
    ];
    write(K.reports, list);
    return list;
  }

  function viewings() {
    return read(K.viewings, []);
  }
  function applications() {
    return read(K.applications, []);
  }

  function ensureSeedData() {
    users();
    props();
    payments();
    subscriptions();
    reports();
  }

  function statusOf(p) {
    return String(p.verificationStatus || (p.verified ? "approved" : "pending")).toLowerCase();
  }

  /* ---------- navigation ---------- */
  var titles = {
    overview: "Overview",
    users: "Users",
    properties: "Properties",
    verification: "Verification",
    viewings: "Viewings & Bookings",
    applications: "Applications",
    payments: "Payments & Finance",
    subscriptions: "Subscriptions & Plans",
    messages: "Messages",
    reports: "Reports & Disputes",
    analytics: "Analytics",
    staff: "Staff & Roles",
    notifications: "Notifications",
    cms: "CMS & Content",
    settings: "Platform Settings",
    audit: "Audit Log"
  };

  function openSection(id) {
    if (!titles[id]) id = "overview";
    document.querySelectorAll(".admin-section").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-section-panel") === id);
    });
    document.querySelectorAll("#adminNav a").forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("data-section") === id);
    });
    document.getElementById("topbarTitle").textContent = titles[id] || id;
    history.replaceState(null, "", "#" + id);
    if (id === "overview" || id === "analytics") {
      setTimeout(drawCharts, 50);
    }
  }

  document.getElementById("adminNav").addEventListener("click", function (e) {
    var a = e.target.closest("a[data-section]");
    if (!a) return;
    e.preventDefault();
    openSection(a.getAttribute("data-section"));
  });

  document.body.addEventListener("click", function (e) {
    var go = e.target.closest("[data-go]");
    if (go) {
      e.preventDefault();
      openSection(go.getAttribute("data-go"));
    }
  });

  window.addEventListener("hashchange", function () {
    openSection(location.hash.replace("#", "") || "overview");
  });

  /* ---------- charts ---------- */
  var chartTraffic, chartRevenue, chartUsers, chartFunnel;

  function animateNumber(el, target, prefix) {
    prefix = prefix || "";
    var start = 0;
    var t0 = performance.now();
    function frame(now) {
      var p = Math.min(1, (now - t0) / 800);
      var val = Math.round(start + (target - start) * p);
      el.textContent = prefix === "₦" ? money(val) : val.toLocaleString();
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function drawCharts() {
    if (typeof Chart === "undefined") return;
    var labels = ["W1", "W2", "W3", "W4", "W5", "W6"];
    var visits = [4200, 5100, 4800, 6200, 7000, 7800];
    var bookings = [180, 220, 210, 260, 310, 340];
    var fees = [1.2, 1.5, 1.4, 1.8, 2.1, 2.0];
    var subs = [2.0, 2.2, 2.4, 2.6, 2.8, 3.1];
    var refunds = [0.2, 0.15, 0.25, 0.1, 0.3, 0.18];

    function line(ctx, id, datasets) {
      if (window[id]) window[id].destroy();
      window[id] = new Chart(ctx, {
        type: "line",
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          animation: { duration: 900 },
          plugins: { legend: { position: "bottom" } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }
    function bar(ctx, id, datasets) {
      if (window[id]) window[id].destroy();
      window[id] = new Chart(ctx, {
        type: "bar",
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          animation: { duration: 900 },
          plugins: { legend: { position: "bottom" } },
          scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
        }
      });
    }

    var t = document.getElementById("chartTraffic");
    var r = document.getElementById("chartRevenue");
    var u = document.getElementById("chartUsers");
    var f = document.getElementById("chartFunnel");
    if (t) {
      line(t, "chartTrafficInst", [
        { label: "Site visits", data: visits, borderColor: "#0d7547", backgroundColor: "rgba(13,117,71,.12)", fill: true, tension: 0.35 },
        { label: "Bookings", data: bookings, borderColor: "#15945c", borderDash: [5, 5], tension: 0.35 }
      ]);
    }
    if (r) {
      bar(r, "chartRevenueInst", [
        { label: "Listing fees (₦m)", data: fees, backgroundColor: "#0d7547" },
        { label: "Subscriptions (₦m)", data: subs, backgroundColor: "#15945c" },
        { label: "Refunds (₦m)", data: refunds.map(function (x) { return -x; }), backgroundColor: "#e14c4c" }
      ]);
    }
    if (u) {
      line(u, "chartUsersInst", [
        { label: "New users", data: [40, 55, 48, 70, 62, 80], borderColor: "#0d7547", fill: true, backgroundColor: "rgba(13,117,71,.1)", tension: 0.3 }
      ]);
    }
    if (f) {
      bar(f, "chartFunnelInst", [
        { label: "Views", data: [1200, 0, 0, 0], backgroundColor: "#b9d7c5" },
        { label: "Viewings", data: [0, 320, 0, 0], backgroundColor: "#15945c" },
        { label: "Applications", data: [0, 0, 90, 0], backgroundColor: "#0d7547" },
        { label: "Paid", data: [0, 0, 0, 35], backgroundColor: "#0b3d2e" }
      ]);
      // simpler funnel chart
      window.chartFunnelInst.destroy();
      window.chartFunnelInst = new Chart(f, {
        type: "bar",
        data: {
          labels: ["Views", "Viewings", "Applications", "Paid"],
          datasets: [{ label: "Count", data: [1200, 320, 90, 35], backgroundColor: ["#b9d7c5", "#8ce0b2", "#15945c", "#0d7547"] }]
        },
        options: { responsive: true, animation: { duration: 900 }, plugins: { legend: { display: false } } }
      });
    }
  }

  /* ---------- renderers ---------- */
  function renderOverview() {
    var p = props();
    var u = users();
    var pay = payments();
    var sub = subscriptions();
    var pending = p.filter(function (x) { return statusOf(x) === "pending"; }).length;
    var approved = p.filter(function (x) { return statusOf(x) === "approved" || statusOf(x) === "live"; }).length;
    var rejected = p.filter(function (x) { return statusOf(x) === "rejected"; }).length;
    var revenue = pay.filter(function (x) { return x.status === "paid"; }).reduce(function (s, x) { return s + Math.max(0, Number(x.amount) || 0); }, 0);
    var activeSubs = sub.filter(function (x) { return x.status === "active"; }).length;
    var openReports = reports().filter(function (x) { return /open|investigating/i.test(x.status); }).length;

    var kpis = [
      { label: "Total users", value: u.length, trend: "+ demo growth" },
      { label: "Live properties", value: approved, trend: "Approved listings" },
      { label: "Pending review", value: pending, trend: "Needs action" },
      { label: "Platform revenue", value: revenue, money: true, trend: "Paid transactions" },
      { label: "Active subscriptions", value: activeSubs, trend: "Owner plans" },
      { label: "Open disputes", value: openReports, trend: openReports ? "Attention" : "Clear", down: !!openReports }
    ];
    var grid = document.getElementById("kpiGrid");
    grid.innerHTML = kpis
      .map(function (k, i) {
        return (
          '<div class="kpi-card"><div class="label">' +
          esc(k.label) +
          '</div><div class="value" data-kpi="' +
          i +
          '">0</div><div class="trend' +
          (k.down ? " down" : "") +
          '">' +
          esc(k.trend) +
          "</div></div>"
        );
      })
      .join("");
    kpis.forEach(function (k, i) {
      var el = grid.querySelector('[data-kpi="' + i + '"]');
      if (el) animateNumber(el, k.value, k.money ? "₦" : "");
    });

    document.getElementById("propertyPipeline").innerHTML = [
      ["Draft", Math.max(0, p.length - pending - approved - rejected)],
      ["Pending", pending],
      ["Approved", approved],
      ["Published", approved],
      ["Rejected", rejected]
    ]
      .map(function (step, idx, arr) {
        return (
          '<div class="pipe-step"><strong>' +
          step[1] +
          "</strong><span>" +
          step[0] +
          "</span></div>" +
          (idx < arr.length - 1 ? '<span class="pipe-arrow">→</span>' : "")
        );
      })
      .join("");

    document.getElementById("overviewPayments").innerHTML =
      '<table class="data"><thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead><tbody>' +
      pay
        .slice(0, 4)
        .map(function (x) {
          var chip =
            x.status === "paid"
              ? "chip"
              : x.status === "failed"
                ? "chip danger"
                : x.status === "refunded"
                  ? "chip muted"
                  : "chip pending";
          return (
            "<tr><td>" +
            esc(x.user) +
            "</td><td>" +
            esc(x.type) +
            "</td><td>" +
            money(x.amount) +
            '</td><td><span class="' +
            chip +
            '">' +
            esc(x.status) +
            "</span></td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";

    var planCount = { Free: 0, Professional: 0, Business: 0 };
    sub.forEach(function (s) {
      planCount[s.plan] = (planCount[s.plan] || 0) + 1;
    });
    document.getElementById("overviewSubs").innerHTML = Object.keys(planCount)
      .map(function (k) {
        return "<p><strong>" + k + "</strong> — " + planCount[k] + " subscribers</p>";
      })
      .join("");

    var alerts = [];
    pay.filter(function (x) { return x.status === "failed"; }).forEach(function (x) {
      alerts.push({ kind: "danger", title: "Failed payment", body: x.user + " · " + money(x.amount) });
    });
    if (pending) alerts.push({ kind: "warn", title: "Listings need review", body: pending + " pending properties" });
    reports()
      .filter(function (x) { return /open/i.test(x.status); })
      .forEach(function (x) {
        alerts.push({ kind: "danger", title: "Open report", body: x.subject });
      });
    if (!alerts.length) alerts.push({ kind: "ok", title: "All clear", body: "No urgent alerts" });
    document.getElementById("overviewAlerts").innerHTML = alerts
      .slice(0, 5)
      .map(function (a) {
        return (
          '<div class="alert-item"><div class="alert-ico ' +
          (a.kind === "warn" ? "warn" : a.kind === "ok" ? "ok" : "") +
          '"><i class="bx bx-error"></i></div><div><strong>' +
          esc(a.title) +
          "</strong><div style=\"color:var(--la-muted);font-size:12px\">" +
          esc(a.body) +
          "</div></div></div>"
        );
      })
      .join("");
  }


  function renderUsers() {
    var listAll = users();
    var tenants = listAll.filter(function (u) { return String(u.accountType || "").toLowerCase().indexOf("owner") < 0 && String(u.accountType || "").toLowerCase() !== "admin"; }).length;
    var owners = listAll.filter(function (u) {
      var t = String(u.accountType || "").toLowerCase();
      return t === "owner" || t === "landlord" || t.indexOf("owner") >= 0;
    }).length;
    var suspended = listAll.filter(function (u) { return String(u.accountStatus || "active") === "suspended"; }).length;
    var stats = document.getElementById("userStatsGrid");
    if (stats) {
      stats.innerHTML =
        '<div class="kpi-card"><div class="label">Total registered</div><div class="value">' + listAll.length + '</div><div class="trend">All accounts</div></div>' +
        '<div class="kpi-card"><div class="label">Tenants</div><div class="value">' + tenants + '</div><div class="trend">Seeking homes</div></div>' +
        '<div class="kpi-card"><div class="label">Owners</div><div class="value">' + owners + '</div><div class="trend">Landlords / agencies</div></div>' +
        '<div class="kpi-card"><div class="label">Suspended</div><div class="value">' + suspended + '</div><div class="trend">Blocked access</div></div>';
    }

    var q = (document.getElementById("userSearch").value || "").toLowerCase();
    var type = document.getElementById("userType").value;
    var st = document.getElementById("userStatus").value;
    var list = listAll.filter(function (u) {
      if (type && String(u.accountType).toLowerCase() !== type) return false;
      if (st && String(u.accountStatus || "active").toLowerCase() !== st) return false;
      if (q && !(String(u.name).toLowerCase().includes(q) || String(u.email).toLowerCase().includes(q))) return false;
      return true;
    });
    document.getElementById("usersTable").innerHTML = list.length
      ? '<table class="data"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Registered</th><th>Status</th><th>Password</th><th>Action</th></tr></thead><tbody>' +
        list
          .map(function (u) {
            var status = String(u.accountStatus || "active");
            var reg = (u.createdAt || u.registeredAt || "").toString().slice(0, 10) || "—";
            return (
              "<tr><td>" +
              esc(u.name) +
              "</td><td>" +
              esc(u.email) +
              "</td><td>" +
              esc(u.phone || "—") +
              "</td><td>" +
              esc(u.accountType) +
              "</td><td>" +
              esc(reg) +
              '</td><td><span class="chip ' +
              (status === "suspended" ? "danger" : "") +
              '">' +
              esc(status) +
              '</span></td><td><span class="chip muted" title="Supabase stores hashed passwords only">Hidden (hashed)</span></td><td><button type="button" class="btn" data-user-toggle="' +
              esc(u.id) +
              '">' +
              (status === "suspended" ? "Reactivate" : "Suspend") +
              '</button> <button type="button" class="btn" data-user-reset="' +
              esc(u.email) +
              '">Reset link</button></td></tr>'
            );
          })
          .join("") +
        "</tbody></table>" +
        '<p style="font-size:12px;color:var(--la-muted);margin-top:10px">Security: plaintext passwords cannot be shown. Supabase Auth stores one-way hashes only. Use Reset link to email a secure reset.</p>'
      : '<div class="empty">No users match your filters. Connect Supabase Auth users or register accounts on the site.</div>';
  }

  function renderProperties() {
    var q = (document.getElementById("propertySearch").value || "").toLowerCase();
    var st = document.getElementById("propertyStatus").value;
    var list = props().filter(function (p) {
      var s = statusOf(p);
      if (st === "pending" && s !== "pending") return false;
      if (st === "approved" && s !== "approved" && s !== "live") return false;
      if (st === "rejected" && s !== "rejected") return false;
      if (q && !(String(p.title).toLowerCase().includes(q) || String(p.city).toLowerCase().includes(q))) return false;
      return true;
    });
    document.getElementById("propertiesTable").innerHTML = list.length
      ? '<table class="data"><thead><tr><th>Title</th><th>City</th><th>Price</th><th>Owner</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
        list
          .map(function (p) {
            var s = statusOf(p);
            return (
              "<tr><td>" +
              esc(p.title) +
              "</td><td>" +
              esc(p.city) +
              "</td><td>" +
              money(p.price) +
              "</td><td>" +
              esc(p.ownerName || "—") +
              '</td><td><span class="chip ' +
              (s === "pending" ? "pending" : s === "rejected" ? "danger" : "") +
              '">' +
              esc(s) +
              '</span></td><td style="white-space:nowrap">' +
              '<button type="button" class="btn btn-soft" data-prop="' +
              esc(p.id) +
              '" data-prop-action="approve">Approve</button> ' +
              '<button type="button" class="btn" data-prop="' +
              esc(p.id) +
              '" data-prop-action="reject">Reject</button> ' +
              '<button type="button" class="btn btn-danger" data-prop="' +
              esc(p.id) +
              '" data-prop-action="delete">Delete</button></td></tr>'
            );
          })
          .join("") +
        "</tbody></table>"
      : '<div class="empty">No properties found.</div>';
  }

  function renderVerification() {
    var list = props().filter(function (p) {
      return statusOf(p) === "pending";
    });
    document.getElementById("verificationQueue").innerHTML = list.length
      ? '<table class="data"><thead><tr><th>Listing</th><th>Owner</th><th>City</th><th>Action</th></tr></thead><tbody>' +
        list
          .map(function (p) {
            return (
              "<tr><td>" +
              esc(p.title) +
              "</td><td>" +
              esc(p.ownerName || "—") +
              "</td><td>" +
              esc(p.city) +
              '</td><td><button type="button" class="btn btn-primary" data-prop="' +
              esc(p.id) +
              '" data-prop-action="approve">Approve &amp; publish</button> ' +
              '<button type="button" class="btn" data-prop="' +
              esc(p.id) +
              '" data-prop-action="reject">Reject</button></td></tr>'
            );
          })
          .join("") +
        "</tbody></table>"
      : '<div class="empty">Verification queue is clear.</div>';
  }

  function renderViewings() {
    var list = viewings();
    document.getElementById("viewingsTable").innerHTML = list.length
      ? '<table class="data"><thead><tr><th>Property</th><th>Tenant</th><th>Date</th><th>Status</th></tr></thead><tbody>' +
        list
          .map(function (v) {
            return (
              "<tr><td>" +
              esc(v.propertyTitle || v.title || "Property") +
              "</td><td>" +
              esc(v.viewerName || v.tenantName || "—") +
              "</td><td>" +
              esc(v.viewingDate || v.date || "—") +
              '</td><td><span class="chip">' +
              esc(v.status || "requested") +
              "</span></td></tr>"
            );
          })
          .join("") +
        "</tbody></table>"
      : '<div class="empty">No viewing requests in storage yet. They appear when tenants submit from property pages.</div>';
  }

  function renderApplications() {
    var list = applications();
    document.getElementById("applicationsTable").innerHTML = list.length
      ? '<table class="data"><thead><tr><th>Property</th><th>Applicant</th><th>Status</th><th>Submitted</th></tr></thead><tbody>' +
        list
          .map(function (a) {
            return (
              "<tr><td>" +
              esc(a.propertyTitle || "Property") +
              "</td><td>" +
              esc(a.applicantName || "—") +
              '</td><td><span class="chip">' +
              esc(a.status || "submitted") +
              "</span></td><td>" +
              esc((a.createdAt || "").slice(0, 10)) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>"
      : '<div class="empty">No rental applications stored yet.</div>';
  }

  function renderPayments() {
    var st = document.getElementById("paymentStatusFilter").value;
    var list = payments().filter(function (p) {
      return !st || p.status === st;
    });
    document.getElementById("paymentsTable").innerHTML = list.length
      ? '<table class="data"><thead><tr><th>Date</th><th>User</th><th>Type</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
        list
          .map(function (p) {
            var chip =
              p.status === "paid" ? "chip" : p.status === "failed" ? "chip danger" : p.status === "refunded" ? "chip muted" : "chip pending";
            return (
              "<tr><td>" +
              esc((p.at || "").slice(0, 16).replace("T", " ")) +
              "</td><td>" +
              esc(p.user) +
              "</td><td>" +
              esc(p.type) +
              "</td><td>" +
              money(p.amount) +
              '</td><td><span class="' +
              chip +
              '">' +
              esc(p.status) +
              "</span></td><td>" +
              (p.status === "paid"
                ? '<button type="button" class="btn" data-pay-refund="' + esc(p.id) + '">Refund</button>'
                : p.status === "failed"
                  ? '<button type="button" class="btn btn-soft" data-pay-retry="' + esc(p.id) + '">Mark paid</button>'
                  : "—") +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>"
      : '<div class="empty">No payments.</div>';
  }


  function renderSubscriptions() {
    var plans = [
      {
        name: "Professional",
        price: "₦5,000",
        period: "/ month",
        annual: "Annual: ₦54,000 (10% off)",
        audience: "Individual landlords and small property owners",
        features: [
          "Up to 5 active listings",
          "Up to 15 photos per listing",
          "1 video per listing",
          "Property verification eligibility",
          "Standard search placement",
          "Availability calendar",
          "Tenant enquiries & in-app chat",
          "Viewing request management",
          "Application tracking",
          "Basic dashboard & analytics",
          "Email support",
          "5% transaction fee discount"
        ]
      },
      {
        name: "Business",
        price: "₦10,000",
        period: "/ month",
        annual: "Annual: ₦108,000 (10% off)",
        popular: true,
        audience: "Growing landlords and property managers",
        features: [
          "Up to 10 active listings",
          "Up to 20 photos per listing",
          "Up to 3 videos per listing",
          "Priority search placement",
          "Everything in Professional",
          "Advanced property & enquiry analytics",
          "Lead tracking & applicant management",
          "Bulk listing management",
          "Dedicated account manager support",
          "Ad-free experience",
          "10% transaction fee discount"
        ]
      },
      {
        name: "Enterprise",
        price: "₦20,000",
        period: "/ month",
        annual: "Annual: ₦216,000 (10% off)",
        audience: "Agencies, hotels and large property businesses",
        features: [
          "Up to 30 active listings",
          "Up to 20 photos per listing",
          "Up to 3 videos per listing",
          "Everything in Business",
          "AI assistant (100 requests / month)",
          "Dedicated company storefront",
          "Branded company profile",
          "Featured on landing page (subject to availability)",
          "Advanced portfolio analytics",
          "Priority customer support",
          "Company advertising (optional add-on)",
          "15% transaction fee discount"
        ]
      }
    ];

    document.getElementById("planCards").innerHTML = plans
      .map(function (pl) {
        return (
          '<div class="plan-card"' +
          (pl.popular ? ' style="border-color:#0d7547;box-shadow:0 0 0 2px rgba(13,117,71,.15)"' : "") +
          ">" +
          (pl.popular ? '<div class="chip" style="margin-bottom:8px">Most Popular</div>' : "") +
          "<h4>" +
          pl.name +
          "</h4><p style=\"font-size:12px;color:var(--la-muted);margin:0 0 8px\">" +
          pl.audience +
          '</p><div class="price">' +
          pl.price +
          ' <span style="font-size:13px;font-weight:600;color:var(--la-muted)">' +
          pl.period +
          "</span></div>" +
          '<div style="font-size:12px;color:var(--la-green);font-weight:700;margin:4px 0 10px">' +
          pl.annual +
          "</div><ul>" +
          pl.features.map(function (f) { return "<li>" + f + "</li>"; }).join("") +
          "</ul></div>"
        );
      })
      .join("");

    var list = subscriptions();
    document.getElementById("subscriptionsTable").innerHTML =
      '<table class="data"><thead><tr><th>Owner</th><th>Plan</th><th>Status</th><th>Amount</th><th>Renews</th></tr></thead><tbody>' +
      list
        .map(function (s) {
          return (
            "<tr><td>" +
            esc(s.user) +
            "</td><td>" +
            esc(s.plan) +
            '</td><td><span class="chip ' +
            (s.status === "past_due" ? "danger" : "") +
            '">' +
            esc(s.status) +
            "</span></td><td>" +
            money(s.amount) +
            "</td><td>" +
            esc(s.renews ? s.renews.slice(0, 10) : "—") +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";
  }

  function renderMessages() {
    document.getElementById("messagesPanel").innerHTML =
      '<div class="empty">Message oversight connects to the shared messages store when conversations exist. Abuse reports appear under Reports.</div>';
  }

  function renderReports() {
    var list = reports();
    document.getElementById("reportsTable").innerHTML = list.length
      ? '<table class="data"><thead><tr><th>Subject</th><th>Property</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
        list
          .map(function (r) {
            return (
              "<tr><td>" +
              esc(r.subject) +
              "</td><td>" +
              esc(r.property) +
              '</td><td><span class="chip pending">' +
              esc(r.status) +
              '</span></td><td><button type="button" class="btn" data-report="' +
              esc(r.id) +
              '" data-report-action="investigate">Investigate</button> ' +
              '<button type="button" class="btn btn-soft" data-report="' +
              esc(r.id) +
              '" data-report-action="resolve">Resolve</button></td></tr>'
            );
          })
          .join("") +
        "</tbody></table>"
      : '<div class="empty">No reports.</div>';
  }

  function renderStaff() {
    var cfg = getStaffConfig();
    document.getElementById("staffPanel").innerHTML =
      "<p><strong>Configured staff accounts</strong></p><ul>" +
      cfg
        .map(function (s) {
          return "<li>" + esc(s.name) + " — " + esc(s.email) + " (" + esc(s.role) + ")</li>";
        })
        .join("") +
      "</ul><p style=\"color:var(--la-muted);font-size:13px;margin-top:12px\">Roles: Super Admin (full), Verification Staff (listings), Support (users & disputes). Public registration cannot create staff.</p>";
  }

  function renderNotifications() {
    document.getElementById("notificationsPanel").innerHTML =
      "<ul><li>Listing approved → owner</li><li>Payment failed → payer</li><li>New viewing request → owner</li><li>Application decision → tenant</li></ul><p style=\"color:var(--la-muted);font-size:13px\">Templates will send when notification backend is connected.</p>";
  }


  function defaultBrand() {
    return {
      appName: "LeaseAccom",
      tagline: "Accommodation made easy",
      logoUrl: "IMAGES/leaseaccom-logo-horizontal.svg",
      logoIconUrl: "IMAGES/leaseaccom-logo.svg",
      colorPrimary: "#0d7547",
      colorSecondary: "#15945c",
      colorBg: "#f5f7f6",
      colorInk: "#101311",
      heroTitle: "Find your place without the unnecessary stress.",
      heroSubtitle: "Search verified properties across Nigeria.",
      heroVideo: "hero-banner.mp4",
      bannerImage: "",
      footer: "© 2026 LeaseAccom. All rights reserved."
    };
  }

  function renderCms() {
    var cms = Object.assign(defaultBrand(), read(K.cms, {}));
    var map = {
      cmsAppName: "appName",
      cmsTagline: "tagline",
      cmsLogoUrl: "logoUrl",
      cmsLogoIconUrl: "logoIconUrl",
      cmsColorPrimary: "colorPrimary",
      cmsColorSecondary: "colorSecondary",
      cmsColorBg: "colorBg",
      cmsColorInk: "colorInk",
      cmsHeroTitle: "heroTitle",
      cmsHeroSub: "heroSubtitle",
      cmsHeroVideo: "heroVideo",
      cmsBannerImage: "bannerImage",
      cmsFooter: "footer"
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = cms[map[id]] || "";
    });
    updateBrandPreview();
  }

  function updateBrandPreview() {
    var primary = (document.getElementById("cmsColorPrimary") || {}).value || "#0d7547";
    var bg = (document.getElementById("cmsColorBg") || {}).value || "#f5f7f6";
    var ink = (document.getElementById("cmsColorInk") || {}).value || "#101311";
    var name = (document.getElementById("cmsAppName") || {}).value || "LeaseAccom";
    var tag = (document.getElementById("cmsTagline") || {}).value || "";
    var box = document.getElementById("brandPreview");
    if (!box) return;
    box.style.background = bg;
    box.style.color = ink;
    document.getElementById("previewName").textContent = name;
    document.getElementById("previewTag").textContent = tag;
    var btn = document.getElementById("previewBtn");
    if (btn) btn.style.background = primary;
  }

  function collectBrand() {
    return {
      appName: document.getElementById("cmsAppName").value.trim() || "LeaseAccom",
      tagline: document.getElementById("cmsTagline").value.trim(),
      logoUrl: document.getElementById("cmsLogoUrl").value.trim(),
      logoIconUrl: document.getElementById("cmsLogoIconUrl").value.trim(),
      colorPrimary: document.getElementById("cmsColorPrimary").value,
      colorSecondary: document.getElementById("cmsColorSecondary").value,
      colorBg: document.getElementById("cmsColorBg").value,
      colorInk: document.getElementById("cmsColorInk").value,
      heroTitle: document.getElementById("cmsHeroTitle").value,
      heroSubtitle: document.getElementById("cmsHeroSub").value,
      heroVideo: document.getElementById("cmsHeroVideo").value.trim(),
      bannerImage: document.getElementById("cmsBannerImage").value.trim(),
      footer: document.getElementById("cmsFooter").value.trim(),
      updatedAt: new Date().toISOString()
    };
  }

  function renderSettings() {
    var s = read(K.settings, { currency: "NGN", minPhotos: 4, feePercent: 5, maintenance: false });
    document.getElementById("setCurrency").value = s.currency || "NGN";
    document.getElementById("setMinPhotos").value = s.minPhotos || 4;
    document.getElementById("setFee").value = s.feePercent || 5;
    document.getElementById("setMaintenance").checked = !!s.maintenance;
  }

  function renderAudit() {
    var list = read(K.audit, []);
    document.getElementById("auditList").innerHTML = list.length
      ? list
          .map(function (a) {
            return (
              '<div class="activity-item"><div><strong>' +
              esc(a.action) +
              "</strong> — " +
              esc(a.detail) +
              '<div style="font-size:12px;color:var(--la-muted)">' +
              esc(a.actor) +
              " · " +
              esc(a.at) +
              "</div></div></div>"
            );
          })
          .join("")
      : '<div class="empty">No audit events yet.</div>';
  }

  function renderAll() {
    renderOverview();
    renderUsers();
    renderProperties();
    renderVerification();
    renderViewings();
    renderApplications();
    renderPayments();
    renderSubscriptions();
    renderMessages();
    renderReports();
    renderStaff();
    renderNotifications();
    renderCms();
    renderSettings();
    renderAudit();
    drawCharts();
  }

  /* ---------- actions ---------- */
  document.body.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;

    if (btn.dataset.userToggle) {
      var list = users();
      var u = list.find(function (x) { return String(x.id) === String(btn.dataset.userToggle); });
      if (!u) return;
      u.accountStatus = u.accountStatus === "suspended" ? "active" : "suspended";
      write(K.users, list);
      audit("User " + u.accountStatus, u.name);
      renderUsers();
      renderOverview();
      return;
    }

    if (btn.dataset.prop && btn.dataset.propAction) {
      var pl = props();
      var i = pl.findIndex(function (x) { return String(x.id) === String(btn.dataset.prop); });
      if (i < 0) return;
      var action = btn.dataset.propAction;
      if (action === "delete") {
        if (!confirm("Delete this property?")) return;
        var title = pl[i].title;
        pl.splice(i, 1);
        write(K.props, pl);
        audit("Property deleted", title);
      } else if (action === "approve") {
        pl[i].verificationStatus = "approved";
        pl[i].verified = true;
        write(K.props, pl);
        audit("Property approved", pl[i].title);
      } else if (action === "reject") {
        var reason = prompt("Rejection reason (shown to owner):", "Incomplete photos or details");
        pl[i].verificationStatus = "rejected";
        pl[i].verified = false;
        pl[i].rejectionReason = reason || "Rejected by admin";
        write(K.props, pl);
        audit("Property rejected", pl[i].title + " — " + pl[i].rejectionReason);
      }
      renderProperties();
      renderVerification();
      renderOverview();
      return;
    }

    if (btn.dataset.payRefund) {
      var pays = payments();
      var pay = pays.find(function (x) { return x.id === btn.dataset.payRefund; });
      if (!pay) return;
      pay.status = "refunded";
      pay.amount = -Math.abs(Number(pay.amount) || 0);
      write(K.payments, pays);
      audit("Payment refunded", pay.user + " " + pay.id);
      renderPayments();
      renderOverview();
      return;
    }

    if (btn.dataset.payRetry) {
      var pays2 = payments();
      var pay2 = pays2.find(function (x) { return x.id === btn.dataset.payRetry; });
      if (!pay2) return;
      pay2.status = "paid";
      write(K.payments, pays2);
      audit("Payment marked paid", pay2.user);
      renderPayments();
      renderOverview();
      return;
    }

    if (btn.dataset.report && btn.dataset.reportAction) {
      var rs = reports();
      var r = rs.find(function (x) { return x.id === btn.dataset.report; });
      if (!r) return;
      r.status = btn.dataset.reportAction === "investigate" ? "Investigating" : "Resolved";
      write(K.reports, rs);
      audit("Report " + r.status, r.subject);
      renderReports();
      renderOverview();
    }
  });

  ["userSearch", "userType", "userStatus"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", renderUsers);
  });
  ["propertySearch", "propertyStatus"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", renderProperties);
  });
  var pf = document.getElementById("paymentStatusFilter");
  if (pf) pf.addEventListener("change", renderPayments);

  document.getElementById("btnSeedPayment").onclick = function () {
    var list = payments();
    list.unshift({
      id: "pay" + Date.now(),
      user: "Demo User",
      email: "demo@leaseaccom.ng",
      type: "Listing fee",
      amount: 5000,
      status: "pending",
      at: new Date().toISOString()
    });
    write(K.payments, list);
    audit("Demo payment added", "Listing fee pending");
    renderPayments();
    renderOverview();
  };

  document.getElementById("btnSeedReport").onclick = function () {
    var list = reports();
    list.unshift({
      id: "r" + Date.now(),
      subject: "User-submitted report",
      property: "Modern 2 Bedroom Apartment",
      status: "Open",
      at: new Date().toISOString()
    });
    write(K.reports, list);
    audit("Demo report added", "Open");
    renderReports();
    renderOverview();
  };

  document.getElementById("cmsForm").onsubmit = function (e) {
    e.preventDefault();
    var brand = collectBrand();
    write(K.cms, brand);
    // also publish under keys the public site can read
    write("leaseaccomBrandConfig", brand);
    write("leaseaccomCmsPublished", brand);
    audit("Brand CMS published", brand.appName + " colours/media updated");
    document.getElementById("cmsStatus").textContent = "Published — public pages will pick this up.";
    updateBrandPreview();
  };

  ["cmsColorPrimary", "cmsColorSecondary", "cmsColorBg", "cmsColorInk", "cmsAppName", "cmsTagline"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", updateBrandPreview);
  });

  document.body.addEventListener("click", function (e) {
    var reset = e.target.closest("[data-user-reset]");
    if (reset) {
      var email = reset.getAttribute("data-user-reset");
      audit("Password reset requested", email);
      alert("Password reset: for Supabase users, send a reset email from Supabase Auth (Dashboard → Authentication → Users) or your API. Plaintext passwords are never available.");
    }
  });

  document.getElementById("settingsForm").onsubmit = function (e) {
    e.preventDefault();
    write(K.settings, {
      currency: document.getElementById("setCurrency").value,
      minPhotos: Number(document.getElementById("setMinPhotos").value) || 4,
      feePercent: Number(document.getElementById("setFee").value) || 0,
      maintenance: document.getElementById("setMaintenance").checked
    });
    audit("Settings updated", "Platform settings");
    document.getElementById("settingsStatus").textContent = "Saved.";
  };

  document.getElementById("btnExportOverview").onclick = function () {
    var blob = new Blob(
      [JSON.stringify({ users: users(), properties: props(), payments: payments(), exportedAt: new Date().toISOString() }, null, 2)],
      { type: "application/json" }
    );
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "leaseaccom-admin-export.json";
    a.click();
    audit("Export", "Overview data downloaded");
  };

  /* boot */
  showApp();
})();
