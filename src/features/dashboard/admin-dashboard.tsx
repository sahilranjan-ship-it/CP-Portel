import { useState, useMemo } from 'react'
import { useAppData } from '../../data/app-data'
import { formatCurrencyCr, formatDate } from '../../lib/format'
import type { SessionUser } from '../../lib/supabase'
import { useLocation } from 'react-router-dom'

const adminTabs = [
  'CP Overview',
  'Lead Overview',
  'IS Performance',
  'Scheduling Performance',
  'VM Performance',
  'Incentive Tracking',
  'Agreement Tracking',
  'Meetings Dashboard',
  'Project Dashboard',
] as const

type AdminTab = (typeof adminTabs)[number]

export function AdminDashboard({ sessionUser }: { sessionUser: SessionUser }) {
  const { dataset } = useAppData()
  const location = useLocation()

  // Map sub-paths to tabs if they exist
  const getInitialTab = (): AdminTab => {
    const path = location.pathname.split('/').pop()
    switch (path) {
      case 'leads': return 'Lead Overview'
      case 'is-performance': return 'IS Performance'
      case 'scheduling-performance': return 'Scheduling Performance'
      case 'vm-performance': return 'VM Performance'
      case 'incentives': return 'Incentive Tracking'
      case 'agreements': return 'Agreement Tracking'
      case 'meetings': return 'Meetings Dashboard'
      case 'projects': return 'Project Dashboard'
      default: return 'CP Overview'
    }
  }

  const [activeTab, setActiveTab] = useState<AdminTab>(getInitialTab())

  const stats = useMemo(() => ({
    totalCps: dataset.cps.length,
    activeCps: dataset.cps.filter(c => c.eligibleForProject).length,
    totalLeads: dataset.leads.length,
    qualifiedLeads: dataset.leads.filter(l => l.currentStage === 'Qualified').length,
    baCollected: dataset.leads.filter(l => l.baStatus === 'Collected').length,
    totalIncentive: dataset.incentives.reduce((sum, i) => sum + i.incentiveAmountLakh, 0),
    pendingAgreements: dataset.agreements.filter(a => a.status === 'Pending').length,
  }), [dataset])

  return (
    <div className="dashboard-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <header className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <p className="eyebrow" style={{ color: 'var(--primary)', fontWeight: 700 }}>ADMIN CONTROL TOWER</p>
          <h1>System Visibility</h1>
        </div>
      </header>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '32px' }}>
        <div className="stat-card">
          <div className="stat-label">TOTAL CPs</div>
          <div className="stat-value">{stats.totalCps}</div>
          <div className="stat-footer"><span className="trend-up">↑ {stats.activeCps} Active</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">TOTAL LEADS</div>
          <div className="stat-value">{stats.totalLeads}</div>
          <div className="stat-footer"><span>{stats.qualifiedLeads} Qualified</span></div>
        </div>
        <div className="stat-card" style={{ background: 'var(--primary)', color: 'white' }}>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.7)' }}>BA COLLECTED</div>
          <div className="stat-value">{stats.baCollected}</div>
          <div className="stat-footer"><span style={{ color: 'white' }}>Flow Closure</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">PENDING AGREEMENTS</div>
          <div className="stat-value">{stats.pendingAgreements}</div>
          <div className="stat-footer"><span className="trend-down">⚠️ Action Required</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">INCENTIVES RELEASED</div>
          <div className="stat-value">₹{stats.totalIncentive.toFixed(1)}L</div>
          <div className="stat-footer"><span className="trend-up">↑ 14% vs LW</span></div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header" style={{ padding: '0 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div className="tab-row" style={{ margin: 0, gap: '32px' }}>
            {adminTabs.map(tab => (
              <button
                key={tab}
                className={`tab-link ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '20px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: activeTab === tab ? 700 : 500,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="table-container" style={{ padding: '24px' }}>
          {activeTab === 'CP Overview' && (
            <table>
              <thead>
                <tr>
                  <th>CP ID</th>
                  <th>Name / City</th>
                  <th>Projects (A/C)</th>
                  <th>Portfolio Value</th>
                  <th>Performance</th>
                  <th>Leads (Q/BA)</th>
                  <th>Incentive Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dataset.cps.map(cp => (
                  <tr key={cp.id}>
                    <td><code style={{ fontSize: '0.75rem' }}>{cp.id.slice(0, 8)}</code></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{cp.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cp.city}</div>
                    </td>
                    <td>{cp.activeProjects} / {cp.completedProjects}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrencyCr(cp.totalProjectValueCr)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: 'var(--warning)' }}>★</span>
                        <span>{cp.averageCsat.toFixed(1)}</span>
                      </div>
                    </td>
                    <td>{dataset.leads.filter(l => l.cpId === cp.id && l.currentStage === 'Qualified').length} / {dataset.leads.filter(l => l.cpId === cp.id && l.baStatus === 'Collected').length}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>₹1.2L</td>
                    <td><span className={`badge ${cp.eligibleForProject ? 'badge-qualified' : 'badge-pending'}`}>{cp.eligibleForProject ? 'ACTIVE' : 'HOLD'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'Lead Overview' && (
            <table>
              <thead>
                <tr>
                  <th>Lead Name</th>
                  <th>City / Project</th>
                  <th>Source (CP)</th>
                  <th>Current Stage</th>
                  <th>Temp</th>
                  <th>IS Owner</th>
                  <th>Scheduling</th>
                  <th>BA Status</th>
                </tr>
              </thead>
              <tbody>
                {dataset.leads.map(lead => (
                  <tr key={lead.id}>
                    <td><div style={{ fontWeight: 700 }}>{lead.name}</div></td>
                    <td>
                      <div style={{ fontSize: '0.875rem' }}>{lead.city}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{lead.projectType}</div>
                    </td>
                    <td><div style={{ fontSize: '0.875rem' }}>BuildRight Pros</div></td>
                    <td><span className="badge badge-primary">{lead.currentStage}</span></td>
                    <td><span style={{ color: lead.leadTemperature === 'Hot' ? 'var(--danger)' : 'var(--warning)', fontWeight: 700 }}>{lead.leadTemperature?.toUpperCase()}</span></td>
                    <td>Sarah Reed</td>
                    <td>{lead.meetingAt ? formatDate(lead.meetingAt) : 'Not Sch.'}</td>
                    <td><span className={`badge ${lead.baStatus === 'Collected' ? 'badge-qualified' : 'badge-pending'}`}>{lead.baStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {(activeTab === 'IS Performance' || activeTab === 'Scheduling Performance' || activeTab === 'VM Performance') && (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '16px' }}>📉</div>
              <h3>{activeTab} Analytics</h3>
              <p style={{ color: 'var(--text-muted)' }}>Detailed SLA tracking and team conversion metrics are being aggregated.</p>
            </div>
          )}

          {activeTab === 'Incentive Tracking' && (
            <table>
              <thead>
                <tr>
                  <th>Lead / CP</th>
                  <th>Model</th>
                  <th>Project Value</th>
                  <th>Incentive %</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Pending Days</th>
                </tr>
              </thead>
              <tbody>
                {dataset.incentives.map(inc => {
                  const lead = dataset.leads.find(l => l.id === inc.leadId)
                  return (
                    <tr key={inc.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{lead?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BuildRight Pros</div>
                      </td>
                      <td>{inc.selectedModel}</td>
                      <td>{formatCurrencyCr(inc.projectValueCr)}</td>
                      <td>{inc.incentivePercent}%</td>
                      <td style={{ fontWeight: 700 }}>₹{inc.incentiveAmountLakh}L</td>
                      <td><span className={`badge ${inc.paymentStatus === 'Released' ? 'badge-qualified' : 'badge-pending'}`}>{inc.paymentStatus}</span></td>
                      <td>{inc.pendingDays} Days</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
