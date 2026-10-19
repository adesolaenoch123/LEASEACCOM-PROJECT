/**
 * LeaseAccom admin — pending properties from Supabase
 */
(function () {
  "use strict";

  async function loadPending() {
    var client = window.leaseaccomSupabase || window.leasehubSupabase;
    var box = document.getElementById("adminPendingProperties") || document.getElementById("admPropertyQueue");
    if (!client || !box) return;

    box.innerHTML = "<p>Loading pending listings…</p>";
    try {
      var { data, error } = await client
        .from("properties")
        .select("id, title, city, price, verification_status, listing_status, owner_id, owner_name, created_at")
        .or("verification_status.eq.pending,listing_status.eq.pending")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      var rows = data || [];
      if (!rows.length) {
        box.innerHTML = '<p class="ov-adm-empty">No pending properties.</p>';
        return;
      }
      box.innerHTML = rows.map(function (p) {
        return (
          '<article class="ov-adm-card" data-prop-id="' + p.id + '">' +
          "<h3>" + escapeHtml(p.title || "Listing") + "</h3>" +
          "<p>" + escapeHtml(p.city || "") + " · ₦" + escapeHtml(String(p.price || 0)) + "</p>" +
          "<p>Status: " + escapeHtml(p.verification_status || p.listing_status || "pending") + "</p>" +
          '<div class="ov-adm-actions">' +
          '<button type="button" class="ov-adm-approve" data-approve-prop="' + escapeHtml(p.id) + '">Approve</button>' +
          '<button type="button" class="ov-adm-reject" data-reject-prop="' + escapeHtml(p.id) + '">Reject</button>' +
          "</div></article>"
        );
      }).join("");

      box.querySelectorAll("[data-approve-prop]").forEach(function (btn) {
        btn.addEventListener("click", function () { setPropStatus(btn.getAttribute("data-approve-prop"), "approved", "live"); });
      });
      box.querySelectorAll("[data-reject-prop]").forEach(function (btn) {
        btn.addEventListener("click", function () { setPropStatus(btn.getAttribute("data-reject-prop"), "rejected", "rejected"); });
      });
    } catch (e) {
      box.innerHTML = "<p>Could not load cloud properties. " + escapeHtml(e.message || "") + "</p>";
    }
  }

  async function setPropStatus(id, verification, listing) {
    var client = window.leaseaccomSupabase || window.leasehubSupabase;
    if (!client) return;
    var { error } = await client.from("properties").update({
      verification_status: verification,
      listing_status: listing
    }).eq("id", id);
    if (error) alert(error.message);
    else loadPending();
  }

  function escapeHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  document.addEventListener("DOMContentLoaded", loadPending);
})();
