-- 006: Fix Lead RLS Policies
-- Allow VMs to create leads and everyone in relevant roles to see technical pipelines.

-- 0. Make role detection more robust by falling back to the database role
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role')::public.app_role,
    (select role from public.user_master where auth_user_id = auth.uid() limit 1),
    'cp'::public.app_role
  )
$$;

-- 1. Update Lead Insert Policy to allow VMs
drop policy if exists "cp insert own leads" on public.lead_master;
drop policy if exists "allow_cp_and_vm_insert_leads" on public.lead_master;
create policy "allow_cp_and_vm_insert_leads" on public.lead_master
for insert
with check (
  public.current_app_role() = 'admin'
  or public.current_app_role() = 'vm'
  or (
    public.current_app_role() = 'cp'
    and cp_id = public.current_cp_id()
  )
);

-- 2. Update Lead Select Policy to allow VMs and broader IS visibility
drop policy if exists "role based lead select" on public.lead_master;
drop policy if exists "lead_select_policy_v2" on public.lead_master;
create policy "lead_select_policy_v2" on public.lead_master
for select
using (
  public.current_app_role() = 'admin'
  or public.current_app_role() = 'vm' 
  or (public.current_app_role() = 'cp' and cp_id = public.current_cp_id())
  or (
    public.current_app_role() = 'is' 
    and (is_owner_id = public.current_user_master_id() or is_owner_id is null)
  )
  or (
    public.current_app_role() = 'scheduling'
    and (
      scheduling_owner_id = public.current_user_master_id()
      or (scheduling_owner_id is null and current_stage in ('Qualified', 'CRN Created', 'Sent to Scheduling Team'))
    )
  )
);

-- 3. Update Lead Update Policy to allow IS assignment
drop policy if exists "role based lead update" on public.lead_master;
drop policy if exists "lead_update_policy_v2" on public.lead_master;
create policy "lead_update_policy_v2" on public.lead_master
for update
using (
  public.current_app_role() = 'admin'
  or (
    public.current_app_role() = 'is' 
    and (is_owner_id = public.current_user_master_id() or is_owner_id is null)
  )
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
  or (public.current_app_role() = 'is' and (is_owner_id = public.current_user_master_id() or is_owner_id is null))
  or (public.current_app_role() = 'scheduling' and (scheduling_owner_id = public.current_user_master_id() or scheduling_owner_id is null))
);
