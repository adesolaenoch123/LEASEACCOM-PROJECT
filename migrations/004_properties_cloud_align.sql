-- Align properties for cloud create + marketplace filters
-- Run in Supabase SQL editor if inserts fail

alter table if exists public.properties
  add column if not exists listing_status text default 'pending';

alter table if exists public.properties
  add column if not exists verification_status text default 'pending';

alter table if exists public.properties
  add column if not exists cover_image text;

alter table if exists public.properties
  add column if not exists image text;

alter table if exists public.properties
  add column if not exists images jsonb default '[]'::jsonb;

alter table if exists public.properties
  add column if not exists owner_name text;

alter table if exists public.properties
  add column if not exists service_charge numeric;

alter table if exists public.properties
  add column if not exists caution_fee numeric;

alter table if exists public.properties
  add column if not exists period text default 'year';

alter table if exists public.properties
  add column if not exists state text;

alter table if exists public.properties
  add column if not exists purpose text;

alter table if exists public.properties
  add column if not exists amenities jsonb default '[]'::jsonb;

alter table if exists public.properties
  add column if not exists updated_at timestamptz default now();

-- RLS: authenticated owners can insert their own rows (adjust if you already have policies)
-- Enable only if not already enabled:
-- alter table public.properties enable row level security;

-- Example policies (skip if they already exist):
-- create policy "owners insert own properties"
--   on public.properties for insert to authenticated
--   with check (auth.uid()::text = owner_id::text OR auth.uid() = owner_id);

-- create policy "public read live/approved"
--   on public.properties for select to anon, authenticated
--   using (
--     listing_status = 'live'
--     OR verification_status = 'approved'
--     OR auth.uid()::text = owner_id::text
--     OR auth.uid() = owner_id
--   );

-- saved_properties: ensure property_id exists (id optional)
-- alter table if exists public.saved_properties add column if not exists property_id text;
