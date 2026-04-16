create extension if not exists "pgcrypto";

create type public.app_role as enum ('cp', 'is', 'scheduling', 'vm', 'admin');
create type public.partnership_model as enum (
  'Direct Incentive',
  'Shared Construction',
  'Barter / Exchange',
  'Financial Assistance Model'
);
create type public.lead_temperature as enum ('Hot', 'Warm', 'Pre-Cold', 'Cold');
create type public.lead_stage as enum (
  'Lead Shared',
  'Assigned to IS',
  'Calling Attempt',
  'Connected',
  'RNR',
  'Callback Later',
  'Interested',
  'Non-Interested',
  'Hot',
  'Warm',
  'Pre-Cold',
  'Cold',
  'Qualified',
  'CRN Created',
  'Sent to Scheduling Team',
  'Meeting Scheduled',
  'Meeting Done',
  'Proposal Shared',
  'GMV Discussion',
  'BA Pending',
  'BA Collected',
  'Rejected',
  'Inactive'
);
create type public.scheduling_status as enum (
  'Pending Scheduling',
  'Meeting Date Selection Pending',
  'OS Selection Pending',
  'Meeting Scheduled',
  'Reschedule Requested',
  'Rescheduled',
  'Meeting Completed',
  'Cancelled',
  'No Show'
);
create type public.meeting_mode as enum ('Site Visit', 'Office Visit', 'Video Call', 'Phone Call');
create type public.agreement_status as enum ('Pending', 'Done');
create type public.payment_status as enum ('Pending', 'Released');

create table public.user_master (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text not null,
  email text unique not null,
  phone text,
  city text,
  role public.app_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.cp_master (
  id uuid primary key default gen_random_uuid(),
  cp_code text unique not null,
  cp_name text not null,
  company_name text,
  city text not null,
  pincode text,
  phone text not null,
  active_since date default current_date,
  primary_scope text,
  tier text,
  vm_owner_id uuid references public.user_master(id),
  spoc_name text,
  total_portfolio_value_cr numeric(12,2) default 0,
  total_assigned_projects integer default 0,
  active_projects integer default 0,
  completed_projects integer default 0,
  held_projects integer default 0,
  average_csat numeric(4,2) default 0,
  average_delay_days integer default 0,
  bms_priority text,
  eligible_for_project boolean default true,
  init_project_count integer default 0,
  remarks text,
  created_at timestamptz not null default now()
);

create table public.lead_master (
  id uuid primary key default gen_random_uuid(),
  lead_code text unique not null,
  cp_id uuid not null references public.cp_master(id),
  lead_name text not null,
  lead_number text not null,
  lead_city text not null,
  project_type text not null,
  approximate_project_value_cr numeric(12,2) not null,
  selected_model public.partnership_model not null,
  current_stage public.lead_stage not null default 'Lead Shared',
  lead_temperature public.lead_temperature,
  submitted_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  crn_number text,
  proposal_value_cr numeric(12,2),
  final_project_value_cr numeric(12,2),
  ba_status text default 'Pending',
  requirement_summary text,
  additional_notes text
);

create table public.is_updates (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.lead_master(id) on delete cascade,
  is_owner_id uuid references public.user_master(id),
  call_status text not null,
  interest_status text,
  reason text,
  detailed_comment text,
  expected_concern text,
  next_possible_action text,
  expected_timeline text,
  budget_range text,
  expected_project_value_cr numeric(12,2),
  next_follow_up_date date,
  comment text,
  created_at timestamptz not null default now()
);

create table public.scheduling_updates (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.lead_master(id) on delete cascade,
  scheduling_owner_id uuid references public.user_master(id),
  assigned_os text,
  meeting_date date,
  meeting_time time,
  meeting_mode public.meeting_mode,
  status public.scheduling_status not null default 'Pending Scheduling',
  reschedule_reason text,
  meeting_notes text,
  created_at timestamptz not null default now()
);

create table public.vm_updates (
  id uuid primary key default gen_random_uuid(),
  cp_id uuid not null references public.cp_master(id) on delete cascade,
  vm_owner_id uuid references public.user_master(id),
  call_status text,
  meeting_status text,
  meeting_scheduled_date date,
  aligned_for_activation boolean default false,
  meeting_mode public.meeting_mode,
  agreement_sent_for_signing boolean default false,
  agreement_signing_status public.agreement_status default 'Pending',
  leads_received integer default 0,
  specs_of_leads_received text,
  remarks text,
  created_at timestamptz not null default now()
);

create table public.meeting_master (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.lead_master(id) on delete cascade,
  assigned_os text not null,
  meeting_date date not null,
  meeting_time time not null,
  meeting_mode public.meeting_mode not null,
  status public.scheduling_status not null,
  meeting_notes text,
  reschedule_reason text,
  created_at timestamptz not null default now()
);

create table public.agreement_master (
  id uuid primary key default gen_random_uuid(),
  cp_id uuid not null references public.cp_master(id) on delete cascade,
  agreement_sent_date date not null,
  agreement_status public.agreement_status not null default 'Pending',
  signed_date date,
  spotdraft_link_status text,
  vm_owner_id uuid references public.user_master(id),
  created_at timestamptz not null default now()
);

create table public.incentive_master (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.lead_master(id) on delete cascade,
  cp_id uuid not null references public.cp_master(id) on delete cascade,
  selected_model public.partnership_model not null,
  project_value_cr numeric(12,2) not null,
  incentive_percent numeric(5,2) not null,
  incentive_amount numeric(14,2) not null,
  payment_status public.payment_status not null default 'Pending',
  payment_date date,
  pending_days integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.notification_master (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  detail text not null,
  audience public.app_role,
  severity text not null,
  created_at timestamptz not null default now()
);

create table public.project_master (
  id uuid primary key default gen_random_uuid(),
  cp_id uuid references public.cp_master(id) on delete set null,
  lead_id uuid references public.lead_master(id) on delete set null,
  project_name text not null,
  project_value_cr numeric(12,2),
  status text not null,
  partnership_model public.partnership_model,
  created_at timestamptz not null default now()
);

alter table public.user_master enable row level security;
alter table public.cp_master enable row level security;
alter table public.lead_master enable row level security;
alter table public.is_updates enable row level security;
alter table public.scheduling_updates enable row level security;
alter table public.vm_updates enable row level security;
alter table public.meeting_master enable row level security;
alter table public.agreement_master enable row level security;
alter table public.incentive_master enable row level security;
alter table public.notification_master enable row level security;
alter table public.project_master enable row level security;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role')::public.app_role,
    'cp'::public.app_role
  )
$$;

create policy "admin full access" on public.user_master
for all using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "admin full access cp" on public.cp_master
for all using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "admin full access lead" on public.lead_master
for all using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "admin full access is" on public.is_updates
for all using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "admin full access scheduling" on public.scheduling_updates
for all using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "admin full access vm" on public.vm_updates
for all using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "admin full access meetings" on public.meeting_master
for all using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "admin full access agreements" on public.agreement_master
for all using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "admin full access incentives" on public.incentive_master
for all using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "admin full access notifications" on public.notification_master
for all using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "admin full access projects" on public.project_master
for all using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');
