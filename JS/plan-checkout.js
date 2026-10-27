(function () {
  "use strict";

  var planNames = {
    professional: "Professional",
    business: "Business",
    enterprise: "Enterprise"
  };

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-plan-checkout]");
    if (!button) return;

    var planName = planNames[button.getAttribute("data-plan-checkout")];
    var section = button.closest("[data-plan-section]") || button.closest(".op-admin-wrap");
    var message = section && section.querySelector("[data-plan-message]");
    if (!planName || !message) return;

    message.textContent =
      planName +
      " checkout is not available yet. No payment was taken and your plan has not been changed. Checkout will be enabled after Supabase and payment setup are connected.";
    message.hidden = false;
  });
})();
