/**
 * LeaseAccom owner plans — Professional / Business / Enterprise
 * Matches official pricing. Paystack can hook into selectPlan later.
 */
(function () {
  "use strict";

  var PLANS = {
    professional: {
      id: "professional",
      name: "Professional",
      monthly: 5000,
      annual: 54000,
      maxListings: 5
    },
    business: {
      id: "business",
      name: "Business",
      monthly: 10000,
      annual: 108000,
      maxListings: 10
    },
    enterprise: {
      id: "enterprise",
      name: "Enterprise",
      monthly: 20000,
      annual: 216000,
      maxListings: 30
    }
  };

  var billing = "monthly";

  function money(n) {
    return "₦" + Number(n).toLocaleString("en-NG");
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

  function showCurrentPlan() {
    var el = document.getElementById("currentPlanBox");
    if (!el) return;
    var u = currentUser();
    var plan = (u && (u.plan || u.subscriptionPlan)) || "free";
    el.innerHTML =
      '<div class="box"><div>Your current plan: <span class="chip">' +
      String(plan).charAt(0).toUpperCase() +
      String(plan).slice(1) +
      "</span></div><div style=\"font-size:13px;color:#66706a\">Limits apply when publishing listings.</div></div>";
  }

  function setBilling(mode) {
    billing = mode;
    document.querySelectorAll("[data-billing]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-billing") === mode);
    });
    document.querySelectorAll("[data-price-for]").forEach(function (node) {
      var id = node.getAttribute("data-price-for");
      var p = PLANS[id];
      if (!p) return;
      node.textContent = mode === "annual" ? money(Math.round(p.annual / 12)) : money(p.monthly);
    });
    document.querySelectorAll("[data-annual-note]").forEach(function (node) {
      var id = node.getAttribute("data-annual-note");
      var p = PLANS[id];
      if (!p) return;
      node.textContent =
        mode === "annual"
          ? "Billed annually at " + money(p.annual) + " (10% off)"
          : "Annual: " + money(p.annual) + " (10% off)";
    });
  }

  function selectPlan(planId) {
    var p = PLANS[planId];
    if (!p) return;
    var u = currentUser();
    if (!u) {
      alert("Please sign in as an owner to choose a plan.");
      location.href = "login.html";
      return;
    }
    var intent = {
      planId: p.id,
      planName: p.name,
      billing: billing,
      amount: billing === "annual" ? p.annual : p.monthly,
      at: new Date().toISOString()
    };
    localStorage.setItem("leaseaccomPlanIntent", JSON.stringify(intent));
    // Ready for Paystack: replace alert with gateway when payments go live
    alert(
      "Selected " +
        p.name +
        " (" +
        billing +
        ") — " +
        money(intent.amount) +
        ".\n\nPayment gateway will complete this when Paystack is connected. Your choice is saved."
    );
    if (u) {
      u.plan = p.id;
      u.subscriptionPlan = p.id;
      localStorage.setItem("leaseaccomCurrentUser", JSON.stringify(u));
    }
    showCurrentPlan();
  }

  document.addEventListener("DOMContentLoaded", function () {
    showCurrentPlan();
    setBilling("monthly");
    document.querySelectorAll("[data-billing]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setBilling(btn.getAttribute("data-billing"));
      });
    });
    document.querySelectorAll("[data-select-plan]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectPlan(btn.getAttribute("data-select-plan"));
      });
    });
  });

  window.LeaseAccomPlans = { PLANS: PLANS, selectPlan: selectPlan };
})();
