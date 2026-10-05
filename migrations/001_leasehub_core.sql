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
    coalesce(new.raw_user_meta_data->>'account_type', 'tenant')
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
  id uuid primary key default gen_random_uuid(),
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
  listing_status text not null default 'pending'
    check (listing_status in ('draft', 'pending', 'live', 'rejected')),
  images jsonb not null default '[]'::jsonb,
  cover_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_owner_idx on public.properties(owner_id);
create index if not exists properties_status_idx on public.properties(listing_status);
create index if not exists properties_city_idx on public.properties(city);

-- 3) Viewings
create table if not exists public.viewings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'declined', 'completed', 'cancelled')),
  viewing_date date,
  message text,
  status_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists viewings_owner_idx on public.viewings(owner_id);
create index if not exists viewings_tenant_idx on public.viewings(tenant_id);

-- 4) Applications
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'accepted', 'rejected', 'withdrawn')),
  applicant_name text,
  applicant_email text,
  applicant_phone text,
  move_in_date date,
  message text,
  status_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_owner_idx on public.applications(owner_id);
create index if not exists applications_tenant_idx on public.applications(tenant_id);

-- 5) Conversations + messages
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
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

-- 7) RLS
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.viewings enable row level security;
alter table public.applications enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.owner_verifications enable row level security;

-- Profiles: users read all basic profiles; update own
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (true);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Properties: public can read LIVE only; owners manage own
drop policy if exists "properties_public_live" on public.properties;
create policy "properties_public_live" on public.properties
  for select using (listing_status = 'live' or owner_id = auth.uid());
drop policy if exists "properties_owner_insert" on public.properties;
create policy "properties_owner_insert" on public.properties
  for insert with check (owner_id = auth.uid());
drop policy if exists "properties_owner_update" on public.properties;
create policy "properties_owner_update" on public.properties
  for update using (owner_id = auth.uid());

-- Viewings: participants only
drop policy if exists "viewings_participants" on public.viewings;
create policy "viewings_participants" on public.viewings
  for select using (tenant_id = auth.uid() or owner_id = auth.uid());
drop policy if exists "viewings_tenant_insert" on public.viewings;
create policy "viewings_tenant_insert" on public.viewings
  for insert with check (tenant_id = auth.uid());
drop policy if exists "viewings_participants_update" on public.viewings;
create policy "viewings_participants_update" on public.viewings
  for update using (tenant_id = auth.uid() or owner_id = auth.uid());

-- Applications: participants only
drop policy if exists "applications_participants" on public.applications;
create policy "applications_participants" on public.applications
  for select using (tenant_id = auth.uid() or owner_id = auth.uid());
drop policy if exists "applications_tenant_insert" on public.applications;
create policy "applications_tenant_insert" on public.applications
  for insert with check (tenant_id = auth.uid());
drop policy if exists "applications_participants_update" on public.applications;
create policy "applications_participants_update" on public.applications
  for update using (tenant_id = auth.uid() or owner_id = auth.uid());

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

-- Storage bucket for property images (run once)
-- insert into storage.buckets (id, name, public) values ('property-images', 'property-images', true)
-- on conflict do nothing;
