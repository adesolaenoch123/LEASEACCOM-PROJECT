/**
 * LeaseAccom applications UI — owner + tenant
 * Hybrid: API when available, localStorage "rentalApplications" otherwise
 */
(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c];
    });
  }

  function currentUser() {
    try {
      return JSON.parse(
        localStorage.getItem("leaseaccomCurrentUser") ||
          localStorage.getItem("leaseaccomCurrentUser") ||
          "null"
      );
    } catch (e) {
      return null;
    }
  }

  function loadLocal() {
    try {
      const v = JSON.parse(localStorage.getItem("rentalApplications") || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocal(list) {
    localStorage.setItem("rentalApplications", JSON.stringify(list));
  }

  function canUseLocalFallback() {
    const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const apiConfigured = Boolean(
      window.LeaseAccomApi &&
      typeof window.LeaseAccomApi.isConfigured === "function" &&
      window.LeaseAccomApi.isConfigured()
    );
    return (window.LeaseAccomLiveMode ? window.LeaseAccomLiveMode.allowLocalFallback() : isLocalHost);
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  }

  function normalizeStatus(status) {
    if (window.LeaseAccomStatus && window.LeaseAccomStatus.normalizeApplicationStatus) {
      return window.LeaseAccomStatus.normalizeApplicationStatus(status);
    }
    const s = String(status || "submitted").toLowerCase().replace(/\s+/g, "_");
    if (s === "requested" || s === "pending") return "submitted";
    return s;
  }

  function statusLabel(status) {
    if (window.LeaseAccomStatus && window.LeaseAccomStatus.applicationLabel) {
      return window.LeaseAccomStatus.applicationLabel(status);
    }
    const s = normalizeStatus(status);
    if (s === "accepted") return "Accepted";
    if (s === "rejected") return "Rejected";
    if (s === "under_review") return "Under review";
    if (s === "withdrawn") return "Withdrawn";
    return "Submitted";
  }

  function ownerMatches(app, owner) {
    if (!owner) return false;
    const oid = owner.id != null ? String(owner.id) : "";
    const oname = String(owner.name || "").trim().toLowerCase();
    if (app.ownerId != null && oid && String(app.ownerId) === oid) return true;
    if (app.owner_id != null && oid && String(app.owner_id) === oid) return true;
    if (oname && String(app.ownerName || "").trim().toLowerCase() === oname) return true;
    try {
      const props = JSON.parse(localStorage.getItem("leaseaccomProperties") || "[]");
      if (Array.isArray(props)) {
        const ids = props
          .filter(function (p) {
            return oid && String(p.ownerId) === oid;
          })
          .map(function (p) {
            return String(p.id);
          });
        if (ids.indexOf(String(app.propertyId || app.property_id || "")) !== -1) return true;
      }
    } catch (e) {}
    return false;
  }

  function tenantMatches(app, user) {
    if (!user) return false;
    const uid = user.id != null ? String(user.id) : "";
    const email = String(user.email || "").trim().toLowerCase();
    if (uid && String(app.tenantId || app.tenant_id || "") === uid) return true;
    if (email && String(app.applicantEmail || app.tenantEmail || "").toLowerCase() === email) return true;
    if (Array.isArray(user.applications) && user.applications.map(String).indexOf(String(app.id)) !== -1) {
      return true;
    }
    return false;
  }

  function toLocalApplication(record) {
    if (!record) return null;
    return {
      id: String(record.id),
      propertyId: String(record.propertyId || record.property_id || ""),
      propertyTitle: record.propertyTitle || record.property_title || (record.property && record.property.title) || "Property",
      propertyImage: record.propertyImage || record.property_image || "",
      propertyLocation: record.propertyLocation || record.property_location || "",
      propertyPrice: record.propertyPrice || record.property_price,
      propertyPeriod: record.propertyPeriod || record.property_period || "year",
      ownerId: record.ownerId || record.owner_id || "",
      ownerName: record.ownerName || record.owner_name || "Property Owner",
      tenantId: record.tenantId || record.tenant_id || "",
      applicantName: record.applicantName || record.applicant_name || record.name || "Applicant",
      applicantEmail: record.applicantEmail || record.applicant_email || record.email || "",
      applicantPhone: record.applicantPhone || record.applicant_phone || record.phone || "",
      moveInDate: record.moveInDate || record.move_in_date || "",
      message: record.message || "",
      status: normalizeStatus(record.status),
      createdAt: record.createdAt || record.created_at || new Date().toISOString()
    };
  }

  function renderOwnerApplications(records) {
    const list = document.getElementById("ownerRentalApplications");
    const empty = document.getElementById("emptyOwnerApplications");
    const count = document.getElementById("ownerApplicationCount");
    if (!list) return;

    const apps = (records || []).map(toLocalApplication).filter(Boolean);
    if (count) count.textContent = String(apps.length);

    if (!apps.length) {
      list.innerHTML = "";
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    list.innerHTML = apps
      .map(function (application) {
        const status = normalizeStatus(application.status);
        const statusText = statusLabel(status);
        let statusClass = "pending-badge";
        if (status === "accepted") statusClass = "verified-badge";
        if (status === "rejected" || status === "withdrawn") statusClass = "rejected-badge";
        if (status === "under_review") statusClass = "review-badge";

        const timeline = window.LeaseAccomStatus
          ? window.LeaseAccomStatus.timelineHtml("application", status)
          : "";

        let actions = "";
        if (status === "submitted" || status === "pending") {
          actions = `<div class="application-actions">
            <button type="button" class="secondary-btn" data-application-id="${escapeHtml(application.id)}" data-application-status="under_review">Mark under review</button>
            <button type="button" class="primary-btn" data-application-id="${escapeHtml(application.id)}" data-application-status="accepted">Accept</button>
            <button type="button" class="secondary-btn" data-application-id="${escapeHtml(application.id)}" data-application-status="rejected">Reject</button>
          </div>`;
        } else if (status === "under_review") {
          actions = `<div class="application-actions">
            <button type="button" class="primary-btn" data-application-id="${escapeHtml(application.id)}" data-application-status="accepted">Accept</button>
            <button type="button" class="secondary-btn" data-application-id="${escapeHtml(application.id)}" data-application-status="rejected">Reject</button>
          </div>`;
        }

        return `<article class="viewing-card application-card lh-status-card">
          <div class="viewing-card-top">
            <div>
              <span class="section-label">RENTAL APPLICATION</span>
              <h3>${escapeHtml(application.propertyTitle)}</h3>
            </div>
            <span class="${statusClass}">${escapeHtml(statusText)}</span>
          </div>
          <div class="application-details">
            <p><strong>Applicant:</strong> ${escapeHtml(application.applicantName)}</p>
            <p><strong>Email:</strong> ${escapeHtml(application.applicantEmail)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(application.applicantPhone)}</p>
            <p><strong>Move-in:</strong> ${escapeHtml(formatDate(application.moveInDate))}</p>
            <p><strong>Submitted:</strong> ${escapeHtml(formatDate(application.createdAt))}</p>
            ${application.message ? `<div class="application-message"><strong>Message</strong><p>${escapeHtml(application.message)}</p></div>` : ""}
          </div>
          ${timeline}
          ${actions}
        </article>`;
      })
      .join("");

    list.querySelectorAll("[data-application-status]").forEach(function (button) {
      button.addEventListener("click", function () {
        updateApplicationStatus(button.dataset.applicationId, button.dataset.applicationStatus, button);
      });
    });
  }

  function renderTenantApplications(records) {
    const list = document.getElementById("tenantApplicationList");
    if (!list) return;
    const apps = (records || []).map(toLocalApplication).filter(Boolean);
    if (!apps.length) {
      list.innerHTML = `<div class="empty-requests"><h2>No applications yet</h2>
        <p>Apply to rent from a property page. Status updates will show here.</p>
        <a href="properties.html" class="primary-btn">Browse properties</a></div>`;
      return;
    }
    list.innerHTML = apps
      .map(function (application) {
        const status = normalizeStatus(application.status);
        const statusText = statusLabel(status);
        const timeline = window.LeaseAccomStatus
          ? window.LeaseAccomStatus.timelineHtml("application", status)
          : "";
        return `<article class="viewing-card application-card">
          <div class="viewing-card-top">
            <div>
              <span class="section-label">YOUR APPLICATION</span>
              <h3>${escapeHtml(application.propertyTitle)}</h3>
            </div>
            <span class="status-badge">${escapeHtml(statusText)}</span>
          </div>
          <div class="application-details">
            <p><strong>Owner:</strong> ${escapeHtml(application.ownerName)}</p>
            <p><strong>Submitted:</strong> ${escapeHtml(formatDate(application.createdAt))}</p>
            <p><strong>Move-in:</strong> ${escapeHtml(formatDate(application.moveInDate))}</p>
          </div>
          ${timeline}
        </article>`;
      })
      .join("");
  }

  async function updateApplicationStatus(applicationId, status, button) {
    if (button) button.disabled = true;
    let updatedRemotely = false;
    try {
      if (
        window.LeaseAccomApi &&
        window.LeaseAccomApi.isConfigured &&
        window.LeaseAccomApi.isConfigured() &&
        typeof window.LeaseAccomApi.request === "function"
      ) {
        const token = await window.LeaseAccomAuth?.getAccessToken?.();
        if (!token) throw new Error("Please log in again to continue.");
        await window.LeaseAccomApi.request("/applications/" + encodeURIComponent(applicationId), {
          method: "PATCH",
          body: { status: status }
        });
        updatedRemotely = true;
      }
    } catch (e) {
      console.warn("Application status API patch failed.", e);
      if (!canUseLocalFallback()) {
        if (button) button.disabled = false;
        if (typeof window.leaseaccomToast === "function") window.leaseaccomToast("Could not update application status");
        return;
      }
    }

    if (!updatedRemotely) {
      if (!canUseLocalFallback()) {
        if (button) button.disabled = false;
        return;
      }
      const list = loadLocal();
      const idx = list.findIndex(function (item) {
        return String(item.id) === String(applicationId);
      });
      if (idx !== -1) {
        list[idx].status = status;
        list[idx].updatedAt = new Date().toISOString();
        saveLocal(list);
      }
    }

    if (status === "accepted") {
      window.location.href = "rental-agreement.html?applicationId=" + encodeURIComponent(applicationId);
      return;
    }
    loadApplications();
  }

  async function loadApplications() {
    const user = currentUser();
    const isOwnerPage = Boolean(document.getElementById("ownerRentalApplications"));
    const isTenantPage = Boolean(document.getElementById("tenantApplicationList"));
    if (!isOwnerPage && !isTenantPage) return;

    let records = [];
    let apiLoaded = false;

    try {
      if (
        window.LeaseAccomApi &&
        window.LeaseAccomApi.isConfigured &&
        window.LeaseAccomApi.isConfigured() &&
        window.LeaseAccomAuth &&
        typeof window.LeaseAccomAuth.getAccessToken === "function"
      ) {
        const token = await window.LeaseAccomAuth.getAccessToken();
        if (token) {
          const payload = await window.LeaseAccomApi.request("/applications");
          records = Array.isArray(payload.applications) ? payload.applications : [];
          apiLoaded = true;
        }
      }
    } catch (e) {
      console.warn("LeaseAccom: applications API unavailable.", e);
    }

    if (!apiLoaded && canUseLocalFallback()) records = loadLocal();

    if (isOwnerPage) {
      const ownerRecords = records.filter(function (r) {
        return ownerMatches(r, user);
      });
      renderOwnerApplications(ownerRecords);
    }

    if (isTenantPage) {
      const tenantRecords = records.filter(function (r) {
        return tenantMatches(r, user);
      });
      renderTenantApplications(tenantRecords);
    }
  }

  document.addEventListener("DOMContentLoaded", loadApplications);
})();
