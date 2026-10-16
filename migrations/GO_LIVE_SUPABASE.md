# LeaseAccom — Go-live on Supabase (everything that matters)

## Why
The app is near launch. Browser `localStorage` cannot be the source of truth for tenants, owners, and admins on different devices. This pack moves **all product data** onto Supabase.

## What you already have
- Auth + profiles
- Properties (partial)
- Migrations 001–006

## What this pack adds
1. **`007_production_complete.sql`** — viewings, applications, messages, notifications, saved, owner_verifications, property_views, payments, subscriptions, reports, audit, platform_settings + RLS
2. **`JS/leaseaccom-cloud.js`** — one JS API for those tables
3. Storage buckets (create in dashboard — see below)

---

## Step 1 — Run SQL (15 minutes)

Supabase → **SQL Editor** → run in order if not already done:

1. `001_leaseaccom_core.sql` (skip pieces you already ran)
2. `004_properties_cloud_align.sql`
3. `005_leaseaccom_full_platform.sql`
4. `007_production_complete.sql` ← **required for go-live**

Confirm tables exist under **Table Editor**.

## Step 2 — Storage buckets

Supabase → **Storage** → New bucket:

| Bucket | Public | Use |
|--------|--------|-----|
| `property-media` | Public read | Listing photos & videos |
| `verification-docs` | **Private** | ID / ownership documents |
| `avatars` | Public read | Profile photos |

Policies (example for `property-media`):

- Authenticated users can **upload** to folder `{user_id}/*`
- Public can **read**

## Step 3 — Make yourself admin

```sql
update public.profiles
set account_type = 'admin', account_status = 'active'
where id = (select id from auth.users where email = 'YOUR_EMAIL@example.com');
```

## Step 4 — Wire the frontend

On every major page (after `supabase-client.js`):

```html
<script src="JS/leaseaccom-cloud.js"></script>
```

Pages that should load it:
- index, properties, property-details
- owner-dashboard, add-property, owner-verification
- messages, tenant-dashboard, admin

## Step 5 — Production config

In `JS/config.js` / `supabase-client.js`:

- Use **production** Supabase URL + **anon** key only (never service role in the browser)
- Turn off demo-only fallbacks when `location.hostname` is your live domain

## Step 6 — Paystack (payments)

- Test keys first → webhooks write to `payments` + `subscriptions`
- Update `profiles.subscription_plan` when payment succeeds

## Step 7 — Launch checklist

- [ ] New tenant can register and log in
- [ ] Owner can verify + add property (media in Storage)
- [ ] Admin can approve property → appears on marketplace
- [ ] Tenant viewing request appears for owner
- [ ] Tenant application appears for owner
- [ ] Messages send between roles
- [ ] Notifications appear in bell
- [ ] Saved properties persist after logout/login on another device
- [ ] RLS: tenant cannot edit someone else’s listing
- [ ] Mobile + desktop smoke test

## What stays local (OK)

- UI preferences, temporary form drafts
- Optional offline cache **read-only** mirror (never the only copy)

## What must NOT stay local-only for go-live

Viewings · Applications · Messages · Notifications · Saved · Verification · Payments · Plans · Property media · Admin moderation data

---

## Timeline (realistic)

| Day | Focus |
|-----|--------|
| 1 | Run 007 + Storage + admin role |
| 2 | Properties + media upload path |
| 3 | Viewings + applications cloud-only |
| 4 | Messages + notifications |
| 5 | Verification + saved + views |
| 6 | Paystack test + admin live queues |
| 7 | Full QA + soft |

You and Copilot can implement page wiring; this pack is the **schema + cloud API foundation**.
