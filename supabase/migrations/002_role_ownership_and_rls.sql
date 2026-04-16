do $$
begin
  if to_regclass('public.cp_master') is null then
    raise exception 'cp_master does not exist. Apply 001_initial_schema.sql before 002_role_ownership_and_rls.sql.';
  end if;

  if to_regclass('public.lead_master') is null then
    raise exception 'lead_master does not exist. Apply 001_initial_schema.sql before 002_role_ownership_and_rls.sql.';
  end if;
end
$$;

alter table public.cp_master
add column if not exists linked_user_id uuid references public.user_master(id);

alter table public.lead_master
add column if not exists is_owner_id uuid references public.user_master(id),
add column if not exists scheduling_owner_id uuid references public.user_master(id);

create index if not exists lead_master_cp_id_idx on public.lead_master(cp_id);
create index if not exists lead_master_is_owner_id_idx on public.lead_master(is_owner_id);
create index if not exists lead_master_scheduling_owner_id_idx on public.lead_master(scheduling_owner_id);
create index if not exists cp_master_linked_user_id_idx on public.cp_master(linked_user_id);

create or replace function public.current_user_master_id()
returns uuid
language sql
stable
as $$
  select id
  from public.user_master
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_cp_id()
returns uuid
language sql
stable
as $$
  select id
  from public.cp_master
  where linked_user_id = public.current_user_master_id()
  limit 1
$$;

drop policy if exists "user self select" on public.user_master;
create policy "user self select" on public.user_master
for select
using (
  public.current_app_role() = 'admin'
  or id = public.current_user_master_id()
);

drop policy if exists "cp select own profile" on public.cp_master;
create policy "cp select own profile" on public.cp_master
for select
using (
  public.current_app_role() = 'admin'
  or (public.current_app_role() = 'cp' and linked_user_id = public.current_user_master_id())
  or public.current_app_role() = 'vm'
);

drop policy if exists "vm write cp master" on public.cp_master;
create policy "vm write cp master" on public.cp_master
for all
using (
  public.current_app_role() = 'admin'
  or public.current_app_role() = 'vm'
)
with check (
  public.current_app_role() = 'admin'
  or public.current_app_role() = 'vm'
);

drop policy if exists "cp insert own leads" on public.lead_master;
create policy "cp insert own leads" on public.lead_master
for insert
with check (
  public.current_app_role() = 'admin'
  or (
    public.current_app_role() = 'cp'
    and cp_id = public.current_cp_id()
  )
);

drop policy if exists "role based lead select" on public.lead_master;
create policy "role based lead select" on public.lead_master
for select
using (
  public.current_app_role() = 'admin'
  or (public.current_app_role() = 'cp' and cp_id = public.current_cp_id())
  or (public.current_app_role() = 'is' and is_owner_id = public.current_user_master_id())
  or (
    public.current_app_role() = 'scheduling'
    and (
      scheduling_owner_id = public.current_user_master_id()
      or (scheduling_owner_id is null and current_stage in ('Qualified', 'CRN Created', 'Sent to Scheduling Team'))
    )
  )
);

drop policy if exists "role based lead update" on public.lead_master;
create policy "role based lead update" on public.lead_master
for update
using (
  public.current_app_role() = 'admin'
  or (public.current_app_role() = 'is' and is_owner_id = public.current_user_master_id())
  or (
    public.current_app_role() = 'scheduling'
    and (
      scheduling_owner_id = public.current_user_master_id()
      or (scheduling_owner_id is null and current_stage in ('Qualified', 'CRN Created', 'Sent to Scheduling Team'))
    )
  )
)
with check (
  public.current_app_role() = 'admin'
  or (public.current_app_role() = 'is' and is_owner_id = public.current_user_master_id())
  or (public.current_app_role() = 'scheduling' and scheduling_owner_id = public.current_user_master_id())
);

drop policy if exists "cp own incentives" on public.incentive_master;
create policy "cp own incentives" on public.incentive_master
for select
using (
  public.current_app_role() = 'admin'
  or (public.current_app_role() = 'cp' and cp_id = public.current_cp_id())
);

drop policy if exists "admin updates incentives" on public.incentive_master;
create policy "admin updates incentives" on public.incentive_master
for update
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "role based agreements select" on public.agreement_master;
create policy "role based agreements select" on public.agreement_master
for select
using (
  public.current_app_role() = 'admin'
  or public.current_app_role() = 'vm'
  or (public.current_app_role() = 'cp' and cp_id = public.current_cp_id())
);

drop policy if exists "vm writes agreements" on public.agreement_master;
create policy "vm writes agreements" on public.agreement_master
for all
using (
  public.current_app_role() = 'admin'
  or public.current_app_role() = 'vm'
)
with check (
  public.current_app_role() = 'admin'
  or public.current_app_role() = 'vm'
);

drop policy if exists "is own updates" on public.is_updates;
create policy "is own updates" on public.is_updates
for all
using (
  public.current_app_role() = 'admin'
  or is_owner_id = public.current_user_master_id()
)
with check (
  public.current_app_role() = 'admin'
  or is_owner_id = public.current_user_master_id()
);

drop policy if exists "scheduling manages meetings" on public.meeting_master;
create policy "scheduling manages meetings" on public.meeting_master
for all
using (
  public.current_app_role() = 'admin'
  or public.current_app_role() = 'scheduling'
)
with check (
  public.current_app_role() = 'admin'
  or public.current_app_role() = 'scheduling'
);

drop policy if exists "vm manages vm updates" on public.vm_updates;
create policy "vm manages vm updates" on public.vm_updates
for all
using (
  public.current_app_role() = 'admin'
  or public.current_app_role() = 'vm'
)
with check (
  public.current_app_role() = 'admin'
  or public.current_app_role() = 'vm'
);

drop policy if exists "role notifications" on public.notification_master;
create policy "role notifications" on public.notification_master
for select
using (
  public.current_app_role() = 'admin'
  or audience is null
  or audience = public.current_app_role()
);
