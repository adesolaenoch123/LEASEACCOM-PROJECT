-- Persistent user-owned data that was previously stored only in browser storage.
-- Apply in the Supabase SQL Editor after migrations 001-009.

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Saved search',
  criteria jsonb not null default '{}'::jsonb,
  new_matches integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_searches_user_updated_idx
  on public.saved_searches(user_id, updated_at desc);
alter table public.saved_searches enable row level security;
drop policy if exists saved_searches_owner_all on public.saved_searches;
create policy saved_searches_owner_all on public.saved_searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.recently_viewed_properties (
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_id text not null references public.properties(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, property_id)
);
create index if not exists recently_viewed_user_time_idx
  on public.recently_viewed_properties(user_id, viewed_at desc);
alter table public.recently_viewed_properties enable row level security;
drop policy if exists recently_viewed_owner_all on public.recently_viewed_properties;
create policy recently_viewed_owner_all on public.recently_viewed_properties
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.owner_storefronts (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  name text not null default '',
  tagline text not null default '',
  goal text not null default '',
  banner_url text not null default '',
  logo_url text not null default '',
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.owner_storefronts enable row level security;
drop policy if exists owner_storefronts_public_or_owner_read on public.owner_storefronts;
create policy owner_storefronts_public_or_owner_read on public.owner_storefronts
  for select using (published or auth.uid() = owner_id);
drop policy if exists owner_storefronts_owner_write on public.owner_storefronts;
create policy owner_storefronts_owner_write on public.owner_storefronts
  for insert with check (auth.uid() = owner_id);
drop policy if exists owner_storefronts_owner_update on public.owner_storefronts;
create policy owner_storefronts_owner_update on public.owner_storefronts
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Store only the payout destination details needed by the owner dashboard.
-- Row Level Security prevents other signed-in users from reading these values.
create table if not exists public.owner_payout_accounts (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  updated_at timestamptz not null default now()
);
alter table public.owner_payout_accounts enable row level security;
drop policy if exists owner_payout_accounts_owner_all on public.owner_payout_accounts;
create policy owner_payout_accounts_owner_all on public.owner_payout_accounts
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
