-- ============================================================
-- 010: Fix enum values and RLS gaps (code-review-graph audit)
-- Run this in the Supabase SQL editor.
-- Safe to re-run — all statements are idempotent.
-- ============================================================


-- ============================================================
-- SECTION 1 — ENUM FIXES
-- ============================================================

-- 1a. agreement_status was originally ('Pending', 'Done') only.
--     Code now writes:
--       'Sent'   — VM sends the agreement to the CP
--       'Signed' — CP digitally signs it
--     Without these values every write will throw a type-cast error.
ALTER TYPE public.agreement_status ADD VALUE IF NOT EXISTS 'Sent';
ALTER TYPE public.agreement_status ADD VALUE IF NOT EXISTS 'Signed';

-- 1b. partnership_model enum is ('Direct Incentive', 'Shared Construction',
--     'Barter / Exchange', 'Financial Assistance Model').
--     project_master rows are filtered and inserted using the short value 'Barter'
--     (upsertBarterMatch and the loadDataset filter both use this string).
--     Inserting a value not in the enum silently fails or throws a cast error.
ALTER TYPE public.partnership_model ADD VALUE IF NOT EXISTS 'Barter';


-- ============================================================
-- SECTION 2 — user_master: all authenticated users can read
-- ============================================================
-- Problem:  original policy only lets admin or the user themselves SELECT.
--           loadDataset() builds a usersByMasterId map from ALL user rows to
--           resolve FK names (vmOwner, isOwner, schedulingOwner).
--           For IS / VM / scheduling / CP roles the map is empty → every
--           name lookup returns undefined / 'Unassigned'.
-- Fix:      allow any authenticated session to read user_master.
--           This is a read-only policy on non-sensitive columns (names, roles).

DROP POLICY IF EXISTS "user self select"                    ON public.user_master;
DROP POLICY IF EXISTS "user_master_authenticated_select"    ON public.user_master;

CREATE POLICY "user_master_authenticated_select" ON public.user_master
  FOR SELECT
  USING (auth.role() = 'authenticated');


-- ============================================================
-- SECTION 3 — agreement_master: CP can sign their own agreement
-- ============================================================
-- Problem:  existing write policy only allows admin + vm.
--           When a CP clicks "Accept & Sign", updateAgreement() calls:
--             UPDATE agreement_master SET agreement_status = 'Signed' WHERE cp_id = ...
--           This is blocked by RLS → CP gets a permission error and the
--           agreement is never marked as signed.
-- Fix:      add a targeted UPDATE-only policy for the CP's own agreement row.

DROP POLICY IF EXISTS "cp_sign_own_agreement" ON public.agreement_master;

CREATE POLICY "cp_sign_own_agreement" ON public.agreement_master
  FOR UPDATE
  USING (
    public.current_app_role() = 'cp'
    AND cp_id = public.current_cp_id()
  )
  WITH CHECK (
    public.current_app_role() = 'cp'
    AND cp_id = public.current_cp_id()
  );


-- ============================================================
-- SECTION 4 — meeting_master: expand read access
-- ============================================================
-- Problem:  original policy only allows admin + scheduling to access meetings.
--           CP needs to read their own meetings for the "Upcoming Meetings" KPI
--           in the CP portal.  IS and VM need read access for cross-role views.
-- Fix:      split the existing FOR ALL policy into a SELECT policy (broad) and
--           a write policy (scheduling + admin only).

DROP POLICY IF EXISTS "scheduling manages meetings" ON public.meeting_master;
DROP POLICY IF EXISTS "meeting_select_policy"      ON public.meeting_master;
DROP POLICY IF EXISTS "meeting_write_policy"       ON public.meeting_master;

CREATE POLICY "meeting_select_policy" ON public.meeting_master
  FOR SELECT
  USING (
    -- Staff roles see everything
    public.current_app_role() IN ('admin', 'scheduling', 'vm', 'is')
    OR
    -- CP sees only meetings linked to their own leads
    (
      public.current_app_role() = 'cp'
      AND lead_id IN (
        SELECT id FROM public.lead_master
        WHERE cp_id = public.current_cp_id()
      )
    )
  );

CREATE POLICY "meeting_write_policy" ON public.meeting_master
  FOR ALL
  USING  (public.current_app_role() IN ('admin', 'scheduling'))
  WITH CHECK (public.current_app_role() IN ('admin', 'scheduling'));


-- ============================================================
-- SECTION 5 — project_master: expand from admin-only
-- ============================================================
-- Problem:  only the admin full-access policy existed.
--           CP dashboard shows Shared Construction and Barter projects
--           (sharedConstructionProjects, barterProjectMatches in loadDataset).
--           CP users get empty arrays → project sections show no data.
--           VM needs read access for portfolio reporting.
--           VM also needs write access for upsertSharedConstructionProject
--           and upsertBarterMatch (called from VM/admin dashboards).
-- Fix:      replace the single admin policy with separate select + write policies.

DROP POLICY IF EXISTS "admin full access projects" ON public.project_master;
DROP POLICY IF EXISTS "project_select_policy"      ON public.project_master;
DROP POLICY IF EXISTS "project_write_policy"       ON public.project_master;

CREATE POLICY "project_select_policy" ON public.project_master
  FOR SELECT
  USING (
    public.current_app_role() IN ('admin', 'vm', 'is', 'scheduling')
    OR (public.current_app_role() = 'cp' AND cp_id = public.current_cp_id())
  );

CREATE POLICY "project_write_policy" ON public.project_master
  FOR ALL
  USING  (public.current_app_role() IN ('admin', 'vm'))
  WITH CHECK (public.current_app_role() IN ('admin', 'vm'));


-- ============================================================
-- SECTION 6 — incentive_master: VM read access
-- ============================================================
-- Problem:  only admin + CP own can SELECT.
--           Admin dashboard "Incentives" tab loads all incentives — admin is
--           fine.  But VM dashboard pages that reference dataset.incentives
--           return empty for VM users.
-- Fix:      add VM (and IS) to the SELECT policy.
--           Write (payment release) stays admin-only.

DROP POLICY IF EXISTS "cp own incentives"          ON public.incentive_master;
DROP POLICY IF EXISTS "admin updates incentives"   ON public.incentive_master;
DROP POLICY IF EXISTS "incentive_select_policy"    ON public.incentive_master;
DROP POLICY IF EXISTS "incentive_write_policy"     ON public.incentive_master;

CREATE POLICY "incentive_select_policy" ON public.incentive_master
  FOR SELECT
  USING (
    public.current_app_role() IN ('admin', 'vm', 'is')
    OR (public.current_app_role() = 'cp' AND cp_id = public.current_cp_id())
  );

CREATE POLICY "incentive_write_policy" ON public.incentive_master
  FOR ALL
  USING  (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');


-- ============================================================
-- SECTION 7 — is_updates: IS can read all (not just own)
-- ============================================================
-- Problem:  "is_manage_updates" uses is_owner_id = current_user_master_id()
--           for both SELECT and INSERT/UPDATE.  An IS user can only read their
--           own updates; they cannot see team-wide history or compare stats.
-- Fix:      split into a broad SELECT (all IS users see all IS updates) and a
--           write policy (can only insert/update rows they own).

DROP POLICY IF EXISTS "is_manage_updates"         ON public.is_updates;
DROP POLICY IF EXISTS "is own updates"            ON public.is_updates;
DROP POLICY IF EXISTS "is_updates_select_policy"  ON public.is_updates;
DROP POLICY IF EXISTS "is_updates_write_policy"   ON public.is_updates;

CREATE POLICY "is_updates_select_policy" ON public.is_updates
  FOR SELECT
  USING (
    public.current_app_role() IN ('admin', 'vm', 'is')
  );

CREATE POLICY "is_updates_write_policy" ON public.is_updates
  FOR ALL
  USING (
    public.current_app_role() = 'admin'
    OR (
      public.current_app_role() = 'is'
      AND is_owner_id = public.current_user_master_id()
    )
  )
  WITH CHECK (
    public.current_app_role() = 'admin'
    OR (
      public.current_app_role() = 'is'
      AND is_owner_id = public.current_user_master_id()
    )
  );


-- ============================================================
-- SECTION 8 — notification_master: ensure insert is open
-- ============================================================
-- Migration 006 already adds "allow_all_insert_notifications".
-- Re-apply defensively in case it was dropped or not run.

DROP POLICY IF EXISTS "allow_all_insert_notifications" ON public.notification_master;

CREATE POLICY "allow_all_insert_notifications" ON public.notification_master
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
