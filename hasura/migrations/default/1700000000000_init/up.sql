-- AI Agent Workflow Builder - core schema
-- organizations -> org_members
--               -> workflows -> workflow_steps
--                             -> workflow_triggers
--                             -> workflow_runs -> step_runs
--                             -> workflow_records (db_write output)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quota_allowed integer not null default 100,
  quota_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- org_members
-- Links an Nhost auth.users row to an organization with a role.
-- No FK to auth.users: the auth schema is owned/migrated by hasura-auth and
-- may not exist yet when this migration runs, so the relationship is wired
-- up in Hasura metadata instead of a DB-level foreign key.
-- ---------------------------------------------------------------------------
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index idx_org_members_org_id on public.org_members(org_id);
create index idx_org_members_user_id on public.org_members(user_id);

-- ---------------------------------------------------------------------------
-- workflows
-- ---------------------------------------------------------------------------
create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_workflows_org_id on public.workflows(org_id);

-- ---------------------------------------------------------------------------
-- workflow_steps
-- ---------------------------------------------------------------------------
create table public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  position integer not null,
  type text not null check (
    type in ('llm_call', 'http_request', 'db_write', 'notify', 'conditional_branch', 'approval_gate')
  ),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_workflow_steps_workflow_id on public.workflow_steps(workflow_id);
create index idx_workflow_steps_workflow_id_position on public.workflow_steps(workflow_id, position);

-- ---------------------------------------------------------------------------
-- workflow_triggers
-- token is used to build the public webhook URL: POST /webhooks/:token
-- ---------------------------------------------------------------------------
create table public.workflow_triggers (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  type text not null check (type in ('manual', 'webhook', 'scheduled', 'database_event')),
  config jsonb not null default '{}'::jsonb,
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (token)
);

create index idx_workflow_triggers_workflow_id on public.workflow_triggers(workflow_id);

-- ---------------------------------------------------------------------------
-- workflow_runs
-- ---------------------------------------------------------------------------
create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  status text not null check (status in ('pending', 'running', 'paused', 'completed', 'failed')) default 'pending',
  trigger_type text not null default 'manual',
  triggered_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index idx_workflow_runs_workflow_id on public.workflow_runs(workflow_id);
create index idx_workflow_runs_status on public.workflow_runs(status);

-- ---------------------------------------------------------------------------
-- step_runs
-- Primary source of real-time execution progress (subscribed to by the UI).
-- ---------------------------------------------------------------------------
create table public.step_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  workflow_step_id uuid not null references public.workflow_steps(id) on delete cascade,
  status text not null check (status in ('pending', 'running', 'paused', 'completed', 'failed')) default 'pending',
  input jsonb,
  output jsonb,
  error text,
  attempt_count integer not null default 0,
  approved_by uuid,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_step_runs_workflow_run_id on public.step_runs(workflow_run_id);
create index idx_step_runs_workflow_step_id on public.step_runs(workflow_step_id);

-- ---------------------------------------------------------------------------
-- workflow_records
-- Application-owned table that db_write steps save output into (scoped by
-- org_id so isolation holds even for this ad-hoc data).
-- ---------------------------------------------------------------------------
create table public.workflow_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  step_run_id uuid not null references public.step_runs(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_workflow_records_org_id on public.workflow_records(org_id);

-- ---------------------------------------------------------------------------
-- notifications
-- Written by the `notify` step instead of sending the Slack/email message
-- inline. A Hasura Event Trigger fires on insert and calls the backend,
-- which performs the actual delivery and updates the status below.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  step_run_id uuid not null references public.step_runs(id) on delete cascade,
  channel text not null check (channel in ('slack', 'email')),
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'sent', 'failed')) default 'pending',
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index idx_notifications_org_id on public.notifications(org_id);

-- ---------------------------------------------------------------------------
-- organization_usage
-- Aggregation view backing the Usage/Quota UI (section 31/32 of the spec).
-- ---------------------------------------------------------------------------
create view public.organization_usage as
select
  o.id as org_id,
  o.quota_allowed,
  o.quota_used,
  count(wr.id) filter (
    where wr.created_at >= date_trunc('month', now())
  ) as runs_this_month,
  count(wr.id) as runs_total
from public.organizations o
left join public.workflows w on w.org_id = o.id
left join public.workflow_runs wr on wr.workflow_id = w.id
group by o.id, o.quota_allowed, o.quota_used;

-- ---------------------------------------------------------------------------
-- updated_at helper trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_organizations before update on public.organizations
  for each row execute procedure public.set_updated_at();

create trigger set_updated_at_workflows before update on public.workflows
  for each row execute procedure public.set_updated_at();

create trigger set_updated_at_workflow_steps before update on public.workflow_steps
  for each row execute procedure public.set_updated_at();
