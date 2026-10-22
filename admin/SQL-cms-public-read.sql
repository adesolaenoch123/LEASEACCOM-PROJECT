-- Allow public (anon) to read CMS + listing limits for homepage
drop policy if exists platform_settings_public_read on public.platform_settings;
create policy platform_settings_public_read on public.platform_settings
  for select using (key in ('cms', 'listing_limits', 'platform_flags', 'support_contact'));
