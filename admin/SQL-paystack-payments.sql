-- Payments + subscriptions for Paystack plan upgrades
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  amount numeric,
  currency text default 'NGN',
  status text default 'pending',
  provider text,
  reference text,
  description text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  plan text,
  status text default 'active',
  billing text,
  provider text,
  reference text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.payments enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists payments_own on public.payments;
create policy payments_own on public.payments
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists subscriptions_own on public.subscriptions;
create policy subscriptions_own on public.subscriptions
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

alter table public.profiles add column if not exists plan text;
alter table public.profiles add column if not exists subscription_plan text;
