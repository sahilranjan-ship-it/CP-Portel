import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/app-shell'
import { AuthPage } from './features/auth/auth-page'
import { CpDashboard } from './features/dashboard/cp-dashboard'
import { IsDashboard } from './features/dashboard/is-dashboard'
import { SchedulingDashboard } from './features/dashboard/scheduling-dashboard'
import { VmDashboard } from './features/dashboard/vm-dashboard'
import { AdminDashboard } from './features/dashboard/admin-dashboard'
import { resolveSessionUser, signInWithGoogle, signOut, supabase, type SessionUser } from './lib/supabase'
import type { Role } from './types/domain'
import { AppDataProvider } from './data/app-data-provider'
import { useAppData } from './data/app-data'

// ── ReloadOnAuth ─────────────────────────────────────────────────────────────────────────────
// Sits inside AppDataProvider so it can call reload().
// Fires a fresh loadDataset() whenever the authenticated user's ID changes
// (i.e. right after resolveSessionUser completes and has synced the role into the JWT).
// This ensures cp_master / lead_master queries run with the CORRECT role in the JWT,
// not the stale/missing role that may have been in the token when AppDataProvider first mounted.
function ReloadOnAuth({ authUserId }: { authUserId: string | null }) {
  const { reload } = useAppData()
  useEffect(() => {
    if (authUserId) {
      void reload()
    }
  }, [authUserId, reload])
  return null
}

function DashboardRouter({
  activeRole,
  sessionUser,
}: {
  activeRole: Role
  sessionUser: SessionUser
}) {
  const location = useLocation()
  const subPath = location.pathname.split('/').pop() || ''

  switch (activeRole) {
    case 'cp':
      return <CpDashboard sessionUser={sessionUser} subPath={subPath} />
    case 'is':
      return <IsDashboard sessionUser={sessionUser} subPath={subPath} />
    case 'scheduling':
      return <SchedulingDashboard sessionUser={sessionUser} subPath={subPath} />
    case 'vm':
      return <VmDashboard sessionUser={sessionUser} subPath={subPath} />
    case 'admin':
      return <AdminDashboard sessionUser={sessionUser} subPath={subPath} />
    default:
      return <div>Access Denied: Unknown Role</div>
  }
}

export function App() {
  const [loading, setLoading] = useState(false)
  const [booting, setBooting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [activeRole, setActiveRole] = useState<Role | null>(null)

  const [syncInProgress, setSyncInProgress] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setBooting(false)
      setError('Supabase is not configured.')
      return
    }

    const syncSession = async (user: any) => {
      if (syncInProgress) return
      setSyncInProgress(true)

      if (!user?.email) {
        setIsAuthenticated(false)
        setSessionUser(null)
        setActiveRole(null)
        setBooting(false)
        setSyncInProgress(false)
        return
      }

      try {
        const resolvedUser = await resolveSessionUser(user)
        setSessionUser(resolvedUser)
        setActiveRole(resolvedUser.role)
        setIsAuthenticated(true)
        setError(null)

        // Clean up URL hash after successful login fragment parsing
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      } catch (caughtError) {
        setIsAuthenticated(false)
        setError(caughtError instanceof Error ? caughtError.message : 'Auth Error')
        await supabase?.auth.signOut()
      } finally {
        setBooting(false)
        setSyncInProgress(false)
      }
    }

    // Single source of truth for auth state
    // onAuthStateChange fires INITIAL_SESSION immediately on start
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[Auth Event] ${event}`, session?.user?.email)

      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false)
        setSessionUser(null)
        setActiveRole(null)
        setBooting(false)
      } else if (session?.user) {
        syncSession(session.user)
      } else {
        // Handle cases where session is null (e.g. initial load with no session)
        setBooting(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [syncInProgress])

  async function handleGoogleSignIn() {
    try {
      setLoading(true)
      setError(null)
      await signInWithGoogle()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Sign-in failed.')
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    setIsAuthenticated(false)
    setSessionUser(null)
    setActiveRole(null)
  }

  if (booting) {
    return (
      <div className="boot-screen" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loader" style={{ marginBottom: '16px' }}>Connecting...</div>
          <p style={{ color: 'var(--text-muted)' }}>Brick & Bolt CRM Ecosystem</p>
        </div>
      </div>
    )
  }

  return (
    <AppDataProvider>
      <BrowserRouter>
        {/* Re-fetch all data once auth resolves so RLS policies see the correct role */}
        <ReloadOnAuth authUserId={sessionUser?.id ?? null} />
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated && sessionUser && activeRole
                ? <Navigate to="/dashboard" replace />
                : <AuthPage onGoogleSignIn={handleGoogleSignIn} loading={loading} error={error} />
            }
          />
          <Route
            path="/dashboard"
            element={
              !isAuthenticated || !sessionUser || !activeRole
                ? <Navigate to="/" replace />
                : (
                  <AppShell
                    activeRole={activeRole}
                    sessionUser={sessionUser}
                    onSignOut={handleSignOut}
                  />
                )
            }
          >
            <Route index element={<DashboardRouter activeRole={activeRole!} sessionUser={sessionUser!} />} />
            <Route path="*" element={<DashboardRouter activeRole={activeRole!} sessionUser={sessionUser!} />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppDataProvider>
  )
}

export default App
