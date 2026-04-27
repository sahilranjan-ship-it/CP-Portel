import { useState, useMemo } from 'react'
import { useAppData } from '../../data/app-data'
import { formatCurrencyCr } from '../../lib/format'
import type { Lead, MeetingMode, ScheduleMeetingInput } from '../../types/domain'
import type { SessionUser } from '../../lib/supabase'

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  'Pending Scheduling': { color: '#1a3c8f', bg: '#eff6ff' },
  'Meeting Date Selection Pending': { color: '#d97706', bg: '#fef9c3' },
  'OS Selection Pending': { color: '#c2410c', bg: '#fff7ed' },
  'Meeting Scheduled': { color: '#15803d', bg: '#dcfce7' },
  'Reschedule Requested': { color: '#7c3aed', bg: '#f5f3ff' },
  'Rescheduled': { color: '#0891b2', bg: '#ecfeff' },
  'Meeting Completed': { color: '#15803d', bg: '#dcfce7' },
  'Cancelled': { color: '#dc2626', bg: '#fee2e2' },
  'No Show': { color: '#dc2626', bg: '#fee2e2' },
}

const RESCHEDULE_REASONS = [
  'Customer unavailable',
  'OS unavailable',
  'Site not ready',
  'Travel issue',
  'Requested by customer',
]

const OS_LIST = [
  { id: 'OS-001', name: 'Rahul Sharma', zone: 'South', languages: 'Kannada, English' },
  { id: 'OS-002', name: 'Arjun Das', zone: 'West', languages: 'Hindi, English' },
  { id: 'OS-003', name: 'Megha K', zone: 'North', languages: 'Hindi, Punjabi' },
  { id: 'OS-004', name: 'Priya Iyer', zone: 'South', languages: 'Tamil, English' },
  { id: 'OS-005', name: 'Vikram Nair', zone: 'West', languages: 'Marathi, English' },
]

// Compute TAT status from submitted time
function getTatStatus(lead: Lead): 'Within TAT' | 'Due Today' | 'TAT Breached' {
  const qualified = new Date(lead.lastUpdatedAt)
  const now = new Date()
  const hoursElapsed = (now.getTime() - qualified.getTime()) / (1000 * 60 * 60)
  if (hoursElapsed > 24) return 'TAT Breached'
  if (hoursElapsed > 20) return 'Due Today'
  return 'Within TAT'
}

export function SchedulingDashboard({ sessionUser, subPath }: { sessionUser: SessionUser; subPath?: string }) {
  const { dataset, scheduleMeeting } = useAppData()
  const isAllMeetingsView = subPath === 'meetings'

  const leads = dataset.leads
  const qualified = useMemo(() =>
    leads.filter(l => ['Qualified', 'Sent to Scheduling Team', 'Meeting Date Selection Pending', 'OS Selection Pending'].includes(l.currentStage)),
    [leads]
  )
  const meetings = dataset.meetings

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isReschedule, setIsReschedule] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const kpis = useMemo(() => ({
    pending: qualified.length,
    scheduled: leads.filter(l => l.currentStage === 'Meeting Scheduled').length,
    dueToday: qualified.filter(l => getTatStatus(l) === 'Due Today').length,
    tatBreached: qualified.filter(l => getTatStatus(l) === 'TAT Breached').length,
    completed: leads.filter(l => l.currentStage === 'Meeting Done').length,
    rescheduled: meetings.filter(m => m.status === 'Reschedule Requested' || m.status === 'Rescheduled').length,
    noShow: meetings.filter(m => m.status === 'No Show').length,
    upcoming: meetings.filter(m => m.status === 'Meeting Scheduled').length,
  }), [leads, qualified, meetings])

  const handleSchedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedLead) return
    setIsSubmitting(true)
    const fd = new FormData(e.currentTarget)
    const input: ScheduleMeetingInput = {
      leadId: selectedLead.id,
      assignedOs: fd.get('assignedOs') as string,
      date: fd.get('date') as string,
      time: fd.get('time') as string,
      mode: fd.get('mode') as MeetingMode,
      notes: fd.get('notes') as string,
      rescheduleReason: fd.get('rescheduleReason') as string || undefined,
    }
    try {
      await scheduleMeeting(input, sessionUser)
      setSelectedLead(null)
      setIsReschedule(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const tableLeads = isAllMeetingsView ? leads.filter(l => ['Meeting Scheduled', 'Meeting Done', 'Rescheduled'].includes(l.currentStage)) : qualified

  return (
    <div className="dashboard-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header */}
      <header style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1a3c8f', letterSpacing: '1px', marginBottom: '4px' }}>SCHEDULING CONTROL ROOM</p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>
          {isAllMeetingsView ? 'All Scheduled Meetings' : 'Daily Scheduling Queue'}
        </h1>
      </header>

      {/* TAT Breach Alert */}
      {kpis.tatBreached > 0 && (
        <div style={{ background: '#fff1f2', border: '1px solid #fda4af', borderRadius: '12px', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ color: '#be123c', fontWeight: 800, fontSize: '0.7rem', marginBottom: '4px' }}>🚨 TAT BREACH ALERT</div>
            <span style={{ color: '#9f1239', fontWeight: 700 }}>{kpis.tatBreached} leads not scheduled within 1 day of qualification</span>
          </div>
          <button style={{ background: '#be123c', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: 700, cursor: 'pointer' }}>FIX NOW</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="resp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Pending Scheduling', value: kpis.pending, color: '#1a3c8f', bg: '#eff6ff' },
          { label: 'Meeting Scheduled', value: kpis.scheduled, color: '#15803d', bg: '#f0fdf4' },
          { label: 'Due Today', value: kpis.dueToday, color: '#d97706', bg: '#fffbeb' },
          { label: 'TAT Breached', value: kpis.tatBreached, color: '#dc2626', bg: '#fff1f2' },
          { label: 'Completed Meetings', value: kpis.completed, color: '#15803d', bg: '#f0fdf4' },
          { label: 'Rescheduled', value: kpis.rescheduled, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'No Shows', value: kpis.noShow, color: '#dc2626', bg: '#fee2e2' },
          { label: 'Upcoming Meetings', value: kpis.upcoming, color: '#1a3c8f', bg: '#eff6ff' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: '12px', padding: '14px 18px', border: `1px solid ${k.color}20` }}>
            <div style={{ fontSize: '0.64rem', fontWeight: 700, color: k.color, opacity: 0.7, letterSpacing: '0.5px', marginBottom: '5px' }}>{k.label.toUpperCase()}</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Lead Table */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e8ecf0', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }}>
            {isAllMeetingsView ? 'Meeting Tracker' : 'Meeting Assignment Queue'}
          </h2>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{tableLeads.length} leads</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Lead / CRN', 'Lead City', 'Project Value', 'Model', 'IS Owner', 'Temperature', 'TAT Status', 'Scheduling Status', 'Assigned OS', 'Meeting Date', ''].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableLeads.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                  {isAllMeetingsView ? 'No meetings scheduled yet.' : 'All qualified leads have been scheduled. ✓'}
                </td></tr>
              ) : tableLeads.map(lead => {
                const tat = getTatStatus(lead)
                const tatColor = tat === 'TAT Breached' ? '#dc2626' : tat === 'Due Today' ? '#d97706' : '#15803d'
                const tatBg = tat === 'TAT Breached' ? '#fee2e2' : tat === 'Due Today' ? '#fef9c3' : '#dcfce7'
                const stageStyle = STATUS_COLORS[lead.currentStage] || { color: '#1a3c8f', bg: '#eff6ff' }
                const meeting = meetings.find(m => m.leadId === lead.id)
                return (
                  <tr key={lead.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '13px 14px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{lead.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#1a3c8f', fontWeight: 600 }}>#{lead.crnNumber || 'PENDING'}</div>
                    </td>
                    <td style={{ padding: '13px 14px', fontSize: '0.82rem' }}>{lead.city}</td>
                    <td style={{ padding: '13px 14px', fontWeight: 700, color: '#1a3c8f', fontSize: '0.82rem' }}>{formatCurrencyCr(lead.projectValueCr)}</td>
                    <td style={{ padding: '13px 14px', fontSize: '0.75rem', color: '#64748b' }}>{lead.selectedModel}</td>
                    <td style={{ padding: '13px 14px', fontSize: '0.78rem' }}>{lead.isOwner || '—'}</td>
                    <td style={{ padding: '13px 14px' }}>
                      {lead.temperature ? (
                        <span style={{ background: lead.temperature === 'Hot' ? '#fee2e2' : lead.temperature === 'Warm' ? '#fef9c3' : '#f1f5f9', color: lead.temperature === 'Hot' ? '#dc2626' : lead.temperature === 'Warm' ? '#d97706' : '#475569', padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>{lead.temperature}</span>
                      ) : <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>}
                    </td>
                    <td style={{ padding: '13px 14px' }}>
                      <span style={{ background: tatBg, color: tatColor, padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>{tat}</span>
                    </td>
                    <td style={{ padding: '13px 14px' }}>
                      <span style={{ background: stageStyle.bg, color: stageStyle.color, padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{lead.currentStage}</span>
                    </td>
                    <td style={{ padding: '13px 14px', fontSize: '0.78rem' }}>{meeting?.assignedOs || '—'}</td>
                    <td style={{ padding: '13px 14px', fontSize: '0.78rem', color: '#64748b' }}>
                      {meeting ? `${meeting.date} ${meeting.time}` : '—'}
                    </td>
                    <td style={{ padding: '13px 14px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setSelectedLead(lead); setIsReschedule(false) }} style={{ background: '#1a3c8f', color: 'white', border: 'none', borderRadius: '7px', padding: '6px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {meeting ? 'UPDATE' : 'SCHEDULE'}
                        </button>
                        {meeting && (
                          <button onClick={() => { setSelectedLead(lead); setIsReschedule(true) }} style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '7px', padding: '6px 10px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                            Reschedule
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule / Reschedule Modal */}
      {selectedLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'grid', placeItems: 'center' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '22px', width: '100%', maxWidth: '520px', animation: 'fadeIn 0.2s ease-out', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                {isReschedule ? '📅 Reschedule Meeting' : '📅 Schedule Expert Meeting'}
              </h2>
              <button onClick={() => setSelectedLead(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ marginBottom: '20px', fontSize: '0.82rem', color: '#64748b' }}>
              <strong style={{ color: '#0f172a' }}>{selectedLead.name}</strong> · {selectedLead.city} · #{selectedLead.crnNumber || 'PENDING'} · {formatCurrencyCr(selectedLead.projectValueCr)}
            </div>
            {/* Lead details visible to scheduler (no phone number) */}
            <div className="resp-grid-2" style={{ background: '#f8fafc', borderRadius: '10px', padding: '13px 16px', marginBottom: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Temperature', value: selectedLead.temperature || 'Not set' },
                { label: 'Selected Model', value: selectedLead.selectedModel },
                { label: 'IS Owner', value: selectedLead.isOwner || '—' },
                { label: 'Requirement', value: selectedLead.requirementSummary || 'No summary' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.4px' }}>{item.label.toUpperCase()}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.value}</div>
                </div>
              ))}
            </div>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '14px' }} onSubmit={handleSchedule}>
              {isReschedule && (
                <div className="form-group">
                  <label>Reschedule Reason *</label>
                  <select name="rescheduleReason" className="input-field" required>
                    {RESCHEDULE_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Assign OS Executive *</label>
                <select name="assignedOs" className="input-field" required>
                  {OS_LIST.map(os => (
                    <option key={os.id} value={`${os.id} - ${os.name}`}>{os.name} ({os.zone} · {os.languages})</option>
                  ))}
                </select>
              </div>
              <div className="resp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group"><label>Meeting Date *</label><input name="date" type="date" required className="input-field" /></div>
                <div className="form-group"><label>Meeting Time *</label><input name="time" type="time" required className="input-field" /></div>
              </div>
              <div className="form-group">
                <label>Meeting Mode *</label>
                <select name="mode" className="input-field" required>
                  <option value="Site Visit">Site Visit</option>
                  <option value="Office Visit">Office Visit</option>
                  <option value="Video Call">Video Call</option>
                  <option value="Phone Call">Phone Call</option>
                </select>
              </div>
              <div className="form-group">
                <label>Meeting Notes (Internal)</label>
                <textarea name="notes" placeholder="Directions, customer preferences, special requirements…" className="input-field" style={{ minHeight: '72px', resize: 'vertical' }} />
              </div>
              <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#1a3c8f' }}>
                📣 Once confirmed: OS, IS Team, CP portal, and customer will be notified automatically.
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button type="button" onClick={() => setSelectedLead(null)} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '11px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ flex: 2, background: '#1a3c8f', color: 'white', border: 'none', borderRadius: '10px', padding: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  {isSubmitting ? 'Confirming…' : isReschedule ? 'Confirm Reschedule ✓' : 'Confirm Meeting ✓'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
