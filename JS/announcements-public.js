(function () {
  "use strict";
  function sb() {
    return window.leaseaccomSupabase || window.leasehubSupabase || null;
  }
  async function boot() {
    var client = sb();
    if (!client) return;
    try {
      var res = await client
        .from("announcements")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(3);
      var list = res.data || [];
      if (!list.length) return;
      var existing = document.getElementById("laAnnounceBar");
      if (existing) existing.remove();
      var bar = document.createElement("div");
      bar.id = "laAnnounceBar";
      bar.style.cssText =
        "background:#0d7547;color:#fff;padding:10px 14px;font-size:13px;font-weight:600;" +
        "font-family:system-ui,sans-serif;text-align:center;position:relative;z-index:9998";
      bar.innerHTML = list
        .map(function (a) {
          return (
            "<div style='margin:4px 0'><strong>" +
            escapeHtml(a.title) +
            "</strong> — " +
            escapeHtml(a.body) +
            "</div>"
          );
        })
        .join("");
      var close = document.createElement("button");
      close.type = "button";
      close.textContent = "×";
      close.setAttribute("aria-label", "Dismiss");
      close.style.cssText =
        "position:absolute;right:10px;top:8px;background:transparent;border:0;color:#fff;font-size:20px;cursor:pointer";
      close.onclick = function () {
        bar.remove();
        try {
          sessionStorage.setItem("laAnnounceDismissed", "1");
        } catch (e) {}
      };
      try {
        if (sessionStorage.getItem("laAnnounceDismissed") === "1") return;
      } catch (e) {}
      bar.appendChild(close);
      document.body.insertBefore(bar, document.body.firstChild);
    } catch (e) {}
  }
  function escapeHtml(v) {
    return String(v || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
