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
  id: string
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
  const { data } = await supabase
    .from('user_master')
    .select('id, full_name, email, role')
    .eq('auth_user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (data?.email && data?.role && data?.full_name) {
    return {
      id: user.id,
      email: data.email,
      role: data.role as Role,
      name: data.full_name,
    }
  }

  // 2. Check by email (Auto-link for first time)
  const { data: emailMatch } = await supabase
    .from('user_master')
    .select('id, full_name, email, role, auth_user_id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  if (emailMatch?.email && emailMatch?.role && emailMatch?.full_name) {
    if (emailMatch.auth_user_id) {
      throw new Error(`This email (${email}) is already linked to another account.`)
    }

    // Auto-link
    const { error: linkError } = await supabase
      .from('user_master')
      .update({ auth_user_id: user.id })
      .eq('id', emailMatch.id)

    if (linkError) throw linkError

    return {
      id: user.id,
      email: emailMatch.email,
      role: emailMatch.role as Role,
      name: emailMatch.full_name,
    }
  }

  throw new Error(
    'Your account is not provisioned for this CRM. Ask an admin to create a user_master record with your role before signing in.',
  )
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}
