-- Disputes / cases
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  description text,
  status text default 'open',
  priority text default 'normal',
  reporter_id uuid,
  against_user_id uuid,
  property_id text,
  admin_notes text,
  resolution text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.disputes enable row level security;
drop policy if exists disputes_admin on public.disputes;
create policy disputes_admin on public.disputes
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists disputes_insert_auth on public.disputes;
create policy disputes_insert_auth on public.disputes
  for insert with check (auth.uid() is not null);

-- Broadcast announcements
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text default 'all',
  active boolean default true,
  created_at timestamptz default now(),
  expires_at timestamptz
);
alter table public.announcements enable row level security;
drop policy if exists announcements_admin on public.announcements;
create policy announcements_admin on public.announcements
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists announcements_public_read on public.announcements;
create policy announcements_public_read on public.announcements
  for select using (active = true);

-- Risk flags on profiles / properties (optional columns)
alter table public.profiles add column if not exists risk_flag boolean default false;
alter table public.profiles add column if not exists risk_note text;
alter table public.properties add column if not exists risk_flag boolean default false;
alter table public.properties add column if not exists risk_note text;
