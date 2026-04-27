import { useState, useMemo } from 'react'
import { formatCurrencyCr, formatDate } from '../../lib/format'
import { useAppData } from '../../data/app-data'
import type { CallStatus, InterestStatus, IsDispositionInput, Lead, LeadTemperature } from '../../types/domain'
import type { SessionUser } from '../../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────
const CALL_STATUSES: { value: CallStatus; label: string; color: string; bg: string }[] = [
  { value: 'Connected', label: 'Connected', color: '#15803d', bg: '#dcfce7' },
  { value: 'Callback Later', label: 'Callback Later', color: '#854d0e', bg: '#fef9c3' },
  { value: 'No Response', label: 'No Incoming', color: '#dc2626', bg: '#fee2e2' },
  { value: 'RNR1', label: 'RNR 1', color: '#c2410c', bg: '#fff7ed' },
  { value: 'RNR2', label: 'RNR 2', color: '#c2410c', bg: '#fff7ed' },
  { value: 'RNR3', label: 'RNR 3', color: '#c2410c', bg: '#fff7ed' },
  { value: 'RNR4', label: 'RNR 4', color: '#c2410c', bg: '#fff7ed' },
  { value: 'RNR5', label: 'RNR 5', color: '#c2410c', bg: '#fff7ed' },
]
const NON_INTERESTED_REASONS = [
  'Already working with another builder',
  'Budget issue',
  'Project postponed',
  'Not planning currently',
  'Looking only for design',
  'Wants local contractor',
  'No longer interested',
]
const FOLLOW_UP_LOGIC = {
  Hot: { interval: '3–5 days', action: 'Prioritize for fast meeting scheduling', badge: '#dc2626', bg: '#fee2e2' },
  Warm: { interval: '10–15 days', action: 'Keep engagement active, track readiness', badge: '#d97706', bg: '#fef9c3' },
  'Pre-Cold': { interval: '20–30 days', action: 'Maintain relationship, periodic updates', badge: '#7c3aed', bg: '#f5f3ff' },
  Cold: { interval: '45–60 days', action: 'Nurture bucket — re-engage later', badge: '#475569', bg: '#f1f5f9' },
}

export function IsDashboard({ sessionUser }: { sessionUser: SessionUser; subPath?: string }) {
  const { dataset, updateIsDisposition } = useAppData()
  const leads = dataset.leads

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [callStatus, setCallStatus] = useState<CallStatus>('Connected')
  const [interestStatus, setInterestStatus] = useState<InterestStatus>('Interested')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  const kpis = useMemo(() => ({
    total: leads.length,
    pending: leads.filter(l => l.currentStage === 'Lead Shared').length,
    qualified: leads.filter(l => l.currentStage === 'Qualified').length,
    callbackLater: leads.filter(l => l.currentStage === 'Callback Later').length,
    hot: leads.filter(l => l.temperature === 'Hot').length,
    warm: leads.filter(l => l.temperature === 'Warm').length,
    cold: leads.filter(l => l.temperature === 'Cold').length,
    active: leads.filter(l => l.currentStage !== 'Rejected' && l.currentStage !== 'Inactive').length,
  }), [leads])

  const openModal = (lead: Lead) => {
    setSelectedLead(lead)
    setCallStatus('Connected')
    setInterestStatus('Interested')
    setStep(1)
  }

  const handleDisposition = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedLead) return
    setIsSubmitting(true)
    const fd = new FormData(e.currentTarget)
    const input: IsDispositionInput = {
      leadId: selectedLead.id,
      callStatus,
      interestStatus: callStatus === 'Connected' ? interestStatus : undefined,
      temperature: fd.get('temperature') as LeadTemperature || undefined,
      reason: fd.get('reason') as string || undefined,
      detailedComment: fd.get('detailedComment') as string || undefined,
      expectedConcern: fd.get('expectedConcern') as string || undefined,
      nextPossibleAction: fd.get('nextPossibleAction') as string || undefined,
      expectedTimeline: fd.get('expectedTimeline') as string || undefined,
      budgetRange: fd.get('budgetRange') as string || undefined,
      expectedProjectValueCr: fd.get('expectedProjectValueCr') ? parseFloat(fd.get('expectedProjectValueCr') as string) : undefined,
      requirementSummary: fd.get('requirementSummary') as string || undefined,
      comment: fd.get('comment') as string || undefined,
      qualifyLead: fd.get('qualifyLead') === 'on',
      nextFollowUpDate: fd.get('nextFollowUpDate') as string || undefined,
    }
    try {
      await updateIsDisposition(input, sessionUser)
      setSelectedLead(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusStyle = (stage: string) => {
    if (stage === 'Connected') return { color: '#15803d', bg: '#dcfce7' }
    if (stage === 'Callback Later') return { color: '#854d0e', bg: '#fef9c3' }
    if (stage === 'Non-Interested') return { color: '#dc2626', bg: '#fee2e2' }
    if (stage.startsWith('RNR')) return { color: '#c2410c', bg: '#fff7ed' }
    if (stage === 'No Response') return { color: '#dc2626', bg: '#fee2e2' }
    if (stage === 'Qualified') return { color: '#15803d', bg: '#dcfce7' }
    return { color: '#1a3c8f', bg: '#eff6ff' }
  }

  const tempHint = (temp?: string) => {
    if (!temp || !(temp in FOLLOW_UP_LOGIC)) return null
    const t = FOLLOW_UP_LOGIC[temp as keyof typeof FOLLOW_UP_LOGIC]
    return t
  }

  return (
    <div className="dashboard-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* SLA Alert - TOPMOST */}
      {kpis.pending > 0 && (
        <div style={{ background: '#fff1f2', border: '1px solid #fda4af', borderRadius: '14px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ color: '#be123c', fontWeight: 800, fontSize: '0.7rem', marginBottom: '4px', letterSpacing: '0.5px' }}>⚠️ SLA BREACH WARNING</div>
            <span style={{ color: '#9f1239', fontWeight: 700 }}>{kpis.pending} leads pending call &gt; 30 minutes — New lead must be called within 30 mins</span>
          </div>
          <button style={{ background: '#be123c', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>PRIORITIZE NOW</button>
        </div>
      )}

      {/* Page Header */}
      <header style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1a3c8f', letterSpacing: '1px', marginBottom: '4px' }}>IS TEAM WORKSPACE</p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>
          Call Queue & Qualification
        </h1>
      </header>

      {/* 10 KPI Cards */}
      <div className="resp-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Assigned', value: kpis.total, color: '#1a3c8f', sub: 'All leads' },
          { label: 'Pending Calls', value: kpis.pending, color: '#dc2626', sub: 'TAT Active' },
          { label: '✅ Qualified', value: kpis.qualified, color: '#15803d', sub: '→ Scheduling' },
          { label: 'Callback Later', value: kpis.callbackLater, color: '#d97706', sub: 'Follow-up' },
          { label: '🔥 Hot Leads', value: kpis.hot, color: '#dc2626', sub: '1–2 months' },
          { label: '🌡️ Warm Leads', value: kpis.warm, color: '#d97706', sub: '2–4 months' },
          { label: '❄️ Cold Leads', value: kpis.cold, color: '#475569', sub: '6+ months' },
          { label: 'Active Pipeline', value: kpis.active, color: '#1a3c8f', sub: 'In Journey' },
        ].map(k => (
          <div key={k.label} style={{ background: 'white', borderRadius: '12px', padding: '14px 16px', border: '1px solid #e8ecf0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: '6px' }}>{k.label.toUpperCase()}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, lineHeight: 1, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '3px' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Lead Table */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e8ecf0', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }}>Qualification Queue</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '0.75rem', cursor: 'pointer' }}>⚙ Filter</button>
            <button style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '0.75rem', cursor: 'pointer' }}>⬇ Export</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Lead Name & Number', 'Referring CP', 'Project / Value', 'Submitted', 'Last Call', 'Status', 'Temp', 'Next Action', ''].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.67rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No leads in queue.</td></tr>
              ) : leads.map(lead => {
                const s = getStatusStyle(lead.currentStage)
                const hint = tempHint(lead.temperature)
                return (
                  <tr key={lead.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.87rem' }}>{lead.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{lead.city} · {lead.phone}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{lead.cpName}</div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{lead.cpEmail || 'No email'}</div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{lead.cpPhone || 'No phone'}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '0.8rem' }}>{lead.projectType}</div>
                      <div style={{ fontWeight: 700, color: '#1a3c8f', fontSize: '0.8rem' }}>{formatCurrencyCr(lead.projectValueCr)}</div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{lead.selectedModel}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.78rem', color: '#64748b' }}>{formatDate(lead.submittedAt)}</td>
                    <td style={{ padding: '14px 16px', fontSize: '0.78rem', color: '#64748b' }}>{formatDate(lead.lastUpdatedAt)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: s.bg, color: s.color, padding: '3px 9px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>{lead.currentStage}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {hint ? (
                        <span style={{ background: hint.bg, color: hint.badge, padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>{lead.temperature}</span>
                      ) : <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{lead.nextAction}</div>
                      {hint && <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>Follow-up: {hint.interval}</div>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => openModal(lead)}
                        style={{ background: '#1a3c8f', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        CALL LOG
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Disposition Modal ── */}
      {
        selectedLead && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'grid', placeItems: 'center' }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '22px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', animation: 'fadeIn 0.2s ease-out', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Call Disposition</h2>
                <button onClick={() => setSelectedLead(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ marginBottom: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>LEAD DETAILS</div>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{selectedLead.name}</div>
                    <div style={{ fontSize: '0.82rem', color: '#475569' }}>{selectedLead.phone}</div>
                    <div style={{ fontSize: '0.82rem', color: '#475569' }}>{selectedLead.city} · {selectedLead.projectType} · {formatCurrencyCr(selectedLead.projectValueCr)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>REFERRING CP</div>
                    <div style={{ fontWeight: 800, color: '#1a3c8f' }}>{selectedLead.cpName}</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569' }}>{selectedLead.cpEmail}</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569' }}>{selectedLead.cpPhone}</div>
                  </div>
                </div>
                {selectedLead.reasonForNotProceeding && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>REASON FOR NOT PROCEEDING PERSONALLY</div>
                    <div style={{ fontSize: '0.85rem', color: '#1a3c8f', fontWeight: 600 }}>"{selectedLead.reasonForNotProceeding}"</div>
                  </div>
                )}
                {selectedLead.comment && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>CP ADDITIONAL NOTES</div>
                    <div style={{ fontSize: '0.82rem', color: '#475569', fontStyle: 'italic' }}>{selectedLead.comment}</div>
                  </div>
                )}
              </div>

              {/* Step 1: Call Status */}
              {step === 1 && (
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: '10px' }}>STEP 1 — CALL STATUS</div>
                  <div className="resp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
                    {CALL_STATUSES.map(cs => (
                      <button
                        key={cs.value}
                        onClick={() => setCallStatus(cs.value)}
                        style={{
                          padding: '10px 6px', borderRadius: '10px', border: `2px solid ${callStatus === cs.value ? cs.color : '#e2e8f0'}`,
                          background: callStatus === cs.value ? cs.bg : 'white',
                          color: callStatus === cs.value ? cs.color : '#475569',
                          fontWeight: callStatus === cs.value ? 700 : 500, fontSize: '0.75rem', cursor: 'pointer', textAlign: 'center',
                        }}
                      >
                        {cs.label}
                      </button>
                    ))}
                  </div>
                  {callStatus === 'Connected' && (
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: '10px' }}>CUSTOMER INTEREST</div>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                        {(['Interested', 'Non-Interested'] as InterestStatus[]).map(s => (
                          <button
                            key={s}
                            onClick={() => setInterestStatus(s)}
                            style={{
                              flex: 1, padding: '12px', borderRadius: '10px',
                              border: `2px solid ${interestStatus === s ? (s === 'Interested' ? '#15803d' : '#dc2626') : '#e2e8f0'}`,
                              background: interestStatus === s ? (s === 'Interested' ? '#dcfce7' : '#fee2e2') : 'white',
                              color: interestStatus === s ? (s === 'Interested' ? '#15803d' : '#dc2626') : '#475569',
                              fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem',
                            }}
                          >
                            {s === 'Interested' ? '✅ Interested' : '❌ Not Interested'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={() => setStep(2)} style={{ background: '#1a3c8f', color: 'white', border: 'none', borderRadius: '10px', padding: '12px', width: '100%', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>
                    Next — Fill Details →
                  </button>
                </div>
              )}

              {/* Step 2: Detailed form */}
              {step === 2 && (
                <form style={{ display: 'flex', flexDirection: 'column', gap: '14px' }} onSubmit={handleDisposition}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1a3c8f', padding: '10px', background: '#eff6ff', borderRadius: '8px', marginBottom: '4px' }}>
                    {callStatus} {callStatus === 'Connected' ? `· ${interestStatus}` : ''}
                  </div>

                  {/* Non-Interested branch */}
                  {callStatus === 'Connected' && interestStatus === 'Non-Interested' && (
                    <>
                      <div style={{ background: '#fff1f2', border: '1px solid #fda4af', borderRadius: '10px', padding: '12px 14px', fontSize: '0.8rem', color: '#9f1239' }}>
                        ⚠️ This lead will be sent back to CP. The CP will be asked: <strong>Reconnect with this lead? Yes / No</strong>
                      </div>
                      <div className="form-group"><label>Reason *</label>
                        <select name="reason" className="input-field" required>
                          {NON_INTERESTED_REASONS.map(r => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="form-group"><label>Detailed Comment *</label>
                        <textarea name="detailedComment" className="input-field" style={{ minHeight: '70px', resize: 'vertical' }} required placeholder="Exact words of the customer…" />
                      </div>
                      <div className="form-group"><label>Expected Concern</label>
                        <input name="expectedConcern" type="text" className="input-field" placeholder="E.g. Timeline, budget, builder trust…" />
                      </div>
                      <div className="form-group"><label>Next Possible Action</label>
                        <input name="nextPossibleAction" type="text" className="input-field" placeholder="E.g. Send brochure, reconnect after 30 days…" />
                      </div>
                    </>
                  )}

                  {/* Interested branch */}
                  {callStatus === 'Connected' && interestStatus === 'Interested' && (
                    <>
                      <div className="form-group"><label>Lead Temperature *</label>
                        <select name="temperature" className="input-field" required>
                          <option value="Hot">🔥 Hot — Project within 1–2 months</option>
                          <option value="Warm">🌡️ Warm — Project within 2–4 months</option>
                          <option value="Pre-Cold">🌥️ Pre-Cold — Project within 4–6 months</option>
                          <option value="Cold">❄️ Cold — After 6 months</option>
                        </select>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group"><label>Expected Timeline</label>
                          <input name="expectedTimeline" type="text" className="input-field" placeholder="e.g. 2 months" />
                        </div>
                        <div className="form-group"><label>Budget Range</label>
                          <input name="budgetRange" type="text" className="input-field" placeholder="e.g. ₹50L – ₹1Cr" />
                        </div>
                      </div>
                      <div className="form-group"><label>Expected Project Value (Cr)</label>
                        <input name="expectedProjectValueCr" type="number" step="0.01" className="input-field" placeholder="e.g. 1.5" />
                      </div>
                      <div className="form-group"><label>Requirement Summary</label>
                        <textarea name="requirementSummary" className="input-field" style={{ minHeight: '60px' }} placeholder="Scope, design preference, site details…" />
                      </div>
                      <div className="form-group"><label>IS Comment (for scheduling team)</label>
                        <textarea name="comment" className="input-field" style={{ minHeight: '70px' }} required placeholder="Detailed notes for OS team…" />
                      </div>
                      <div className="form-group"><label>Next Follow-up Date</label>
                        <input name="nextFollowUpDate" type="date" className="input-field" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #86efac' }}>
                        <input name="qualifyLead" type="checkbox" id="qualify" />
                        <label htmlFor="qualify" style={{ margin: 0, fontWeight: 700, color: '#15803d', cursor: 'pointer', fontSize: '0.875rem' }}>
                          ✅ QUALIFY LEAD & GENERATE CRN → Send to Scheduling
                        </label>
                      </div>
                    </>
                  )}

                  {/* Non-connected statuses */}
                  {callStatus !== 'Connected' && (
                    <>
                      <div className="form-group"><label>Comment</label>
                        <textarea name="comment" className="input-field" style={{ minHeight: '70px' }} placeholder="Note what happened on this attempt…" />
                      </div>
                      <div className="form-group"><label>Next Follow-up Date</label>
                        <input name="nextFollowUpDate" type="date" className="input-field" />
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <button type="button" onClick={() => setStep(1)} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '11px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>← Back</button>
                    <button type="submit" disabled={isSubmitting} style={{ flex: 2, background: '#1a3c8f', color: 'white', border: 'none', borderRadius: '10px', padding: '11px', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>
                      {isSubmitting ? 'Saving…' : 'Submit Disposition ✓'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )
      }
    </div >
  )
}
