-- Allow admin to read operational tables
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'admin'
  );
$$;

-- Profiles: users can read own; admin reads all
drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles for select using (
  auth.uid() = id or public.is_admin()
);
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update using (public.is_admin());

-- Properties admin update
drop policy if exists properties_admin_all on public.properties;
create policy properties_admin_all on public.properties for all using (public.is_admin());
