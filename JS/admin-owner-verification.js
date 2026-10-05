(function () {
  const QUEUE_KEY = "leasehubOwnerVerifications";
  const USERS_KEY = "leasehubUsers";
  const CURRENT_KEY = "leasehubCurrentUser";

  function readJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch { return fallback; }
  }
  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function setUserStatus(email, userId, status, note) {
    const users = readJSON(USERS_KEY, []);
    if (Array.isArray(users)) {
      users.forEach((u, i) => {
        if (String(u.id) === String(userId) || String(u.email || "").toLowerCase() === String(email || "").toLowerCase()) {
          users[i] = {
            ...u,
            verificationStatus: status,
            ownerVerificationStatus: status,
            verificationNote: note || "",
            verifiedAt: status === "verified" ? new Date().toISOString() : u.verifiedAt
          };
        }
      });
      writeJSON(USERS_KEY, users);
    }
    const cur = readJSON(CURRENT_KEY, null);
    if (cur && (String(cur.id) === String(userId) || String(cur.email || "").toLowerCase() === String(email || "").toLowerCase())) {
      cur.verificationStatus = status;
      cur.ownerVerificationStatus = status;
      cur.verificationNote = note || "";
      if (status === "verified") cur.verifiedAt = new Date().toISOString();
      const payload = JSON.stringify(cur);
      localStorage.setItem(CURRENT_KEY, payload);
      localStorage.setItem("leaseHubCurrentUser", payload);
      localStorage.setItem("currentUser", payload);
    }
  }

  function render() {
    const box = document.getElementById("admOwnerQueue");
    if (!box) return;
    const queue = readJSON(QUEUE_KEY, []);
    if (!queue.length) {
      box.innerHTML = '<div class="adm-empty">No owner verification requests yet.</div>';
      return;
    }
    box.innerHTML = queue.map((item) => {
      const a = item.application || {};
      return `<article class="adm-card" data-id="${item.id}">
        <h3>${escapeHtml(a.fullName || item.email)} <small style="color:#888;font-weight:600">(${item.status})</small></h3>
        <div class="adm-meta">
          <div><strong>Email:</strong> ${escapeHtml(item.email || a.email || "—")}</div>
          <div><strong>Phone:</strong> ${escapeHtml(a.phone || "—")}</div>
          <div><strong>City / State:</strong> ${escapeHtml(a.city || "—")}, ${escapeHtml(a.state || "—")}</div>
          <div><strong>ID:</strong> ${escapeHtml(a.idType || "—")} · ${escapeHtml(a.idNumber || "—")}</div>
          <div><strong>Role:</strong> ${escapeHtml(a.listingRole || "—")}</div>
          <div><strong>Submitted:</strong> ${escapeHtml(item.createdAt || a.submittedAt || "—")}</div>
        </div>
        ${item.status === "pending" ? `<div class="adm-actions">
          <button type="button" class="adm-approve" data-approve="${item.id}">Approve (verify)</button>
          <button type="button" class="adm-reject" data-reject="${item.id}">Reject</button>
        </div>` : `<p class="adm-meta">Already ${escapeHtml(item.status)}</p>`}
      </article>`;
    }).join("");

    box.querySelectorAll("[data-approve]").forEach((btn) => {
      btn.addEventListener("click", () => updateItem(btn.getAttribute("data-approve"), "verified"));
    });
    box.querySelectorAll("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const note = prompt("Rejection reason (shown to owner):", "Details could not be confirmed. Please resubmit.");
        updateItem(btn.getAttribute("data-reject"), "rejected", note || "Rejected");
      });
    });
  }

  function updateItem(id, status, note) {
    const queue = readJSON(QUEUE_KEY, []);
    const item = queue.find((q) => String(q.id) === String(id));
    if (!item) return;
    item.status = status;
    item.reviewedAt = new Date().toISOString();
    writeJSON(QUEUE_KEY, queue);
    setUserStatus(item.email, item.userId, status, note);
    render();
    alert(status === "verified" ? "Owner verified. They can list properties now." : "Owner rejected.");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  render();
})();
