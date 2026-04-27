-- ============================================================
-- 014: Complete role-sync + RLS reset for all roles
-- Run this in the Supabase SQL editor (safe to re-run).
-- Drops every existing policy on every table and recreates
-- them from scratch so the state is deterministic regardless
-- of which earlier migrations were partially applied.
-- ============================================================


-- ============================================================
-- SECTION 1 — Helper functions (SECURITY DEFINER throughout)
-- ============================================================

-- 1a. current_app_role()
--     Safe plpgsql rewrite — lower()+trim() before any cast so
--     'VM', 'Vm', 'IS', etc. never trigger a hard enum error.
--     SECURITY DEFINER so RLS on user_master does not block the
--     DB-fallback lookup.
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    jwt_role text;
    db_role  public.app_role;
BEGIN
    jwt_role := lower(trim(
        auth.jwt() -> 'user_metadata' ->> 'role'
    ));

    IF jwt_role IN ('cp', 'is', 'scheduling', 'vm', 'admin') THEN
        RETURN jwt_role::public.app_role;
    END IF;

    SELECT role INTO db_role
      FROM public.user_master
     WHERE auth_user_id = auth.uid()
     LIMIT 1;

    IF db_role IS NOT NULL THEN
        RETURN db_role;
    END IF;

    RETURN 'cp'::public.app_role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated, anon;


-- 1b. current_user_master_id()
--     Returns user_master.id for the current session user.
--     SECURITY DEFINER so it works even if user_master RLS is tight.
CREATE OR REPLACE FUNCTION public.current_user_master_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id
      FROM public.user_master
     WHERE auth_user_id = auth.uid()
     LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_master_id() TO authenticated, anon;


-- 1c. current_cp_id()
--     Returns cp_master.id for the current CP session user.
--     Matches by linked_user_id first, then by email for
--     CPs who have not yet been linked.
--     SECURITY DEFINER so it can read cp_master without RLS.
CREATE OR REPLACE FUNCTION public.current_cp_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id
      FROM public.cp_master
     WHERE linked_user_id = public.current_user_master_id()
        OR (
            linked_user_id IS NULL
            AND email = (
                SELECT email FROM public.user_master
                 WHERE id = public.current_user_master_id()
            )
        )
     LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_cp_id() TO authenticated, anon;


-- ============================================================
-- SECTION 2 — user_master policies
-- ============================================================
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'user_master' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_master', r.policyname);
  END LOOP;
END $$;

-- Any signed-in user can read all rows (needed for name-lookup maps in loadDataset)
CREATE POLICY "um_select_authenticated" ON public.user_master
  FOR SELECT USING (auth.role() = 'authenticated');

-- A user may only INSERT their own row (auto-provisioning)
CREATE POLICY "um_insert_self" ON public.user_master
  FOR INSERT WITH CHECK (auth_user_id = auth.uid());

-- A user may UPDATE a row only if auth_user_id is NULL (un-linked) or already theirs
-- AND the resulting value must be their own UID (prevents hijacking another account)
CREATE POLICY "um_update_self_link" ON public.user_master
  FOR UPDATE
  USING  (auth.role() = 'authenticated' AND (auth_user_id IS NULL OR auth_user_id = auth.uid()))
  WITH CHECK (auth_user_id = auth.uid());

-- Only admin can delete user rows
CREATE POLICY "um_delete_admin" ON public.user_master
  FOR DELETE USING (public.current_app_role() = 'admin');


-- ============================================================
-- SECTION 3 — cp_master policies
-- ============================================================
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'cp_master' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.cp_master', r.policyname);
  END LOOP;
END $$;

-- SELECT: all staff roles see all rows; CP sees only their own row
CREATE POLICY "cp_select" ON public.cp_master
  FOR SELECT USING (
    public.current_app_role() IN ('admin', 'vm', 'is', 'scheduling')
    OR (
      public.current_app_role() = 'cp'
      AND linked_user_id = public.current_user_master_id()
    )
  );

-- INSERT: admin + vm create CPs; CP can self-insert during first sign-in
CREATE POLICY "cp_insert" ON public.cp_master
  FOR INSERT WITH CHECK (
    public.current_app_role() IN ('admin', 'vm')
    OR (
      public.current_app_role() = 'cp'
      AND linked_user_id = public.current_user_master_id()
    )
  );

-- UPDATE: admin + vm update any row; CP can update their own profile fields
CREATE POLICY "cp_update" ON public.cp_master
  FOR UPDATE
  USING (
    public.current_app_role() IN ('admin', 'vm')
    OR (
      public.current_app_role() = 'cp'
      AND linked_user_id = public.current_user_master_id()
    )
  )
  WITH CHECK (
    public.current_app_role() IN ('admin', 'vm')
    OR (
      public.current_app_role() = 'cp'
      AND linked_user_id = public.current_user_master_id()
    )
  );

-- DELETE: admin only
CREATE POLICY "cp_delete" ON public.cp_master
  FOR DELETE USING (public.current_app_role() = 'admin');


-- ============================================================
-- SECTION 4 — lead_master policies
-- ============================================================
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'lead_master' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.lead_master', r.policyname);
  END LOOP;
END $$;

-- SELECT
CREATE POLICY "lead_select" ON public.lead_master
  FOR SELECT USING (
    public.current_app_role() IN ('admin', 'vm')
    OR (public.current_app_role() = 'cp'  AND cp_id = public.current_cp_id())
    OR (public.current_app_role() = 'is'  AND (is_owner_id = public.current_user_master_id() OR is_owner_id IS NULL))
    OR (
      public.current_app_role() = 'scheduling'
      AND (
        scheduling_owner_id = public.current_user_master_id()
        OR (scheduling_owner_id IS NULL AND current_stage IN (
          'Qualified', 'CRN Created', 'Sent to Scheduling Team',
          'Meeting Scheduled', 'Meeting Done'
        ))
      )
    )
  );

-- INSERT
CREATE POLICY "lead_insert" ON public.lead_master
  FOR INSERT WITH CHECK (
    public.current_app_role() IN ('admin', 'vm')
    OR (public.current_app_role() = 'cp' AND cp_id = public.current_cp_id())
  );

-- UPDATE
CREATE POLICY "lead_update" ON public.lead_master
  FOR UPDATE
  USING (
    public.current_app_role() IN ('admin', 'vm')
    OR (public.current_app_role() = 'is'         AND (is_owner_id         = public.current_user_master_id() OR is_owner_id IS NULL))
    OR (public.current_app_role() = 'scheduling' AND (scheduling_owner_id = public.current_user_master_id() OR scheduling_owner_id IS NULL))
  )
  WITH CHECK (
    public.current_app_role() IN ('admin', 'vm')
    OR (public.current_app_role() = 'is'         AND (is_owner_id         = public.current_user_master_id() OR is_owner_id IS NULL))
    OR (public.current_app_role() = 'scheduling' AND (scheduling_owner_id = public.current_user_master_id() OR scheduling_owner_id IS NULL))
  );

-- DELETE: admin only
CREATE POLICY "lead_delete" ON public.lead_master
  FOR DELETE USING (public.current_app_role() = 'admin');


-- ============================================================
-- SECTION 5 — agreement_master policies
-- ============================================================
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'agreement_master' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.agreement_master', r.policyname);
  END LOOP;
END $$;

-- SELECT: admin + vm see all; CP sees only their own agreement
CREATE POLICY "agreement_select" ON public.agreement_master
  FOR SELECT USING (
    public.current_app_role() IN ('admin', 'vm')
    OR (public.current_app_role() = 'cp' AND cp_id = public.current_cp_id())
  );

-- INSERT: admin + vm create agreements
CREATE POLICY "agreement_insert" ON public.agreement_master
  FOR INSERT WITH CHECK (public.current_app_role() IN ('admin', 'vm'));

-- UPDATE: admin + vm manage onboarding fields;
--         CP can sign (update agreement_status to 'Signed') on their own row
CREATE POLICY "agreement_update" ON public.agreement_master
  FOR UPDATE
  USING (
    public.current_app_role() IN ('admin', 'vm')
    OR (public.current_app_role() = 'cp' AND cp_id = public.current_cp_id())
  )
  WITH CHECK (
    public.current_app_role() IN ('admin', 'vm')
    OR (public.current_app_role() = 'cp' AND cp_id = public.current_cp_id())
  );

-- DELETE: admin only
CREATE POLICY "agreement_delete" ON public.agreement_master
  FOR DELETE USING (public.current_app_role() = 'admin');


-- ============================================================
-- SECTION 6 — meeting_master policies
-- ============================================================
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'meeting_master' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.meeting_master', r.policyname);
  END LOOP;
END $$;

-- SELECT: staff see all; CP sees meetings linked to their own leads
CREATE POLICY "meeting_select" ON public.meeting_master
  FOR SELECT USING (
    public.current_app_role() IN ('admin', 'vm', 'is', 'scheduling')
    OR (
      public.current_app_role() = 'cp'
      AND lead_id IN (SELECT id FROM public.lead_master WHERE cp_id = public.current_cp_id())
    )
  );

-- INSERT + UPDATE + DELETE: scheduling + admin
CREATE POLICY "meeting_write" ON public.meeting_master
  FOR ALL
  USING  (public.current_app_role() IN ('admin', 'scheduling'))
  WITH CHECK (public.current_app_role() IN ('admin', 'scheduling'));


-- ============================================================
-- SECTION 7 — is_updates policies
-- ============================================================
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'is_updates' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.is_updates', r.policyname);
  END LOOP;
END $$;

-- SELECT: admin, vm, is can read all IS updates
CREATE POLICY "is_updates_select" ON public.is_updates
  FOR SELECT USING (public.current_app_role() IN ('admin', 'vm', 'is'));

-- WRITE: admin can write any; IS can only write rows assigned to themselves
CREATE POLICY "is_updates_write" ON public.is_updates
  FOR ALL
  USING (
    public.current_app_role() = 'admin'
    OR (public.current_app_role() = 'is' AND is_owner_id = public.current_user_master_id())
  )
  WITH CHECK (
    public.current_app_role() = 'admin'
    OR (public.current_app_role() = 'is' AND is_owner_id = public.current_user_master_id())
  );


-- ============================================================
-- SECTION 8 — vm_updates policies
-- ============================================================
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'vm_updates' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.vm_updates', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "vm_updates_all" ON public.vm_updates
  FOR ALL
  USING  (public.current_app_role() IN ('admin', 'vm'))
  WITH CHECK (public.current_app_role() IN ('admin', 'vm'));


-- ============================================================
-- SECTION 9 — incentive_master policies
-- ============================================================
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'incentive_master' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.incentive_master', r.policyname);
  END LOOP;
END $$;

-- SELECT: admin, vm, is see all; CP sees own
CREATE POLICY "incentive_select" ON public.incentive_master
  FOR SELECT USING (
    public.current_app_role() IN ('admin', 'vm', 'is')
    OR (public.current_app_role() = 'cp' AND cp_id = public.current_cp_id())
  );

-- WRITE: admin only
CREATE POLICY "incentive_write" ON public.incentive_master
  FOR ALL
  USING  (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');


-- ============================================================
-- SECTION 10 — project_master policies
-- ============================================================
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'project_master' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_master', r.policyname);
  END LOOP;
END $$;

-- SELECT: all staff roles; CP sees own projects
CREATE POLICY "project_select" ON public.project_master
  FOR SELECT USING (
    public.current_app_role() IN ('admin', 'vm', 'is', 'scheduling')
    OR (public.current_app_role() = 'cp' AND cp_id = public.current_cp_id())
  );

-- WRITE: admin + vm
CREATE POLICY "project_write" ON public.project_master
  FOR ALL
  USING  (public.current_app_role() IN ('admin', 'vm'))
  WITH CHECK (public.current_app_role() IN ('admin', 'vm'));


-- ============================================================
-- SECTION 11 — notification_master policies
-- ============================================================
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'notification_master' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notification_master', r.policyname);
  END LOOP;
END $$;

-- SELECT: admin sees all; others see broadcasts (audience IS NULL) or their role
CREATE POLICY "notification_select" ON public.notification_master
  FOR SELECT USING (
    public.current_app_role() = 'admin'
    OR audience IS NULL
    OR audience::text = public.current_app_role()::text
  );

-- INSERT: any authenticated user (CP, IS, VM etc. may create notifications)
CREATE POLICY "notification_insert" ON public.notification_master
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- DELETE: admin only
CREATE POLICY "notification_delete" ON public.notification_master
  FOR DELETE USING (public.current_app_role() = 'admin');


-- ============================================================
-- SECTION 12 — Make sure RLS is enabled on every table
-- ============================================================
ALTER TABLE public.user_master         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cp_master           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_master         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_master    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_master      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.is_updates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vm_updates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_master    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_master      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_master ENABLE ROW LEVEL SECURITY;
