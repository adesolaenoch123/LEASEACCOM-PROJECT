(function () {
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);

  const displayStatus = (status) => ({
    submitted: "Submitted",
    pending: "Submitted",
    under_review: "Under review",
    accepted: "Accepted",
    rejected: "Rejected"
  })[status] || "Submitted";

  const formatDate = (value) => {
    if (!value) return "Not specified";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const toLocalApplication = (record) => ({
    ...record,
    propertyId: record.property_id,
    propertyTitle: record.property_title,
    propertyImage: record.property_image,
    propertyLocation: record.property_location,
    propertyPrice: record.property_price,
    propertyPeriod: record.property_period,
    ownerName: record.owner_name,
    applicantName: record.applicant_name,
    applicantEmail: record.applicant_email,
    applicantPhone: record.applicant_phone,
    moveInDate: record.move_in_date,
    tenantId: record.tenant_id,
    ownerId: record.owner_id,
    createdAt: record.created_at,
    status: record.status === "submitted" ? "pending" : record.status
  });

  function renderTenantApplications(records) {
    const list = document.getElementById("tenantApplicationList");
    const empty = document.getElementById("emptyTenantApplications");
    if (!list || !empty) return;

    if (!records.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    list.innerHTML = records.map((record) => {
      const application = toLocalApplication(record);
      const status = record.status;
      const statusText = displayStatus(status);
      const statusClass = status === "accepted" ? "verified-badge" : status === "rejected" ? "rejected-badge" : "pending-badge";
      const trackPosition = status === "accepted" || status === "rejected" ? 3 : status === "under_review" ? 2 : 1;
      const steps = ["Submitted", "Under review", "Decision"];
      return `<article class="viewing-card">
        <div class="viewing-card-top"><div><span class="section-label">APPLICATION</span><h3>${escapeHtml(application.propertyTitle || "Property")}</h3></div><span class="${statusClass}">${statusText}</span></div>
        <div class="leasehub-status-track">${steps.map((step, index) => `<div class="leasehub-status-step ${index < trackPosition ? "is-done" : ""} ${index === trackPosition - 1 ? "is-current" : ""}"><span class="leasehub-status-dot">${index + 1}</span><span>${step}</span></div>`).join("")}</div>
        <p class="leasehub-application-date">Move-in: ${formatDate(application.moveInDate)}</p>
        ${status === "accepted" ? `<a class="primary-btn" href="rental-agreement.html?applicationId=${encodeURIComponent(application.id)}">Open rental agreement</a>` : ""}
      </article>`;
    }).join("");
  }

  function renderOwnerApplications(records) {
    const list = document.getElementById("ownerRentalApplications");
    const empty = document.getElementById("emptyOwnerApplications");
    const count = document.getElementById("ownerApplicationCount");
    if (!list || !empty) return;

    if (count) count.textContent = String(records.length);
    if (!records.length) {
      list.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    list.innerHTML = records.map((record) => {
      const application = toLocalApplication(record);
      const status = record.status;
      const statusText = displayStatus(status);
      const statusClass = status === "accepted" ? "verified-badge" : status === "rejected" ? "rejected-badge" : "pending-badge";
      const canReview = status === "submitted" || status === "under_review";
      const reviewActions = canReview ? `<div class="application-actions">
        <button type="button" class="primary-btn" data-application-status="accepted" data-application-id="${escapeHtml(record.id)}">Accept application</button>
        <button type="button" class="secondary-btn" data-application-status="rejected" data-application-id="${escapeHtml(record.id)}">Reject</button>
      </div>` : `<p class="application-status-message">Application ${statusText.toLowerCase()}.</p>`;
      return `<article class="viewing-card application-card">
        <div class="viewing-card-top"><div><span class="section-label">RENTAL APPLICATION</span><h3>${escapeHtml(application.propertyTitle || "Property")}</h3></div><span class="${statusClass}">${statusText}</span></div>
        <div class="application-details">
          <p><strong>Applicant:</strong> ${escapeHtml(application.applicantName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(application.applicantEmail)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(application.applicantPhone)}</p>
          <p><strong>Move-in date:</strong> ${formatDate(application.moveInDate)}</p>
          <p><strong>Submitted:</strong> ${formatDate(application.createdAt)}</p>
          ${application.message ? `<div class="application-message"><strong>Message from applicant</strong><p>${escapeHtml(application.message)}</p></div>` : ""}
        </div>
        ${reviewActions}
      </article>`;
    }).join("");

    list.querySelectorAll("[data-application-status]").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const applicationId = button.dataset.applicationId;
          const status = button.dataset.applicationStatus;
          const response = await window.LeaseHubApi.request(`/applications/${encodeURIComponent(applicationId)}`, {
            method: "PATCH",
            body: { status }
          });
          const updated = toLocalApplication(response.application);
          let stored = [];
          try {
            stored = JSON.parse(localStorage.getItem("rentalApplications") || "[]");
          } catch {}
          stored = Array.isArray(stored) ? stored : [];
          const index = stored.findIndex((item) => String(item.id) === String(updated.id));
          if (index < 0) stored.push(updated);
          else stored[index] = { ...stored[index], ...updated };
          localStorage.setItem("rentalApplications", JSON.stringify(stored));
          await loadApplications();
          if (status === "accepted") {
            window.location.href = `rental-agreement.html?applicationId=${encodeURIComponent(applicationId)}`;
          }
        } catch (error) {
          button.disabled = false;
          window.alert(error.message || "Unable to update this application.");
        }
      });
    });
  }

  async function loadApplications() {
    const user = (() => {
      try {
        return JSON.parse(localStorage.getItem("leasehubCurrentUser") || "null");
      } catch {
        return null;
      }
    })();
    const isOwnerPage = Boolean(document.getElementById("ownerRentalApplications"));
    const isTenantPage = Boolean(document.getElementById("tenantApplicationList"));
    if (!user || !window.LeaseHubApi || (!isOwnerPage && !isTenantPage)) return;

    try {
      const token = await window.LeaseHubAuth.getAccessToken();
      if (!token) return;
      const payload = await window.LeaseHubApi.request("/applications");
      const records = payload.applications || [];
      if (isOwnerPage) renderOwnerApplications(records);
      if (isTenantPage) renderTenantApplications(records);
    } catch (error) {
      const target = isOwnerPage
        ? document.getElementById("ownerRentalApplications")
        : document.getElementById("tenantApplicationList");
      if (target) target.innerHTML = `<p class="leasehub-application-error">${escapeHtml(error.message || "Applications could not be loaded.")}</p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", loadApplications);
})();
