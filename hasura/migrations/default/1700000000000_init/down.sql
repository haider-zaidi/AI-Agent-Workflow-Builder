drop trigger if exists set_updated_at_workflow_steps on public.workflow_steps;
drop trigger if exists set_updated_at_workflows on public.workflows;
drop trigger if exists set_updated_at_organizations on public.organizations;
drop function if exists public.set_updated_at();

drop view if exists public.organization_usage;

drop table if exists public.notifications;
drop table if exists public.workflow_records;
drop table if exists public.step_runs;
drop table if exists public.workflow_runs;
drop table if exists public.workflow_triggers;
drop table if exists public.workflow_steps;
drop table if exists public.workflows;
drop table if exists public.org_members;
drop table if exists public.organizations;
