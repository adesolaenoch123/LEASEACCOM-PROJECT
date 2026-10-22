-- ============================================================
-- LeaseAccom — full platform schema (run in Supabase SQL Editor)
-- Additive platform schema; review existing schema before applying.
-- Requires the core tables from 001_leaseaccom_core.sql.
-- ============================================================

-- ---------- Profiles extensions ----------
alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'deleted'));

alter table public.profiles
  add column if not exists plan text default 'free';

-- Allow admin in account_type if constraint blocks it (recreate carefully)
-- profiles already has tenant|owner|admin in core

-- ---------- Platform brand / CMS (single row style via key) ----------
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- ---------- Subscription plans (catalog) ----------
create table if not exists public.subscription_plans (
  id text primary key,
  name text not null,
  price_monthly numeric not null default 0,
  price_annual numeric not null default 0,
  currency text not null default 'NGN',
  max_listings int not null default 1,
  max_photos int not null default 8,
  max_videos int not null default 0,
  features jsonb not null default '[]'::jsonb,
  fee_discount_pct numeric not null default 0,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (id, name, price_monthly, price_annual, max_listings, max_photos, max_videos, fee_discount_pct, features, sort_order)
values
  ('free', 'Free', 0, 0, 2, 8, 0, 0,
   '["1–2 live listings","Basic inbox","Standard support"]'::jsonb, 0),
  ('professional', 'Professional', 5000, 54000, 5, 15, 1, 5,
   '["Up to 5 active listings","Up to 15 photos","1 video","Verification eligibility","Standard search","Availability calendar","Enquiries & chat","Viewings","Applications","Basic analytics","Email support","5% fee discount"]'::jsonb, 1),
  ('business', 'Business', 10000, 108000, 10, 20, 3, 10,
   '["Up to 10 listings","20 photos","3 videos","Priority search","Everything in Professional","Advanced analytics","Lead tracking","Bulk management","Account manager","Ad-free","10% fee discount"]'::jsonb, 2),
  ('enterprise', 'Enterprise', 20000, 216000, 30, 20, 3, 15,
   '["Up to 30 listings","Everything in Business","AI assistant (100/mo)","Company propertypage","Branded profile","Featured placement","Portfolio analytics","Priority support","15% fee discount"]'::jsonb, 3)
on conflict (id) do update set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  price_annual = excluded.price_annual,
  max_listings = excluded.max_listings,
  max_photos = excluded.max_photos,
  max_videos = excluded.max_videos,
  fee_discount_pct = excluded.fee_discount_pct,
  features = excluded.features,
  sort_order = excluded.sort_order;

-- ---------- Owner subscriptions ----------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  status text not null default 'active'
    check (status in ('active', 'past_due', 'cancelled', 'expired', 'trialing')),
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual')),
  amount numeric not null default 0,
  currency text not null default 'NGN',
  starts_at timestamptz not null default now(),
  renews_at timestamptz,
  cancelled_at timestamptz,
  provider text default 'paystack',
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions(user_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);

-- ---------- Payments ledger ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  property_id text references public.properties(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount numeric not null,
  currency text not null default 'NGN',
  type text not null default 'other'
    check (type in ('subscription', 'listing_fee', 'application_fee', 'boost', 'payout', 'refund', 'other')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  provider text default 'paystack',
  provider_ref text,
  description text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_user_idx on public.payments(user_id);
create index if not exists payments_status_idx on public.payments(status);
create index if not exists payments_created_idx on public.payments(created_at desc);

-- ---------- Reports & disputes ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  property_id text references public.properties(id) on delete set null,
  subject text not null,
  body text,
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved', 'dismissed')),
  resolution text,
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Admin audit log ----------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  action text not null,
  detail text,
  entity_type text,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

-- ---------- Helper: is_admin() ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.account_type = 'admin'
      and p.account_status = 'active'
  );
$$;

create or replace function public.prevent_profile_platform_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.account_status is distinct from old.account_status
      or new.plan is distinct from old.plan)
     and auth.role() <> 'service_role'
     and coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Only trusted administrators can change account status or plan';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_platform_fields on public.profiles;
create trigger profiles_protect_platform_fields
  before update on public.profiles
  for each row execute function public.prevent_profile_platform_fields();

-- ---------- RLS ----------
alter table public.platform_settings enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;

-- Plans: public read
drop policy if exists "plans_public_read" on public.subscription_plans;
create policy "plans_public_read" on public.subscription_plans
  for select to anon, authenticated using (is_active = true);

drop policy if exists "plans_admin_all" on public.subscription_plans;
create policy "plans_admin_all" on public.subscription_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Platform settings: public read, admin write
drop policy if exists "settings_public_read" on public.platform_settings;
create policy "settings_public_read" on public.platform_settings
  for select to anon, authenticated using (true);

drop policy if exists "settings_admin_write" on public.platform_settings;
create policy "settings_admin_write" on public.platform_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Subscriptions: own + admin
drop policy if exists "subs_own_read" on public.subscriptions;
create policy "subs_own_read" on public.subscriptions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "subs_own_insert" on public.subscriptions;
-- Subscription writes are performed by the trusted backend after payment verification.

drop policy if exists "subs_admin_update" on public.subscriptions;

-- Payments: own + admin
drop policy if exists "payments_own_read" on public.payments;
create policy "payments_own_read" on public.payments
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "payments_insert" on public.payments;

drop policy if exists "payments_admin_update" on public.payments;
-- Payment ledger writes are performed by the trusted backend/payment webhook.

-- Reports
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "reports_read" on public.reports;
create policy "reports_read" on public.reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "reports_admin_update" on public.reports;
create policy "reports_admin_update" on public.reports
  for update to authenticated using (public.is_admin());

-- Audit: admin only
drop policy if exists "audit_admin_read" on public.audit_logs;
create policy "audit_admin_read" on public.audit_logs
  for select to authenticated using (public.is_admin());

drop policy if exists "audit_admin_insert" on public.audit_logs;
-- Audit entries are written by the trusted backend, not browser clients.

-- Admin can read all profiles
drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles
  for select to authenticated using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated using (auth.uid() = id or public.is_admin());

-- Admin full property moderation
drop policy if exists "properties_admin_all" on public.properties;
create policy "properties_admin_all" on public.properties
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Seed default brand settings
insert into public.platform_settings (key, value)
values (
  'brand',
  '{
    "appName": "LeaseAccom",
    "tagline": "Find your space with ease",
    "colorPrimary": "#0d7547",
    "colorSecondary": "#15945c",
    "colorBg": "#f5f7f6",
    "colorInk": "#101311",
    "heroTitle": "Find your place without the unnecessary stress.",
    "heroSubtitle": "Search verified properties across Nigeria.",
    "heroVideo": "hero-banner.mp4",
    "logoUrl": "IMAGES/leaseaccom-logo-horizontal.svg",
    "logoIconUrl": "IMAGES/leaseaccom-logo.svg"
  }'::jsonb
)
on conflict (key) do nothing;

insert into public.platform_settings (key, value)
values (
  'fees',
  '{"currency":"NGN","minPhotos":4,"feePercent":5,"maintenance":false}'::jsonb
)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
