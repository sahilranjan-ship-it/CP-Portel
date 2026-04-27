import { useMemo, useState } from 'react'
import { useAppData } from '../../data/app-data'
import { formatCurrencyCr, formatDate } from '../../lib/format'
import type { SessionUser } from '../../lib/supabase'
import { getEscalations } from '../../data/sla-utils'

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent = '#1a3c8f', highlight = false }: {
  icon: string; label: string; value: string | number; sub?: string; accent?: string; highlight?: boolean
}) {
  return (
    <div style={{
      background: highlight ? accent : 'white',
      borderRadius: '14px',
      padding: '18px 20px',
      border: `1px solid ${highlight ? accent : '#e8ecf0'}`,
      boxShadow: highlight ? `0 4px 20px ${accent}33` : '0 1px 4px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ fontSize: '1.3rem' }}>{icon}</div>
      <div style={{ fontSize: '0.63rem', fontWeight: 700, color: highlight ? 'rgba(255,255,255,0.75)' : '#94a3b8', letterSpacing: '0.5px' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 900, lineHeight: 1, color: highlight ? 'white' : accent }}>{value}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: highlight ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}>{sub}</div>}
    </div>
  )
}

function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'BA Collected': { bg: '#dcfce7', color: '#15803d' },
    'Non-Interested': { bg: '#fee2e2', color: '#dc2626' },
    'Inactive': { bg: '#f1f5f9', color: '#94a3b8' },
    'RNR': { bg: '#fff7ed', color: '#c2410c' },
    'Callback Later': { bg: '#fff7ed', color: '#c2410c' },
  }
  const s = map[stage] || { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 9px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{stage}</span>
  )
}

function ProgressBar({ value, max, color = '#1a3c8f' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, color, minWidth: '32px' }}>{pct}%</span>
    </div>
  )
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e8ecf0', overflow: 'hidden', marginBottom: '16px' }}>
      <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem' }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ background: '#f8fafc' }}>
        {cols.map(c => <th key={c} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.63rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{c}</th>)}
      </tr>
    </thead>
  )
}

// ─── Admin Tabs ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview', label: '📊 Overview' },
  { key: 'leads', label: '🎯 Lead Pipeline' },
  { key: 'cp', label: '🏗️ CP Master' },
  { key: 'is-performance', label: '📞 IS Performance' },
  { key: 'scheduling-performance', label: '📅 Scheduling' },
  { key: 'vm-performance', label: '🤝 VM Performance' },
  { key: 'incentives', label: '💰 Incentives' },
  { key: 'agreements', label: '📝 Agreements' },
  { key: 'notifications', label: '🚨 Escalations' },
] as const

type TabKey = typeof TABS[number]['key']

// ─── Main Component ──────────────────────────────────────────────────────────
export function AdminDashboard({ sessionUser, subPath }: { sessionUser: SessionUser; subPath?: string }) {
  const { dataset } = useAppData()

  const tabFromPath: TabKey = useMemo(() => {
    const map: Record<string, TabKey> = {
      'leads': 'leads', 'cp': 'cp',
      'is-performance': 'is-performance', 'scheduling-performance': 'scheduling-performance',
      'vm-performance': 'vm-performance', 'incentives': 'incentives',
      'agreements': 'agreements', 'notifications': 'notifications',
    }
    return map[subPath ?? ''] ?? 'overview'
  }, [subPath])

  const [activeTab, setActiveTab] = useState<TabKey>(tabFromPath)
  const [search, setSearch] = useState('')

  const escalations = useMemo(() => getEscalations(dataset), [dataset])

  const stats = useMemo(() => {
    const leads = dataset.leads
    const cps = dataset.cps
    const incs = dataset.incentives
    return {
      totalCps: cps.length,
      activeCps: cps.filter(c => c.eligibleForProject).length,
      holdCps: cps.filter(c => !c.eligibleForProject).length,
      totalLeads: leads.length,
      qualifiedLeads: leads.filter(l => l.currentStage === 'Qualified').length,
      meetingScheduled: leads.filter(l => ['Meeting Scheduled', 'Meeting Done'].includes(l.currentStage)).length,
      baCollected: leads.filter(l => l.baStatus === 'Collected').length,
      won: leads.filter(l => l.currentStage === 'BA Collected').length,
      hotLeads: leads.filter(l => l.temperature === 'Hot').length,
      pendingCalls: leads.filter(l => ['Lead Shared', 'Assigned to IS', 'Calling Attempt'].includes(l.currentStage)).length,
      totalIncentiveEarned: incs.reduce((s, i) => s + i.incentiveAmountLakh, 0),
      totalIncentivePaid: incs.filter(i => i.paymentStatus === 'Released').reduce((s, i) => s + i.incentiveAmountLakh, 0),
      pendingPayout: incs.filter(i => i.paymentStatus !== 'Released').reduce((s, i) => s + i.incentiveAmountLakh, 0),
      pendingAgreements: dataset.agreements.filter(a => a.status === 'Pending').length,
      tatBreach: escalations.length,
      totalProjectValue: cps.reduce((s, c) => s + c.totalProjectValueCr, 0),
    }
  }, [dataset, escalations])

  const conversionRate = stats.totalLeads > 0 ? ((stats.baCollected / stats.totalLeads) * 100).toFixed(1) : '0'

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: '1400px' }}>
      {/* ══ HEADER ══ */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1a3c8f 60%, #2b5be0 100%)',
        borderRadius: '20px', padding: '28px 32px', marginBottom: '20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px',
        boxShadow: '0 8px 32px rgba(26,60,143,0.3)',
      }}>
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '2px', marginBottom: '6px' }}>ADMIN CONTROL TOWER</div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: 'white' }}>System Command Centre</h1>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', marginTop: '4px' }}>
            Welcome back, <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{sessionUser.name}</strong> · Full system visibility
          </div>
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          {[
            { label: 'Total CPs', value: stats.totalCps },
            { label: 'Live Leads', value: stats.totalLeads },
            { label: 'TAT Breaches', value: stats.tatBreach },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.5px', marginBottom: '2px' }}>{m.label}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: m.label === 'TAT Breaches' && m.value > 0 ? '#fca5a5' : 'white' }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ 12 KPI CARDS ══ */}
      <div className="resp-grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <KpiCard icon="🏗️" label="Total CPs" value={stats.totalCps} sub={`${stats.activeCps} active · ${stats.holdCps} hold`} accent="#1a3c8f" />
        <KpiCard icon="🎯" label="Total Leads" value={stats.totalLeads} sub={`${stats.pendingCalls} pending call`} accent="#1a3c8f" />
        <KpiCard icon="✅" label="Qualified" value={stats.qualifiedLeads} sub={`${conversionRate}% conversion`} accent="#15803d" />
        <KpiCard icon="📅" label="Meetings" value={stats.meetingScheduled} sub="Scheduled + Done" accent="#7c3aed" />
        <KpiCard icon="💼" label="BA Collected" value={stats.baCollected} sub="Final stage reached" accent="#0891b2" highlight />
        <KpiCard icon="🔥" label="Hot Leads" value={stats.hotLeads} sub="1–2 month timeline" accent="#dc2626" />
        <KpiCard icon="💰" label="Incentive Earned" value={`₹${stats.totalIncentiveEarned.toFixed(1)}L`} sub={`₹${stats.totalIncentivePaid.toFixed(1)}L paid`} accent="#1a3c8f" />
        <KpiCard icon="⏳" label="Pending Payout" value={`₹${stats.pendingPayout.toFixed(1)}L`} sub="Awaiting release" accent="#d97706" />
        <KpiCard icon="📝" label="Pending Agreements" value={stats.pendingAgreements} sub="Awaiting signature" accent="#c2410c" />
        <KpiCard icon="🚨" label="TAT Breaches" value={stats.tatBreach} sub="Needs action" accent="#dc2626" />
        <KpiCard icon="📦" label="Total Portfolio" value={formatCurrencyCr(stats.totalProjectValue)} sub="Across all CPs" accent="#0d7a3c" />
        <KpiCard icon="📊" label="Conversion Rate" value={`${conversionRate}%`} sub="Leads → BA Collected" accent="#7c3aed" />
      </div>

      {/* ══ TAB BAR ══ */}
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e8ecf0', padding: '6px', display: 'flex', gap: '4px', marginBottom: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '9px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem', fontWeight: activeTab === tab.key ? 700 : 500,
              background: activeTab === tab.key ? '#1a3c8f' : 'transparent',
              color: activeTab === tab.key ? 'white' : '#64748b',
              transition: 'all 0.15s ease',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW TAB ══ */}
      {activeTab === 'overview' && (
        <div>
          {/* Funnel */}
          <SectionCard title="📈 Lead Conversion Funnel">
            <div style={{ padding: '20px 24px' }}>
              {[
                { stage: 'Leads Submitted', value: stats.totalLeads, color: '#1a3c8f' },
                { stage: 'IS Qualified', value: stats.qualifiedLeads, color: '#15803d' },
                { stage: 'Meetings Scheduled', value: stats.meetingScheduled, color: '#7c3aed' },
                { stage: 'BA Collected', value: stats.baCollected, color: '#0891b2' },
              ].map(row => (
                <div key={row.stage} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{row.stage}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: row.color }}>{row.value}</span>
                  </div>
                  <ProgressBar value={row.value} max={stats.totalLeads} color={row.color} />
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="resp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Recent Escalations */}
            <SectionCard title="🚨 Active Escalations">
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {escalations.length === 0
                  ? <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '0.85rem' }}>✨ No active SLA breaches</div>
                  : escalations.slice(0, 5).map(esc => (
                    <div key={esc.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 12px', background: esc.severity === 'critical' ? '#fff1f2' : '#fffbeb', borderRadius: '10px', border: `1px solid ${esc.severity === 'critical' ? '#fda4af' : '#fcd34d'}` }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: esc.severity === 'critical' ? '#dc2626' : '#d97706', color: 'white', display: 'grid', placeItems: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>!</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: esc.severity === 'critical' ? '#be123c' : '#854d0e', letterSpacing: '0.4px' }}>{esc.label}</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{esc.detail}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </SectionCard>

            {/* Incentive Summary */}
            <SectionCard title="💰 Incentive Summary">
              <div style={{ padding: '16px 20px' }}>
                {[
                  { label: 'Total Earned', value: `₹${stats.totalIncentiveEarned.toFixed(2)}L`, color: '#1a3c8f' },
                  { label: 'Total Paid', value: `₹${stats.totalIncentivePaid.toFixed(2)}L`, color: '#15803d' },
                  { label: 'Pending Release', value: `₹${stats.pendingPayout.toFixed(2)}L`, color: '#dc2626' },
                ].map((row, i) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{row.label}</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: row.color }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ marginTop: '14px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>PAID / TOTAL</div>
                  <ProgressBar value={stats.totalIncentivePaid} max={stats.totalIncentiveEarned} color="#15803d" />
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ══ LEAD PIPELINE TAB ══ */}
      {activeTab === 'leads' && (
        <SectionCard title="🎯 Full Lead Pipeline"
          action={<span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dataset.leads.length} leads total</span>}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <input type="text" placeholder="🔍 Search leads by name, city, CP…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <TableHead cols={['Lead Name', 'City / Project', 'CP Source', 'Model', 'Value', 'Stage', 'Temp', 'IS Owner', 'Meeting', 'BA', 'Submitted']} />
              <tbody>
                {dataset.leads
                  .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.city.toLowerCase().includes(search.toLowerCase()) || l.cpName?.toLowerCase().includes(search.toLowerCase()))
                  .map(lead => (
                    <tr key={lead.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{lead.name}</div>
                        <div style={{ fontSize: '0.68rem', color: '#1a3c8f', fontWeight: 600 }}>#{lead.crnNumber || 'PENDING'}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '0.82rem' }}>{lead.city}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{lead.projectType}</div>
                        {lead.reasonForNotProceeding && (
                          <div style={{ fontSize: '0.65rem', color: '#1a3c8f', fontWeight: 600, marginTop: '2px', fontStyle: 'italic' }}>
                            Ref: {lead.reasonForNotProceeding}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>{lead.cpName}</div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{lead.cpEmail || 'No email'}</div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{lead.cpPhone || 'No phone'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#64748b' }}>{lead.selectedModel}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1a3c8f', fontSize: '0.82rem' }}>{formatCurrencyCr(lead.projectValueCr)}</td>
                      <td style={{ padding: '12px 16px' }}><StageBadge stage={lead.currentStage} /></td>
                      <td style={{ padding: '12px 16px' }}>
                        {lead.temperature
                          ? <span style={{ background: lead.temperature === 'Hot' ? '#fee2e2' : lead.temperature === 'Warm' ? '#fef9c3' : '#f1f5f9', color: lead.temperature === 'Hot' ? '#dc2626' : lead.temperature === 'Warm' ? '#d97706' : '#475569', padding: '2px 8px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 700 }}>{lead.temperature}</span>
                          : <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.78rem' }}>{lead.isOwner || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#64748b' }}>{lead.meetingAt ? formatDate(lead.meetingAt) : '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: lead.baStatus === 'Collected' ? '#dcfce7' : '#fef9c3', color: lead.baStatus === 'Collected' ? '#15803d' : '#854d0e', padding: '2px 8px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 700 }}>{lead.baStatus || 'Pending'}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.72rem', color: '#94a3b8' }}>{formatDate(lead.submittedAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ══ CP MASTER TAB ══ */}
      {activeTab === 'cp' && (
        <SectionCard title="🏗️ CP Master View"
          action={<span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dataset.cps.length} contractors</span>}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <input type="text" placeholder="🔍 Search CP…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <TableHead cols={['CP Name', 'City', 'Phone', 'Active', 'Completed', 'Held', 'Portfolio PV', 'CSAT', 'Delay', 'Tier', 'BMS', 'INIT', 'Eligible', 'VM Owner', 'Leads S/Q/BA']} />
              <tbody>
                {dataset.cps
                  .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.city.toLowerCase().includes(search.toLowerCase()))
                  .map(cp => {
                    const cpLeads = dataset.leads.filter(l => l.cpId === cp.id)
                    const cpQualified = cpLeads.filter(l => l.currentStage === 'Qualified').length
                    const cpBa = cpLeads.filter(l => l.baStatus === 'Collected').length
                    return (
                      <tr key={cp.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{cp.name}</div>
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{cp.companyName}</div>
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '0.82rem' }}>{cp.city}</td>
                        <td style={{ padding: '11px 16px', fontSize: '0.78rem', color: '#64748b' }}>{cp.phone}</td>
                        <td style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 700, color: '#1a3c8f' }}>{cp.activeProjects}</td>
                        <td style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 600, color: '#15803d' }}>{cp.completedProjects}</td>
                        <td style={{ padding: '11px 16px', textAlign: 'center', color: '#d97706' }}>{cp.heldProjects}</td>
                        <td style={{ padding: '11px 16px', fontWeight: 700, color: '#1a3c8f', fontSize: '0.82rem' }}>{formatCurrencyCr(cp.totalProjectValueCr)}</td>
                        <td style={{ padding: '11px 16px', fontSize: '0.82rem' }}>⭐ {cp.averageCsat.toFixed(1)}</td>
                        <td style={{ padding: '11px 16px', fontSize: '0.78rem', color: cp.averageDelayDays > 5 ? '#dc2626' : '#64748b' }}>{cp.averageDelayDays}d</td>
                        <td style={{ padding: '11px 16px' }}><span style={{ background: '#eff6ff', color: '#1a3c8f', padding: '2px 8px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 700 }}>{cp.tier}</span></td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ background: cp.bmsPriority === 'High' ? '#fee2e2' : cp.bmsPriority === 'Medium' ? '#fef9c3' : '#f1f5f9', color: cp.bmsPriority === 'High' ? '#dc2626' : cp.bmsPriority === 'Medium' ? '#d97706' : '#64748b', padding: '2px 8px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 600 }}>{cp.bmsPriority}</span>
                        </td>
                        <td style={{ padding: '11px 16px', textAlign: 'center', fontSize: '0.82rem' }}>{cp.initProjectCount}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ background: cp.eligibleForProject ? '#dcfce7' : '#fee2e2', color: cp.eligibleForProject ? '#15803d' : '#dc2626', padding: '2px 8px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 700 }}>{cp.eligibleForProject ? 'YES' : 'HOLD'}</span>
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '0.78rem' }}>{cp.vmOwner || '—'}</td>
                        <td style={{ padding: '11px 16px', fontWeight: 600, fontSize: '0.82rem' }}>
                          <span style={{ color: '#1a3c8f' }}>{cpLeads.length}</span>
                          <span style={{ color: '#94a3b8' }}> / </span>
                          <span style={{ color: '#15803d' }}>{cpQualified}</span>
                          <span style={{ color: '#94a3b8' }}> / </span>
                          <span style={{ color: '#0891b2' }}>{cpBa}</span>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ══ IS PERFORMANCE TAB ══ */}
      {activeTab === 'is-performance' && (
        <div>
          <div className="resp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <KpiCard icon="📞" label="Total Leads" value={stats.totalLeads} accent="#1a3c8f" />
            <KpiCard icon="✅" label="Qualified" value={stats.qualifiedLeads} sub={`${stats.totalLeads > 0 ? ((stats.qualifiedLeads / stats.totalLeads) * 100).toFixed(1) : 0}% rate`} accent="#15803d" />
            <KpiCard icon="⏳" label="Pending Calls" value={stats.pendingCalls} accent="#dc2626" />
            <KpiCard icon="🔥" label="Hot Leads" value={stats.hotLeads} accent="#d97706" />
          </div>
          <SectionCard title="📞 IS Team — Lead Status Breakdown">
            <div style={{ padding: '16px 22px' }}>
              {[
                { label: 'Total Leads', value: stats.totalLeads, color: '#1a3c8f', pct: 100 },
                { label: 'Pending Calls (SLA)', value: stats.pendingCalls, color: '#dc2626', pct: stats.totalLeads > 0 ? (stats.pendingCalls / stats.totalLeads) * 100 : 0 },
                { label: 'Qualified', value: stats.qualifiedLeads, color: '#15803d', pct: stats.totalLeads > 0 ? (stats.qualifiedLeads / stats.totalLeads) * 100 : 0 },
                { label: 'Hot', value: stats.hotLeads, color: '#ef4444', pct: stats.totalLeads > 0 ? (stats.hotLeads / stats.totalLeads) * 100 : 0 },
                { label: 'Meetings Done', value: dataset.leads.filter(l => l.currentStage === 'Meeting Done').length, color: '#7c3aed', pct: stats.totalLeads > 0 ? (dataset.leads.filter(l => l.currentStage === 'Meeting Done').length / stats.totalLeads) * 100 : 0 },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{row.label}</span>
                    <span style={{ fontWeight: 800, color: row.color }}>{row.value}</span>
                  </div>
                  <ProgressBar value={row.value} max={stats.totalLeads} color={row.color} />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ══ SCHEDULING PERFORMANCE TAB ══ */}
      {activeTab === 'scheduling-performance' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <KpiCard icon="📅" label="Scheduled" value={stats.meetingScheduled} accent="#1a3c8f" />
            <KpiCard icon="✅" label="Completed" value={dataset.leads.filter(l => l.currentStage === 'Meeting Done').length} accent="#15803d" />
            <KpiCard icon="🚨" label="TAT Breached" value={stats.tatBreach} accent="#dc2626" />
            <KpiCard icon="⏳" label="Pending Scheduling" value={stats.qualifiedLeads} sub="Awaiting OS assignment" accent="#d97706" />
          </div>
          <SectionCard title="📅 Meetings Overview">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <TableHead cols={['Lead Name', 'CRN', 'City', 'Project Value', 'IS Owner', 'Temperature', 'Stage', 'Meeting At']} />
                <tbody>
                  {dataset.leads.filter(l => ['Meeting Scheduled', 'Meeting Done', 'Qualified', 'Sent to Scheduling Team'].includes(l.currentStage)).map(lead => (
                    <tr key={lead.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '11px 16px', fontWeight: 700, fontSize: '0.85rem' }}>{lead.name}</td>
                      <td style={{ padding: '11px 16px', fontSize: '0.72rem', color: '#1a3c8f', fontWeight: 600 }}>#{lead.crnNumber || 'PENDING'}</td>
                      <td style={{ padding: '11px 16px', fontSize: '0.82rem' }}>{lead.city}</td>
                      <td style={{ padding: '11px 16px', fontWeight: 700, color: '#1a3c8f', fontSize: '0.82rem' }}>{formatCurrencyCr(lead.projectValueCr)}</td>
                      <td style={{ padding: '11px 16px', fontSize: '0.78rem' }}>{lead.isOwner || '—'}</td>
                      <td style={{ padding: '11px 16px' }}>
                        {lead.temperature ? <span style={{ background: lead.temperature === 'Hot' ? '#fee2e2' : '#fef9c3', color: lead.temperature === 'Hot' ? '#dc2626' : '#d97706', padding: '2px 8px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 700 }}>{lead.temperature}</span> : '—'}
                      </td>
                      <td style={{ padding: '11px 16px' }}><StageBadge stage={lead.currentStage} /></td>
                      <td style={{ padding: '11px 16px', fontSize: '0.75rem', color: '#64748b' }}>{lead.meetingAt ? formatDate(lead.meetingAt) : 'Not Scheduled'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ══ VM PERFORMANCE TAB ══ */}
      {activeTab === 'vm-performance' && (
        <div>
          <div className="resp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <KpiCard icon="🏗️" label="Total CPs Managed" value={stats.totalCps} accent="#1a3c8f" />
            <KpiCard icon="✅" label="Active CPs" value={stats.activeCps} accent="#15803d" />
            <KpiCard icon="📝" label="Pending Agreements" value={stats.pendingAgreements} accent="#dc2626" />
            <KpiCard icon="⏸️" label="Hold CPs" value={stats.holdCps} accent="#d97706" />
          </div>
          <SectionCard title="🤝 VM CP Portfolio Summary">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <TableHead cols={['CP Name', 'City', 'Tier', 'Active Projects', 'Total PV', 'CSAT', 'Eligible', 'Leads Count']} />
                <tbody>
                  {dataset.cps.map(cp => (
                    <tr key={cp.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{cp.name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{cp.vmOwner || '—'}</div>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: '0.82rem' }}>{cp.city}</td>
                      <td style={{ padding: '11px 16px' }}><span style={{ background: '#eff6ff', color: '#1a3c8f', padding: '2px 8px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 700 }}>{cp.tier}</span></td>
                      <td style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 700, color: '#1a3c8f' }}>{cp.activeProjects}</td>
                      <td style={{ padding: '11px 16px', fontWeight: 700, color: '#1a3c8f', fontSize: '0.82rem' }}>{formatCurrencyCr(cp.totalProjectValueCr)}</td>
                      <td style={{ padding: '11px 16px', fontSize: '0.82rem' }}>⭐ {cp.averageCsat.toFixed(1)}</td>
                      <td style={{ padding: '11px 16px' }}><span style={{ background: cp.eligibleForProject ? '#dcfce7' : '#fee2e2', color: cp.eligibleForProject ? '#15803d' : '#dc2626', padding: '2px 8px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 700 }}>{cp.eligibleForProject ? 'YES' : 'HOLD'}</span></td>
                      <td style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 600 }}>{dataset.leads.filter(l => l.cpId === cp.id).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ══ INCENTIVES TAB ══ */}
      {activeTab === 'incentives' && (
        <div>
          <div className="resp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <KpiCard icon="💰" label="Total Earned" value={`₹${stats.totalIncentiveEarned.toFixed(2)}L`} accent="#1a3c8f" />
            <KpiCard icon="✅" label="Total Paid" value={`₹${stats.totalIncentivePaid.toFixed(2)}L`} accent="#15803d" highlight />
            <KpiCard icon="⏳" label="Pending Release" value={`₹${stats.pendingPayout.toFixed(2)}L`} accent="#dc2626" />
          </div>
          <SectionCard title="💰 Incentive & Payout Tracking">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <TableHead cols={['Lead Name', 'CP', 'Model', 'Project Value', 'Rate %', 'Amount', 'Status', 'Pending Days', 'Paid Date']} />
                <tbody>
                  {dataset.incentives.map(inc => {
                    const lead = dataset.leads.find(l => l.id === inc.leadId)
                    return (
                      <tr key={inc.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.85rem' }}>{lead?.name || inc.leadName}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#64748b' }}>{inc.cpName}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#64748b' }}>{inc.selectedModel}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1a3c8f', fontSize: '0.82rem' }}>{formatCurrencyCr(inc.projectValueCr)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.82rem' }}>{inc.incentivePercent}%</td>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: '#1a3c8f', fontSize: '0.9rem' }}>₹{inc.incentiveAmountLakh}L</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: inc.paymentStatus === 'Released' ? '#dcfce7' : '#fef9c3', color: inc.paymentStatus === 'Released' ? '#15803d' : '#854d0e', padding: '3px 9px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700 }}>{inc.paymentStatus}</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: inc.pendingDays > 7 ? '#dc2626' : '#64748b', fontWeight: inc.pendingDays > 7 ? 700 : 400, fontSize: '0.82rem' }}>{inc.pendingDays}d</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#94a3b8' }}>{inc.paymentDate ? formatDate(inc.paymentDate) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ══ AGREEMENTS TAB ══ */}
      {activeTab === 'agreements' && (
        <SectionCard title="📝 Agreement Tracking">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <TableHead cols={['CP Name', 'Agreement Status', 'Sent Date', 'Signed Date', 'SpotDraft Status', 'VM Owner', 'Action']} />
              <tbody>
                {dataset.agreements.map(ag => (
                  <tr key={ag.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.85rem' }}>{ag.cpName}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: ag.status === 'Done' ? '#dcfce7' : '#fef9c3', color: ag.status === 'Done' ? '#15803d' : '#854d0e', padding: '3px 9px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700 }}>{ag.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#64748b' }}>{formatDate(ag.sentDate)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#64748b' }}>{ag.signedDate ? formatDate(ag.signedDate) : '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: ag.spotdraftStatus === 'Completed' ? '#dcfce7' : '#f1f5f9', color: ag.spotdraftStatus === 'Completed' ? '#15803d' : '#64748b', padding: '3px 9px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700 }}>{ag.spotdraftStatus || 'Pending'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.78rem' }}>{ag.vmOwner}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button style={{ background: '#eff6ff', color: '#1a3c8f', border: 'none', borderRadius: '7px', padding: '5px 12px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Follow Up</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ══ ESCALATIONS TAB ══ */}
      {activeTab === 'notifications' && (
        <div>
          <div className="resp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <KpiCard icon="🚨" label="Critical Breaches" value={escalations.filter(e => e.severity === 'critical').length} accent="#dc2626" highlight />
            <KpiCard icon="⚠️" label="Warnings" value={escalations.filter(e => e.severity === 'warn').length} accent="#d97706" />
            <KpiCard icon="✅" label="Clean" value={escalations.length === 0 ? 'All Good' : '—'} accent="#15803d" />
          </div>
          <SectionCard title="🚨 Active SLA Escalations">
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {escalations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✨</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', marginBottom: '6px' }}>No Active Escalations</div>
                  <div style={{ fontSize: '0.85rem' }}>All SLA metrics are within acceptable limits.</div>
                </div>
              ) : escalations.map(esc => (
                <div key={esc.id} style={{
                  display: 'flex', gap: '14px', alignItems: 'flex-start',
                  padding: '14px 18px', borderRadius: '12px',
                  background: esc.severity === 'critical' ? '#fff1f2' : '#fffbeb',
                  border: `1px solid ${esc.severity === 'critical' ? '#fda4af' : '#fcd34d'}`,
                }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: esc.severity === 'critical' ? '#dc2626' : '#d97706', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '0.9rem', flexShrink: 0 }}>!</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: esc.severity === 'critical' ? '#be123c' : '#854d0e', letterSpacing: '0.5px', marginBottom: '3px' }}>{esc.label.toUpperCase()}</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{esc.detail}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '7px 14px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>View</button>
                    <button style={{ background: esc.severity === 'critical' ? '#dc2626' : '#d97706', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Resolve</button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
          {/* System Notifications */}
          <SectionCard title="🔔 System Notifications">
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dataset.notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '0.85rem' }}>No system notifications.</div>
              ) : dataset.notifications.slice(0, 10).map(n => (
                <div key={n.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 12px', background: '#f8fafc', borderRadius: '10px' }}>
                  <div style={{ fontSize: '1.1rem', flexShrink: 0 }}>{n.severity === 'critical' ? '🔴' : n.severity === 'warn' ? '🟡' : '🟢'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{n.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{n.detail}</div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', flexShrink: 0 }}>{formatDate(n.createdAt)}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}
