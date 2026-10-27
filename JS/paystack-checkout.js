/**
 * LeaseAccom — Paystack Inline checkout for owner plans
 * Amounts are in Naira; Paystack expects kobo (x100).
 */
(function (global) {
  "use strict";

  var cachedPublicKey = null;

  function sb() {
    return global.leaseaccomSupabase || global.leasehubSupabase || null;
  }

  function currentUser() {
    try {
      return (
        JSON.parse(localStorage.getItem("leaseaccomCurrentUser") || "null") ||
        JSON.parse(localStorage.getItem("leasehubCurrentUser") || "null")
      );
    } catch (e) {
      return null;
    }
  }

  async function getPublicKey() {
    if (cachedPublicKey) return cachedPublicKey;
    if (global.PAYSTACK_PUBLIC_KEY) {
      cachedPublicKey = global.PAYSTACK_PUBLIC_KEY;
      return cachedPublicKey;
    }
    var client = sb();
    if (client) {
      try {
        var res = await client
          .from("platform_settings")
          .select("value")
          .eq("key", "payments_config")
          .maybeSingle();
        if (res.data && res.data.value && res.data.value.paystackPublicKey) {
          cachedPublicKey = res.data.value.paystackPublicKey;
          return cachedPublicKey;
        }
      } catch (e) {}
    }
    try {
      var local = JSON.parse(localStorage.getItem("leaseaccomPaymentsConfig") || "{}");
      if (local.paystackPublicKey) {
        cachedPublicKey = local.paystackPublicKey;
        return cachedPublicKey;
      }
    } catch (e2) {}
    return null;
  }

  function loadPaystackScript() {
    return new Promise(function (resolve, reject) {
      if (global.PaystackPop) {
        resolve();
        return;
      }
      var s = document.createElement("script");
      s.src = "https://js.paystack.co/v1/inline.js";
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("Could not load Paystack"));
      };
      document.head.appendChild(s);
    });
  }

  async function activatePlan(user, planId, reference, amount, billing) {
    var client = sb();
    var uid = user && (user.id || user.userId);
    user.plan = planId;
    user.subscriptionPlan = planId;
    try {
      localStorage.setItem("leaseaccomCurrentUser", JSON.stringify(user));
      localStorage.setItem("leasehubCurrentUser", JSON.stringify(user));
    } catch (e) {}

    if (client && uid) {
      try {
        await client
          .from("profiles")
          .update({ plan: planId, subscription_plan: planId })
          .eq("id", uid);
      } catch (e) {}
      try {
        await client.from("payments").insert({
          user_id: uid,
          amount: amount,
          currency: "NGN",
          status: "success",
          provider: "paystack",
          reference: reference,
          description: "Plan: " + planId + " (" + billing + ")",
          meta: { planId: planId, billing: billing }
        });
      } catch (e2) {
        console.warn("payments insert", e2);
      }
      try {
        await client.from("subscriptions").upsert(
          {
            user_id: uid,
            plan: planId,
            status: "active",
            billing: billing,
            provider: "paystack",
            reference: reference,
            updated_at: new Date().toISOString()
          },
          { onConflict: "user_id" }
        );
      } catch (e3) {
        try {
          await client.from("subscriptions").insert({
            user_id: uid,
            plan: planId,
            status: "active",
            billing: billing,
            provider: "paystack",
            reference: reference
          });
        } catch (e4) {}
      }
    }
  }

  /**
   * @param {object} opts
   * @param {string} opts.planId
   * @param {string} opts.planName
   * @param {number} opts.amountNaira
   * @param {string} opts.billing monthly|annual
   * @param {string} [opts.email]
   */
  async function startPlanCheckout(opts) {
    var user = currentUser();
    if (!user) {
      alert("Please sign in as an owner to subscribe.");
      location.href = "login.html";
      return;
    }
    var email =
      opts.email ||
      user.email ||
      user.userEmail ||
      "";
    if (!email) {
      email = prompt("Enter the email for Paystack receipt:") || "";
    }
    if (!email || email.indexOf("@") < 0) {
      alert("A valid email is required for payment.");
      return;
    }

    var publicKey = await getPublicKey();
    if (!publicKey) {
      alert(
        "Paystack is not configured yet.\n\nAdmin → Settings → add Paystack public key, or set window.PAYSTACK_PUBLIC_KEY."
      );
      return;
    }

    var amountNaira = Number(opts.amountNaira) || 0;
    if (amountNaira < 100) {
      alert("Invalid amount.");
      return;
    }
    var amountKobo = Math.round(amountNaira * 100);
    var ref =
      "LA-" +
      (opts.planId || "plan") +
      "-" +
      Date.now() +
      "-" +
      Math.floor(Math.random() * 1e6);

    try {
      await loadPaystackScript();
    } catch (e) {
      alert("Could not load Paystack. Check your internet connection.");
      return;
    }

    var handler = global.PaystackPop.setup({
      key: publicKey,
      email: email,
      amount: amountKobo,
      currency: "NGN",
      ref: ref,
      metadata: {
        custom_fields: [
          { display_name: "Plan", variable_name: "plan", value: opts.planName || opts.planId },
          { display_name: "Billing", variable_name: "billing", value: opts.billing || "monthly" },
          { display_name: "User", variable_name: "user_id", value: String(user.id || user.userId || "") }
        ],
        planId: opts.planId,
        billing: opts.billing,
        userId: user.id || user.userId
      },
      callback: function (response) {
        activatePlan(
          user,
          opts.planId,
          response.reference || ref,
          amountNaira,
          opts.billing || "monthly"
        ).then(function () {
          alert(
            "Payment successful!\n\nPlan: " +
              (opts.planName || opts.planId) +
              "\nReference: " +
              (response.reference || ref) +
              "\n\nYour plan is now active."
          );
          if (location.pathname.indexOf("owner-plans") >= 0 || location.pathname.indexOf("owner-payments") >= 0) {
            location.href = "owner-dashboard.html#ownerPlan";
          } else {
            location.reload();
          }
        });
      },
      onClose: function () {
        console.log("Paystack closed");
      }
    });
    handler.openIframe();
  }

  global.LeaseAccomPaystack = {
    getPublicKey: getPublicKey,
    startPlanCheckout: startPlanCheckout,
    activatePlan: activatePlan
  };
})(window);
