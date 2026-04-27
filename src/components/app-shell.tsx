import { useState, useEffect, useCallback } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '../types/domain'
import type { SessionUser } from '../lib/supabase'

const roleLabels: Record<Role, string> = {
  cp: 'Contractor Portal',
  is: 'IS Team',
  scheduling: 'Scheduling Team',
  vm: 'VM Team',
  admin: 'Admin Console',
}

interface NavItem {
  label: string
  icon: string
  path: string
}

const roleNavItems: Record<Role, NavItem[]> = {
  admin: [
    { label: 'CP Overview', icon: '👤', path: '/dashboard' },
    { label: 'Lead Overview', icon: '📊', path: '/dashboard/leads' },
    { label: 'IS Performance', icon: '📞', path: '/dashboard/is-performance' },
    { label: 'Scheduling Perf', icon: '📅', path: '/dashboard/scheduling-performance' },
    { label: 'VM Performance', icon: '🤝', path: '/dashboard/vm-performance' },
    { label: 'Incentives', icon: '💰', path: '/dashboard/incentives' },
    { label: 'Agreements', icon: '📝', path: '/dashboard/agreements' },
    { label: 'Meetings', icon: '🏠', path: '/dashboard/meetings' },
    { label: 'Projects', icon: '🏗️', path: '/dashboard/projects' },
    { label: 'Notifications', icon: '🔔', path: '/dashboard/notifications' },
  ],
  cp: [
    { label: 'Profile & Hub', icon: '🏠', path: '/dashboard' },
    { label: 'Earnings', icon: '💰', path: '/dashboard/earnings' },
    { label: 'Agreements', icon: '📝', path: '/dashboard/agreements' },
  ],
  is: [
    { label: 'Call Queue', icon: '📞', path: '/dashboard' },
  ],
  scheduling: [
    { label: 'Daily Queue', icon: '📅', path: '/dashboard' },
    { label: 'Timeline', icon: '🕒', path: '/dashboard/timeline' },
    { label: 'All Meetings', icon: '🏠', path: '/dashboard/meetings' },
  ],
  vm: [
    { label: 'CP Master', icon: '👤', path: '/dashboard' },
    { label: 'Onboarding', icon: '📋', path: '/dashboard/onboarding' },
    { label: 'Lead Creation', icon: '➕', path: '/dashboard/lead-creation' },
  ],
}

export function AppShell({
  activeRole,
  sessionUser,
  onSignOut,
}: {
  activeRole: Role
  sessionUser: SessionUser
  onSignOut: () => void
}) {
  const navItems = roleNavItems[activeRole] || []
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Close sidebar on route change (mobile navigation)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen])

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), [])

  return (
    <div className={`app-shell role-${activeRole}`}>
      {/* Overlay for mobile sidebar */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">BB</div>
          <span>{roleLabels[activeRole]}</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.path === '/dashboard'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-footer-btn" onClick={onSignOut} style={{ color: 'var(--danger)' }}>
            <span>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      <div className="main-container">
        <header className="top-bar">
          {/* Hamburger menu button — visible only on mobile via CSS */}
          <button
            className="mobile-menu-btn"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
            type="button"
          >
            {sidebarOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>

          <div className="search-bar">
            <span>🔍</span>
            <input type="text" placeholder={`Search ${activeRole} data...`} />
          </div>

          <div className="top-actions">
            <div className="user-name-block" style={{ marginRight: '16px', textAlign: 'right' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{sessionUser.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{activeRole}</div>
            </div>
            <div className="user-profile">
              <div className="avatar">
                {sessionUser.name.slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
