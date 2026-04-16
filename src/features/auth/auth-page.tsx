import { isSupabaseConfigured } from '../../lib/supabase'

export function AuthPage({
  onGoogleSignIn,
  loading,
  error,
}: {
  onGoogleSignIn: () => Promise<void>
  loading: boolean
  error: string | null
}) {
  return (
    <main className="auth-layout">
      <div className="auth-panel">
        <div className="auth-brand">
          <div className="auth-logo">BB</div>
          <h1 className="auth-title">CP Partner CRM</h1>
          <p className="auth-subtitle">Brick & Bolt Operational Ecosystem</p>
        </div>

        <div className="auth-card">
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Welcome Back</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Please authenticate using your company Google account</p>
          </div>

          {error && (
            <div style={{
              padding: '12px 16px',
              background: '#fef2f2',
              color: '#dc2626',
              borderRadius: '12px',
              fontSize: '0.875rem',
              border: '1px solid #fee2e2'
            }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '14px',
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              fontSize: '1rem',
              borderRadius: '12px'
            }}
            disabled={loading || !isSupabaseConfigured}
            onClick={() => void onGoogleSignIn()}
            type="button"
          >
            <span style={{
              background: 'white',
              color: 'var(--primary)',
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 900,
              fontSize: '0.8rem'
            }}>G</span>
            <span>{loading ? 'Authenticating...' : 'Sign in with Google'}</span>
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-light)', lineHeight: 1.5 }}>
            {isSupabaseConfigured
              ? 'Access is strictly limited to authorized personnel. Sign-in attempts are logged for security auditing.'
              : 'Waiting for Supabase configuration environment variables...'}
          </p>
        </div>
      </div>
    </main>
  )
}
