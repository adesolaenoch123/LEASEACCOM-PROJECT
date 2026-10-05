create table if not exists public.applications (
    id uuid primary key default gen_random_uuid(),
    property_id text not null,
    tenant_id uuid not null references auth.users(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    applicant_name text not null check (char_length(applicant_name) between 1 and 150),
    applicant_email text,
    applicant_phone text not null check (char_length(applicant_phone) between 1 and 40),
    move_in_date text not null,
    property_title text not null default 'Property',
    property_image text not null default '',
    property_location text not null default 'Nigeria',
    property_price numeric,
    property_period text not null default 'year',
    owner_name text not null default 'Property Owner',
    status text not null default 'submitted'
        check (status in ('submitted', 'under_review', 'accepted', 'rejected')),
    message text check (char_length(message) <= 2000),
    employment_status text,
    monthly_income numeric check (monthly_income is null or monthly_income >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists applications_tenant_created_idx
    on public.applications (tenant_id, created_at desc);

create index if not exists applications_owner_created_idx
    on public.applications (owner_id, created_at desc);

alter table public.applications enable row level security;

drop policy if exists "Tenants can read their applications" on public.applications;
create policy "Tenants can read their applications"
    on public.applications for select to authenticated
    using (tenant_id = auth.uid());

drop policy if exists "Owners can read applications for their listings" on public.applications;
create policy "Owners can read applications for their listings"
    on public.applications for select to authenticated
    using (owner_id = auth.uid());
