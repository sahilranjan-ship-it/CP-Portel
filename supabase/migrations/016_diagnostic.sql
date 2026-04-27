-- ============================================================
-- DIAGNOSTIC: Run this as Supabase admin to see exact state
-- ============================================================

-- 1. Check Sahil's user_master row (is auth_user_id set?)
SELECT 
    id,
    full_name,
    email,
    role,
    auth_user_id,
    CASE WHEN auth_user_id IS NULL THEN '❌ NOT LINKED - THIS IS THE BUG' 
         ELSE '✅ Linked to auth UID' END AS link_status
FROM public.user_master
WHERE email = 'sahil.ranjan@bricknbolt.com';

-- 2. Check CP record state after merge
SELECT 
    cp_code,
    cp_name,
    email,
    linked_user_id,
    total_assigned_projects,
    active_projects,
    total_portfolio_value_cr,
    CASE WHEN linked_user_id IS NULL THEN '❌ NO LINK - CP is invisible to CP RLS'
         ELSE '✅ Has linked_user_id' END AS link_status
FROM public.cp_master
WHERE email = 'sahil.ranjan@bricknbolt.com';

-- 3. Check agreement status
SELECT 
    am.id,
    am.agreement_status,
    am.agreement_sent_date,
    cp.cp_code
FROM public.agreement_master am
JOIN public.cp_master cp ON cp.id = am.cp_id
WHERE cp.email = 'sahil.ranjan@bricknbolt.com';

-- 4. THE KEY CHECK: Does the chain connect?
-- user_master.auth_user_id → cp_master.linked_user_id = user_master.id
SELECT
    um.id AS user_master_id,
    um.auth_user_id,
    cp.cp_code,
    cp.linked_user_id,
    CASE WHEN cp.linked_user_id = um.id THEN '✅ Chain connected correctly'
         ELSE '❌ CHAIN BROKEN - linked_user_id does not match user_master.id'
    END AS chain_status
FROM public.user_master um
LEFT JOIN public.cp_master cp ON cp.linked_user_id = um.id
WHERE um.email = 'sahil.ranjan@bricknbolt.com';
