(function (global) {
  "use strict";

  var dialog;

  function getDialog() {
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.className = "la-plan-checkout";
    dialog.setAttribute("aria-labelledby", "la-plan-checkout-title");
    dialog.innerHTML =
      '<div class="la-plan-checkout__content">' +
      '<button class="la-plan-checkout__close" type="button" aria-label="Close checkout summary">×</button>' +
      '<p class="la-plan-checkout__eyebrow">Checkout preview</p>' +
      '<h2 id="la-plan-checkout-title">Review your plan</h2>' +
      '<dl class="la-plan-checkout__details">' +
      '<div><dt>Plan</dt><dd data-checkout-plan></dd></div>' +
      '<div><dt>Billing</dt><dd data-checkout-billing></dd></div>' +
      '<div><dt>Total</dt><dd data-checkout-amount></dd></div>' +
      "</dl>" +
      '<p class="la-plan-checkout__notice">Secure payment setup is not connected yet. No payment will be taken and your current plan will not change.</p>' +
      '<div class="la-plan-checkout__actions">' +
      '<button class="la-plan-checkout__back" type="button" data-checkout-close>Back to plans</button>' +
      '<button class="la-plan-checkout__pending" type="button" disabled>Payment setup coming soon</button>' +
      "</div>" +
      "</div>";

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog || event.target.closest("[data-checkout-close], .la-plan-checkout__close")) {
        dialog.close();
      }
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function show(intent) {
    if (!intent || !intent.planName || !intent.amount || !/^(monthly|annual)$/.test(intent.billing || "")) {
      return false;
    }

    var checkout = getDialog();
    checkout.querySelector("[data-checkout-plan]").textContent = intent.planName;
    checkout.querySelector("[data-checkout-billing]").textContent =
      intent.billing === "annual" ? "Annual billing" : "Monthly billing";
    checkout.querySelector("[data-checkout-amount]").textContent =
      "₦" + Number(intent.amount).toLocaleString("en-NG");

    if (typeof checkout.showModal === "function") checkout.showModal();
    else checkout.setAttribute("open", "");
    checkout.querySelector(".la-plan-checkout__close").focus();
    return true;
  }

  global.LeaseAccomPlanCheckout = { show: show };
})(window);
