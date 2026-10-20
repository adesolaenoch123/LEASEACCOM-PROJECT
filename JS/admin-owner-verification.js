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


  async function cloudReview(id, status, note) {
    if (window.LeaseAccomCloud && typeof window.LeaseAccomCloud.reviewOwnerVerification === "function" && id && String(id).indexOf("ov-") !== 0) {
      try {
        return await window.LeaseAccomCloud.reviewOwnerVerification(id, status, note);
      } catch (e) {
        console.warn(e);
      }
    }
    return { ok: false };
  }

  function setUserStatus(email, userId, status, note) {
    var users = readJSON(USERS_KEY, []);
    if (Array.isArray(users)) {
      users.forEach(function (u, i) {
        if (String(u.id) === String(userId) || String(u.email).toLowerCase() === String(email).toLowerCase()) {
          users[i] = Object.assign({}, u, {
            verificationStatus: status,
            ownerVerificationStatus: status,
            verificationNote: note || "",
            verifiedAt: status === "verified" ? new Date().toISOString() : u.verifiedAt
          });
        }
      });
      writeJSON(USERS_KEY, users);
    }
    try {
      var cur = readJSON(CURRENT_KEY, null);
      if (
        cur &&
        (String(cur.id) === String(userId) ||
          String(cur.email).toLowerCase() === String(email).toLowerCase())
      ) {
        cur.verificationStatus = status;
        cur.ownerVerificationStatus = status;
        cur.verificationNote = note || "";
        writeJSON(CURRENT_KEY, cur);
        writeJSON("leaseaccomCurrentUser", cur);
      }
    } catch (e) {}
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

  function render() {
    var queue = readJSON(QUEUE_KEY, []);
    if (!Array.isArray(queue)) queue = [];
    paintQueue(queue);
    loadCloudQueue().then(function (cloudList) {
      if (cloudList && cloudList.length) {
        writeJSON(QUEUE_KEY, cloudList.slice(0, 100));
        paintQueue(cloudList);
      }
    });
  }

  function paintQueue(queue) {
    if (!Array.isArray(queue)) queue = [];

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

    var box = document.getElementById("admOwnerQueue");
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
    var queue = readJSON(QUEUE_KEY, []);
    var item = queue.find(function (q) {
      return String(q.id) === String(id);
    });
    if (!item) return;
    item.status = status;
    item.reviewedAt = new Date().toISOString();
    item.reviewNote = note || "";
    writeJSON(QUEUE_KEY, queue);
    setUserStatus(item.email, item.userId, status, note);
    try {
      var cr = await cloudReview(id, status, note);
      if (cr && cr.ok) {
        console.info("Cloud verification review saved");
      }
    } catch (e) {
      console.warn(e);
    }
    render();
    alert(
      status === "verified"
        ? "Landlord verified. They can proceed to list properties."
        : "Application rejected. Reason saved for the owner."
    );
  }

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
})();
