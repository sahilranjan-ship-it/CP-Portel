
-- ADD ONBOARDING COLUMNS TO CP MASTER
ALTER TABLE public.cp_master ADD COLUMN IF NOT EXISTS onboarding_vm_name text;
ALTER TABLE public.cp_master ADD COLUMN IF NOT EXISTS onboarding_call_status text;
ALTER TABLE public.cp_master ADD COLUMN IF NOT EXISTS onboarding_meeting_status text;
ALTER TABLE public.cp_master ADD COLUMN IF NOT EXISTS onboarding_meeting_scheduled_date text;
ALTER TABLE public.cp_master ADD COLUMN IF NOT EXISTS onboarding_aligned_for_activation text;
ALTER TABLE public.cp_master ADD COLUMN IF NOT EXISTS onboarding_mode_of_meeting text;
ALTER TABLE public.cp_master ADD COLUMN IF NOT EXISTS onboarding_cp_ready_for_signing text;
ALTER TABLE public.cp_master ADD COLUMN IF NOT EXISTS onboarding_agreement_sent_status text DEFAULT 'Pending';
ALTER TABLE public.cp_master ADD COLUMN IF NOT EXISTS onboarding_cp_signed_status text DEFAULT 'Pending';
ALTER TABLE public.cp_master ADD COLUMN IF NOT EXISTS onboarding_signed_agreement_url text;

-- ALSO ENSURE BMS PRIORITY HAS A DEFAULT
ALTER TABLE public.cp_master ALTER COLUMN bms_priority SET DEFAULT 'Medium';
