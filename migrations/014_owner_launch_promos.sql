alter table public.profiles
  add column if not exists promo_type text,
  add column if not exists promo_ends_at timestamptz;
