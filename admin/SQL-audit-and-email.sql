-- Audit log
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  detail text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_admin on public.audit_logs;
create policy audit_logs_admin on public.audit_logs
  for all using (public.is_admin()) with check (public.is_admin());

-- Email outbox (Edge Function or cron sends these)
create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  to_email text,
  subject text not null,
  body text not null,
  status text default 'pending',
  error text,
  created_at timestamptz default now(),
  sent_at timestamptz
);
alter table public.email_queue enable row level security;
drop policy if exists email_queue_admin on public.email_queue;
create policy email_queue_admin on public.email_queue
  for all using (public.is_admin()) with check (public.is_admin());

-- Optional: profiles.email for notifications
alter table public.profiles add column if not exists email text;
