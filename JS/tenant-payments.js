(function () {
  "use strict";

  function money(n) {
    var v = Number(n) || 0;
    var sign = v < 0 ? "-" : "";
    return sign + "₦" + Math.abs(v).toLocaleString("en-NG");
  }

  function loadPayments() {
    try {
      var list = JSON.parse(localStorage.getItem("leaseaccomPayments") || "[]");
      if (list.length) return list;
    } catch (e) {}
    // Demo seed so UI is clear
    return [
      {
        id: "1",
        type: "Application fee",
        property: "Modern 2 Bedroom · Lekki",
        amount: 3500,
        status: "paid",
        at: new Date(Date.now() - 2 * 864e5).toISOString()
      },
      {
        id: "2",
        type: "Caution deposit",
        property: "Studio in Yaba",
        amount: 150000,
        status: "paid",
        at: new Date(Date.now() - 10 * 864e5).toISOString()
      },
      {
        id: "3",
        type: "Service fee",
        property: "Office Space Ikeja",
        amount: 5000,
        status: "failed",
        at: new Date(Date.now() - 1 * 864e5).toISOString()
      }
    ];
  }

  var filter = "all";

  function render() {
    var all = loadPayments();
    var paid = all.filter(function (p) { return p.status === "paid"; });
    var failed = all.filter(function (p) { return p.status === "failed"; });
    var totalPaid = paid.reduce(function (s, p) { return s + Math.max(0, Number(p.amount) || 0); }, 0);

    var bal = document.getElementById("payBalance");
    if (bal) bal.textContent = money(totalPaid);
    var s1 = document.getElementById("statPaid");
    var s2 = document.getElementById("statFailed");
    var s3 = document.getElementById("statCount");
    if (s1) s1.textContent = money(totalPaid);
    if (s2) s2.textContent = String(failed.length);
    if (s3) s3.textContent = String(all.length);

    var list = all.filter(function (p) {
      if (filter === "all") return true;
      return p.status === filter;
    });
    var box = document.getElementById("payList");
    if (!box) return;
    if (!list.length) {
      box.innerHTML =
        '<div class="la-pay-empty"><p>No payments in this filter.</p><a href="properties.html">Browse properties</a></div>';
      return;
    }
    box.innerHTML = list
      .map(function (p) {
        var ico =
          p.status === "failed" ? "failed" : Number(p.amount) < 0 ? "refund" : "";
        var statusClass = p.status === "paid" ? "ok" : "bad";
        return (
          '<article class="la-pay-item"><div class="ico ' +
          ico +
          '"><i class="bx bx-receipt"></i></div><div class="meta"><strong>' +
          (p.type || "Payment") +
          "</strong><span>" +
          (p.property || "LeaseAccom") +
          " · " +
          String(p.at || "").slice(0, 10) +
          '</span></div><div class="amt"><span class="' +
          statusClass +
          '">' +
          money(p.amount) +
          "</span><small class=\"" +
          statusClass +
          '">' +
          (p.status || "") +
          "</small></div></article>"
        );
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    render();
    document.querySelectorAll("[data-pay-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        filter = btn.getAttribute("data-pay-filter");
        document.querySelectorAll("[data-pay-filter]").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        render();
      });
    });
  });
})();
