-- 006: Fix Lead RLS and Notification Policies
-- Resolves submission failures and data visibility issues.

-- 1. Upgrade Role Detection (Database Fallback)
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role')::public.app_role,
    (SELECT role FROM public.user_master WHERE auth_user_id = auth.uid() LIMIT 1),
    'cp'::public.app_role
  )
$$;

-- 2. Notification Policies (CRITICAL for Lead Submission)
-- Allowing all roles to insert notifications prevents cross-role actions (like lead submission) from failing.
DROP POLICY IF EXISTS "role notifications" ON public.notification_master;
DROP POLICY IF EXISTS "allow_all_insert_notifications" ON public.notification_master;
DROP POLICY IF EXISTS "allow_role_select_notifications" ON public.notification_master;

CREATE POLICY "allow_all_insert_notifications" ON public.notification_master
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "allow_role_select_notifications" ON public.notification_master
FOR SELECT USING (
  public.current_app_role() = 'admin'
  OR audience IS NULL
  OR audience = public.current_app_role()
);

-- 3. Lead Master Policies (Relaxed for VM/IS visibility)
DROP POLICY IF EXISTS "cp insert own leads" ON public.lead_master;
DROP POLICY IF EXISTS "allow_cp_and_vm_insert_leads" ON public.lead_master;
DROP POLICY IF EXISTS "lead_insert_policy" ON public.lead_master;
DROP POLICY IF EXISTS "role based lead select" ON public.lead_master;
DROP POLICY IF EXISTS "lead_select_policy" ON public.lead_master;
DROP POLICY IF EXISTS "role based lead update" ON public.lead_master;
DROP POLICY IF EXISTS "lead_update_policy" ON public.lead_master;

CREATE POLICY "lead_insert_policy" ON public.lead_master
FOR INSERT WITH CHECK (
  public.current_app_role() = 'admin'
  OR public.current_app_role() = 'vm'
  OR (public.current_app_role() = 'cp' AND cp_id = public.current_cp_id())
);

CREATE POLICY "lead_select_policy" ON public.lead_master
FOR SELECT USING (
  public.current_app_role() = 'admin'
  OR public.current_app_role() = 'vm' 
  OR (public.current_app_role() = 'cp' AND cp_id = public.current_cp_id())
  OR (public.current_app_role() = 'is' AND (is_owner_id = public.current_user_master_id() OR is_owner_id IS NULL))
  OR (
    public.current_app_role() = 'scheduling'
    AND (
      scheduling_owner_id = public.current_user_master_id()
      OR (scheduling_owner_id IS NULL AND current_stage IN ('Qualified', 'CRN Created', 'Sent to Scheduling Team'))
    )
  )
);

CREATE POLICY "lead_update_policy" ON public.lead_master
FOR UPDATE USING (
  public.current_app_role() = 'admin'
  OR (public.current_app_role() = 'is' AND (is_owner_id = public.current_user_master_id() OR is_owner_id IS NULL))
  OR (public.current_app_role() = 'scheduling' AND (scheduling_owner_id = public.current_user_master_id() OR scheduling_owner_id IS NULL))
)
WITH CHECK (
  public.current_app_role() = 'admin'
  OR (public.current_app_role() = 'is' AND (is_owner_id = public.current_user_master_id() OR is_owner_id IS NULL))
  OR (public.current_app_role() = 'scheduling' AND (scheduling_owner_id = public.current_user_master_id() OR scheduling_owner_id IS NULL))
);

-- 4. Partner Visibility for VMs
DROP POLICY IF EXISTS "vm_manage_cp_master" ON public.cp_master;
DROP POLICY IF EXISTS "vm write cp master" ON public.cp_master;
CREATE POLICY "vm_manage_cp_master" ON public.cp_master
FOR ALL USING (public.current_app_role() IN ('admin', 'vm'))
WITH CHECK (public.current_app_role() IN ('admin', 'vm'));

-- 5. IS Update Visibility
DROP POLICY IF EXISTS "is_manage_updates" ON public.is_updates;
DROP POLICY IF EXISTS "is own updates" ON public.is_updates;
CREATE POLICY "is_manage_updates" ON public.is_updates
FOR ALL USING (public.current_app_role() = 'admin' OR is_owner_id = public.current_user_master_id())
WITH CHECK (public.current_app_role() = 'admin' OR is_owner_id = public.current_user_master_id());
