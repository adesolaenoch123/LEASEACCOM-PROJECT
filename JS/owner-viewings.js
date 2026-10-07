document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("ownerViewingRequests");
  if (!container || !window.LeaseHubApi || !window.LeaseHubAuth) return;

  const count = document.getElementById("ownerViewingCount");
  const empty = document.getElementById("emptyOwnerViewings");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);

  const toViewing = (record) => {
    const property = record.property || {};
    return {
      id: String(record.id),
      title: property.title || "Property",
      location: property.location || property.city || "",
      date: record.preferred_date || record.viewing_date,
      time: record.preferred_time,
      notes: record.notes || record.message,
      status: window.LeaseHubStatus
        ? window.LeaseHubStatus.normalizeViewingStatus(record.status)
        : String(record.status || "requested")
    };
  };

  const render = (records) => {
    if (count) count.textContent = String(records.length);
    if (!records.length) {
      container.replaceChildren();
      container.style.display = "none";
      if (empty) empty.style.display = "block";
      return;
    }

    container.style.display = "grid";
    if (empty) empty.style.display = "none";
    container.innerHTML = records.map((record) => {
      const viewing = toViewing(record);
      const statusClass = ["accepted", "completed"].includes(viewing.status)
        ? "accepted"
        : ["declined", "cancelled"].includes(viewing.status) ? "declined" : "pending";
      const statusLabel = window.LeaseHubStatus
        ? window.LeaseHubStatus.viewingLabel(viewing.status)
        : viewing.status;
      const timeline = window.LeaseHubStatus
        ? window.LeaseHubStatus.timelineHtml("viewing", viewing.status)
        : "";
      const date = viewing.date
        ? new Date(viewing.date).toLocaleDateString("en-NG", { weekday: "short", year: "numeric", month: "short", day: "numeric" })
        : "Not specified";
      const actions = ["requested", "pending"].includes(viewing.status)
        ? `<div class="viewing-request-actions">
            <button class="accept-viewing-btn" data-viewing-status="accepted" data-viewing-id="${escapeHtml(viewing.id)}">Accept request</button>
            <button class="decline-viewing-btn" data-viewing-status="declined" data-viewing-id="${escapeHtml(viewing.id)}">Decline</button>
          </div>`
        : viewing.status === "accepted"
          ? `<div class="viewing-request-actions"><button class="accept-viewing-btn" data-viewing-status="completed" data-viewing-id="${escapeHtml(viewing.id)}">Mark completed</button></div>`
          : `<p class="viewing-request-result">${viewing.status === "completed" ? "Viewing completed." : "Status updated."}</p>`;

      return `<article class="viewing-request-card">
        <div class="viewing-request-header">
          <div><span class="request-label">VIEWING REQUEST</span><h3>${escapeHtml(viewing.title)}</h3></div>
          <span class="request-status status-${statusClass}">${escapeHtml(statusLabel)}</span>
        </div>
        ${viewing.location ? `<p class="request-detail"><small>Location</small><strong>${escapeHtml(viewing.location)}</strong></p>` : ""}
        <p class="request-detail"><small>Tenant</small><strong>Tenant</strong></p>
        <p class="request-detail"><small>Viewing date</small><strong>${escapeHtml(date)}</strong></p>
        <p class="request-detail"><small>Viewing time</small><strong>${escapeHtml(viewing.time || "Not specified")}</strong></p>
        ${viewing.notes ? `<p class="request-detail"><small>Note</small><strong>${escapeHtml(viewing.notes)}</strong></p>` : ""}
        ${actions}${timeline}
      </article>`;
    }).join("");
  };

  const load = async () => {
    const payload = await window.LeaseHubApi.request("/viewing-requests");
    const records = payload.viewing_requests || [];
    window.LeaseHubViewingApiActive = true;
    render(records);
  };

  try {
    const token = await window.LeaseHubAuth.getAccessToken();
    if (!token) return;
    await load();
  } catch (error) {
    console.warn("Backend viewing requests could not be loaded.", error);
    return;
  }

  container.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-viewing-status]");
    if (!button) return;

    button.disabled = true;
    try {
      await window.LeaseHubApi.request(
        `/viewing-requests/${encodeURIComponent(button.dataset.viewingId)}`,
        { method: "PATCH", body: { status: button.dataset.viewingStatus } }
      );
      await load();
    } catch (error) {
      button.disabled = false;
      window.alert(error.message || "Unable to update this viewing request.");
    }
  });
});