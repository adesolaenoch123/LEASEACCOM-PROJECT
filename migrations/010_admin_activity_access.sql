-- Allow authenticated admins to review tenant activity without granting write access.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.account_type, '')) = 'admin'
  );
$$;

alter table public.viewings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

grant select on public.viewings, public.conversations, public.messages, public.notifications to authenticated;

drop policy if exists admin_viewings_read on public.viewings;
create policy admin_viewings_read on public.viewings
  for select to authenticated
  using (public.is_admin());

drop policy if exists admin_conversations_read on public.conversations;
create policy admin_conversations_read on public.conversations
  for select to authenticated
  using (public.is_admin());

drop policy if exists admin_messages_read on public.messages;
create policy admin_messages_read on public.messages
  for select to authenticated
  using (public.is_admin());

drop policy if exists admin_notifications_read on public.notifications;
create policy admin_notifications_read on public.notifications
  for select to authenticated
  using (public.is_admin());
