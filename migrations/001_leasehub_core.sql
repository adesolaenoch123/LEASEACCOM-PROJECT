-- LeaseHub Phase 2 — core schema (run in Supabase SQL Editor)
-- Safe to re-run pieces carefully; review if you already have tables.

-- 1) Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  account_type text not null default 'tenant'
    check (account_type in ('tenant', 'owner', 'admin')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  add column if not exists avatar_url text,
  add column if not exists updated_at timestamptz not null default now();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    case when new.raw_user_meta_data->>'account_type' = 'owner' then 'owner' else 'tenant' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Properties
create table if not exists public.properties (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  type text,
  location text,
  city text,
  price numeric not null default 0,
  period text default 'year',
  service_charge numeric default 0,
  caution_fee numeric default 0,
  agency_fee numeric default 0,
  description text default '',
  bedrooms int default 0,
  bathrooms int default 0,
    owner_name text not null default 'Property Owner',
    image text not null default '',
    verification_status text not null default 'pending'
      check (verification_status in ('pending', 'approved', 'rejected')),
  images jsonb not null default '[]'::jsonb,
  cover_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_owner_idx on public.properties(owner_id);
create index if not exists properties_city_idx on public.properties(city);

alter table public.properties add column if not exists owner_name text not null default 'Property Owner';
alter table public.properties add column if not exists image text not null default '';
alter table public.properties add column if not exists verification_status text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'listing_status'
  ) then
    execute $migration$
      update public.properties
      set verification_status = case listing_status
        when 'live' then 'approved'
        when 'approved' then 'approved'
        when 'rejected' then 'rejected'
        else 'pending'
      end
      where verification_status is null
    $migration$;
  end if;
end;
$$;

update public.properties set verification_status = 'pending' where verification_status is null;
alter table public.properties alter column verification_status set default 'pending';
alter table public.properties alter column verification_status set not null;
create index if not exists properties_status_idx on public.properties(verification_status);

-- 3) Viewings
create table if not exists public.viewings (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'declined', 'completed', 'cancelled')),
  viewing_date date,
    preferred_date date,
    preferred_time text,
  message text,
    notes text,
  status_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists viewings_owner_idx on public.viewings(owner_id);
create index if not exists viewings_tenant_idx on public.viewings(tenant_id);
alter table public.viewings add column if not exists preferred_date date;
alter table public.viewings add column if not exists preferred_time text;
alter table public.viewings add column if not exists notes text;

-- 4) Applications
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'accepted', 'rejected', 'withdrawn')),
  applicant_name text,
  applicant_email text,
  applicant_phone text,
  move_in_date date,
    property_title text not null default 'Property',
    property_image text not null default '',
    property_location text not null default 'Nigeria',
    property_price numeric,
    property_period text not null default 'year',
    owner_name text not null default 'Property Owner',
    occupants integer not null default 1 check (occupants > 0),
    stay_length text,
    income_range text,
  message text,
    employment_status text,
    monthly_income numeric check (monthly_income is null or monthly_income >= 0),
  status_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_owner_idx on public.applications(owner_id);
create index if not exists applications_tenant_idx on public.applications(tenant_id);
alter table public.applications add column if not exists property_title text not null default 'Property';
alter table public.applications add column if not exists property_image text not null default '';
alter table public.applications add column if not exists property_location text not null default 'Nigeria';
alter table public.applications add column if not exists property_price numeric;
alter table public.applications add column if not exists property_period text not null default 'year';
alter table public.applications add column if not exists owner_name text not null default 'Property Owner';
alter table public.applications add column if not exists occupants integer not null default 1 check (occupants > 0);
alter table public.applications add column if not exists stay_length text;
alter table public.applications add column if not exists income_range text;
alter table public.applications add column if not exists employment_status text;
alter table public.applications add column if not exists monthly_income numeric;

-- 5) Conversations + messages
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  property_id text references public.properties(id) on delete set null,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  last_message text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages(conversation_id);

-- 6) Owner verification queue
create table if not exists public.owner_verifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected')),
  full_name text,
  phone text,
  id_type text,
  id_number text,
  notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

  create table if not exists public.saved_properties (
    user_id uuid not null references public.profiles(id) on delete cascade,
    property_id text not null references public.properties(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, property_id)
  );

  create table if not exists public.agreements (
    id uuid primary key default gen_random_uuid(),
    application_id uuid references public.applications(id) on delete cascade,
    property_id text not null references public.properties(id) on delete cascade,
    tenant_id uuid not null references public.profiles(id) on delete cascade,
    owner_id uuid not null references public.profiles(id) on delete cascade,
    title text not null,
    term_months integer not null check (term_months > 0),
    monthly_rent numeric not null check (monthly_rent > 0),
    property_period text not null default 'year',
    deposit_amount numeric check (deposit_amount is null or deposit_amount >= 0),
    start_date date,
    notes text,
    owner_agreed boolean not null default false,
    tenant_agreed boolean not null default false,
    owner_agreed_at timestamptz,
    tenant_agreed_at timestamptz,
    status text not null default 'draft'
      check (status in ('draft', 'pending', 'signed', 'cancelled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

alter table public.agreements
  add column if not exists application_id uuid references public.applications(id) on delete cascade,
  add column if not exists property_period text not null default 'year',
  add column if not exists owner_agreed boolean not null default false,
  add column if not exists tenant_agreed boolean not null default false,
  add column if not exists owner_agreed_at timestamptz,
  add column if not exists tenant_agreed_at timestamptz;

create unique index if not exists agreements_application_id_idx
  on public.agreements(application_id)
  where application_id is not null;

  create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    title text not null,
    message text not null,
    type text not null default 'info',
    link text,
    read boolean not null default false,
    created_at timestamptz not null default now()
  );

-- 7) RLS
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.viewings enable row level security;
alter table public.applications enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.owner_verifications enable row level security;
alter table public.saved_properties enable row level security;
alter table public.agreements enable row level security;
alter table public.notifications enable row level security;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.account_type is distinct from old.account_type
      or new.verification_status is distinct from old.verification_status)
     and auth.role() <> 'service_role'
     and coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Only trusted administrators can change profile roles or verification status';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

-- Profiles: users read all basic profiles; update own
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Properties: public can read LIVE only; owners manage own
drop policy if exists "properties_public_live" on public.properties;
create policy "properties_public_live" on public.properties
  for select using (verification_status = 'approved' or owner_id = auth.uid()
    or coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');
drop policy if exists "properties_owner_insert" on public.properties;
create policy "properties_owner_insert" on public.properties
  for insert with check (owner_id = auth.uid() and verification_status = 'pending');
drop policy if exists "properties_admin_update" on public.properties;
create policy "properties_admin_update" on public.properties
  for update using (coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin')
  with check (coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin');

-- Viewings: participants only
drop policy if exists "viewings_participants" on public.viewings;
create policy "viewings_participants" on public.viewings
  for select using (tenant_id = auth.uid() or owner_id = auth.uid());
drop policy if exists "viewings_tenant_insert" on public.viewings;
create policy "viewings_tenant_insert" on public.viewings
  for insert with check (
    tenant_id = auth.uid()
    and exists (
      select 1 from public.properties p
      where p.id::text = property_id::text
        and p.owner_id = viewings.owner_id
        and p.verification_status = 'approved'
    )
  );
drop policy if exists "viewings_participants_update" on public.viewings;
drop policy if exists "viewings_participants_update" on public.viewings;

-- Applications: participants only
drop policy if exists "applications_participants" on public.applications;
create policy "applications_participants" on public.applications
  for select using (tenant_id = auth.uid() or owner_id = auth.uid());
drop policy if exists "applications_tenant_insert" on public.applications;
create policy "applications_tenant_insert" on public.applications
  for insert with check (
    tenant_id = auth.uid()
    and exists (
      select 1 from public.properties p
      where p.id::text = property_id::text
        and p.owner_id = applications.owner_id
        and p.verification_status = 'approved'
    )
  );
drop policy if exists "applications_participants_update" on public.applications;
drop policy if exists "applications_participants_update" on public.applications;

-- Conversations / messages
drop policy if exists "conversations_participants" on public.conversations;
create policy "conversations_participants" on public.conversations
  for select using (tenant_id = auth.uid() or owner_id = auth.uid());
drop policy if exists "conversations_insert" on public.conversations;
create policy "conversations_insert" on public.conversations
  for insert with check (tenant_id = auth.uid() or owner_id = auth.uid());

drop policy if exists "messages_participants" on public.messages;
create policy "messages_participants" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.tenant_id = auth.uid() or c.owner_id = auth.uid())
    )
  );
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.tenant_id = auth.uid() or c.owner_id = auth.uid())
    )
  );

-- Owner verifications
drop policy if exists "owner_verifications_own" on public.owner_verifications;
create policy "owner_verifications_own" on public.owner_verifications
  for select using (owner_id = auth.uid());
drop policy if exists "owner_verifications_insert" on public.owner_verifications;
create policy "owner_verifications_insert" on public.owner_verifications
  for insert with check (owner_id = auth.uid());

drop policy if exists "saved_properties_own" on public.saved_properties;
create policy "saved_properties_own" on public.saved_properties
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "agreements_participants" on public.agreements;
create policy "agreements_participants" on public.agreements
  for select using (tenant_id = auth.uid() or owner_id = auth.uid());
drop policy if exists "agreements_owner_insert" on public.agreements;
create policy "agreements_owner_insert" on public.agreements
  for insert with check (owner_id = auth.uid());

drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications
  for select using (user_id = auth.uid());
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage bucket for property images (run once)
-- insert into storage.buckets (id, name, public) values ('property-images', 'property-images', true)
-- on conflict do nothing;
