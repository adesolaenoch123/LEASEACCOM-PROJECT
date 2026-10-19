-- Landlord verification extras (NIN + document paths)
alter table public.owner_verifications
  add column if not exists email text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists address text,
  add column if not exists listing_role text,
  add column if not exists business_name text,
  add column if not exists proof_type text,
  add column if not exists proof_note text,
  add column if not exists id_file_path text,
  add column if not exists proof_file_path text,
  add column if not exists id_file_url text,
  add column if not exists proof_file_url text,
  add column if not exists review_note text,
  add column if not exists updated_at timestamptz default now();

-- Ensure profiles verification_status exists
alter table public.profiles
  add column if not exists verification_status text default 'unverified';
