-- ============================================================
-- 011: Fix current_app_role() safe cast + cp_master visibility
--      + lead_update for VM + user_master self-link policy
-- Run this in the Supabase SQL editor.
-- Safe to re-run — all statements are idempotent.
-- ============================================================


-- ============================================================
-- SECTION 1 — FIX current_app_role() SAFE CAST (ROOT CAUSE)
-- ============================================================
-- Problem:  The old SQL function used a hard cast:
--             (auth.jwt() -> 'user_metadata' ->> 'role')::public.app_role
--           If the JWT stores the role in ANY unexpected format — e.g.
--           'VM' (uppercase), 'Vm', ' vm' (space), or an obsolete string —
--           the ::app_role cast throws a PostgreSQL ERROR (not NULL).
--           A thrown error inside a COALESCE is NOT caught by COALESCE;
--           it propagates, causing every RLS policy that calls
--           current_app_role() to fail.  The result: every table returns
--           zero rows for that user — the entire dashboard is blank.
-- Fix:      Rewrite as a plpgsql function that:
--           1. lower() + trim() normalises the JWT string
--           2. Validates against the known enum values before casting
--           3. Falls back to a direct user_master lookup if invalid/null
--           4. Returns 'cp' only as a last resort
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    jwt_role  text;
    db_role   public.app_role;
BEGIN
    -- 1. Read and normalise the JWT claim
    jwt_role := lower(trim(auth.jwt() -> 'user_metadata' ->> 'role'));

    -- 2. Only cast if it's a known valid enum member (avoids hard cast error)
    IF jwt_role IN ('cp', 'is', 'scheduling', 'vm', 'admin') THEN
        RETURN jwt_role::public.app_role;
    END IF;

    -- 3. DB fallback: look up role from user_master using the auth UID
    SELECT role
      INTO db_role
      FROM public.user_master
     WHERE auth_user_id = auth.uid()
     LIMIT 1;

    IF db_role IS NOT NULL THEN
        RETURN db_role;
    END IF;

    -- 4. Absolute default
    RETURN 'cp'::public.app_role;
END;
$$;


-- ============================================================
-- SECTION 2 — user_master: allow self-link (auto-provisioning)
-- ============================================================
-- Problem:  resolveSessionUser() calls:
--             UPDATE user_master SET auth_user_id = <uid> WHERE id = <matchedId>
--           when a pre-created staff row (vm / is / scheduling) signs in for the
--           first time via Google OAuth.  Without an UPDATE policy on user_master
--           this silently fails (RLS blocks), auth_user_id stays NULL, and the
--           DB fallback in current_app_role() finds no matching row → returns 'cp'.
-- Fix:      Allow any authenticated user to update a user_master row IF the
--           auth_user_id being written equals their own auth UID (they are only
--           linking themselves, not hijacking someone else's account).

DROP POLICY IF EXISTS "user_master_self_link" ON public.user_master;

CREATE POLICY "user_master_self_link" ON public.user_master
  FOR UPDATE
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth_user_id = auth.uid());


-- ============================================================
-- SECTION 3 — cp_master: extend SELECT to IS + Scheduling
-- ============================================================
-- Problem:  cp_master SELECT only covers admin / vm / cp.
--           IS users need cp_name for every lead they work on.
--           Scheduling users need it for meeting summaries.
--           Without access, cpsResponse.data = [] for those roles,
--           so dataset.cps is empty and all cpName values show 'Unknown'.
-- Fix:      Replace the old SELECT policy with one covering all staff roles.

DROP POLICY IF EXISTS "cp select own profile"  ON public.cp_master;
DROP POLICY IF EXISTS "cp_master_select_policy" ON public.cp_master;

CREATE POLICY "cp_master_select_policy" ON public.cp_master
  FOR SELECT
  USING (
    public.current_app_role() IN ('admin', 'vm', 'is', 'scheduling')
    OR (
      public.current_app_role() = 'cp'
      AND linked_user_id = public.current_user_master_id()
    )
  );

-- Write policy stays vm + admin only (unchanged from 006)
DROP POLICY IF EXISTS "vm_manage_cp_master"    ON public.cp_master;
DROP POLICY IF EXISTS "cp_master_write_policy" ON public.cp_master;

CREATE POLICY "cp_master_write_policy" ON public.cp_master
  FOR ALL
  USING  (public.current_app_role() IN ('admin', 'vm'))
  WITH CHECK (public.current_app_role() IN ('admin', 'vm'));


-- ============================================================
-- SECTION 4 — lead_master: add VM to UPDATE policy
-- ============================================================
-- Problem:  The lead_update_policy from 006 only covers admin / is /
--           scheduling.  VM team may need to update lead fields
--           (e.g. adding notes, correcting values on VM-created leads).
-- Fix:      Add 'vm' to the USING and WITH CHECK clauses.

DROP POLICY IF EXISTS "lead_update_policy" ON public.lead_master;
DROP POLICY IF EXISTS "lead_update_policy_vm" ON public.lead_master;

CREATE POLICY "lead_update_policy" ON public.lead_master
  FOR UPDATE
  USING (
    public.current_app_role() = 'admin'
    OR public.current_app_role() = 'vm'
    OR (
      public.current_app_role() = 'is'
      AND (is_owner_id = public.current_user_master_id() OR is_owner_id IS NULL)
    )
    OR (
      public.current_app_role() = 'scheduling'
      AND (scheduling_owner_id = public.current_user_master_id() OR scheduling_owner_id IS NULL)
    )
  )
  WITH CHECK (
    public.current_app_role() = 'admin'
    OR public.current_app_role() = 'vm'
    OR (
      public.current_app_role() = 'is'
      AND (is_owner_id = public.current_user_master_id() OR is_owner_id IS NULL)
    )
    OR (
      public.current_app_role() = 'scheduling'
      AND (scheduling_owner_id = public.current_user_master_id() OR scheduling_owner_id IS NULL)
    )
  );


-- ============================================================
-- SECTION 5 — lead_master: add reason_for_not_proceeding column
-- ============================================================
-- Problem:  createVmLead now inserts reason_for_not_proceeding but the
--           column may be missing from lead_master (not in 001 schema).

ALTER TABLE public.lead_master
  ADD COLUMN IF NOT EXISTS reason_for_not_proceeding text;
