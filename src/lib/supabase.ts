import { createClient } from '@supabase/supabase-js'
import type { Role } from '../types/domain'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
    : null

export const isSupabaseConfigured = Boolean(supabase)

export type SessionUser = {
  id: string // auth.uid()
  userMasterId: string // user_master.id
  email: string
  role: Role
  name: string
}

type AuthUserLike = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}

function formatAuthErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Unable to sign in with Google.'
  }

  const message = error.message

  if (
    message.includes('Unsupported provider') ||
    message.includes('provider is not enabled')
  ) {
    return 'Google sign-in is not enabled in this Supabase project. Go to Supabase Authentication -> Providers -> Google, enable it.'
  }

  return message
}

export async function signInWithGoogle() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  })

  if (error) {
    throw new Error(formatAuthErrorMessage(error))
  }

  return data
}

export async function resolveSessionUser(user: AuthUserLike): Promise<SessionUser> {
  const email = user.email ?? ''

  if (!supabase) {
    throw new Error('Supabase integration missing.')
  }

  // 1. Check by linked auth_user_id
  const { data, error: fetchError } = await supabase
    .from('user_master')
    .select('id, full_name, email, role')
    .eq('auth_user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (fetchError) {
    console.error('Error fetching user_master by auth_user_id:', fetchError)
  }

  let matchedUser = data

  // 2. Check by email (Auto-link for first time)
  if (!matchedUser) {
    const { data: emailMatch, error: emailError } = await supabase
      .from('user_master')
      .select('id, full_name, email, role, auth_user_id')
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (emailError) {
      console.error('Error fetching user_master by email:', emailError)
    }

    if (emailMatch?.email && emailMatch?.role && emailMatch?.full_name) {
      if (emailMatch.auth_user_id) {
        throw new Error(`This email (${email}) is already linked to another account.`)
      }

      // Auto-link
      console.log('Auto-linking auth user to user_master:', { authId: user.id, masterId: emailMatch.id })
      const { error: linkError } = await supabase
        .from('user_master')
        .update({ auth_user_id: user.id })
        .eq('id', emailMatch.id)

      if (linkError) throw linkError
      matchedUser = emailMatch
    }
  }

  // 3. AUTO-PROVISION GUARD: If the trigger failed or hasn't run yet, we provision manually
  if (!matchedUser) {
    console.warn('User record NOT found, auto-provisioning now...', user.id)

    // 3a. Create user_master first
    const { data: newUser, error: createError } = await supabase
      .from('user_master')
      .insert({
        auth_user_id: user.id,
        email: email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0],
        role: 'cp',
        city: 'Not Set',
        active: true
      })
      .select()
      .single()

    if (createError) {
      console.error('Manual provisioning failed:', createError)
      throw new Error(`Auth Sync Error: ${createError.message}. Please contact support.`)
    }

    matchedUser = newUser

    // 3b. LINK or Create CP record
    // First check if a CP record with this email already exists but isn't linked
    const { data: existingCp } = await supabase
      .from('cp_master')
      .select('id')
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (existingCp) {
      console.log('Linking new user to existing CP record:', existingCp.id)
      await supabase.from('cp_master').update({ linked_user_id: matchedUser.id }).eq('id', existingCp.id)
    } else {
      console.log('Creating brand new CP record for first-time user')
      const { error: cpError } = await supabase.from('cp_master').insert({
        cp_code: `CP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        cp_name: matchedUser.full_name,
        email: email,
        linked_user_id: matchedUser.id,
        city: 'Location Pending',
        phone: 'Contact Unverified',
        tier: 'Platinum',
        eligible_for_project: true
      })
      if (cpError) console.error('CP record creation failed during auto-link:', cpError)
    }
  }

  if (matchedUser?.email && matchedUser?.role && matchedUser?.full_name) {
    const targetRole = matchedUser.role.toLowerCase() as Role

    // Use the RAW (un-normalised) JWT value for comparison.
    // If it is 'VM', 'Vm', 'Is', etc. we need an exact mismatch so that
    // supabase.auth.updateUser() is called and the token is rewritten with
    // the correct lowercase value.  Lowercasing both sides before comparing
    // would mask the drift and leave an uppercase value in the JWT forever,
    // causing `current_app_role()` in PostgreSQL to throw a hard enum-cast
    // error and return 0 rows from every RLS-protected table.
    const rawMetadataRole = user.user_metadata?.role as string | undefined

    // 🔄 ROLE SYNC: Ensure JWT metadata exactly matches user_master role for RLS
    if (rawMetadataRole !== targetRole) {
      console.log(`[resolveSessionUser] Syncing JWT role: "${rawMetadataRole}" → "${targetRole}"`)
      await supabase.auth.updateUser({
        data: { role: targetRole }
      })
    }

    return {
      id: user.id,
      userMasterId: matchedUser.id,
      email: matchedUser.email,
      role: targetRole,
      name: matchedUser.full_name,
    }
  }

  throw new Error('Critical Auth Error: Unable to resolve or create user profile.')
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}
