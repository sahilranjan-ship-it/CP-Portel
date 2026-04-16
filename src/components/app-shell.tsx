import { NavLink, Outlet } from 'react-router-dom'
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
    { label: 'Active Leads', icon: '📊', path: '/dashboard/leads' },
    { label: 'Won Leads', icon: '🏆', path: '/dashboard/won' },
    { label: 'Earnings', icon: '💰', path: '/dashboard/earnings' },
  ],
  is: [
    { label: 'Call Queue', icon: '📞', path: '/dashboard' },
    { label: 'IS Insights', icon: '💡', path: '/dashboard/is-insights' },
    { label: 'My Leads', icon: '🎯', path: '/dashboard/leads' },
  ],
  scheduling: [
    { label: 'Daily Queue', icon: '📅', path: '/dashboard' },
    { label: 'Timeline', icon: '🕒', path: '/dashboard/timeline' },
    { label: 'All Meetings', icon: '🏠', path: '/dashboard/meetings' },
  ],
  vm: [
    { label: 'CP Master', icon: '👤', path: '/dashboard' },
    { label: 'Onboarding', icon: '📋', path: '/dashboard/vm' },
    { label: 'Lead Creation', icon: '➕', path: '/dashboard/leads' },
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
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
          <div className="search-bar">
            <span>🔍</span>
            <input type="text" placeholder={`Search ${activeRole} data...`} />
          </div>

          <div className="top-actions">
            <div style={{ marginRight: '16px', textAlign: 'right' }}>
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
