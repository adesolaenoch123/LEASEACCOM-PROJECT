-- Persistent workflow rules for the admin AI assistant.
create table if not exists public.admin_workflow_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rule_type text not null check (rule_type in ('overdue_reminder','suspicious_activity','daily_report','weekly_report')),
  conditions jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_run_at timestamptz
);
create index if not exists admin_workflow_rules_enabled_idx on public.admin_workflow_rules(enabled, rule_type);
alter table public.admin_workflow_rules enable row level security;
drop policy if exists admin_workflow_rules_admin_read on public.admin_workflow_rules;
create policy admin_workflow_rules_admin_read on public.admin_workflow_rules for select to authenticated using (public.is_admin());
