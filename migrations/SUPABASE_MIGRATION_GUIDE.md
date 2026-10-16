# LeaseAccom → Supabase migration guide

## Goal
Move all demo / localStorage data to **Supabase** so Admin, Owner, and Tenant share one database.

## Your project
- URL: `https://jxbraodoqfwagefsynlc.supabase.co`
- Anon key is already in `JS/supabase-client.js`

## Steps (do in order)

### 1. Open Supabase SQL Editor
Dashboard → **SQL** → New query

### 2. Run core schema (if not already)
Paste and run: `migrations/001_leaseaccom_core.sql`

If you already ran this earlier, skip or ignore “already exists” errors.

### 3. Run full platform schema (NEW)
Paste and run: `migrations/005_leaseaccom_full_platform.sql`

This creates:
| Table | Purpose |
|-------|---------|
| `subscription_plans` | Free / Professional / Business / Enterprise |
| `subscriptions` | Owner plan subscriptions |
| `payments` | Payment ledger |
| `reports` | Disputes / listing reports |
| `audit_logs` | Admin audit trail |
| `platform_settings` | Brand CMS, fees |
| `profiles.account_status` | active / suspended |
| `is_admin()` | RLS helper |

### 4. Make yourself an admin (required for Command Centre DB access)
After you **register** once on the site with Supabase Auth:

```sql
update public.profiles
set account_type = 'admin', account_status = 'active'
where id = (select id from auth.users where email = 'YOUR_EMAIL@example.com');
```

### 5. Frontend files
Ensure every data page loads (order matters):

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="JS/supabase-client.js"></script>
<script src="JS/supabase-store.js"></script>
```

Admin:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../JS/supabase-client.js"></script>
<script src="../JS/supabase-store.js"></script>
<script src="admin.js"></script>
```

### 6. What moves where

| Old (localStorage) | New (Supabase) |
|--------------------|----------------|
| `leaseaccomUsers` | `profiles` (+ `auth.users`) |
| `leaseaccomProperties` | `properties` |
| `viewingRequests` | `viewings` |
| `rentalApplications` | `applications` |
| `leaseaccomPayments` | `payments` |
| `leaseaccomSubscriptions` | `subscriptions` |
| `leaseaccomReports` | `reports` |
| `leaseaccomBrandConfig` | `platform_settings` key `brand` |
| `leaseaccomAdminAuditLog` | `audit_logs` |

### 7. Passwords
Still **never** stored or shown. Supabase Auth keeps hashes only.

### 8. Test checklist
- [ ] Register tenant + owner (Auth)
- [ ] Owner adds property → status `pending` in `properties`
- [ ] Admin (account_type=admin) approves → `approved` → shows on marketplace
- [ ] Tenant requests viewing → row in `viewings`
- [ ] Tenant applies → row in `applications`
- [ ] CMS save brand → `platform_settings`

## Fallback
If Supabase is offline, `LeaseAccomStore` still reads localStorage so the UI does not crash.
