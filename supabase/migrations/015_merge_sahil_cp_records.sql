-- ============================================================
-- 015: Merge duplicate CP records for Sahil Ranjan
-- CP-5B7595F3 = active record (has linked_user_id + agreement)
-- CP-8434     = old record (has real data: 1000 projects, ₹100Cr)
-- This merges CP-8434's data INTO CP-5B7595F3, then deletes CP-8434.
-- ============================================================

-- Step 1: Copy real data from CP-8434 into the active record CP-5B7595F3
UPDATE public.cp_master
SET
  cp_name                     = 'Sahil Ranjan',
  city                        = 'BLR',
  phone                       = '8581949827',
  tier                        = 'Blue',
  bms_priority                = 'High',
  total_assigned_projects     = 1000,
  active_projects             = 100,
  completed_projects          = 0,
  total_portfolio_value_cr    = 100.00,
  lowest_percentage_completed = 1,
  remarks                     = 'Merged from CP-8434'
WHERE cp_code = 'CP-5B7595F3';

-- Step 2: Move any leads pointing to CP-8434 → CP-5B7595F3
UPDATE public.lead_master
SET cp_id = (SELECT id FROM public.cp_master WHERE cp_code = 'CP-5B7595F3')
WHERE cp_id = (SELECT id FROM public.cp_master WHERE cp_code = 'CP-8434');

-- Step 3: Move any vm_updates pointing to CP-8434 → CP-5B7595F3
UPDATE public.vm_updates
SET cp_id = (SELECT id FROM public.cp_master WHERE cp_code = 'CP-5B7595F3')
WHERE cp_id = (SELECT id FROM public.cp_master WHERE cp_code = 'CP-8434');

-- Step 4: Move any agreements pointing to CP-8434 → CP-5B7595F3
UPDATE public.agreement_master
SET cp_id = (SELECT id FROM public.cp_master WHERE cp_code = 'CP-5B7595F3')
WHERE cp_id = (SELECT id FROM public.cp_master WHERE cp_code = 'CP-8434');

-- Step 5: Delete the old CP-8434 (now safely orphaned)
DELETE FROM public.cp_master WHERE cp_code = 'CP-8434';
