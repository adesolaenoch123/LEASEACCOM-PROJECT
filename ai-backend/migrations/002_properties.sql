create table if not exists public.properties (
    id text primary key default gen_random_uuid()::text,
    owner_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (char_length(title) between 1 and 200),
    city text not null check (char_length(city) between 1 and 200),
    type text not null check (char_length(type) between 1 and 60),
    price numeric not null check (price > 0),
    period text not null default 'year',
    location text not null default '',
    image text not null default '',
    images text[] not null default '{}',
    owner_name text not null default 'Property Owner',
    bedrooms integer not null default 0 check (bedrooms >= 0),
    bathrooms integer not null default 0 check (bathrooms >= 0),
    description text not null default '',
    verification_status text not null default 'pending'
        check (verification_status in ('pending', 'approved', 'rejected')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists properties_owner_created_idx
    on public.properties (owner_id, created_at desc);

create index if not exists properties_public_search_idx
    on public.properties (verification_status, city, type, price);

alter table public.properties enable row level security;

drop policy if exists "Read approved properties or own listings" on public.properties;
create policy "Read approved properties or own listings"
    on public.properties for select to anon, authenticated
    using (
        verification_status = 'approved'
        or owner_id = auth.uid()
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

drop policy if exists "Owners can create pending listings" on public.properties;
create policy "Owners can create pending listings"
    on public.properties for insert to authenticated
    with check (
        owner_id = auth.uid()
        and verification_status = 'pending'
        and (auth.jwt() -> 'user_metadata' ->> 'account_type') = 'owner'
    );

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'applications_property_id_fkey'
          and conrelid = 'public.applications'::regclass
    ) then
        alter table public.applications
            add constraint applications_property_id_fkey
            foreign key (property_id) references public.properties(id)
            on delete cascade not valid;
    end if;
end;
$$;

alter table public.applications
    validate constraint applications_property_id_fkey;

notify pgrst, 'reload schema';
