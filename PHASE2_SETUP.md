# LeaseHub Phase 2 — Real data (Supabase)

## Goal
Same app, but data works on **phone + PC** (not only one browser).

## You already have
- Supabase project URL in `JS/supabase-client.js`
- Auth helpers (`LeaseHubAuth`)
- Frontend flows (verify, list, chat, viewings, applications)

## Step checklist

### A. Database (do first — 15 min)
1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. **SQL Editor** → New query
3. Paste and run: `migrations/001_leasehub_core.sql`
4. Confirm tables exist: `profiles`, `properties`, `viewings`, `applications`, `conversations`, `messages`, `owner_verifications`

### B. Auth settings
1. Authentication → Providers → Email enabled
2. (Optional) disable “confirm email” while testing locally

### C. Frontend scripts (order on pages)
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="JS/supabase-client.js"></script>
<script src="JS/data.js"></script>
<script src="JS/app.js"></script>
```

### D. Hybrid mode (this phase)
- **Login/register** → try Supabase Auth; keep localStorage mirror for old pages
- **Listings** → read Live from Supabase when available; else demo `data.js`
- **Viewings / applications** → write to Supabase when logged in with session; else localStorage

### E. Test gate (before Phase 3 payments)
- [ ] Register owner on PC
- [ ] Same login works on phone (or second browser)
- [ ] Profile `account_type` + `verification_status` in `profiles`
- [ ] Create property row in Supabase
- [ ] Set `listing_status = live` → appears on marketplace from DB

### F. Do not do yet
- Live Paystack
- Delete localStorage entirely (keep as fallback until tests pass)
- Africa multi-country

## Admin verification (manual pilot)
1. Owner submits verification (local or `owner_verifications` table)
2. You set `profiles.verification_status = 'verified'` in Supabase Table Editor
3. Owner can list; you set property `listing_status = 'live'` when ready

## Next after this checklist
Wire login/register pages to `LeaseHubAuth`, then properties read/write.
