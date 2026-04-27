-- ============================================================
-- 013: Safety re-apply of current_app_role() plpgsql function
-- Run this in the Supabase SQL editor.
-- Safe to re-run — CREATE OR REPLACE is idempotent.
-- ============================================================
--
-- Root cause this addresses:
--   If migration 011 was applied but the SQL editor reported a
--   non-fatal warning and continued with older statements, the
--   original sql-language current_app_role() from migration 006
--   may still be in place.  That function does a hard enum cast:
--
--       (auth.jwt() -> 'user_metadata' ->> 'role')::public.app_role
--
--   If user_metadata.role is 'VM', 'Is', 'Scheduling' (any case
--   variation), the cast THROWS a PostgreSQL exception.  Exceptions
--   inside a COALESCE are NOT suppressed — they propagate and make
--   EVERY RLS policy that calls current_app_role() fail.  Result:
--   every table returns 0 rows for that user.
--
--   The plpgsql rewrite below is safe: it lower()s + trim()s the
--   JWT value, validates it against the known enum members, and
--   falls back to a SECURITY DEFINER DB lookup before defaulting
--   to 'cp'.  No hard cast is ever attempted on an unknown value.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER          -- bypass RLS on user_master for the DB fallback
SET search_path = public  -- pin schema so search_path injection is impossible
AS $$
DECLARE
    jwt_role text;
    db_role  public.app_role;
BEGIN
    -- 1. Read and normalise the JWT claim (handles 'VM', 'Is', etc.)
    jwt_role := lower(trim(
        auth.jwt() -> 'user_metadata' ->> 'role'
    ));

    -- 2. Only cast if it is a known valid enum member (avoids hard-cast error)
    IF jwt_role IN ('cp', 'is', 'scheduling', 'vm', 'admin') THEN
        RETURN jwt_role::public.app_role;
    END IF;

    -- 3. DB fallback: look up role from user_master using the auth UID.
    --    SECURITY DEFINER means this SELECT bypasses user_master RLS.
    SELECT role
      INTO db_role
      FROM public.user_master
     WHERE auth_user_id = auth.uid()
     LIMIT 1;

    IF db_role IS NOT NULL THEN
        RETURN db_role;
    END IF;

    -- 4. Absolute safe default
    RETURN 'cp'::public.app_role;
END;
$$;

-- Grant execute to authenticated and anon so RLS policies can call it
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated, anon;
