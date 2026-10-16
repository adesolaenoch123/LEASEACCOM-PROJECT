LeaseAccom — Phase 3 confirmed fixes only

Overwrite:
  JS/app.js
  JS/supabase-client.js

Problem 11 — CONFIRMED and FIXED
--------------------------------
Multiple session keys caused inconsistent login state:
  leaseaccomCurrentUser  (canonical)
  leaseaccomCurrentUser  (legacy)
  currentUser          (legacy)

Fix:
  - getCurrentUser() migrates any legacy key → canonical
  - saveCurrentUser() writes the same payload to all three (never divergent)
  - clearCurrentUser() removes all session keys
  - normalizeAccountType applied on every read/write

Problem 12 — CONFIRMED working (no code change)
-----------------------------------------------
https://leaseaccom-api.onrender.com/health → {"status":"ok"}
JS/config.js already points at that URL.
Free Render may cold-start (~30s); that is host behaviour, not a bug.

Problem 13 — CONFIRMED, deferred
--------------------------------
admin/admin.js still uses localStorage for properties/users/reports.
Needs a real admin API before replacing. Not patched here.

Problem 14 — CONFIRMED, deferred
--------------------------------
add-property.js Property Page s images as compressed base64 in the browser.
Private document vault + Supabase Storage buckets need setup first.
Not patched here.
