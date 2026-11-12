-- Allow owners to accept/decline their own viewing requests and applications.
-- Run this in Supabase SQL Editor after the existing LeaseAccom migrations.

alter table public.viewings enable row level security;
alter table public.applications enable row level security;

drop policy if exists viewings_owner_update on public.viewings;
create policy viewings_owner_update
on public.viewings
for update
using (auth.uid() = owner_id or public.is_admin())
with check (auth.uid() = owner_id or public.is_admin());

drop policy if exists applications_owner_update on public.applications;
create policy applications_owner_update
on public.applications
for update
using (auth.uid() = owner_id or public.is_admin())
with check (auth.uid() = owner_id or public.is_admin());
