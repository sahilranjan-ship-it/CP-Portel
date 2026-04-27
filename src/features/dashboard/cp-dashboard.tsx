import { useState, useMemo, Fragment } from 'react'
import { formatCurrencyCr, formatDate } from '../../lib/format'
import { useAppData } from '../../data/app-data'
import type { LeadBucket, LeadSubmissionInput, PartnershipModel, LeadStage } from '../../types/domain'
import { NOT_PROCEEDING_REASONS } from '../../types/domain'
import type { SessionUser } from '../../lib/supabase'
import { AGREEMENT_TEMPLATE, generateAgreement } from '../../lib/legal-templates'
import { todayIso } from '../../data/repository-utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const JOURNEY_STAGES: LeadStage[] = [
  'Lead Shared', 'Qualified', 'Meeting Scheduled', 'Meeting Done',
  'Proposal Shared', 'GMV Discussion', 'BA Pending', 'BA Collected',
]

const LEAD_TABS: { label: string; bucket: LeadBucket }[] = [
  { label: 'Active Leads', bucket: 'Active Leads' },
  { label: 'Won Leads', bucket: 'Won Leads' },
  { label: 'Inactive Leads', bucket: 'Inactive Leads' },
  { label: 'Rejected Leads', bucket: 'Rejected Leads' },
]

const PARTNERSHIP_MODELS = [
  {
    icon: '💰',
    name: 'Direct Incentive',
    color: '#1a3c8f',
    bg: '#eff6ff',
    tagline: 'Share a lead, earn guaranteed payout',
    points: [
      'No execution responsibility',
      'Payout within 7 days after BA collection',
      'Below ₹5 Cr → 2% incentive',
      '₹5–₹10 Cr → 2.5% incentive',
      'Above ₹10 Cr → 3% incentive',
    ],
  },
  {
    icon: '🏗️',
    name: 'Shared Construction',
    color: '#0d7a3c',
    bg: '#f0fdf4',
    tagline: 'Execute a scope, earn execution profit',
    points: [
      '10–20% scope allocation to CP',
      'Earn execution profit + commission',
      'Suitable for plumbing, finishing, interiors',
      'Electrical, boundary wall, fabrication',
    ],
  },
  {
    icon: '🔄',
    name: 'Barter / Exchange',
    color: '#92400e',
    bg: '#fffbeb',
    tagline: 'Share leads outside your area, get one back',
    points: [
      'Share leads outside service area/capability',
      'B&B matches a suitable project back',
      'Matching starts after BA collection',
      'Expected timeline: 7–14 days',
    ],
  },
  {
    icon: '🤝',
    name: 'Financial Assistance',
    color: '#6d28d9',
    bg: '#f5f3ff',
    tagline: 'Execute with B&B funding support',
    points: [
      'B&B supports working capital & materials',
      'Suitable for large-value or cash-flow projects',
      'B&B manages payments, CP focuses on execution',
    ],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function CpDashboard({ sessionUser, subPath }: { sessionUser: SessionUser; subPath?: string }) {
  const { dataset, submitLead, updateAgreement } = useAppData()

  // ── Data ──
  const cp = useMemo(() => {
    const matches = dataset.cps.filter(c =>
      (c.email?.toLowerCase() === sessionUser.email?.toLowerCase()) ||
      (c.linkedUserId === sessionUser.userMasterId) ||
      (c.name?.toLowerCase() === sessionUser.name?.toLowerCase() && c.name?.length > 3)
    )
    if (matches.length === 0) return null

    // Sort logic to find the "Real" record:
    // 1. Records with a proper code (not GUEST/PENDING)
    // 2. Records with the most projects
    return [...matches].sort((a, b) => {
      const aIsReal = a.code && !a.code.includes('GUEST') && a.code !== 'PENDING';
      const bIsReal = b.code && !b.code.includes('GUEST') && b.code !== 'PENDING';
      if (aIsReal && !bIsReal) return -1;
      if (!aIsReal && bIsReal) return 1;
      return (b.totalAssignedProjects || 0) - (a.totalAssignedProjects || 0);
    })[0]
  }, [dataset.cps, sessionUser.email, sessionUser.userMasterId, sessionUser.name])

  const myLeads = useMemo(
    () => (cp ? dataset.leads.filter(l => l.cpId === cp.id) : []),
    [dataset.leads, cp]
  )

  const myIncentives = useMemo(
    () => (cp ? dataset.incentives.filter(i => i.cpId === cp.id) : []),
    [dataset.incentives, cp]
  )

  const myScProjects = useMemo(
    () => (cp ? dataset.sharedConstructionProjects.filter(p => p.cpId === cp.id) : []),
    [dataset.sharedConstructionProjects, cp]
  )

  const myMeetings = useMemo(() => {
    const myLeadIds = new Set(myLeads.map(l => l.id))
    return dataset.meetings.filter(m => myLeadIds.has(m.leadId))
  }, [dataset.meetings, myLeads])

  const myAgreement = useMemo(() => {
    // Find ALL cp IDs that belong to this user (by email or linked user ID)
    const myCpIds = new Set(
      dataset.cps
        .filter(c =>
          c.email?.toLowerCase() === sessionUser.email?.toLowerCase() ||
          c.linkedUserId === sessionUser.userMasterId
        )
        .map(c => c.id)
    )
    // Return the most relevant agreement (prefer Sent/Signed over Pending)
    const all = dataset.agreements.filter(a => myCpIds.has(a.contractorId))
    return all.sort((a, b) => {
      const rank = (s: string) => s === 'Signed' ? 3 : s === 'Sent' ? 2 : s === 'Pending' ? 1 : 0
      return rank(b.status) - rank(a.status)
    })[0]
  }, [dataset.agreements, dataset.cps, sessionUser.email, sessionUser.userMasterId])

  // ── Stats ──
  const stats = useMemo(() => {
    const earned = myIncentives.reduce((s, i) => s + i.incentiveAmountLakh, 0)
    const paid = myIncentives.filter(i => i.paymentStatus === 'Released').reduce((s, i) => s + i.incentiveAmountLakh, 0)
    const scProfit = myScProjects.reduce((s, p) => s + p.projectedProfitLakh, 0)
    return {
      activeLeads: myLeads.filter(l => l.bucket === 'Active Leads').length,
      wonLeads: myLeads.filter(l => l.bucket === 'Won Leads').length,
      inactiveLeads: myLeads.filter(l => l.bucket === 'Inactive Leads').length,
      rejectedLeads: myLeads.filter(l => l.bucket === 'Rejected Leads').length,
      qualified: myLeads.filter(l => l.currentStage === 'Qualified').length,
      baCollected: myLeads.filter(l => l.baStatus === 'Collected').length,
      totalLeads: myLeads.length,
      incentiveEarned: earned,
      incentivePaid: paid,
      incentivePending: earned - paid,
      scProfit,
      activeScProjects: myScProjects.filter(p => p.executionStatus !== 'Completed').length,
      faProjects: cp?.initProjectCount ?? 0,
      upcomingMeetings: myMeetings.filter(m => m.status === 'Meeting Scheduled').length,
    }
  }, [myLeads, myIncentives, myScProjects, myMeetings, cp])

  // ── Local state ──
  const initialBucket: LeadBucket = useMemo(() => {
    if (subPath === 'won') return 'Won Leads'
    if (subPath === 'rejected') return 'Rejected Leads'
    if (subPath === 'leads') return 'Active Leads'
    return 'Active Leads'
  }, [subPath])

  const [activeBucket, setActiveBucket] = useState<LeadBucket>(initialBucket)
  const [expandedLead, setExpandedLead] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formSuccess, setFormSuccess] = useState(false)

  const isAgreementsView = subPath === 'agreements'

  // ── Submission ──
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    const fd = new FormData(e.currentTarget)
    const input: LeadSubmissionInput = {
      name: fd.get('name') as string,
      phone: fd.get('phone') as string,
      city: fd.get('city') as string,
      projectType: fd.get('projectType') as string,
      projectValueCr: parseFloat(fd.get('projectValueCr') as string),
      selectedModel: fd.get('selectedModel') as PartnershipModel,
      notes: fd.get('notes') as string,
      reasonForNotProceeding: fd.get('reasonForNotProceeding') as string,
    }
    try {
      await submitLead(input, sessionUser)
      setFormSuccess(true)
      setTimeout(() => { setShowForm(false); setFormSuccess(false) }, 2000)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Synthetic CP fallback ────────────────────────────────────────────────
  // When cp_master row doesn't exist yet (RLS insert still pending / new user),
  // build a placeholder from sessionUser so the dashboard renders immediately.
  const effectiveCp = cp ?? {
    id: 'PENDING',
    code: 'GUEST',
    name: sessionUser.name,
    companyName: sessionUser.name,
    city: 'Location Not Set',
    activeSince: todayIso(),
    primaryScope: 'Full Interior',
    phone: 'NA',
    spoc: sessionUser.name,
    vmOwner: 'Unassigned',
    tier: 'Classic',
    activeProjects: 0,
    completedProjects: 0,
    heldProjects: 0,
    totalProjectValueCr: 0,
    totalAssignedProjects: 0,
    averageCsat: 0,
    averageDelayDays: 0,
    lowestPercentageCompleted: 0,
    bmsPriority: 'Medium' as const,
    eligibleForProject: true,
    initProjectCount: 0,
    leadsReceived: 0,
    linkedUserId: sessionUser.userMasterId,
  }

  const isNewUser = !cp   // show a setup banner in this case

  // ─── Agreements View ──────────────────────────────────────────────────────────
  if (isAgreementsView) {
    // Agreement is visible if EITHER the onboarding field OR the agreement_master record shows Sent/Signed/Done
    const agreementSent = (
      ['Sent', 'Signed', 'Done'].includes(effectiveCp.onboardingAgreementSentStatus ?? '') ||
      ['Sent', 'Signed', 'Done'].includes(myAgreement?.status ?? '')
    )
    const isSigned = effectiveCp.onboardingCpSignedStatus === 'Done' || myAgreement?.status === 'Signed' || myAgreement?.status === 'Done'
    const agreementContent = cp ? generateAgreement(cp.name) : AGREEMENT_TEMPLATE

    const handleSign = async () => {
      if (!cp) return
      setIsSubmitting(true)
      try {
        await updateAgreement({ contractorId: cp.id, status: 'Signed' }, sessionUser)
        setFormSuccess(true)
      } finally {
        setIsSubmitting(false)
      }
    }

    // Not yet sent by VM — show a waiting state
    if (!agreementSent) {
      return (
        <div className="dashboard-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <SectionHeader title="Partnership Agreement" subtitle="Review and digitally sign your agreement" />
          <div style={{ maxWidth: '900px', margin: '0 auto', background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📄</div>
            <h2 style={{ margin: '0 0 8px', color: '#1e293b' }}>Agreement Not Yet Sent</h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '480px', margin: '0 auto 24px' }}>
              Your partnership agreement has not been sent yet. Your assigned VM ({effectiveCp.vmOwner || 'team'}) will send it once your onboarding is complete.
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              Contact your SPOC if you believe this is an error.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="dashboard-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
        <SectionHeader title="Partnership Agreement" subtitle="Review and digitally sign your agreement" />

        <div style={{ maxWidth: '900px', margin: '0 auto', background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', padding: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h2 style={{ margin: 0 }}>Domestic Channel Partner Agreement</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                Partner: <strong>{effectiveCp.name}</strong> &nbsp;·&nbsp;
                Sent: {myAgreement ? formatDate(myAgreement.sentDate) : formatDate(new Date().toISOString())}
              </p>
            </div>
            <StatusBadge status={isSigned ? 'success' : 'pending'} label={isSigned ? 'Signed' : (myAgreement?.status || 'Sent')} />
          </div>

          <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '32px', maxHeight: '500px', overflowY: 'auto', border: '1px solid #edf2f7', color: '#1e293b', lineHeight: '1.7', whiteSpace: 'pre-wrap', fontSize: '0.92rem', marginBottom: '40px' }}>
            {agreementContent}
          </div>

          {!isSigned ? (
            <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '32px' }}>
              <h3 style={{ marginBottom: '16px' }}>Digital Signature</h3>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '16px', padding: '24px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1a3c8f', marginBottom: '6px' }}>FULL NAME AS PER AADHAAR</label>
                  <input id="sign-name" type="text" defaultValue={effectiveCp.name} placeholder="Type your full name" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem' }} />
                </div>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1a3c8f', marginBottom: '6px' }}>EMAIL ADDRESS</label>
                  <input id="sign-email" type="email" defaultValue={effectiveCp.email ?? sessionUser.email ?? ''} placeholder="your@email.com" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem' }} />
                </div>
                <button
                  disabled={isSubmitting || !cp}
                  onClick={handleSign}
                  style={{ background: '#1a3c8f', color: 'white', border: 'none', borderRadius: '12px', padding: '14px 32px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                  {isSubmitting ? 'Processing...' : 'Accept & Sign Agreement'}
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '12px', textAlign: 'center' }}>
                By clicking "Accept & Sign", you agree to the terms of the Partnership Agreement electronically.
              </p>
            </div>
          ) : (
            <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '16px', padding: '28px', textAlign: 'center' }}>
              {/* Green signed badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#22c55e', color: 'white', padding: '8px 20px', borderRadius: '999px', fontWeight: 700, fontSize: '0.9rem', marginBottom: '12px' }}>
                <span>✅</span> Agreement Signed
              </div>
              <p style={{ color: '#166534', fontWeight: 600, margin: '0 0 4px' }}>
                Signed on {myAgreement?.signedDate ? formatDate(myAgreement.signedDate) : 'Recently'}
              </p>
              <p style={{ color: '#15803d', fontSize: '0.85rem', margin: '0 0 20px' }}>
                Your onboarding is complete. You can now start sharing leads.
              </p>
              {/* Download PDF button */}
              <button
                onClick={() => {
                  const signedDate = myAgreement?.signedDate ? formatDate(myAgreement.signedDate) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
                  const cpName = effectiveCp.name || 'Partner'
                  const cpEmail = effectiveCp.email || sessionUser.email || ''
                  const printWindow = window.open('', '_blank', 'width=900,height=700')
                  if (!printWindow) return
                  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Partnership Agreement - ${cpName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', serif; color: #1a1a1a; background: white; padding: 60px; max-width: 800px; margin: 0 auto; line-height: 1.8; font-size: 13px; }
    .header { text-align: center; border-bottom: 3px solid #1a3c8f; padding-bottom: 24px; margin-bottom: 32px; }
    .header h1 { font-size: 22px; color: #1a3c8f; letter-spacing: 1px; margin-bottom: 6px; }
    .header p { color: #555; font-size: 12px; }
    .status-badge { display: inline-block; background: #22c55e; color: white; padding: 4px 16px; border-radius: 999px; font-size: 11px; font-weight: bold; margin-top: 8px; font-family: Arial, sans-serif; }
    .body-text { white-space: pre-wrap; font-size: 12.5px; line-height: 1.85; color: #222; margin-bottom: 40px; }
    .signature-block { border-top: 2px solid #1a3c8f; padding-top: 32px; margin-top: 40px; }
    .signature-block h3 { font-size: 14px; color: #1a3c8f; margin-bottom: 20px; letter-spacing: 0.5px; }
    .sig-row { display: flex; gap: 24px; margin-top: 8px; }
    .sig-field { flex: 1; border-bottom: 1px solid #333; padding-bottom: 4px; }
    .sig-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; font-family: Arial, sans-serif; }
    .sig-value { font-size: 18px; font-style: italic; color: #1a3c8f; font-family: 'Georgia', cursive; }
    .sig-email { font-size: 13px; font-style: normal; color: #1a3c8f; font-family: Arial, sans-serif; }
    .footer { text-align: center; margin-top: 48px; font-size: 10px; color: #aaa; font-family: Arial, sans-serif; border-top: 1px solid #eee; padding-top: 16px; }
    .certified { background: #f0fdf4; border: 1.5px solid #22c55e; border-radius: 8px; padding: 12px 20px; margin-top: 24px; color: #166534; font-size: 11px; font-family: Arial, sans-serif; }
    @media print { body { padding: 40px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>DOMESTIC CHANNEL PARTNER AGREEMENT</h1>
    <p>Brick &amp; Bolt Construction Technologies Pvt. Ltd.</p>
    <span class="status-badge">✓ DIGITALLY SIGNED</span>
  </div>
  <div class="body-text">${agreementContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  <div class="signature-block">
    <h3>DIGITAL SIGNATURE CERTIFICATE</h3>
    <div class="sig-row">
      <div class="sig-field">
        <div class="sig-value">${cpName}</div>
        <div class="sig-label">Signed By (Channel Partner)</div>
      </div>
      <div class="sig-field">
        <div class="sig-email">${cpEmail}</div>
        <div class="sig-label">Email Address</div>
      </div>
      <div class="sig-field">
        <div class="sig-value">${signedDate}</div>
        <div class="sig-label">Date of Signing</div>
      </div>
    </div>
    <div class="certified">
      ✅ This agreement was digitally signed by <strong>${cpName}</strong> (<strong>${cpEmail}</strong>) on <strong>${signedDate}</strong> via the Brick &amp; Bolt Partner Portal. This constitutes a legally binding electronic signature.
    </div>
  </div>
  <div class="footer">
    Brick &amp; Bolt Construction Technologies Pvt. Ltd. · Partner Portal · Generated ${new Date().toLocaleDateString('en-IN')}
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`)
                  printWindow.document.close()
                }}
                style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 28px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#15803d')}
                onMouseLeave={e => (e.currentTarget.style.background = '#16a34a')}
              >
                📄 Download Signed Agreement PDF
              </button>
            </div>
          )}

        </div>
      </div>
    )
  }

  // ─── Main CP Hub ───────────────────────────────────────────────────────────
  const visibleLeads = myLeads.filter(l => l.bucket === activeBucket)
  const chartData = [
    { label: 'SHARED', value: stats.totalLeads, color: '#bfdbfe' },
    { label: 'QUALIFIED', value: stats.qualified, color: '#1a3c8f' },
    { label: 'SITE VISIT', value: myLeads.filter(l => l.currentStage === 'Meeting Scheduled' || l.currentStage === 'Meeting Done').length, color: '#93c5fd' },
    { label: 'WON', value: stats.wonLeads, color: '#2b5be0' },
  ]
  const chartMax = Math.max(...chartData.map(d => d.value), 1)

  return (
    <div className="dashboard-content" style={{ animation: 'fadeIn 0.35s ease-out' }}>

      {/* ══ NEW USER BANNER ═════════════════════════════════════════════════ */}
      {isNewUser && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px',
          padding: '14px 20px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontSize: '1.2rem' }}>⚙️</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: '#92400e', fontSize: '0.85rem' }}>Profile setup in progress — </span>
            <span style={{ color: '#78350f', fontSize: '0.82rem' }}>Your CP record is being linked. Contact your SPOC Name to complete your profile. You can still browse and submit leads.</span>
          </div>
          <button onClick={() => window.location.reload()} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Refresh</button>
        </div>
      )}

      {/* ══ 1. PROFILE SUMMARY ═══════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'stretch' }}>
        {/* CP Info Box */}
        <div style={{
          background: 'white', borderRadius: '16px', padding: '16px 20px', flex: 1,
          display: 'flex', alignItems: 'center', gap: '18px', border: '1px solid #e2e8f0'
        }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg,#1a3c8f,#2b5be0)', display: 'grid', placeItems: 'center', fontSize: '1.4rem' }}>🏗️</div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>{effectiveCp.name}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', display: 'flex', gap: '12px' }}>
              <span>🪪 {effectiveCp.id === 'PENDING' ? 'ID pending…' : effectiveCp.code || effectiveCp.id}</span>
              <span>📍 {effectiveCp.city || 'BLR'}</span>
            </div>
          </div>
        </div>

        {/* Primary Contact */}
        <InfoBox
          title="Your SPOC (Contractor Side)"
          value={effectiveCp.spoc || sessionUser.name}
          sub={effectiveCp.phone || 'Contact not set'}
        />

        {/* Assigned B&B VM */}
        <InfoBox
          title="Assigned VM (B&B Side)"
          value={effectiveCp.vmOwner || 'Technical Team'}
          sub="Partnership Manager"
        />

        {/* CTA */}
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: 'linear-gradient(135deg,#1a3c8f,#2b5be0)', color: 'white',
            border: 'none', borderRadius: '12px', padding: '14px 20px', cursor: 'pointer',
            fontWeight: 700, fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.4,
            boxShadow: '0 4px 14px rgba(43,91,224,0.35)', whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontSize: '1.3rem', marginBottom: '2px' }}>+</div>
          Submit Lead
        </button>
      </div>

      {/* ══ 2. KPI CARDS (Focused Metrics) ═════════════════════════════════════ */}
      <div className="resp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '20px' }}>
        <KpiCard icon="🔧" label="Active Projects" value={String(effectiveCp.activeProjects || 0)} sub={`Lowest Progress: ${effectiveCp.lowestPercentageCompleted || 0}%`} accent="#1a3c8f" />
        <KpiCard icon="📋" label="Projects Assigned" value={String(effectiveCp.totalAssignedProjects || 0)} sub={`Completed: ${effectiveCp.completedProjects || 0}`} accent="#0d7a3c" />
        <KpiCard icon="💼" label="Portfolio Value" value={formatCurrencyCr(effectiveCp.totalProjectValueCr || 0)} sub="Total value of projects shared" accent="#1a3c8f" />
        <KpiCard icon="👥" label="Leads Shared" value={String(stats.totalLeads)} sub={`${stats.activeLeads} currently active`} progress={stats.totalLeads > 0 ? Math.round((stats.wonLeads / stats.totalLeads) * 100) : 0} progressLabel={`${stats.wonLeads > 0 ? Math.round((stats.wonLeads / stats.totalLeads) * 100) : 0}% conversion`} accent="#2b5be0" />
        <KpiCard icon="✅" label="Qualified Leads" value={String(stats.qualified)} sub={`${stats.baCollected} BA collections`} accent="#0d7a3c" />
        <KpiCard icon="📄" label="BA Collected" value={String(stats.baCollected)} sub="Leads converted to projects" accent="#0d7a3c" />
        <KpiCard icon="💰" label="Incentive Earned" value={`₹${stats.incentiveEarned.toFixed(2)} L`} accent="#1a3c8f">
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <div><div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600 }}>PAID</div><div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#16a34a' }}>₹{stats.incentivePaid.toFixed(2)} L</div></div>
            <div><div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600 }}>PENDING</div><div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#dc2626' }}>₹{stats.incentivePending.toFixed(2)} L</div></div>
          </div>
        </KpiCard>
        <KpiCard
          icon={effectiveCp.eligibleForProject ? "🏗️" : "⚠️"}
          label="Partnership Status"
          value={effectiveCp.eligibleForProject ? 'ELIGIBLE' : 'ON HOLD'}
          sub={`Tier: ${effectiveCp.tier} • Priority: ${effectiveCp.bmsPriority || 'Medium'}`}
          accent={effectiveCp.eligibleForProject ? "#0d7a3c" : "#dc2626"}
        />
      </div>

      {/* ══ 3. LEAD SUMMARY SECTION ══════════════════════════════════════════ */}
      <Card style={{ marginBottom: '20px' }}>
        {/* Tab Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', padding: '0 24px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
          <div style={{ display: 'flex' }}>
            {LEAD_TABS.map(tab => (
              <button
                key={tab.bucket}
                onClick={() => setActiveBucket(tab.bucket)}
                style={{
                  padding: '16px 18px', background: 'none', border: 'none',
                  borderBottom: activeBucket === tab.bucket ? '2px solid #1a3c8f' : '2px solid transparent',
                  color: activeBucket === tab.bucket ? '#1a3c8f' : '#64748b',
                  fontWeight: activeBucket === tab.bucket ? 700 : 500,
                  fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {tab.label} <span style={{ opacity: 0.7 }}>({myLeads.filter(l => l.bucket === tab.bucket).length})</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', padding: '0 4px' }}>
            <button className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '5px 12px' }}>⚙ Filter</button>
            <button className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '5px 12px' }}>⬇ Export</button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {activeBucket === 'Inactive Leads' || activeBucket === 'Rejected Leads'
                  ? ['Lead Name', 'City', 'Rejection / Reason', 'Final Stage', 'Last Updated'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))
                  : ['Lead Name', 'City', 'Project Value', 'Model', 'Stage', 'BA Status', 'Next Action', ''].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))
                }
              </tr>
            </thead>
            <tbody>
              {visibleLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                    No leads in this category.
                  </td>
                </tr>
              ) : visibleLeads.map(lead => (
                <Fragment key={lead.id}>
                  {activeBucket === 'Inactive Leads' || activeBucket === 'Rejected Leads' ? (
                    <tr style={trStyle} onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}>
                      <td style={tdStyle}><div style={{ fontWeight: 700 }}>{lead.name}</div><div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Sub. {formatDate(lead.submittedAt)}</div></td>
                      <td style={tdStyle}>{lead.city}</td>
                      <td style={tdStyle}><span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{lead.comment || 'No reason recorded'}</span></td>
                      <td style={tdStyle}><span style={{ background: '#fee2e2', color: '#dc2626', padding: '3px 8px', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 600 }}>{lead.currentStage}</span></td>
                      <td style={tdStyle}><span style={{ fontSize: '0.78rem', color: '#64748b' }}>{formatDate(lead.lastUpdatedAt)}</span></td>
                    </tr>
                  ) : (
                    <tr style={trStyle} onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{lead.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>Sub. {formatDate(lead.submittedAt)}</div>
                      </td>
                      <td style={tdStyle}>{lead.city}</td>
                      <td style={tdStyle}><span style={{ fontWeight: 600 }}>{formatCurrencyCr(lead.projectValueCr)}</span></td>
                      <td style={tdStyle}><span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 600 }}>{lead.selectedModel}</span></td>
                      <td style={tdStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />{lead.currentStage}</div></td>
                      <td style={tdStyle}><StatusBadge status={lead.baStatus === 'Collected' ? 'success' : 'pending'} label={lead.baStatus === 'Collected' ? 'COLLECTED' : 'PENDING'} /></td>
                      <td style={tdStyle}><div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{lead.nextAction}</div><div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{formatDate(lead.lastUpdatedAt)}</div></td>
                      <td style={tdStyle}><span style={{ fontSize: '0.72rem', color: '#1a3c8f', fontWeight: 600 }}>{expandedLead === lead.id ? '▲ Hide' : '▼ Track'}</span></td>
                    </tr>
                  )}

                  {/* Journey Tracker Expand */}
                  {expandedLead === lead.id && (
                    <tr>
                      <td colSpan={8} style={{ background: '#f8fafc', borderTop: '1px solid #e8ecf0', padding: 0 }}>
                        <div style={{ padding: '20px 28px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.6px', color: '#64748b', marginBottom: '16px' }}>LEAD JOURNEY</div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '4px' }}>
                            {JOURNEY_STAGES.map((stage, idx) => {
                              const currIdx = JOURNEY_STAGES.indexOf(lead.currentStage)
                              const done = idx <= currIdx
                              const isCurr = idx === currIdx
                              return (
                                <div key={stage} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 0 80px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                    {idx > 0 && <div style={{ flex: 1, height: 2, background: done ? '#1a3c8f' : '#e2e8f0' }} />}
                                    <div style={{
                                      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                                      background: isCurr ? '#1a3c8f' : done ? '#93c5fd' : '#e2e8f0',
                                      boxShadow: isCurr ? '0 0 0 3px rgba(26,60,143,0.2)' : 'none',
                                    }} />
                                    {idx < JOURNEY_STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: done && idx < currIdx ? '#1a3c8f' : '#e2e8f0' }} />}
                                  </div>
                                  <div style={{ fontSize: '0.58rem', textAlign: 'center', marginTop: '5px', color: done ? '#1a3c8f' : '#94a3b8', fontWeight: done ? 600 : 400, lineHeight: 1.3 }}>{stage}</div>
                                </div>
                              )
                            })}
                          </div>
                          <div className="resp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginTop: '18px' }}>
                            {[
                              { label: 'Submitted', value: formatDate(lead.submittedAt) },
                              { label: 'Model', value: lead.selectedModel },
                              { label: 'Lead Owner', value: lead.isOwner || '—' },
                              { label: 'Meeting Date', value: lead.meetingAt ? formatDate(lead.meetingAt) : 'Not Scheduled' },
                              { label: 'Proposal Value', value: lead.proposalValueCr ? formatCurrencyCr(lead.proposalValueCr) : 'TBD' },
                              { label: 'Final Value', value: lead.finalProjectValueCr ? formatCurrencyCr(lead.finalProjectValueCr) : 'TBD' },
                              { label: 'BA Status', value: lead.baStatus },
                              { label: 'CRN', value: lead.crnNumber || 'Pending' },
                            ].map(m => (
                              <div key={m.label} style={{ background: 'white', borderRadius: '8px', padding: '10px 14px', border: '1px solid #e8ecf0' }}>
                                <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.4px', marginBottom: '3px' }}>{m.label.toUpperCase()}</div>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{m.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {visibleLeads.length > 0 && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Showing {visibleLeads.length} leads</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '5px 14px' }}>← Previous</button>
              <button className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '5px 14px' }}>Next →</button>
            </div>
          </div>
        )}
      </Card>

      {/* ══ 4. PARTNERSHIP MODELS ════════════════════════════════════════════ */}
      <div style={{ marginBottom: '20px' }}>
        <SectionHeader title="Partnership Models" subtitle="Choose the right model before submitting your next lead" />
        <div className="resp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
          {PARTNERSHIP_MODELS.map(model => (
            <div
              key={model.name}
              style={{ background: model.bg, borderRadius: '14px', padding: '20px', border: `1px solid ${model.color}22`, cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>{model.icon}</div>
              <h4 style={{ color: model.color, fontWeight: 800, fontSize: '0.9rem', margin: '0 0 6px' }}>{model.name}</h4>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 12px', lineHeight: 1.5 }}>{model.tagline}</p>
              <ul style={{ margin: 0, padding: '0 0 0 14px', listStyle: 'disc' }}>
                {model.points.map(pt => (
                  <li key={pt} style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '4px', lineHeight: 1.5 }}>{pt}</li>
                ))}
              </ul>
              <button
                onClick={() => setShowForm(true)}
                style={{ marginTop: '14px', width: '100%', background: model.color, color: 'white', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Submit with this model →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ══ 5. ANALYTICS + PAYOUT ════════════════════════════════════════════ */}
      <div className="resp-grid-sidebar" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', marginBottom: '20px' }}>
        {/* Bar chart */}
        <Card>
          <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <span>📊</span><span style={{ fontWeight: 700 }}>Lead Journey Analytics</span>
          </div>
          <div style={{ padding: '0 24px', display: 'flex', alignItems: 'flex-end', gap: '20px', height: '100px' }}>
            {chartData.map(d => (
              <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '6px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1a3c8f' }}>{d.value}</div>
                <div style={{ width: '100%', borderRadius: '6px 6px 0 0', background: d.color, height: `${Math.max((d.value / chartMax) * 100, 6)}%`, transition: 'height 0.4s' }} />
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 24px 20px', display: 'flex', gap: '20px' }}>
            {chartData.map(d => (
              <div key={d.label} style={{ flex: 1, textAlign: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.4px' }}>{d.label}</div>
            ))}
          </div>
        </Card>

        {/* Payout card */}
        <div style={{ background: 'linear-gradient(135deg,#1a3c8f,#2b5be0)', borderRadius: '16px', padding: '24px', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 20px rgba(26,60,143,0.3)' }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '1px', opacity: 0.7, marginBottom: '8px' }}>NEXT PAYOUT</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1 }}>₹{(stats.incentivePending * 100000).toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: '4px', marginBottom: '20px' }}>Expected within 7 days of BA</div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ opacity: 0.7 }}>Total Since Onboarding</span>
              <span style={{ fontWeight: 700 }}>₹{(stats.incentiveEarned * 100000).toLocaleString('en-IN')}</span>
            </div>
          </div>
          <button
            onClick={() => { /* navigate earnings */ }}
            style={{ background: 'white', color: '#1a3c8f', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', width: '100%' }}
          >
            View Earning History
          </button>
        </div>
      </div>

      {/* ══ 6. NOTIFICATIONS ═════════════════════════════════════════════════ */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>🔔 Recent Notifications</h3>
          <span style={{ fontSize: '0.75rem', color: '#1a3c8f', fontWeight: 600, cursor: 'pointer' }}>View All</span>
        </div>
        <div style={{ padding: '8px 0' }}>
          {dataset.notifications.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No notifications yet.</div>
          ) : dataset.notifications.slice(0, 5).map(n => (
            <div key={n.id} style={{ padding: '12px 24px', display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid #f8fafc' }}>
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{n.severity === 'warn' ? '⚠️' : n.severity === 'critical' ? '🔴' : '✅'}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{n.title}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{n.detail}</div>
              </div>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: 'auto', marginTop: '2px' }}>{formatDate(n.createdAt)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ══ 7. BOTTOM QUICK ACCESS ══════════════════════════════════════════ */}
      <div className="resp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '20px' }}>
        {/* Upcoming Meetings */}
        <Card>
          <SectionInner title="📅 Upcoming Meetings">
            {myMeetings.filter(m => m.status === 'Meeting Scheduled').length === 0
              ? <EmptyMsg>No meetings scheduled.</EmptyMsg>
              : myMeetings.filter(m => m.status === 'Meeting Scheduled').slice(0, 3).map(m => {
                const lead = myLeads.find(l => l.id === m.leadId)
                return (
                  <div key={m.id} style={{ paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{lead?.name || m.leadId}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{m.date} at {m.time} · {m.mode}</div>
                  </div>
                )
              })
            }
          </SectionInner>
        </Card>

        {/* Pending BA Follow-ups */}
        <Card>
          <SectionInner title="⏳ Pending BA Follow-ups">
            {myLeads.filter(l => l.currentStage === 'BA Pending').length === 0
              ? <EmptyMsg>No pending BA follow-ups.</EmptyMsg>
              : myLeads.filter(l => l.currentStage === 'BA Pending').slice(0, 3).map(l => (
                <div key={l.id} style={{ paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{l.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#f59e0b' }}>BA Pending · {formatCurrencyCr(l.projectValueCr)}</div>
                </div>
              ))
            }
          </SectionInner>
        </Card>

        {/* Support & Help */}
        <Card>
          <SectionInner title="🆘 Support & Help">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button className="btn btn-ghost" style={{ textAlign: 'left', fontSize: '0.8rem', padding: '8px 12px' }}>📋 FAQs & Guides</button>
              <button className="btn btn-ghost" style={{ textAlign: 'left', fontSize: '0.8rem', padding: '8px 12px' }}>🐛 Raise an Issue</button>
              <button className="btn btn-ghost" style={{ textAlign: 'left', fontSize: '0.8rem', padding: '8px 12px' }}>💬 Chat with SPOC</button>
              <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '8px 12px', marginTop: '4px' }} onClick={() => setShowForm(true)}>
                + Submit New Lead
              </button>
            </div>
          </SectionInner>
        </Card>
      </div>

      {/* Matching Opportunities */}
      {
        dataset.barterProjectMatches.filter(b => b.cpId === effectiveCp.id).length > 0 && (
          <Card style={{ marginBottom: '20px' }}>
            <SectionInner title="🔄 New Matching Opportunities (Barter)">
              <div className="resp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginTop: '4px' }}>
                {dataset.barterProjectMatches.filter(b => b.cpId === effectiveCp.id).map(m => (
                  <div key={m.id} style={{ background: '#fffbeb', borderRadius: '10px', padding: '14px 16px', border: '1px solid #fcd34d22' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{m.leadName}</div>
                    <div style={{ fontSize: '0.72rem', color: '#92400e', marginTop: '4px' }}>{m.matchStatus} · Est. {m.expectedTimelineDays} days</div>
                  </div>
                ))}
              </div>
            </SectionInner>
          </Card>
        )
      }

      {/* ── Lead Submission Modal ── */}
      <LeadModal show={showForm} onClose={() => setShowForm(false)} onSubmit={handleSubmit} isSubmitting={isSubmitting} success={formSuccess} />
    </div >
  )
}

// ─── Shared Sub-Components ─────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, accent = '#1a3c8f', badge, badgeColor, badgeText, progress, progressLabel, children }: {
  icon: string; label: string; value: string; sub?: string; accent?: string
  badge?: string; badgeColor?: string; badgeText?: string
  progress?: number; progressLabel?: string; children?: React.ReactNode
}) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', padding: '18px 20px', border: '1px solid #e8ecf0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ width: 36, height: 36, borderRadius: '8px', background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{icon}</div>
        {badge && <span style={{ background: badgeColor, color: badgeText, fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', alignSelf: 'flex-start' }}>{badge}</span>}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1.1, color: '#0f172a' }}>{value}</div>
      <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginTop: '4px' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>}
      {progress !== undefined && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ height: '3px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: accent, borderRadius: '3px' }} />
          </div>
          {progressLabel && <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>{progressLabel}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e8ecf0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', ...style }}>
      {children}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>{title}</h3>
      {subtitle && <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>{subtitle}</p>}
    </div>
  )
}

function SectionInner({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '12px' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
    </div>
  )
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '4px 0' }}>{children}</div>
}

function InfoBox({ title, value, sub, subAccent }: { title: string; value: string; sub?: string; subAccent?: boolean }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 18px', minWidth: '150px', borderLeft: '3px solid #e8ecf0' }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.6px', marginBottom: '4px', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ fontWeight: 700, fontSize: '0.87rem' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: subAccent ? '#1a3c8f' : '#64748b', marginTop: '2px', cursor: subAccent ? 'pointer' : 'default' }}>{sub}</div>}
    </div>
  )
}

function StatusBadge({ status, label }: { status: 'success' | 'pending' | 'danger'; label: string }) {
  const colors = { success: { bg: '#dcfce7', text: '#15803d' }, pending: { bg: '#fef9c3', text: '#854d0e' }, danger: { bg: '#fee2e2', text: '#dc2626' } }
  const c = colors[status]
  return <span style={{ background: c.bg, color: c.text, padding: '3px 9px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
}

function LeadModal({ show, onClose, onSubmit, isSubmitting, success }: {
  show: boolean; onClose: () => void; onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  isSubmitting: boolean; success: boolean
}) {
  if (!show) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'grid', placeItems: 'center' }}>
      <div style={{ background: 'white', padding: '36px', borderRadius: '22px', width: '100%', maxWidth: '540px', animation: 'fadeIn 0.2s ease-out', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎉</div>
            <h3>Lead Submitted!</h3>
            <p style={{ color: '#64748b' }}>Your lead has been assigned for qualification.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h2 style={{ margin: 0 }}>Submit New Lead</h2>
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>✕</button>
            </div>
            <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '0.875rem' }}>Fill in the details below. Our IS Team will call the customer within 24 hours.</p>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '14px' }} onSubmit={onSubmit}>
              <div className="form-group"><label>Lead Name *</label><input name="name" type="text" placeholder="Customer full name" required className="input-field" /></div>
              <div className="form-group"><label>Lead Number *</label><input name="phone" type="text" placeholder="+91 XXXXX XXXXX" required className="input-field" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group"><label>Lead City *</label><input name="city" type="text" required className="input-field" /></div>
                <div className="form-group"><label>Project Type</label>
                  <select name="projectType" className="input-field">
                    <option>Full Interior</option>
                    <option>Renovation</option>
                    <option>Civil Work</option>
                    <option>Turnkey</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label>Approx Project Value (Cr) *</label><input name="projectValueCr" type="number" step="0.01" min="0.1" required className="input-field" placeholder="e.g. 1.5" /></div>
              <div className="form-group">
                <label>Preferred Partnership Model</label>
                <select name="selectedModel" className="input-field">
                  <option>Direct Incentive</option>
                  <option>Shared Construction</option>
                  <option>Barter / Exchange</option>
                  <option>Financial Assistance Model</option>
                </select>
                <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#64748b', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                  💡 <b>Direct Incentive:</b> 2–3% of project value as payout after BA collection
                </div>
              </div>
              <div className="form-group">
                <label>Reason for Not Proceeding With This Lead *</label>
                <select name="reasonForNotProceeding" className="input-field" required>
                  <option value="">-- Select Reason --</option>
                  {NOT_PROCEEDING_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Additional Notes</label><textarea name="notes" placeholder="Any context on the customer, project urgency, special requirements…" className="input-field" style={{ minHeight: '80px', resize: 'vertical' }} /></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }} disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={isSubmitting}>
                  {isSubmitting ? '⏳ Submitting…' : '✓ Submit Lead'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Table style helpers ───────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: '11px 18px', textAlign: 'left', fontSize: '0.67rem',
  fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = { padding: '14px 18px', fontSize: '0.82rem', color: '#0f172a', verticalAlign: 'middle' }
const trStyle: React.CSSProperties = { borderTop: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.1s' }
