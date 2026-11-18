LeaseAccom — Owner Plans + Tenant Payments (frontend pack)

Files:
  owner-plans.html
  tenant-payments.html
  CSS/plans.css
  JS/plans.js
  JS/tenant-payments.js

Open:
  owner-plans.html  → Professional ₦5k / Business ₦10k / Enterprise ₦20k
  tenant-payments.html → wallet summary + history + future ideas

Owner dashboard: add a nav link to owner-plans.html (Plans / Upgrade).
Tenant dashboard: add a link to tenant-payments.html (Payments).

Plan checkout: selecting a paid plan saves an intent in localStorage key
leaseaccomPlanIntent and opens a checkout preview. Monthly and annual
billing are selectable. No payment is taken and no plan is activated until
secure server-side payment processing is connected.
