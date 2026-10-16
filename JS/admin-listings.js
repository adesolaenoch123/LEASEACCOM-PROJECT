/* Phase B: Approve → listingStatus live + verification approved. Reject sets rejected. */
(function () {
  const KEY = "leaseaccomProperties";

  function readProps() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }
  function writeProps(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }
  function esc(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function render() {
    const box = document.getElementById("admListingQueue");
    if (!box) return;
    const props = readProps().slice().reverse();
    if (!props.length) {
      box.innerHTML = '<div class="adm-empty">No owner-submitted listings in this browser yet.</div>';
      return;
    }
    box.innerHTML = props.map(p => {
      const status = String(p.listingStatus || p.verificationStatus || "pending").toLowerCase();
      const photos = Array.isArray(p.images) ? p.images.length : (p.image ? 1 : 0);
      const img = (Array.isArray(p.images) && p.images[0]) || p.image || "";
      const isPending = status === "pending" || status === "pending verification";
      return `<article class="adm-card" data-id="${p.id}">
        <img src="${esc(img)}" alt="">
        <div>
          <h3>${esc(p.title)} <span class="badge ${status === "live" || status === "approved" ? "live" : ""}">${esc(status)}</span></h3>
          <div class="adm-meta">
            <div>${esc(p.location || p.city)} · ₦${Number(p.price||0).toLocaleString("en-NG")} / ${esc(p.period||"year")}</div>
            <div>Photos: ${photos} · Owner: ${esc(p.ownerName || p.ownerId || "—")}</div>
            <div>Submitted: ${esc(p.submittedAt || "—")}</div>
          </div>
          ${isPending ? `<div class="adm-actions">
            <button type="button" class="adm-approve" data-approve="${p.id}">Approve → Live</button>
            <button type="button" class="adm-reject" data-reject="${p.id}">Reject</button>
          </div>` : ""}
        </div>
      </article>`;
    }).join("");

    box.querySelectorAll("[data-approve]").forEach(btn => {
      btn.addEventListener("click", () => setStatus(btn.getAttribute("data-approve"), "live"));
    });
    box.querySelectorAll("[data-reject]").forEach(btn => {
      btn.addEventListener("click", () => setStatus(btn.getAttribute("data-reject"), "rejected"));
    });
  }

  function setStatus(id, status) {
    const props = readProps();
    const i = props.findIndex(p => String(p.id) === String(id));
    if (i < 0) return;
    if (status === "live") {
      props[i].listingStatus = "live";
      props[i].verificationStatus = "approved";
      props[i].verified = true;
      props[i].verificationLabel = "Verified";
    } else {
      props[i].listingStatus = "rejected";
      props[i].verificationStatus = "rejected";
      props[i].verified = false;
      props[i].verificationLabel = "Rejected";
    }
    props[i].reviewedAt = new Date().toISOString();
    writeProps(props);
    render();
    alert(status === "live" ? "Listing is Live on the marketplace." : "Listing rejected.");
  }

  render();
})();
