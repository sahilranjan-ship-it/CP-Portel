
-- ADD MISSING COLUMNS TO CP MASTER
ALTER TABLE public.cp_master ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'CONTRACTOR';
ALTER TABLE public.cp_master ADD COLUMN IF NOT EXISTS lowest_percentage_completed numeric(5,2) DEFAULT 0;

-- Ensure total_assigned_projects and other metrics are numeric/int as expected
-- already in initial schema but good to verify
ALTER TABLE public.cp_master ALTER COLUMN total_assigned_projects SET DEFAULT 0;
ALTER TABLE public.cp_master ALTER COLUMN active_projects SET DEFAULT 0;
ALTER TABLE public.cp_master ALTER COLUMN total_portfolio_value_cr SET DEFAULT 0;

-- Re-enable RLS for safety (already enabled but just in case)
ALTER TABLE public.cp_master ENABLE ROW LEVEL SECURITY;
