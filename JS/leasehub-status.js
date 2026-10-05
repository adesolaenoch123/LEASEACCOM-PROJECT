/**
 * LeaseHub shared status — viewings + applications (same labels both sides)
 */
(function (global) {
  const VIEWING_STEPS = [
    { key: "requested", label: "Requested" },
    { key: "accepted", label: "Accepted" },
    { key: "completed", label: "Completed" }
  ];
  const APPLICATION_STEPS = [
    { key: "submitted", label: "Submitted" },
    { key: "under_review", label: "Under review" },
    { key: "accepted", label: "Accepted" }
  ];

  function normalizeViewingStatus(raw) {
    const s = String(raw || "pending").toLowerCase().replace(/\s+/g, "_");
    if (s === "pending" || s === "requested" || s === "") return "requested";
    if (s === "accepted" || s === "approved" || s === "confirmed") return "accepted";
    if (s === "declined" || s === "rejected" || s === "denied") return "declined";
    if (s === "completed" || s === "done" || s === "finished") return "completed";
    if (s === "cancelled" || s === "canceled") return "cancelled";
    return "requested";
  }

  function normalizeApplicationStatus(raw) {
    const s = String(raw || "pending").toLowerCase().replace(/\s+/g, "_");
    if (s === "pending" || s === "submitted" || s === "") return "submitted";
    if (s === "under_review" || s === "review" || s === "reviewing") return "under_review";
    if (s === "accepted" || s === "approved") return "accepted";
    if (s === "rejected" || s === "declined" || s === "denied") return "rejected";
    if (s === "withdrawn") return "withdrawn";
    return "submitted";
  }

  function viewingLabel(status) {
    const s = normalizeViewingStatus(status);
    return ({ requested: "Requested", accepted: "Accepted", declined: "Declined", completed: "Completed", cancelled: "Cancelled" })[s] || "Requested";
  }

  function applicationLabel(status) {
    const s = normalizeApplicationStatus(status);
    return ({ submitted: "Submitted", under_review: "Under review", accepted: "Accepted", rejected: "Rejected", withdrawn: "Withdrawn" })[s] || "Submitted";
  }

  function viewingClass(status) {
    const s = normalizeViewingStatus(status);
    if (s === "accepted" || s === "completed") return "status-accepted";
    if (s === "declined" || s === "cancelled") return "status-declined";
    return "status-pending";
  }

  function applicationClass(status) {
    const s = normalizeApplicationStatus(status);
    if (s === "accepted") return "status-accepted";
    if (s === "rejected" || s === "withdrawn") return "status-declined";
    if (s === "under_review") return "status-review";
    return "status-pending";
  }

  function timelineHtml(kind, status) {
    const s = kind === "application" ? normalizeApplicationStatus(status) : normalizeViewingStatus(status);
    let steps = kind === "application" ? APPLICATION_STEPS.slice() : VIEWING_STEPS.slice();
    if (kind === "viewing" && s === "declined") steps = [{ key: "requested", label: "Requested" }, { key: "declined", label: "Declined" }];
    if (kind === "viewing" && s === "cancelled") steps = [{ key: "requested", label: "Requested" }, { key: "cancelled", label: "Cancelled" }];
    if (kind === "application" && s === "rejected") steps = [{ key: "submitted", label: "Submitted" }, { key: "rejected", label: "Rejected" }];
    const order = steps.map((x) => x.key);
    let activeIdx = order.indexOf(s);
    if (activeIdx < 0) activeIdx = 0;
    return `<ol class="lh-status-timeline" aria-label="Status timeline">${steps.map((step, i) => {
      let cls = "lh-step";
      if (i < activeIdx) cls += " is-done";
      if (i === activeIdx) cls += " is-current";
      if ((s === "declined" || s === "rejected" || s === "cancelled") && i === activeIdx) cls += " is-bad";
      return `<li class="${cls}"><span class="lh-step-dot"></span><span class="lh-step-label">${step.label}</span></li>`;
    }).join("")}</ol>`;
  }

  function pushHistory(item, status, by) {
    if (!item) return;
    if (!Array.isArray(item.statusHistory)) item.statusHistory = [];
    item.statusHistory.push({ status, at: new Date().toISOString(), by: by || "system" });
    if (item.statusHistory.length > 12) item.statusHistory = item.statusHistory.slice(-12);
  }

  global.LeaseHubStatus = {
    normalizeViewingStatus, normalizeApplicationStatus,
    viewingLabel, applicationLabel, viewingClass, applicationClass,
    timelineHtml, pushHistory, VIEWING_STEPS, APPLICATION_STEPS
  };
})(window);
