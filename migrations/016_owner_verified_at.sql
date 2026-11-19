alter table public.profiles
  add column if not exists verified_at timestamptz;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
set search_path = public
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

  if new.verified_at is distinct from old.verified_at then
    raise exception 'Only administrators can change owner verification timestamps';
  end if;

  return new;
end;
$$;
