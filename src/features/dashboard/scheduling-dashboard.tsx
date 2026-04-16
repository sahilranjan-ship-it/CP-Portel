import { useAppData } from '../../data/app-data'
import { formatCurrencyCr, formatDate } from '../../lib/format'
import type { SessionUser } from '../../lib/supabase'

export function SchedulingDashboard({ sessionUser }: { sessionUser: SessionUser }) {
  const { dataset } = useAppData()
  const leads = dataset.leads.filter((lead) => lead.crnNumber)

  return (
    <div className="dashboard-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <header className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <p className="eyebrow" style={{ color: 'var(--primary)', fontWeight: 700 }}>SCHEDULING TEAM HUB</p>
          <h1>Meeting Orchestration</h1>
        </div>
      </header>

      {/* 6. KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">PENDING SCHEDULING</div>
          <div className="stat-value">42</div>
          <div className="stat-footer"><span className="trend-down">⚠️ 8 Need assignment</span></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-label">SCHEDULED</div>
          <div className="stat-value">128</div>
          <div className="stat-footer"><span>↑ 12% vs LW</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">RESCHEDULED</div>
          <div className="stat-value">14</div>
          <div className="stat-footer"><span>Stable Trend</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">MEETINGS TODAY</div>
          <div className="stat-value">26</div>
          <div className="stat-footer"><span style={{ color: 'var(--primary)', fontWeight: 600 }}>6 Currently ongoing</span></div>
        </div>
        <div className="stat-card stat-card-danger">
          <div className="stat-label">TAT BREACHED</div>
          <div className="stat-value">05</div>
          <div className="stat-footer"><span>&gt; 24h since Qual.</span></div>
        </div>
      </div>

      <div className="admin-grid" style={{ marginTop: '32px' }}>
        <div className="admin-left">
          {/* 6. Dispatch Timeline Section */}
          <div className="table-card" style={{ padding: '24px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h3>Today's Dispatch Timeline</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Real-time appointment delivery status</p>
              </div>
              <div className="table-actions">
                <button className="btn active">Timeline View</button>
                <button className="btn">Grid</button>
              </div>
            </div>

            <div>
              {[
                { time: '09:30 AM', name: 'James Wilson', crn: 'CRN-8822', type: 'Residential • Hot', os: 'Mark Vance' },
                { time: '12:00 PM', name: 'Linda Chen', crn: 'CRN-9011', type: 'Commercial • Warm', os: 'Sarah K' },
                { time: '02:30 PM', name: 'Arun Kumar', crn: 'CRN-7731', type: 'Renovation • Cold', os: 'Rajesh P' },
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '24px', position: 'relative', marginBottom: '24px' }}>
                  <div style={{ width: '80px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{item.time}</div>
                  <div style={{ width: '2px', background: '#f1f5f9', position: 'absolute', left: '92px', top: '0', bottom: idx === 2 ? '50%' : '-24px' }}></div>
                  <div style={{ width: '12px', height: '12px', background: 'var(--primary)', borderRadius: '50%', border: '3px solid white', position: 'absolute', left: '87px', top: '4px', zIndex: 1, boxShadow: '0 0 0 1px #e2e8f0' }}></div>
                  <div style={{ flex: 1, background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({item.crn})</span></div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.type}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OS Assigned</div>
                      <div style={{ fontWeight: 600 }}>{item.os}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Lead Row Table */}
          <div className="table-card">
            <div className="table-header">
              <h2>Scheduling Queue</h2>
              <button className="btn btn-primary">+ Manual Add</button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Lead / CRN</th>
                    <th>Project / Value</th>
                    <th>IS Owner</th>
                    <th>Status</th>
                    <th>OS Assignment</th>
                    <th>Date / Time</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 3).map((lead, i) => (
                    <tr key={lead.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{lead.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CRN-4422119</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.875rem' }}>Full Interior</div>
                        <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.75rem' }}>{formatCurrencyCr(lead.projectValueCr)}</div>
                      </td>
                      <td>Sarah Reed</td>
                      <td><span className="badge badge-primary">OS SELECTION PENDING</span></td>
                      <td>
                        <select className="input-field" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                          <option>Select OS</option>
                          <option>Mark Vance</option>
                          <option>Sarah K</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.75rem' }}>
                          <div>24 Oct 2023</div>
                          <div style={{ fontWeight: 600 }}>11:30 AM</div>
                        </div>
                      </td>
                      <td><button className="btn" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>UPDATE</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="admin-right">
          <div className="onboarding-side" style={{ marginBottom: '24px' }}>
            <h3>Meeting Confirmation Flow</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Triggered after assignment:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--success)' }}>✔</span> OS Email Notification
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--success)' }}>✔</span> OS Dashboard Update
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--warning)' }}>●</span> Customer confirmation pending
              </div>
            </div>
          </div>

          <div className="table-card" style={{ padding: '24px' }}>
            <h3>Meeting Modes</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
              {['Site Visit', 'Office Visit', 'Video Call', 'Phone Call'].map(mode => (
                <div key={mode} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '0.75rem', fontWeight: 600, textAlign: 'center' }}>
                  {mode}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
