/**
 * LeaseAccom owner viewing requests
 * Owner viewing requests are loaded and updated in Supabase.
 */
document.addEventListener("DOMContentLoaded", async function () {
  const container = document.getElementById("ownerViewingRequests");
  if (!container) return;

  const countEl = document.getElementById("ownerViewingCount");
  const emptyEl = document.getElementById("emptyOwnerViewings");

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c];
    });
  }

  function currentOwner() {
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


  function mapCloudViewing(row) {
    return {
      id: row.id,
      propertyId: row.property_id,
      ownerId: row.owner_id,
      tenantId: row.tenant_id,
      status: row.status || "requested",
      date: row.preferred_date || row.viewing_date,
      time: row.preferred_time,
      message: row.message || "",
      createdAt: row.created_at,
      preferredDate: row.preferred_date,
      preferredTime: row.preferred_time
    };
  }

  async function loadCloudRequests(owner) {
    if (!window.LeaseAccomCloud || typeof window.LeaseAccomCloud.listMyViewings !== "function") return null;
    try {
      var res = await window.LeaseAccomCloud.listMyViewings("owner");
      if (!res || !res.ok) return null;
      return (res.data || []).map(mapCloudViewing);
    } catch (e) {
      console.warn(e);
      return null;
    }
  }

  function ownerMatches(request, owner) {
    if (!owner) return false;
    const oid = owner.id != null ? String(owner.id) : "";
    const oname = String(owner.name || "").trim().toLowerCase();
    const oemail = String(owner.email || "").trim().toLowerCase();

    if (request.ownerId != null && oid && String(request.ownerId) === oid) return true;
    if (request.owner_id != null && oid && String(request.owner_id) === oid) return true;
    if (oname && String(request.ownerName || "").trim().toLowerCase() === oname) return true;
    if (oemail && String(request.ownerEmail || "").trim().toLowerCase() === oemail) return true;

    return false;
  }

  function normalize(record) {
    const status = window.LeaseAccomStatus
      ? window.LeaseAccomStatus.normalizeViewingStatus(record.status)
      : String(record.status || "requested").toLowerCase();
    return {
      id: String(record.id),
      propertyId: String(record.propertyId || record.property_id || ""),
      title: record.propertyTitle || record.title || (record.property && record.property.title) || "Property",
      location:
        record.propertyLocation ||
        record.location ||
        (record.property && (record.property.location || record.property.city)) ||
        "",
      viewerName: record.viewerName || record.tenantName || record.tenant_name || record.tenant_full_name || "Tenant",
      title: record.title || record.propertyTitle || record.property_title || record.listing_title || "Property",
      tenantEmail: record.tenantEmail || record.tenant_email || "",
      date: record.viewingDate || record.preferred_date || record.viewing_date || record.date,
      time: record.viewingTime || record.preferred_time || record.time || "",
      notes: record.notes || record.message || "",
      status: status,
      raw: record
    };
  }

  function render(records) {
    const list = (records || []).map(normalize);
    if (countEl) countEl.textContent = String(list.length);

    if (!list.length) {
      container.innerHTML = "";
      container.style.display = "none";
      if (emptyEl) emptyEl.style.display = "block";
      return;
    }

    container.style.display = "grid";
    if (emptyEl) emptyEl.style.display = "none";

    container.innerHTML = list
      .map(function (viewing) {
        const statusClass = ["accepted", "completed"].indexOf(viewing.status) !== -1
          ? "accepted"
          : ["declined", "cancelled"].indexOf(viewing.status) !== -1
            ? "declined"
            : "pending";
        const statusLabel = window.LeaseAccomStatus
          ? window.LeaseAccomStatus.viewingLabel(viewing.status)
          : viewing.status;
        const timeline = window.LeaseAccomStatus
          ? window.LeaseAccomStatus.timelineHtml("viewing", viewing.status)
          : "";
        let date = "Not specified";
        if (viewing.date) {
          const d = new Date(viewing.date);
          if (!isNaN(d.getTime())) {
            date = d.toLocaleDateString("en-NG", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric"
            });
          } else {
            date = String(viewing.date);
          }
        }
        const actions =
          ["requested", "pending"].indexOf(viewing.status) !== -1
            ? `<div class="viewing-request-actions">
            <button type="button" class="accept-viewing-btn primary-btn" data-viewing-status="accepted" data-viewing-id="${escapeHtml(viewing.id)}">Accept</button>
            <button type="button" class="decline-viewing-btn secondary-btn" data-viewing-status="declined" data-viewing-id="${escapeHtml(viewing.id)}">Decline</button>
          </div>`
            : `<p class="owner-muted">Status: ${escapeHtml(statusLabel)}</p>`;

        return `<article class="viewing-card lh-status-card" data-viewing-id="${escapeHtml(viewing.id)}">
          <div class="viewing-card-top">
            <div>
              <span class="section-label">VIEWING REQUEST</span>
              <h3>${escapeHtml(viewing.title || viewing.propertyTitle || viewing.property_title || "Property viewing")}</h3>
            </div>
            <span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
          </div>
          <div class="viewing-card-body">
            <p><strong>Tenant:</strong> ${escapeHtml(viewing.viewerName)}</p>
            ${viewing.tenantEmail ? `<p><strong>Email:</strong> ${escapeHtml(viewing.tenantEmail)}</p>` : ""}
            <p><strong>Preferred date:</strong> ${escapeHtml(date)}</p>
            ${viewing.time ? `<p><strong>Time:</strong> ${escapeHtml(viewing.time)}</p>` : ""}
            ${viewing.location ? `<p><strong>Location:</strong> ${escapeHtml(viewing.location)}</p>` : ""}
            ${viewing.notes ? `<p><strong>Note:</strong> ${escapeHtml(viewing.notes)}</p>` : ""}
          </div>
          ${timeline}
          ${actions}
        </article>`;
      })
      .join("");

    container.querySelectorAll("[data-viewing-status]").forEach(function (button) {
      button.addEventListener("click", function () {
        updateStatus(button.dataset.viewingId, button.dataset.viewingStatus, button);
      });
    });
  }

  async function updateStatus(id, status, button) {
    if (button) button.disabled = true;
    let updatedRemotely = false;
    try {
      if (window.LeaseAccomCloud && typeof window.LeaseAccomCloud.updateViewingStatus === "function") {
        const mapped = status === "accept" || status === "accepted" ? "accepted"
          : status === "decline" || status === "declined" ? "declined"
          : status;
        const cr = await window.LeaseAccomCloud.updateViewingStatus(id, mapped);
        if (cr && cr.ok) updatedRemotely = true;
      }
      if (!updatedRemotely &&
        window.LeaseAccomApi &&
        window.LeaseAccomApi.isConfigured &&
        window.LeaseAccomApi.isConfigured() &&
        typeof window.LeaseAccomApi.request === "function"
      ) {
        const token = await window.LeaseAccomAuth?.getAccessToken?.();
        if (!token) throw new Error("Please log in again to continue.");
        await window.LeaseAccomApi.request("/viewing-requests/" + encodeURIComponent(id), {
          method: "PATCH",
          body: { status: status }
        });
        updatedRemotely = true;
      }
    } catch (error) {
      console.warn("Viewing status API patch failed.", error);
      if (button) button.disabled = false;
      if (typeof window.leaseaccomToast === "function") window.leaseaccomToast("Could not update viewing status");
      return;
    }

    if (!updatedRemotely) {
      if (button) button.disabled = false;
      if (typeof window.leaseaccomToast === "function") window.leaseaccomToast("Viewing request could not be updated in Supabase.");
      return;
    }

    await loadAndRender();
  }

  async function loadAndRender() {
    const owner = currentOwner();
    let records = [];
    let apiLoaded = false;

    // Supabase cloud first
    try {
      if (window.LeaseAccomCloud && typeof window.LeaseAccomCloud.listMyViewings === "function") {
        const cloud = await window.LeaseAccomCloud.listMyViewings("owner");
        if (cloud && cloud.ok && Array.isArray(cloud.data)) {
          records = cloud.data.map(function (row) {
            return {
              id: row.id,
              propertyId: row.property_id,
              ownerId: row.owner_id,
              tenantId: row.tenant_id,
              status: row.status,
              preferred_date: row.preferred_date,
              preferred_time: row.preferred_time,
              message: row.message,
              created_at: row.created_at,
              updatedAt: row.updated_at
            };
          });
          apiLoaded = true;
        }
      }
    } catch (e) {
      console.warn("LeaseAccom cloud viewings:", e);
    }

    // Try API second
    if (!apiLoaded) try {
      if (
        window.LeaseAccomApi &&
        window.LeaseAccomApi.isConfigured &&
        window.LeaseAccomApi.isConfigured() &&
        window.LeaseAccomAuth &&
        typeof window.LeaseAccomAuth.getAccessToken === "function"
      ) {
        const token = await window.LeaseAccomAuth.getAccessToken();
        if (token) {
          const payload = await window.LeaseAccomApi.request("/viewing-requests");
          const apiList = payload.viewing_requests || payload.viewings || payload || [];
          records = Array.isArray(apiList) ? apiList : [];
          apiLoaded = true;
        }
      }
    } catch (e) {
      console.warn("LeaseAccom: owner viewings API unavailable.", e);
    }

    if (!apiLoaded) {
      if (typeof window.leaseaccomToast === "function") window.leaseaccomToast("Viewing requests could not be loaded from Supabase.");
      render([]);
      return;
    }

    records.sort(function (a, b) {
      return (
        new Date(b.updatedAt || b.createdAt || b.created_at || 0) -
        new Date(a.updatedAt || a.createdAt || a.created_at || 0)
      );
    });

    render(records);
  }

  loadAndRender();
});
