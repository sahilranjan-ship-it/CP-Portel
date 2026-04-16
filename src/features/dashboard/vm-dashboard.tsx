import { useState } from 'react'
import { useAppData } from '../../data/app-data'
import { formatCurrencyCr } from '../../lib/format'
import type { SessionUser } from '../../lib/supabase'

const vmTabs = ['CP Master View', 'CP Onboarding View', 'Lead Creation'] as const
type VmTab = (typeof vmTabs)[number]

export function VmDashboard({ sessionUser }: { sessionUser: SessionUser }) {
  const { dataset } = useAppData()
  console.log('VM Profile for:', sessionUser.name)
  const [activeTab, setActiveTab] = useState<VmTab>('CP Master View')
  const cps = dataset.cps
  const agreements = dataset.agreements

  return (
    <div className="dashboard-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <header className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <p className="eyebrow" style={{ color: 'var(--primary)', fontWeight: 700 }}>VM PORTFOLIO MANAGEMENT</p>
          <h1>Contractor Ecosystem</h1>
        </div>
      </header>

      {/* 7. KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">TOTAL CPs</div>
          <div className="stat-value">{cps.length}</div>
          <div className="stat-footer"><span>↑ 4 New this month</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">NEW SIGNUPS (MTD)</div>
          <div className="stat-value">12</div>
          <div className="stat-footer"><span>85% Processed</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">PENDING AGREEMENTS</div>
          <div className="stat-value">{agreements.filter(a => a.status === 'Pending').length}</div>
          <div className="stat-footer"><span className="trend-down">⚠️ 4 Blocked in Legal</span></div>
        </div>
        <div className="stat-card" style={{ background: 'var(--primary)', color: 'white' }}>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.7)' }}>AVG CSAT</div>
          <div className="stat-value" style={{ color: 'white' }}>4.2/5</div>
          <div className="stat-footer"><span style={{ color: 'white' }}>Top Quartile Performance</span></div>
        </div>
      </div>

      <div className="admin-grid" style={{ marginTop: '32px' }}>
        <div className="admin-left">
          <div className="table-card">
            <div className="table-header" style={{ padding: '0 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div className="tab-row" style={{ margin: 0, gap: '32px' }}>
                {vmTabs.map(tab => (
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
              {activeTab === 'CP Master View' && (
                <table>
                  <thead>
                    <tr>
                      <th>CP Name / ID</th>
                      <th>Projects (A/C/H)</th>
                      <th>Portfolio Value</th>
                      <th>Tier / Priority</th>
                      <th>Performance (CSAT/Delay)</th>
                      <th>VM Owner</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cps.map(cp => (
                      <tr key={cp.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{cp.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {cp.id}</div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{cp.activeProjects} / {cp.completedProjects} / 0</td>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatCurrencyCr(cp.totalProjectValueCr)}</td>
                        <td>
                          <div style={{ fontSize: '0.8rem' }}>Tier: {cp.tier}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 700 }}>Priority: {cp.bmsPriority || 'Medium'}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem' }}>{cp.averageCsat}/5 CSAT</div>
                          <div style={{ fontSize: '0.75rem', color: cp.averageDelayDays > 5 ? 'var(--danger)' : 'var(--success)' }}>{cp.averageDelayDays}d Avg Delay</div>
                        </td>
                        <td>{cp.vmOwner}</td>
                        <td><span className={`badge ${cp.eligibleForProject ? 'badge-qualified' : 'badge-pending'}`}>{cp.eligibleForProject ? 'ELIGIBLE' : 'HOLD'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'CP Onboarding View' && (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)' }}>CP Onboarding flow including agreement status and activation steps is tracked here.</p>
                  <button className="btn btn-primary" style={{ marginTop: '16px' }}>View Agreement Queue</button>
                </div>
              )}

              {activeTab === 'Lead Creation' && (
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                  <h3>Submit Referral on behalf of CP</h3>
                  <form style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
                    <div className="form-group">
                      <label>Lead Details</label>
                      <input type="text" placeholder="Lead Name" />
                    </div>
                    <div className="form-group">
                      <label>CP Selection</label>
                      <select>
                        {cps.map(c => <option key={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <button className="btn btn-primary">Create Lead</button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="admin-right">
          <div className="onboarding-side">
            <h3>Quick CP Registration</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Onboard new partners directly into the portal.</p>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" placeholder="Contractor Full Name" />
              </div>
              <div className="form-group">
                <label>Company Name</label>
                <input type="text" placeholder="As per GST/Aadhar" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Mobile</label>
                  <input type="text" />
                </div>
                <div className="form-group">
                  <label>City</label>
                  <input type="text" />
                </div>
              </div>
              <div className="form-group">
                <label>Primary Scope</label>
                <select>
                  <option>Full Interior</option>
                  <option>Civil & Structure</option>
                  <option>Turnkey</option>
                </select>
              </div>
              <button className="btn btn-primary" style={{ marginTop: '8px' }}>Launch SpotDraft Agreement</button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  )
}
