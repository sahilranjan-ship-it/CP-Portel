import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/app-shell'
import { AuthPage } from './features/auth/auth-page'
import { CpDashboard } from './features/dashboard/cp-dashboard'
import { IsDashboard } from './features/dashboard/is-dashboard'
import { SchedulingDashboard } from './features/dashboard/scheduling-dashboard'
import { VmDashboard } from './features/dashboard/vm-dashboard'
import { AdminDashboard } from './features/dashboard/admin-dashboard'
import { isSupabaseConfigured, resolveSessionUser, signInWithGoogle, signOut, supabase, type SessionUser } from './lib/supabase'
import type { Role } from './types/domain'
import { AppDataProvider } from './data/app-data-provider'

function DashboardRouter({
  activeRole,
  sessionUser,
}: {
  activeRole: Role
  sessionUser: SessionUser
}) {
  switch (activeRole) {
    case 'cp':
      return <CpDashboard sessionUser={sessionUser} />
    case 'is':
      return <IsDashboard sessionUser={sessionUser} />
    case 'scheduling':
      return <SchedulingDashboard sessionUser={sessionUser} />
    case 'vm':
      return <VmDashboard sessionUser={sessionUser} />
    case 'admin':
      return <AdminDashboard sessionUser={sessionUser} />
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

  useEffect(() => {
    if (!supabase) {
      setBooting(false)
      setError('Supabase is not configured.')
      return
    }

    const syncSession = async (user: any) => {
      if (!user?.email) {
        setIsAuthenticated(false)
        setSessionUser(null)
        setActiveRole(null)
        setBooting(false)
        return
      }

      try {
        const resolvedUser = await resolveSessionUser(user)
        setSessionUser(resolvedUser)
        setActiveRole(resolvedUser.role)
        setIsAuthenticated(true)
        setError(null)
      } catch (caughtError) {
        setIsAuthenticated(false)
        setError(caughtError instanceof Error ? caughtError.message : 'Auth Error')
        await supabase.auth.signOut()
      } finally {
        setBooting(false)
      }
    }

    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      syncSession(data.session?.user)
    })

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        setIsAuthenticated(false)
        setSessionUser(null)
        setActiveRole(null)
        setBooting(false)
      } else if (session?.user) {
        syncSession(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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
