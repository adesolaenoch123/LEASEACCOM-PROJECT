insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do update set public = false;

drop policy if exists verification_docs_owner_insert on storage.objects;
create policy verification_docs_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_owner()
  );

drop policy if exists verification_docs_owner_admin_read on storage.objects;
create policy verification_docs_owner_admin_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (
      public.is_admin()
      or (public.is_owner() and (storage.foldername(name))[1] = auth.uid()::text)
    )
  );

drop policy if exists properties_owner_insert on public.properties;
create policy properties_owner_insert on public.properties
  for insert to authenticated
  with check (
    public.is_owner()
    and owner_id = auth.uid()
    and verification_status = 'pending'
    and listing_status = 'pending'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.verification_status = 'verified'
    )
  );

notify pgrst, 'reload schema';
