-- Harden role checks and participant-owned records after migrations 001-012.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.account_type, '')) = 'admin'
      and lower(coalesce(p.account_status, 'active')) = 'active'
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.account_type, '')) = 'owner'
      and lower(coalesce(p.account_status, 'active')) = 'active'
  );
$$;

create or replace function public.is_tenant()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.account_type, '')) = 'tenant'
      and lower(coalesce(p.account_status, 'active')) = 'active'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_tenant() to authenticated;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin')
     or public.is_admin() then
    return new;
  end if;

  if new.account_type is distinct from old.account_type then
    raise exception 'Only administrators can change account roles';
  end if;

  if new.verification_status is distinct from old.verification_status
     and not (public.is_owner() and new.verification_status = 'pending') then
    raise exception 'Only administrators can change verification status';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_profile_platform_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (new.account_status is distinct from old.account_status
      or new.plan is distinct from old.plan
      or new.subscription_plan is distinct from old.subscription_plan)
     and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin')
     and not public.is_admin() then
    raise exception 'Only administrators can change account status or plan';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

drop trigger if exists profiles_protect_platform_fields on public.profiles;
create trigger profiles_protect_platform_fields
  before update on public.profiles
  for each row execute function public.prevent_profile_platform_fields();

drop policy if exists properties_owner_insert on public.properties;
create policy properties_owner_insert on public.properties
  for insert to authenticated
  with check (
    public.is_owner()
    and owner_id = auth.uid()
    and verification_status = 'pending'
  );

drop policy if exists viewings_participants on public.viewings;
drop policy if exists viewings_select on public.viewings;
drop policy if exists admin_viewings_read on public.viewings;
create policy viewings_participants on public.viewings
  for select to authenticated
  using (
    (public.is_tenant() and tenant_id = auth.uid())
    or (public.is_owner() and owner_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists viewings_tenant_insert on public.viewings;
drop policy if exists viewings_insert on public.viewings;
create policy viewings_tenant_insert on public.viewings
  for insert to authenticated
  with check (
    public.is_tenant()
    and tenant_id = auth.uid()
    and status = 'requested'
    and exists (
      select 1
      from public.properties p
      where p.id = viewings.property_id
        and p.owner_id = viewings.owner_id
        and p.verification_status = 'approved'
    )
  );

drop policy if exists viewings_update on public.viewings;
drop policy if exists viewings_participants_update on public.viewings;
drop policy if exists viewings_owner_update on public.viewings;
create policy viewings_owner_update on public.viewings
  for update to authenticated
  using ((public.is_owner() and owner_id = auth.uid()) or public.is_admin())
  with check ((public.is_owner() and owner_id = auth.uid()) or public.is_admin());

drop policy if exists applications_participants on public.applications;
drop policy if exists applications_select on public.applications;
create policy applications_participants on public.applications
  for select to authenticated
  using (
    (public.is_tenant() and tenant_id = auth.uid())
    or (public.is_owner() and owner_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists applications_tenant_insert on public.applications;
drop policy if exists applications_insert on public.applications;
create policy applications_tenant_insert on public.applications
  for insert to authenticated
  with check (
    public.is_tenant()
    and tenant_id = auth.uid()
    and status = 'submitted'
    and exists (
      select 1
      from public.properties p
      where p.id = applications.property_id
        and p.owner_id = applications.owner_id
        and p.verification_status = 'approved'
    )
  );

drop policy if exists applications_update on public.applications;
drop policy if exists applications_participants_update on public.applications;
drop policy if exists applications_owner_update on public.applications;
create policy applications_owner_update on public.applications
  for update to authenticated
  using ((public.is_owner() and owner_id = auth.uid()) or public.is_admin())
  with check ((public.is_owner() and owner_id = auth.uid()) or public.is_admin());

drop policy if exists conversations_participants on public.conversations;
drop policy if exists conv_select on public.conversations;
drop policy if exists admin_conversations_read on public.conversations;
create policy conversations_participants on public.conversations
  for select to authenticated
  using (
    (public.is_tenant() and tenant_id = auth.uid())
    or (public.is_owner() and owner_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists conversations_insert on public.conversations;
drop policy if exists conv_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (
    public.is_tenant()
    and tenant_id = auth.uid()
    and exists (
      select 1
      from public.properties p
      where p.id = conversations.property_id
        and p.owner_id = conversations.owner_id
        and p.verification_status = 'approved'
    )
  );

drop policy if exists messages_participants on public.messages;
drop policy if exists msg_select on public.messages;
drop policy if exists admin_messages_read on public.messages;
create policy messages_participants on public.messages
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (
          (public.is_tenant() and c.tenant_id = auth.uid())
          or (public.is_owner() and c.owner_id = auth.uid())
        )
    )
  );

drop policy if exists messages_insert on public.messages;
drop policy if exists msg_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (
          (public.is_tenant() and c.tenant_id = auth.uid())
          or (public.is_owner() and c.owner_id = auth.uid())
        )
    )
  );

drop policy if exists owner_verifications_own on public.owner_verifications;
drop policy if exists owner_verifications_insert on public.owner_verifications;
drop policy if exists ov_select on public.owner_verifications;
drop policy if exists ov_insert on public.owner_verifications;
drop policy if exists ov_update on public.owner_verifications;
create policy owner_verifications_select on public.owner_verifications
  for select to authenticated
  using ((public.is_owner() and owner_id = auth.uid()) or public.is_admin());
create policy owner_verifications_insert on public.owner_verifications
  for insert to authenticated
  with check (public.is_owner() and owner_id = auth.uid() and status = 'pending');
create policy owner_verifications_update on public.owner_verifications
  for update to authenticated
  using ((public.is_owner() and owner_id = auth.uid()) or public.is_admin())
  with check ((public.is_owner() and owner_id = auth.uid()) or public.is_admin());

create or replace function public.prevent_owner_verification_self_review()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin')
     or public.is_admin() then
    return new;
  end if;

  if old.owner_id = auth.uid()
     and (
       new.status is distinct from old.status
       or new.reviewed_at is distinct from old.reviewed_at
       or new.reviewed_by is distinct from old.reviewed_by
       or new.review_note is distinct from old.review_note
     ) then
    raise exception 'Owners cannot change verification review fields';
  end if;
  return new;
end;
$$;

drop trigger if exists owner_verifications_protect_review on public.owner_verifications;
create trigger owner_verifications_protect_review
  before update on public.owner_verifications
  for each row execute function public.prevent_owner_verification_self_review();

drop policy if exists owner_storefronts_owner_write on public.owner_storefronts;
create policy owner_storefronts_owner_write on public.owner_storefronts
  for insert to authenticated
  with check (public.is_owner() and owner_id = auth.uid());
drop policy if exists owner_storefronts_owner_update on public.owner_storefronts;
create policy owner_storefronts_owner_update on public.owner_storefronts
  for update to authenticated
  using (public.is_owner() and owner_id = auth.uid())
  with check (public.is_owner() and owner_id = auth.uid());

drop policy if exists owner_payout_accounts_owner_all on public.owner_payout_accounts;
create policy owner_payout_accounts_owner_all on public.owner_payout_accounts
  for all to authenticated
  using (public.is_owner() and owner_id = auth.uid())
  with check (public.is_owner() and owner_id = auth.uid());

notify pgrst, 'reload schema';
