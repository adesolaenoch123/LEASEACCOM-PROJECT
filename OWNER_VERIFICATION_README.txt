LeaseAccom — Landlord verification & documentation pack

PAGES
  owner-verification.html     Multi-step document submission (owners)
  admin-owner-verification.html   Staff review queue (approve / reject)

FILES
  CSS/verification.css
  JS/owner-verification.js
  JS/admin-owner-verification.js

FLOW
  1. Owner opens owner-verification.html
  2. Step 1 Identity → Step 2 Government ID → Step 3 Ownership proof → Step 4 Review
  3. Submit → status Pending (localStorage queue: leaseaccomOwnerVerifications)
  4. Staff opens admin-owner-verification.html → Approve or Reject with reason
  5. Owner status becomes verified | rejected (shown on their form banner)

DOCUMENTS COLLECTED
  - Full name, phone, email, role, business name, city, state, address
  - ID type + number + file (NIN, passport, licence, voter card, CAC)
  - Proof type + file (title, utility bill, authority letter, mandate, etc.)
  - Optional note + consent checkbox

LIMITS
  - Max 5MB per file, JPG/PNG/PDF
  - Image previews stored for admin review (demo); move to Supabase Storage in production

LINK FROM OWNER DASHBOARD
  Add: <a href="owner-verification.html">Verification</a>

SUPABASE LATER
  Table owner_verifications already exists in core migration.
  Upload files to Storage bucket "verification-docs" and save paths in the row.
