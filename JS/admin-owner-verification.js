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

  function render() {
    var queue = readJSON(QUEUE_KEY, []);
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
        if (a.idPreview) {
          previews +=
            '<div style="margin-top:10px"><div style="font-size:11px;font-weight:700;margin-bottom:4px">ID preview</div><img src="' +
            a.idPreview +
            '" alt="ID" style="max-width:180px;border-radius:8px;border:1px solid #e3e8e5"></div>';
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

  function updateItem(id, status, note) {
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
