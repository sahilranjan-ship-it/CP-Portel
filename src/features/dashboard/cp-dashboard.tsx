import { useState, useMemo } from 'react'
import { formatCurrencyCr, formatDate } from '../../lib/format'
import { useAppData } from '../../data/app-data'
import type { LeadBucket } from '../../types/domain'
import type { SessionUser } from '../../lib/supabase'

export function CpDashboard({ sessionUser }: { sessionUser: SessionUser }) {
  const { dataset, createCpLead } = useAppData()
  const cp = dataset.cps.find((item) => item.email === sessionUser.email) ?? dataset.cps[0]
  const myLeads = dataset.leads.filter((lead) => lead.cpId === cp.id)

  const [activeBucket, setActiveBucket] = useState<LeadBucket>('Active Leads')
  const [showForm, setShowForm] = useState(false)

  const leadStats = useMemo(() => ({
    active: myLeads.filter(l => l.bucket === 'Active Leads').length,
    won: myLeads.filter(l => l.bucket === 'Won Leads').length,
    inactive: myLeads.filter(l => l.bucket === 'Inactive Leads').length,
    rejected: myLeads.filter(l => l.bucket === 'Rejected Leads').length,
    qualified: myLeads.filter(l => l.currentStage === 'Qualified').length,
    ba: myLeads.filter(l => l.baStatus === 'Collected').length,
  }), [myLeads])

  return (
    <div className="dashboard-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* 4. Top Profile Section */}
      <header className="profile-header">
        <div className="profile-avatar">CP</div>
        <div className="profile-info">
          <h2>{cp.name}</h2>
          <p>ID: {cp.cpCode || 'CP-8833'} • {cp.city} • Active Since {formatDate(cp.activeSince)}</p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <span className="badge badge-primary">SCOPE: {cp.primaryScope?.toUpperCase()}</span>
            <span className="badge" style={{ background: '#f3f4f6' }}>TIER: {cp.tier}</span>
          </div>
        </div>
        <div className="profile-details">
          <div className="meta-item">
            <span className="label">Primary Contact</span>
            <span className="value">{cp.spocName || 'Vikram Rathore'}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cp.phone}</span>
          </div>
          <div className="meta-item">
            <span className="label">Relationship Manager (VM)</span>
            <span className="value">Siddharth Varma</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', cursor: 'pointer' }}>Chat with RM</span>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ padding: '12px 24px', borderRadius: '12px' }}>
            + Submit Lead
          </button>
        </div>
      </header>

      {/* 4. KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Active Projects</div>
          <div className="stat-value">{cp.activeProjects}</div>
          <div className="stat-footer"><span>{cp.completedProjects} Completed</span></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-label">Total Portfolio Value</div>
          <div className="stat-value">{formatCurrencyCr(cp.totalProjectValueCr)}</div>
          <div className="stat-footer"><span>Assigned by B&B</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Leads: Shared / Qual. / BA</div>
          <div className="stat-value">{myLeads.length} / {leadStats.qualified} / {leadStats.ba}</div>
          <div style={{ marginTop: '8px', height: '4px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${(leadStats.ba / (myLeads.length || 1)) * 100}%`, height: '100%', background: 'var(--success)' }}></div>
          </div>
        </div>
        <div className="stat-card" style={{ background: 'var(--primary)', color: 'white' }}>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.7)' }}>Pending Incentive</div>
          <div className="stat-value">₹2.25L</div>
          <div className="stat-footer"><span style={{ color: 'white' }}>Paid to date: ₹6.20L</span></div>
        </div>
      </div>

      {/* 4. Lead Tabs & Table */}
      <div className="table-card" style={{ marginTop: '32px' }}>
        <div className="table-header">
          <div className="table-tabs">
            {(['Active Leads', 'Won Leads', 'Inactive Leads', 'Rejected Leads'] as const).map(bucket => (
              <button
                key={bucket}
                className={`table-tab ${activeBucket === bucket ? 'active' : ''}`}
                onClick={() => setActiveBucket(bucket)}
              >
                {bucket.toUpperCase()} ({bucket === 'Active Leads' ? leadStats.active : bucket === 'Won Leads' ? leadStats.won : bucket === 'Inactive Leads' ? leadStats.inactive : leadStats.rejected})
              </button>
            ))}
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Lead Details</th>
                <th>Project Value</th>
                <th>Model</th>
                <th>Current Stage</th>
                <th>Journey Status</th>
                <th>BA Status</th>
                <th>Next Action</th>
              </tr>
            </thead>
            <tbody>
              {myLeads.filter(l => l.bucket === activeBucket).map(lead => (
                <tr key={lead.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{lead.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.city} • Sub: {formatDate(lead.submittedAt)}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCurrencyCr(lead.projectValueCr)}</td>
                  <td><span className="badge" style={{ background: '#f8fafc' }}>{lead.selectedModel}</span></td>
                  <td><span className="badge badge-primary">{lead.currentStage}</span></td>
                  <td>
                    <div style={{ width: '100%', maxWidth: '120px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '4px' }}>
                        <span>Progress</span>
                        <span>60%</span>
                      </div>
                      <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px' }}>
                        <div style={{ width: '60%', height: '100%', background: 'var(--primary)', borderRadius: '2px' }}></div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${lead.baStatus === 'Collected' ? 'badge-qualified' : 'badge-pending'}`}>{lead.baStatus}</span></td>
                  <td>
                    <div style={{ fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 600 }}>Proposal Shared</div>
                      <div style={{ color: 'var(--text-muted)' }}>Update expected in 2 days</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Earnings & Models */}
      <div className="admin-grid" style={{ marginTop: '32px' }}>
        <div className="table-card" style={{ padding: '24px' }}>
          <h3>Partnership Models & Performance</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px' }}>
            <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontWeight: 700, marginBottom: '8px' }}>Direct Incentive</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Released within 7 days after BA collection. Tiers: 2% to 3% based on value.</p>
            </div>
            <div style={{ padding: '16px', borderRadius: '12px', background: '#f8fafc' }}>
              <div style={{ fontWeight: 700, marginBottom: '8px' }}>Shared Construction</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>10-20% scope allocation. Earn execution profit + commission.</p>
            </div>
          </div>
        </div>

        <div className="payout-forecast" style={{ background: 'var(--primary)' }}>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.7)' }}>UPCOMING RELEASE</div>
          <div className="stat-value" style={{ color: 'white', fontSize: '2.5rem' }}>₹48,250</div>
          <p style={{ fontSize: '0.875rem' }}>Target: 30 Oct 2023</p>
          <div style={{ marginTop: '24px' }}>
            <button className="btn" style={{ width: '100%', background: 'white', color: 'var(--primary)', fontWeight: 700 }}>
              View Earnings Statement
            </button>
          </div>
        </div>
      </div>

      {/* 4. Lead Submission Form (Overlay) */}
      {showForm && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'grid', placeItems: 'center' }}>
          <div className="modal-content" style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '500px' }}>
            <h2>Lead Submission</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Submit a new project for qualification.</p>

            <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={(e) => {
              e.preventDefault()
              // Mock submission logic
              setShowForm(false)
            }}>
              <div className="form-group">
                <label>Lead Name</label>
                <input type="text" placeholder="Owner full name" required />
              </div>
              <div className="form-group">
                <label>Lead Number</label>
                <input type="text" placeholder="+91" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>City</label>
                  <input type="text" required />
                </div>
                <div className="form-group">
                  <label>Project Type</label>
                  <select>
                    <option>Full Interior</option>
                    <option>Renovation</option>
                    <option>Civil Work</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Approx Project Value (Cr)</label>
                <input type="number" step="0.1" required />
              </div>
              <div className="form-group">
                <label>Preferred Partnership Model</label>
                <select>
                  <option>Direct Incentive</option>
                  <option>Shared Construction</option>
                  <option>Barter / Exchange</option>
                  <option>Financial Assistance Model</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Submit Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
