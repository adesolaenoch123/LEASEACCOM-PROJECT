-- LeaseAccom 007 — Production complete schema
-- Run in Supabase SQL Editor AFTER 001–006 (safe-ish to re-run).
-- Goal: every live feature has a cloud table + RLS.

-- ========== PROFILES extras ==========
alter table public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists subscription_plan text default 'free',
  add column if not exists business_name text,
  add column if not exists city text,
  add column if not exists state text;

-- ========== PROPERTIES extras (media as Storage paths preferred) ==========
alter table public.properties
  add column if not exists videos jsonb default '[]'::jsonb,
  add column if not exists views_count int not null default 0,
  add column if not exists cover_image text,
  add column if not exists listing_status text default 'pending',
  add column if not exists purpose text,
  add column if not exists state text,
  add column if not exists size text,
  add column if not exists amenities jsonb default '[]'::jsonb,
  add column if not exists owner_name text;

-- ========== VIEWINGS ==========
create table if not exists public.viewings (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'requested'
    check (status in ('requested','accepted','declined','completed','cancelled','rescheduled')),
  preferred_date date,
  preferred_time text,
  viewing_date date,
  message text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists viewings_tenant_idx on public.viewings(tenant_id);
create index if not exists viewings_owner_idx on public.viewings(owner_id);
create index if not exists viewings_property_idx on public.viewings(property_id);

-- ========== APPLICATIONS ==========
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'submitted'
    check (status in ('submitted','under_review','accepted','rejected','withdrawn')),
  applicant_name text,
  applicant_email text,
  applicant_phone text,
  move_in_date date,
  occupants int,
  stay_length text,
  income_range text,
  employment_status text,
  message text,
  property_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_tenant_idx on public.applications(tenant_id);
create index if not exists applications_owner_idx on public.applications(owner_id);

-- ========== MESSAGES ==========
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  property_id text references public.properties(id) on delete set null,
  tenant_id uuid references public.profiles(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete cascade,
  subject text,
  last_message_at timestamptz default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages(conversation_id);

-- ========== NOTIFICATIONS ==========
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text,
  type text default 'info',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, read);

-- ========== SAVED PROPERTIES ==========
create table if not exists public.saved_properties (
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_id text not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

-- ========== OWNER VERIFICATIONS ==========
create table if not exists public.owner_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','verified','rejected')),
  full_name text,
  phone text,
  email text,
  listing_role text,
  business_name text,
  city text,
  state text,
  address text,
  id_type text,
  id_number text,
  id_file_path text,
  proof_type text,
  proof_file_path text,
  proof_note text,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== PROPERTY VIEWS (analytics) ==========
create table if not exists public.property_views (
  id bigserial primary key,
  property_id text not null references public.properties(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  viewed_on date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now()
);
create index if not exists property_views_prop_day on public.property_views(property_id, viewed_on);

-- ========== PAYMENTS & SUBSCRIPTIONS ==========
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null,
  billing text not null default 'monthly' check (billing in ('monthly','annual')),
  status text not null default 'active',
  amount numeric not null default 0,
  currency text not null default 'NGN',
  paystack_reference text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  amount numeric not null,
  currency text not null default 'NGN',
  status text not null default 'pending',
  purpose text,
  property_id text,
  paystack_reference text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ========== REPORTS ==========
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  property_id text references public.properties(id) on delete cascade,
  reason text,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- ========== AUDIT LOG ==========
create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ========== PLATFORM SETTINGS (CMS) ==========
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- ========== RLS ==========
alter table public.viewings enable row level security;
alter table public.applications enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.saved_properties enable row level security;
alter table public.owner_verifications enable row level security;
alter table public.property_views enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.platform_settings enable row level security;

-- Helper: is admin
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.account_type = 'admin'
  );
$$;

-- VIEWINGS policies
drop policy if exists viewings_select on public.viewings;
create policy viewings_select on public.viewings for select using (
  auth.uid() = tenant_id or auth.uid() = owner_id or public.is_admin()
);
drop policy if exists viewings_insert on public.viewings;
create policy viewings_insert on public.viewings for insert with check (auth.uid() = tenant_id);
drop policy if exists viewings_update on public.viewings;
create policy viewings_update on public.viewings for update using (
  auth.uid() = owner_id or auth.uid() = tenant_id or public.is_admin()
);

-- APPLICATIONS policies
drop policy if exists applications_select on public.applications;
create policy applications_select on public.applications for select using (
  auth.uid() = tenant_id or auth.uid() = owner_id or public.is_admin()
);
drop policy if exists applications_insert on public.applications;
create policy applications_insert on public.applications for insert with check (auth.uid() = tenant_id);
drop policy if exists applications_update on public.applications;
create policy applications_update on public.applications for update using (
  auth.uid() = owner_id or auth.uid() = tenant_id or public.is_admin()
);

-- NOTIFICATIONS
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update using (auth.uid() = user_id);
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert with check (public.is_admin() or auth.uid() = user_id);

-- SAVED
drop policy if exists saved_all on public.saved_properties;
create policy saved_all on public.saved_properties for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- OWNER VERIFICATIONS
drop policy if exists ov_select on public.owner_verifications;
create policy ov_select on public.owner_verifications for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists ov_insert on public.owner_verifications;
create policy ov_insert on public.owner_verifications for insert with check (auth.uid() = user_id);
drop policy if exists ov_update on public.owner_verifications;
create policy ov_update on public.owner_verifications for update using (public.is_admin() or auth.uid() = user_id);

-- PROPERTY VIEWS: anyone authenticated can insert; owners can read their property views
drop policy if exists pv_insert on public.property_views;
create policy pv_insert on public.property_views for insert with check (true);
drop policy if exists pv_select on public.property_views;
create policy pv_select on public.property_views for select using (
  public.is_admin() or exists (
    select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()
  )
);

-- MESSAGES / CONVERSATIONS
drop policy if exists conv_select on public.conversations;
create policy conv_select on public.conversations for select using (
  auth.uid() = tenant_id or auth.uid() = owner_id or public.is_admin()
);
drop policy if exists conv_insert on public.conversations;
create policy conv_insert on public.conversations for insert with check (
  auth.uid() = tenant_id or auth.uid() = owner_id
);
drop policy if exists msg_select on public.messages;
create policy msg_select on public.messages for select using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.tenant_id = auth.uid() or c.owner_id = auth.uid())
  ) or public.is_admin()
);
drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert with check (auth.uid() = sender_id);

-- SUBSCRIPTIONS / PAYMENTS: own rows + admin
drop policy if exists sub_select on public.subscriptions;
create policy sub_select on public.subscriptions for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments for select using (auth.uid() = user_id or public.is_admin());

-- REPORTS
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert with check (auth.uid() = reporter_id);
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select using (public.is_admin() or auth.uid() = reporter_id);

-- PLATFORM SETTINGS: public read, admin write
drop policy if exists settings_read on public.platform_settings;
create policy settings_read on public.platform_settings for select using (true);
drop policy if exists settings_write on public.platform_settings;
create policy settings_write on public.platform_settings for all using (public.is_admin());

-- AUDIT: admin only
drop policy if exists audit_admin on public.audit_logs;
create policy audit_admin on public.audit_logs for select using (public.is_admin());

-- Properties public read for approved/live (if not already)
drop policy if exists properties_public_read on public.properties;
create policy properties_public_read on public.properties for select using (
  verification_status = 'approved' or listing_status = 'live' or owner_id = auth.uid() or public.is_admin()
);

-- Increment views helper
create or replace function public.record_property_view(p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.property_views (property_id, viewer_id)
  values (p_id, auth.uid());
  update public.properties set views_count = coalesce(views_count,0) + 1 where id = p_id;
end;
$$;

grant execute on function public.record_property_view(text) to anon, authenticated;
