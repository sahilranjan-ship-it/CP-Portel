-- ============================================================
-- 012: VM data visibility hardening + auth_user_id self-link fix
-- Run this in the Supabase SQL editor.
-- Safe to re-run — all statements are idempotent.
-- ============================================================
--
-- Root cause addressed:
--   When a VM user signs in for the first time the following
--   sequence can leave cp_master returning 0 rows:
--
--   1. AppDataProvider.loadDataset() fires on mount BEFORE
--      resolveSessionUser() has completed the auto-link
--      (UPDATE user_master SET auth_user_id = ...).
--   2. current_app_role() finds no matching user_master row
--      (auth_user_id IS NULL) and falls back to 'cp'.
--   3. RLS on cp_master blocks the query for 'cp' role with
--      mismatched linked_user_id → returns 0 rows.
--
--   The frontend fix (ReloadOnAuth in App.tsx) handles the
--   race condition by re-running loadDataset() once the auth
--   session is confirmed.  This migration hardens the DB side
--   so every subsequent request is also correct.
-- ============================================================


-- ============================================================
-- SECTION 1 — Harden user_master self-link UPDATE policy
-- ============================================================
-- The 011 policy USING clause allowed any authenticated user to
-- target ANY user_master row for UPDATE (only the WITH CHECK
-- restricted the final value).  Tighten the USING clause so
-- a user can only UPDATE rows where auth_user_id IS NULL
-- (un-linked) OR already equals their own UID (re-linking).
-- This prevents an authenticated user from touching a row
-- that already belongs to someone else.

DROP POLICY IF EXISTS "user_master_self_link" ON public.user_master;

CREATE POLICY "user_master_self_link" ON public.user_master
  FOR UPDATE
  USING  (
    auth.role() = 'authenticated'
    AND (auth_user_id IS NULL OR auth_user_id = auth.uid())
  )
  WITH CHECK (auth_user_id = auth.uid());


-- ============================================================
-- SECTION 2 — Confirm lead_master SELECT includes 'vm'
-- ============================================================
-- Migration 006 added 'vm' to lead_select_policy.
-- Re-apply defensively in case 006 was not fully executed or
-- was later overridden.

DROP POLICY IF EXISTS "lead_select_policy"    ON public.lead_master;
DROP POLICY IF EXISTS "role based lead select" ON public.lead_master;

CREATE POLICY "lead_select_policy" ON public.lead_master
  FOR SELECT
  USING (
    public.current_app_role() = 'admin'
    OR public.current_app_role() = 'vm'
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


-- ============================================================
-- SECTION 3 — Confirm lead_master INSERT includes 'vm'
-- ============================================================
DROP POLICY IF EXISTS "lead_insert_policy"       ON public.lead_master;
DROP POLICY IF EXISTS "cp insert own leads"      ON public.lead_master;
DROP POLICY IF EXISTS "allow_cp_and_vm_insert_leads" ON public.lead_master;

CREATE POLICY "lead_insert_policy" ON public.lead_master
  FOR INSERT
  WITH CHECK (
    public.current_app_role() = 'admin'
    OR public.current_app_role() = 'vm'
    OR (public.current_app_role() = 'cp' AND cp_id = public.current_cp_id())
  );


-- ============================================================
-- SECTION 4 — Confirm lead_master UPDATE includes 'vm'
-- ============================================================
-- Already set in 011 but drop/re-create to guarantee it is
-- present even if 011 was partially applied.

DROP POLICY IF EXISTS "lead_update_policy"    ON public.lead_master;
DROP POLICY IF EXISTS "role based lead update" ON public.lead_master;

CREATE POLICY "lead_update_policy" ON public.lead_master
  FOR UPDATE
  USING (
    public.current_app_role() = 'admin'
    OR public.current_app_role() = 'vm'
    OR (public.current_app_role() = 'is'         AND (is_owner_id          = public.current_user_master_id() OR is_owner_id IS NULL))
    OR (public.current_app_role() = 'scheduling' AND (scheduling_owner_id  = public.current_user_master_id() OR scheduling_owner_id IS NULL))
  )
  WITH CHECK (
    public.current_app_role() = 'admin'
    OR public.current_app_role() = 'vm'
    OR (public.current_app_role() = 'is'         AND (is_owner_id          = public.current_user_master_id() OR is_owner_id IS NULL))
    OR (public.current_app_role() = 'scheduling' AND (scheduling_owner_id  = public.current_user_master_id() OR scheduling_owner_id IS NULL))
  );


-- ============================================================
-- SECTION 5 — Confirm cp_master policies (idempotent re-apply)
-- ============================================================
-- Ensures the correct split of SELECT vs write policies survives
-- a partial or out-of-order migration run.

DROP POLICY IF EXISTS "cp select own profile"  ON public.cp_master;
DROP POLICY IF EXISTS "cp_master_select_policy" ON public.cp_master;
DROP POLICY IF EXISTS "vm_manage_cp_master"    ON public.cp_master;
DROP POLICY IF EXISTS "vm write cp master"     ON public.cp_master;
DROP POLICY IF EXISTS "cp_master_write_policy" ON public.cp_master;

-- All staff roles can SELECT; CP can only see their own row.
CREATE POLICY "cp_master_select_policy" ON public.cp_master
  FOR SELECT
  USING (
    public.current_app_role() IN ('admin', 'vm', 'is', 'scheduling')
    OR (
      public.current_app_role() = 'cp'
      AND linked_user_id = public.current_user_master_id()
    )
  );

-- Only admin and vm can write (INSERT / UPDATE / DELETE).
CREATE POLICY "cp_master_write_policy" ON public.cp_master
  FOR ALL
  USING  (public.current_app_role() IN ('admin', 'vm'))
  WITH CHECK (public.current_app_role() IN ('admin', 'vm'));
