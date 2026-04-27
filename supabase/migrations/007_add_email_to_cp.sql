
-- MIGRATE CP MASTER TO INCLUDE EMAIL
-- This allows linking CPs to portal users via email before the linked_user_id is explicitly set.

-- 1. Add email column to cp_master
ALTER TABLE public.cp_master ADD COLUMN IF NOT EXISTS email text;

-- 2. Update current_cp_id() function to support email-based lookup
-- This ensures RLS policies work for new users who haven't been "linked" yet but have a matching email.
CREATE OR REPLACE FUNCTION public.current_cp_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id
  FROM public.cp_master
  WHERE linked_user_id = public.current_user_master_id()
     OR (linked_user_id IS NULL AND email = (SELECT email FROM public.user_master WHERE id = public.current_user_master_id()))
  LIMIT 1
$$;
