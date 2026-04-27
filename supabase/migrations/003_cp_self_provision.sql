-- 003: Allow CP users to self-provision their own cp_master row
-- This is required when a new Google user signs in for the first time
-- and their cp_master row hasn't been created by a VM yet.

-- Allow a CP user to insert their own cp_master row.
-- The check ensures the linked_user_id must be their own user_master id.
drop policy if exists "cp self insert" on public.cp_master;
create policy "cp self insert" on public.cp_master
for insert
with check (
  public.current_app_role() = 'cp'
  and linked_user_id = public.current_user_master_id()
);

-- Also allow a CP to update their own basic profile fields (phone, city etc.)
drop policy if exists "cp self update" on public.cp_master;
create policy "cp self update" on public.cp_master
for update
using (
  public.current_app_role() = 'cp'
  and linked_user_id = public.current_user_master_id()
)
with check (
  public.current_app_role() = 'cp'
  and linked_user_id = public.current_user_master_id()
);

-- Allow CP users to also see all cp_master rows (needed for VM/CP reference data loading)
-- This matches existing pattern: admins + vm + cp with linked_user_id
drop policy if exists "cp select own profile" on public.cp_master;
create policy "cp select own profile" on public.cp_master
for select
using (
  public.current_app_role() = 'admin'
  or public.current_app_role() = 'vm'
  or (public.current_app_role() = 'cp' and linked_user_id = public.current_user_master_id())
);

-- Allow CP to insert their own leads (must already exist for submitLead to work,
-- but cp_master row must exist first via current_cp_id() function)
-- This policy is already in 002 but we re-check it's correct:
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
