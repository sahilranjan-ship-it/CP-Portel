import { useAppData } from '../../data/app-data'
import { formatCurrencyCr, formatDate } from '../../lib/format'
import type { SessionUser } from '../../lib/supabase'

export function IsDashboard({ sessionUser }: { sessionUser: SessionUser }) {
  const { dataset } = useAppData()
  const leads = dataset.leads
  console.log('IS Workspace for:', sessionUser.name)

  return (
    <div className="dashboard-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <header className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <p className="eyebrow" style={{ color: 'var(--primary)', fontWeight: 700 }}>IS TEAM WORKSPACE</p>
          <h1>Call Queue & Qualification</h1>
        </div>
      </header>

      {/* 5. IS Team SLA */}
      <div className="sla-alert" style={{ background: '#fff1f2', border: '1px solid #fda4af', borderRadius: '16px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <div style={{ color: '#be123c', fontWeight: 800, fontSize: '0.75rem', marginBottom: '4px' }}>SLA BREACH WARNING</div>
          <h3 style={{ color: '#9f1239' }}>12 Leads pending call for &gt; 30 mins</h3>
        </div>
        <button className="btn" style={{ background: '#be123c', color: 'white', fontWeight: 750 }}>PRIORITIZE NOW</button>
      </div>

      {/* 5. KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">TOTAL ASSIGNED</div>
          <div className="stat-value">428</div>
          <div className="stat-footer"><span>24 New Today</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">QUALIFIED LEADS</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>86</div>
          <div className="stat-footer"><span>20.1% Conv. Rate</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">CONNECTED / RNR</div>
          <div className="stat-value">184 / 64</div>
          <div className="stat-footer"><span>Action required on RNRs</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">TEMP: H / W / C</div>
          <div className="stat-value" style={{ display: 'flex', gap: '8px' }}>
            <span style={{ color: 'var(--danger)' }}>24</span>
            <span style={{ color: 'var(--primary)' }}>52</span>
            <span style={{ color: 'var(--text-light)' }}>108</span>
          </div>
          <div className="stat-footer"><span>Hot / Warm / Cold</span></div>
        </div>
      </div>

      {/* 5. Lead Table */}
      <div className="table-card" style={{ marginTop: '32px' }}>
        <div className="table-header">
          <h2>Active Qualification Queue</h2>
          <div className="table-actions">
            <button className="btn">All Leads</button>
            <button className="btn active">Priority</button>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Lead Details</th>
                <th>Source (CP)</th>
                <th>Project Value</th>
                <th>SLA</th>
                <th>Call Status</th>
                <th>Temperature</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 5).map((lead, i) => (
                <tr key={lead.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{lead.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.city} • {formatDate(lead.submittedAt)}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>BuildRight Pros</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: CP-4422</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCurrencyCr(lead.projectValueCr)}</td>
                  <td>
                    <span style={{ color: i === 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700, fontSize: '0.75rem' }}>
                      {i === 0 ? '🕒 42m Over' : '● On Time'}
                    </span>
                  </td>
                  <td>
                    <select className="input-field" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                      <option>Connected</option>
                      <option>Callback Later</option>
                      <option>RNR1</option>
                      <option>RNR2</option>
                      <option>RNR3</option>
                      <option>{i === 2 ? 'Interested' : 'Pending'}</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${lead.temperature === 'Hot' ? 'badge-danger' : 'badge-primary'}`}>
                      {lead.temperature?.toUpperCase() || 'WARM'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.75rem' }}>LOG CALL</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
