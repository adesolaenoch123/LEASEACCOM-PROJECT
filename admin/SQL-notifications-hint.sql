-- Run if admin cannot insert notifications for other users
drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_admin_insert on public.notifications
  for insert with check (public.is_admin() or auth.uid() = user_id);

drop policy if exists notifications_user_read on public.notifications;
create policy notifications_user_read on public.notifications
  for select using (auth.uid() = user_id or public.is_admin());
