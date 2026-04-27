import { useState, useMemo } from 'react'
import { useAppData } from '../../data/app-data'
import { formatCurrencyCr } from '../../lib/format'
import type { NewCpInput, PartnershipModel, VmLeadInput } from '../../types/domain'
import { NOT_PROCEEDING_REASONS } from '../../types/domain'
import type { SessionUser } from '../../lib/supabase'
import { AGREEMENT_TEMPLATE, generateAgreement } from '../../lib/legal-templates'

const vmTabs = ['CP Master', 'CP Onboarding', 'Lead Creation'] as const
type VmTab = typeof vmTabs[number]

const CALL_STATUSES = ['Connect', 'Call Back Later', 'Request Call Back', 'DNP']
const MEETING_STATUSES = ['Meeting Done', 'Meeting Scheduled', 'Not Interested']
const VM_NAMES = ['Praveen', 'Srinivaas', 'Arjun', 'Sumanth', 'Vaibhhav', 'Varun', 'Ghansham']
const ALIGNED_OPTIONS = ['Yes', 'No']
const MEETING_MODES = ['Online', 'Offline']
const READY_OPTIONS = ['Yes', 'No']

export function VmDashboard({ sessionUser, subPath }: { sessionUser: SessionUser; subPath?: string }) {
    const { dataset, createCp, updateCp, createVmLead, bulkCreateCp, updateCpOnboarding } = useAppData()
    const [showBulkUpload, setShowBulkUpload] = useState(false)
    const [showTemplate, setShowTemplate] = useState(false)

    const activeTab: VmTab = useMemo(() => {
        if (subPath === 'onboarding') return 'CP Onboarding'
        if (subPath === 'lead-creation') return 'Lead Creation'
        return 'CP Master'
    }, [subPath])

    const cps = dataset.cps
    const agreements = dataset.agreements
    const leads = dataset.leads

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showNewCp, setShowNewCp] = useState(false)
    const [selectedCp, setSelectedCp] = useState<typeof cps[0] | null>(null)
    const [editingCp, setEditingCp] = useState<typeof cps[0] | null>(null)
    const [showCpLeadForm, setShowCpLeadForm] = useState(false)
    const [cpSearch, setCpSearch] = useState('')
    // ── Optimistic overlay for inline onboarding cell edits ─────────────────────────────────
    // Keyed by cp.id → partial field overrides that show immediately while the DB saves.
    // Cleared per-CP once updateCpOnboarding resolves and fresh cps arrive from context.
    const [localOnboardingOverrides, setLocalOnboardingOverrides] = useState<Record<string, any>>({})
    const [onboardingSearch, setOnboardingSearch] = useState('')
    const [onboardingCityFilter, setOnboardingCityFilter] = useState('')
    const [onboardingVmFilter, setOnboardingVmFilter] = useState('')
    const [leadSearch, setLeadSearch] = useState('')

    // ── filteredOnboardingRows: always derived from live cps context (never stale) ──────────
    // Merges any pending local overrides on top so in-flight edits are reflected immediately.
    const filteredOnboardingRows = useMemo(() => {
        return cps
            .map(cp => ({ ...cp, ...(localOnboardingOverrides[cp.id] ?? {}) }))
            .filter(cp => {
                const matchesSearch = !onboardingSearch ||
                    (cp.name || '').toLowerCase().includes(onboardingSearch.toLowerCase()) ||
                    (cp.onboardingVmName || '').toLowerCase().includes(onboardingSearch.toLowerCase())
                const matchesCity = !onboardingCityFilter || cp.city === onboardingCityFilter
                const matchesVm = !onboardingVmFilter || cp.onboardingVmName === onboardingVmFilter
                return matchesSearch && matchesCity && matchesVm
            })
    }, [cps, localOnboardingOverrides, onboardingSearch, onboardingCityFilter, onboardingVmFilter])

    const uniqueCities = useMemo(() => {
        const cities = new Set(cps.map(c => c.city).filter(Boolean))
        return Array.from(cities).sort()
    }, [cps])

    const handleCpOnboardingUpdate = async (cpId: string, field: string, value: any) => {
        // Apply optimistic overlay immediately so the cell feels instant
        setLocalOnboardingOverrides(prev => ({
            ...prev,
            [cpId]: { ...(prev[cpId] ?? {}), [field]: value },
        }))
        // Persist to DB; AppDataProvider refreshes dataset.cps on success
        await updateCpOnboarding({ cpId, field, value }, sessionUser)
        // Clear overlay — fresh cps from context now carries the saved value
        setLocalOnboardingOverrides(prev => {
            const next = { ...prev }
            delete next[cpId]
            return next
        })
    }

    // ── Filtered leads for the Lead Creation tab ────────────────────────────────────────────
    const filteredLeads = useMemo(() => {
        if (!leadSearch) return leads
        const s = leadSearch.toLowerCase()
        return leads.filter(l =>
            l.name.toLowerCase().includes(s) ||
            l.cpName.toLowerCase().includes(s) ||
            l.city.toLowerCase().includes(s)
        )
    }, [leads, leadSearch])

    // ── KPIs: totals across ALL CPs visible to this VM role ────────────────────────────────
    const kpis = useMemo(() => ({
        total: cps.length,
        pendingAgreements: agreements.filter(a => a.status === 'Pending').length,
        activeCps: cps.filter(c => c.eligibleForProject).length,
        totalLeadsCreated: leads.length,
        pendingActivation: agreements.filter(a => a.status === 'Pending').length,
        avgCsat: cps.length > 0
            ? (cps.reduce((s, c) => s + c.averageCsat, 0) / cps.length).toFixed(1)
            : '0',
    }), [cps, agreements, leads])

    const filteredCps = useMemo(() =>
        cps.filter(c =>
        (!cpSearch ||
            c.name.toLowerCase().includes(cpSearch.toLowerCase()) ||
            c.city.toLowerCase().includes(cpSearch.toLowerCase()) ||
            c.code.toLowerCase().includes(cpSearch.toLowerCase()))
        ),
        [cps, cpSearch]
    )

    const handleCreateCp = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        const fd = new FormData(e.currentTarget)
        const input: NewCpInput = {
            contractorId: fd.get('contractorId') as string,
            cpName: fd.get('cpName') as string,
            companyName: fd.get('companyName') as string,
            email: fd.get('email') as string,
            phone: fd.get('phone') as string,
            city: fd.get('city') as string,
            pincode: fd.get('pincode') as string,
            userType: fd.get('userType') as string,
            totalCrn: parseInt(fd.get('totalCrn') as string) || 0,
            runningCrn: parseInt(fd.get('runningCrn') as string) || 0,
            totalProjectValue: parseFloat(fd.get('totalProjectValue') as string) || 0,
            lowestPercentageCompleted: parseFloat(fd.get('lowestPercentageCompleted') as string) || 0,
            primaryScope: fd.get('primaryScope') as string,
            tier: fd.get('tier') as string,
            bmsPriority: fd.get('bmsPriority') as string,
            remarks: fd.get('remarks') as string,
        }
        try {
            await createCp(input, sessionUser)
            e.currentTarget.reset()
            setShowNewCp(false)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCreateLead = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        const fd = new FormData(e.currentTarget)
        const cpId = fd.get('cpId') as string || selectedCp?.id || ''
        const input: VmLeadInput = {
            cpId,
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
            await createVmLead(input, sessionUser)
            e.currentTarget.reset()
            setShowCpLeadForm(false)
            setSelectedCp(null)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="dashboard-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <style>{`
                .onboarding-row:hover { background: #f1f5f9; }
                .onboarding-row td { transition: background 0.2s; }
                .google-sheet-input:focus { background: white !important; box-shadow: inset 0 0 0 2px #1a3c8f; z-index: 5; }
            `}</style>

            <header style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1a3c8f', letterSpacing: '1px', marginBottom: '4px' }}>VM PORTFOLIO MANAGEMENT</p>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>{activeTab}</h1>
            </header>

            <div className="resp-grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                    { label: 'Total CPs', value: kpis.total, color: '#1a3c8f' },
                    { label: 'Active CPs', value: kpis.activeCps, color: '#15803d' },
                    { label: 'Pending Agreements', value: kpis.pendingAgreements, color: '#dc2626' },
                    { label: 'Pending Activation', value: kpis.pendingActivation, color: '#d97706' },
                    { label: 'Total Leads Created', value: kpis.totalLeadsCreated, color: '#7c3aed' },
                    { label: 'Avg CSAT', value: `${kpis.avgCsat}/5`, color: '#0891b2' },
                ].map(k => (
                    <div key={k.label} style={{ background: 'white', borderRadius: '12px', padding: '14px 16px', border: '1px solid #e8ecf0' }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: '6px' }}>{k.label.toUpperCase()}</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1, color: k.color }}>{k.value}</div>
                    </div>
                ))}
            </div>

            {activeTab === 'CP Master' && (
                <>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                            type="text" placeholder="🔍 Search CP by name, city or ID…"
                            value={cpSearch} onChange={e => setCpSearch(e.target.value)}
                            style={{ flex: '1 1 300px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.85rem', outline: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: '12px', flex: '1 1 auto' }}>
                            <button onClick={() => setShowNewCp(true)} style={{ flex: 1, background: '#1a3c8f', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ New CP</button>
                            <button onClick={() => setShowBulkUpload(true)} style={{ flex: 1, background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '10px 16px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.82rem', color: '#475569' }}>⬆ Bulk Upload CPs</button>
                        </div>
                    </div>

                    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e8ecf0', overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        {['contractor_id', 'assigned_contractor_name', 'phone', 'email', 'user_type', 'cities', 'total_crn', 'running_crn', 'total_project_value', 'lowest_percentage_completed', 'Tier', 'BMS colms', 'Actions'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.63rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{h.toUpperCase()}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCps.map(cp => (
                                        <tr key={cp.id} style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => setSelectedCp(cp)}>
                                            <td style={{ padding: '11px 14px', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, fontFamily: 'monospace' }}>{cp.code}</td>
                                            <td style={{ padding: '11px 14px' }}><div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{cp.name}</div></td>
                                            <td style={{ padding: '11px 14px', fontSize: '0.8rem' }}>{cp.phone}</td>
                                            <td style={{ padding: '11px 14px', fontSize: '0.8rem', color: '#64748b' }}>{cp.email || '—'}</td>
                                            <td style={{ padding: '11px 14px', fontSize: '0.75rem', fontWeight: 600 }}>{cp.userType || 'CONTRACTOR'}</td>
                                            <td style={{ padding: '11px 14px', fontSize: '0.8rem' }}>{cp.city}</td>
                                            <td style={{ padding: '11px 14px', fontWeight: 600, textAlign: 'center' }}>{cp.totalAssignedProjects}</td>
                                            <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1a3c8f', textAlign: 'center' }}>{cp.activeProjects}</td>
                                            <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1a3c8f', fontSize: '0.82rem' }}>{formatCurrencyCr(cp.totalProjectValueCr)}</td>
                                            <td style={{ padding: '11px 14px', textAlign: 'center' }}>{cp.lowestPercentageCompleted || 0}%</td>
                                            <td style={{ padding: '11px 14px' }}><span style={{ background: '#eff6ff', color: '#1a3c8f', padding: '2px 8px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 700 }}>{cp.tier}</span></td>
                                            <td style={{ padding: '11px 14px' }}><span style={{ background: cp.bmsPriority === 'High' ? '#fee2e2' : cp.bmsPriority === 'Medium' ? '#fef9c3' : '#f1f5f9', color: cp.bmsPriority === 'High' ? '#dc2626' : cp.bmsPriority === 'Medium' ? '#d97706' : '#64748b', padding: '2px 8px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 600 }}>{cp.bmsPriority}</span></td>
                                            <td style={{ padding: '11px 14px' }}>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button onClick={e => { e.stopPropagation(); setSelectedCp(cp); setShowCpLeadForm(true) }}
                                                        style={{ background: '#eff6ff', color: '#1a3c8f', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                                                        + Lead
                                                    </button>
                                                    <button onClick={e => { e.stopPropagation(); setEditingCp(cp) }}
                                                        style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                                                        Edit
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'CP Onboarding' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 250px)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>VM Onboarding Tracker</h2>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="🔍 Search CP or VM..."
                                    value={onboardingSearch}
                                    onChange={e => setOnboardingSearch(e.target.value)}
                                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem', width: '200px' }}
                                />
                                <select
                                    value={onboardingCityFilter}
                                    onChange={e => setOnboardingCityFilter(e.target.value)}
                                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem' }}
                                >
                                    <option value="">All Cities</option>
                                    {uniqueCities.map(city => <option key={city} value={city}>{city}</option>)}
                                </select>
                                <select
                                    value={onboardingVmFilter}
                                    onChange={e => setOnboardingVmFilter(e.target.value)}
                                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem' }}
                                >
                                    <option value="">All VMs</option>
                                    {VM_NAMES.map(vm => <option key={vm} value={vm}>{vm}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setShowTemplate(true)} style={{ background: 'white', color: '#1a3c8f', border: '1px solid #1a3c8f', borderRadius: '8px', padding: '8px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>📄 View Template</button>
                            <button onClick={() => setShowNewCp(true)} style={{ background: '#1a3c8f', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>+ New CP</button>
                        </div>
                    </div>

                    <div style={{
                        background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
                        overflow: 'auto', position: 'relative', flex: 1, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}>
                        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.8rem' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                                <tr>
                                    {[
                                        'CP Name', 'City', 'Phone', 'Email', 'Total Projects', 'Tier', 'BMS Priority',
                                        'VM Name', 'Call Status', 'Meeting Status', 'Meeting Date', 'Aligned', 'Mode of Meeting',
                                        'CP Ready?', 'Send Agreement', 'Sent Status', 'Signed Status', 'Final Agreement'
                                    ].map((h, i) => (
                                        <th key={h} style={{
                                            padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#475569',
                                            borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
                                            whiteSpace: 'nowrap', background: '#f8fafc',
                                            position: i < 1 ? 'sticky' : 'static', left: i < 1 ? 0 : 'auto', zIndex: i < 1 ? 20 : 1
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOnboardingRows.map((cp) => (
                                    <tr key={cp.id} className="onboarding-row">
                                        <td style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', background: 'white', fontWeight: 700, position: 'sticky', left: 0, zIndex: 5 }}>{cp.name}</td>
                                        <td style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{cp.city}</td>
                                        <td style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{cp.phone}</td>
                                        <td style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', color: cp.email ? 'inherit' : '#94a3b8' }}>{cp.email || 'Email missing'}</td>
                                        <td style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>{cp.totalAssignedProjects || 0}</td>
                                        <td style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}><span style={{ background: '#eff6ff', color: '#1a3c8f', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>{cp.tier}</span></td>
                                        <td style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}><span style={{ background: cp.bmsPriority === 'High' ? '#fee2e2' : cp.bmsPriority === 'Medium' ? '#fef9c3' : '#f1f5f9', color: cp.bmsPriority === 'High' ? '#dc2626' : cp.bmsPriority === 'Medium' ? '#d97706' : '#64748b', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>{cp.bmsPriority}</span></td>

                                        <td style={{ padding: 0, borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                            <select value={cp.onboardingVmName || ''} onChange={(e) => handleCpOnboardingUpdate(cp.id, 'onboardingVmName', e.target.value)} className="google-sheet-input" style={{ width: '100%', height: '38px', padding: '0 12px', border: 'none', background: 'transparent', outline: 'none' }}>
                                                <option value="">Select VM</option>
                                                {VM_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: 0, borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                            <select value={cp.onboardingCallStatus || ''} onChange={(e) => handleCpOnboardingUpdate(cp.id, 'onboardingCallStatus', e.target.value)} className="google-sheet-input" style={{ width: '100%', height: '38px', padding: '0 12px', border: 'none', background: 'transparent', outline: 'none' }}>
                                                <option value="">Select Status</option>
                                                {CALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: 0, borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                            <select value={cp.onboardingMeetingStatus || ''} onChange={(e) => handleCpOnboardingUpdate(cp.id, 'onboardingMeetingStatus', e.target.value)} className="google-sheet-input" style={{ width: '100%', height: '38px', padding: '0 12px', border: 'none', background: 'transparent', outline: 'none' }}>
                                                <option value="">Select Status</option>
                                                {MEETING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: 0, borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                            <input type="date" value={cp.onboardingMeetingScheduledDate || ''} min={new Date().toISOString().split('T')[0]} onChange={(e) => handleCpOnboardingUpdate(cp.id, 'onboardingMeetingScheduledDate', e.target.value)} className="google-sheet-input" style={{ width: '100%', height: '38px', padding: '0 12px', border: 'none', background: 'transparent', outline: 'none' }} />
                                        </td>
                                        <td style={{ padding: 0, borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                            <select value={cp.onboardingAlignedForActivation || ''} onChange={(e) => handleCpOnboardingUpdate(cp.id, 'onboardingAlignedForActivation', e.target.value)} className="google-sheet-input" style={{ width: '100%', height: '38px', padding: '0 12px', border: 'none', background: 'transparent', outline: 'none' }}>
                                                <option value="">Select</option>
                                                {ALIGNED_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: 0, borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                            <select value={cp.onboardingModeOfMeeting || ''} onChange={(e) => handleCpOnboardingUpdate(cp.id, 'onboardingModeOfMeeting', e.target.value)} className="google-sheet-input" style={{ width: '100%', height: '38px', padding: '0 12px', border: 'none', background: 'transparent', outline: 'none' }}>
                                                <option value="">Select</option>
                                                {MEETING_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: 0, borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                            <select value={cp.onboardingCpReadyForSigning || ''} onChange={(e) => handleCpOnboardingUpdate(cp.id, 'onboardingCpReadyForSigning', e.target.value)} className="google-sheet-input" style={{ width: '100%', height: '38px', padding: '0 12px', border: 'none', background: 'transparent', outline: 'none' }}>
                                                <option value="">Select</option>
                                                {READY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleCpOnboardingUpdate(cp.id, 'onboardingAgreementSentStatus', 'Sent')}
                                                title={!cp.email ? 'Email ID missing' : 'Send agreement to CP'}
                                                disabled={!cp.email || cp.onboardingAgreementSentStatus === 'Sent'}
                                                style={{
                                                    background: (!cp.email || cp.onboardingAgreementSentStatus === 'Sent') ? '#f1f5f9' : '#1a3c8f',
                                                    color: (!cp.email || cp.onboardingAgreementSentStatus === 'Sent') ? '#94a3b8' : 'white',
                                                    border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: !cp.email ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                {cp.onboardingAgreementSentStatus === 'Sent' ? 'SENT ✓' : (cp.onboardingCpSignedStatus === 'Done' || cp.onboardingAgreementSentStatus === 'Done') ? 'SIGNED ✓' : 'SEND AGMT'}
                                            </button>
                                        </td>
                                        <td style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: cp.onboardingAgreementSentStatus === 'Sent' ? '#fef9c3' : '#f1f5f9', color: cp.onboardingAgreementSentStatus === 'Sent' ? '#d97706' : '#64748b' }}>{cp.onboardingAgreementSentStatus || 'Pending'}</span>
                                        </td>
                                        <td style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: cp.onboardingCpSignedStatus === 'Done' ? '#dcfce7' : '#f1f5f9', color: cp.onboardingCpSignedStatus === 'Done' ? '#166534' : '#64748b' }}>{cp.onboardingCpSignedStatus || 'Pending'}</span>
                                        </td>
                                        <td style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            {cp.onboardingCpSignedStatus === 'Done' ? (
                                                <button
                                                    onClick={() => {
                                                        const cpName = cp.name || 'Partner'
                                                        // Use actual signed date from agreement_master if available
                                                        const cpAgreement = agreements.find(a => a.contractorId === cp.id)
                                                        const rawDate = cpAgreement?.signedDate
                                                        const signedDate = rawDate
                                                            ? new Date(rawDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
                                                            : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
                                                        // Use generateAgreement so {{cp_name}} is replaced
                                                        const content = generateAgreement(cpName)
                                                        const pw = window.open('', '_blank', 'width=900,height=700')
                                                        if (!pw) return
                                                        pw.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Signed Agreement - ${cpName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Georgia',serif;color:#1a1a1a;background:white;padding:60px;max-width:800px;margin:0 auto;line-height:1.8;font-size:13px}
  .hdr{text-align:center;border-bottom:3px solid #1a3c8f;padding-bottom:24px;margin-bottom:32px}
  .hdr h1{font-size:22px;color:#1a3c8f;letter-spacing:1px;margin-bottom:6px}
  .hdr p{color:#555;font-size:12px}
  .badge{display:inline-block;background:#22c55e;color:white;padding:4px 16px;border-radius:999px;font-size:11px;font-weight:bold;margin-top:8px;font-family:Arial,sans-serif}
  .body-text{white-space:pre-wrap;font-size:12.5px;line-height:1.85;color:#222;margin-bottom:40px}
  .sig-block{border-top:2px solid #1a3c8f;padding-top:32px;margin-top:40px}
  .sig-block h3{font-size:14px;color:#1a3c8f;margin-bottom:20px}
  .sig-row{display:flex;gap:24px;margin-top:8px}
  .sig-field{flex:1;border-bottom:1px solid #333;padding-bottom:4px}
  .sig-label{font-size:10px;color:#666;text-transform:uppercase;margin-top:6px;font-family:Arial,sans-serif}
  .sig-value{font-size:18px;font-style:italic;color:#1a3c8f;font-family:'Georgia',cursive}
  .sig-email{font-size:13px;font-style:normal;color:#1a3c8f;font-family:Arial,sans-serif}
  .cert{background:#f0fdf4;border:1.5px solid #22c55e;border-radius:8px;padding:12px 20px;margin-top:24px;color:#166534;font-size:11px;font-family:Arial,sans-serif}
  .footer{text-align:center;margin-top:48px;font-size:10px;color:#aaa;font-family:Arial,sans-serif;border-top:1px solid #eee;padding-top:16px}
  @media print{body{padding:40px}}
</style></head><body>
  <div class="hdr"><h1>DOMESTIC CHANNEL PARTNER AGREEMENT</h1><p>Brick &amp; Bolt Construction Technologies Pvt. Ltd.</p><span class="badge">✓ DIGITALLY SIGNED</span></div>
  <div class="body-text">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  <div class="sig-block">
    <h3>DIGITAL SIGNATURE CERTIFICATE</h3>
    <div class="sig-row">
      <div class="sig-field"><div class="sig-value">${cpName}</div><div class="sig-label">Signed By (Channel Partner)</div></div>
      <div class="sig-field"><div class="sig-email">${cp.email || ''}</div><div class="sig-label">Email Address</div></div>
      <div class="sig-field"><div class="sig-value">${signedDate}</div><div class="sig-label">Date of Signing</div></div>
    </div>
    <div class="cert">✅ Digitally signed by <strong>${cpName}</strong> (<strong>${cp.email || ''}</strong>) on <strong>${signedDate}</strong> via the Brick &amp; Bolt Partner Portal.</div>
  </div>
  <div class="footer">Brick &amp; Bolt Construction Technologies Pvt. Ltd. · Generated ${new Date().toLocaleDateString('en-IN')}</div>
  <script>window.onload=()=>{window.print()}<\/script>
</body></html>`)
                                                        pw.document.close()
                                                    }}
                                                    style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '5px 12px', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                >
                                                    📄 Download
                                                </button>
                                            ) : '—'}
                                        </td>

                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── LEAD CREATION TAB ──────────────────────────────────────────────────────────── */}
            {activeTab === 'Lead Creation' && (
                <>
                    {/* CP selector card */}
                    <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e8ecf0', padding: '20px', marginBottom: '16px', display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 260px' }}>
                            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', marginBottom: '6px' }}>SELECT CONTRACTOR PARTNER</label>
                            <select
                                value={selectedCp?.id || ''}
                                onChange={e => setSelectedCp(cps.find(c => c.id === e.target.value) || null)}
                                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', background: 'white' }}
                            >
                                <option value="">— Choose a CP —</option>
                                {cps.map(cp => (
                                    <option key={cp.id} value={cp.id}>{cp.name}  ({cp.city})</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => selectedCp && setShowCpLeadForm(true)}
                            disabled={!selectedCp}
                            style={{
                                background: selectedCp ? '#1a3c8f' : '#f1f5f9',
                                color: selectedCp ? 'white' : '#94a3b8',
                                border: 'none', borderRadius: '10px', padding: '10px 24px',
                                fontWeight: 700, cursor: selectedCp ? 'pointer' : 'not-allowed',
                                fontSize: '0.85rem', whiteSpace: 'nowrap', height: '42px',
                            }}
                        >
                            ➕ Create Lead
                        </button>
                    </div>

                    {/* Leads table for this VM's portfolio */}
                    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e8ecf0', overflow: 'hidden' }}>
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>
                                All Leads <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.85rem' }}>({leads.length} total)</span>
                            </h3>
                            <input
                                type="text"
                                placeholder="🔍 Search lead, CP or city..."
                                value={leadSearch}
                                onChange={e => setLeadSearch(e.target.value)}
                                style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem', width: '240px', outline: 'none' }}
                            />
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        {['CP Name', 'Lead Name', 'Phone', 'City', 'Project Type', 'Value (Cr)', 'Model', 'Stage', 'Date'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.63rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{h.toUpperCase()}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLeads.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '0.9rem' }}>
                                                {leads.length === 0
                                                    ? 'No leads yet — select a CP above and create your first lead.'
                                                    : 'No leads match your search.'}
                                            </td>
                                        </tr>
                                    ) : filteredLeads.map(lead => (
                                        <tr key={lead.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '10px 14px', fontSize: '0.82rem', fontWeight: 600 }}>{lead.cpName}</td>
                                            <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: '0.85rem' }}>{lead.name}</td>
                                            <td style={{ padding: '10px 14px', fontSize: '0.8rem' }}>{lead.phone}</td>
                                            <td style={{ padding: '10px 14px', fontSize: '0.8rem' }}>{lead.city}</td>
                                            <td style={{ padding: '10px 14px', fontSize: '0.75rem', color: '#475569' }}>{lead.projectType || '—'}</td>
                                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1a3c8f', fontSize: '0.82rem' }}>
                                                {lead.projectValueCr ? `${lead.projectValueCr} Cr` : '—'}
                                            </td>
                                            <td style={{ padding: '10px 14px', fontSize: '0.73rem', color: '#475569' }}>{lead.selectedModel || '—'}</td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <span style={{
                                                    background: lead.currentStage === 'Qualified' ? '#dcfce7'
                                                        : lead.currentStage === 'Rejected' ? '#fee2e2'
                                                            : lead.currentStage === 'Lead Shared' ? '#eff6ff' : '#f8fafc',
                                                    color: lead.currentStage === 'Qualified' ? '#166534'
                                                        : lead.currentStage === 'Rejected' ? '#dc2626'
                                                            : lead.currentStage === 'Lead Shared' ? '#1a3c8f' : '#475569',
                                                    padding: '2px 8px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap'
                                                }}>{lead.currentStage}</span>
                                            </td>
                                            <td style={{ padding: '10px 14px', fontSize: '0.73rem', color: '#64748b' }}>
                                                {lead.submittedAt
                                                    ? new Date(lead.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {showNewCp && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '600px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Register New Contractor Partner</h2>
                            <button onClick={() => setShowNewCp(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
                        </div>
                        <form onSubmit={handleCreateCp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Contractor Name *</label>
                                <input name="cpName" required className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Email ID *</label>
                                <input name="email" type="email" required className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Phone Number *</label>
                                <input name="phone" required className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>City *</label>
                                <input name="city" required className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>User Type</label>
                                <select name="userType" className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                    <option value="CONTRACTOR">CONTRACTOR</option>
                                    <option value="REFERRAL_PARTNER">REFERRAL PARTNER</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Tier</label>
                                <select name="tier" className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                    <option>Blue</option>
                                    <option>Silver</option>
                                    <option>Gold</option>
                                    <option>Platinum</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>BMS Priority</label>
                                <select name="bmsPriority" className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                    <option>Low</option>
                                    <option>Medium</option>
                                    <option>High</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Total CRN</label>
                                <input name="totalCrn" type="number" defaultValue="0" className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Running CRN</label>
                                <input name="runningCrn" type="number" defaultValue="0" className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Total Project Value (Cr)</label>
                                <input name="totalProjectValue" type="number" step="0.01" defaultValue="0" className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Lowest % Completed</label>
                                <input name="lowestPercentageCompleted" type="number" step="0.1" defaultValue="0" className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Remarks</label>
                                <textarea name="remarks" className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', minHeight: '60px' }} />
                            </div>
                            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setShowNewCp(false)} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={isSubmitting} style={{ flex: 2, background: '#1a3c8f', color: 'white', border: 'none', borderRadius: '10px', padding: '12px', fontWeight: 700, cursor: 'pointer' }}>{isSubmitting ? 'Registering...' : 'Complete Registration ✓'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedCp && showCpLeadForm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'grid', placeItems: 'center' }}>
                    <div style={{ background: 'white', borderRadius: '22px', padding: '32px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem' }}>Create Lead for {selectedCp.name}</h2>
                            <button onClick={() => { setSelectedCp(null); setShowCpLeadForm(false) }} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
                        </div>
                        <form style={{ display: 'flex', flexDirection: 'column', gap: '13px' }} onSubmit={handleCreateLead}>
                            <input type="hidden" name="cpId" value={selectedCp.id} />
                            <div className="form-group"><label>Lead Name *</label><input name="name" type="text" required className="input-field" /></div>
                            <div className="form-group"><label>Lead Number *</label><input name="phone" type="text" required className="input-field" /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group"><label>Lead City *</label><input name="city" type="text" required className="input-field" /></div>
                                <div className="form-group"><label>Project Type</label>
                                    <select name="projectType" className="input-field"><option>Full Interior</option><option>Renovation</option><option>Civil Work</option></select>
                                </div>
                            </div>
                            <div className="form-group"><label>Approx Value (Cr) *</label><input name="projectValueCr" type="number" step="0.01" required className="input-field" /></div>
                            <div className="form-group">
                                <label>Partnership Model</label>
                                <select name="selectedModel" className="input-field"><option>Direct Incentive</option><option>Shared Construction</option><option>Barter / Exchange</option><option>Financial Assistance Model</option></select>
                            </div>
                            <div className="form-group">
                                <label>Reason for Not Proceeding Personally *</label>
                                <select name="reasonForNotProceeding" className="input-field" required>
                                    <option value="">-- Select Reason --</option>
                                    {NOT_PROCEEDING_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="form-group"><label>Notes</label><textarea name="notes" className="input-field" style={{ minHeight: '60px' }} /></div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="button" onClick={() => { setSelectedCp(null); setShowCpLeadForm(false) }} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '11px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={isSubmitting} style={{ flex: 2, background: '#1a3c8f', color: 'white', border: 'none', borderRadius: '10px', padding: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                    {isSubmitting ? 'Creating…' : 'Create Lead & Assign IS ✓'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showBulkUpload && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '500px', padding: '32px' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '20px' }}>Bulk Upload CPs (CSV)</h2>
                        <div style={{ background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                            <input type="file" accept=".csv" onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                const reader = new FileReader()
                                reader.onload = async (event) => {
                                    const csv = event.target?.result as string
                                    const rows = csv.split('\n').slice(1).map(line => line.split(',')).filter(r => r.length > 1)
                                    setIsSubmitting(true)
                                    try {
                                        await bulkCreateCp(rows, sessionUser)
                                        setShowBulkUpload(false)
                                    } finally {
                                        setIsSubmitting(false)
                                    }
                                }
                                reader.readAsText(file)
                            }} disabled={isSubmitting} />
                        </div>
                        <button onClick={() => setShowBulkUpload(false)} style={{ width: '100%', marginTop: '16px', background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '12px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
                    </div>
                </div>
            )}

            {showTemplate && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Agreement Template Preview</h2>
                            <button onClick={() => setShowTemplate(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '32px', background: '#f8fafc' }}>
                            <div style={{ background: 'white', padding: '40px', whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#1e293b', lineHeight: '1.6', fontFamily: 'serif' }}>{AGREEMENT_TEMPLATE}</div>
                        </div>
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}><button onClick={() => setShowTemplate(false)} style={{ background: '#1a3c8f', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}>Close</button></div>
                    </div>
                </div>
            )}

            {editingCp && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '650px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Edit Contractor Partner: {editingCp.name}</h2>
                            <button onClick={() => setEditingCp(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
                        </div>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            setIsSubmitting(true);
                            const fd = new FormData(e.currentTarget);
                            const input: NewCpInput = {
                                contractorId: editingCp.code,
                                cpName: fd.get('cpName') as string,
                                companyName: fd.get('companyName') as string,
                                email: fd.get('email') as string,
                                phone: fd.get('phone') as string,
                                city: fd.get('city') as string,
                                pincode: fd.get('pincode') as string,
                                userType: fd.get('userType') as string,
                                totalCrn: parseInt(fd.get('totalCrn') as string) || 0,
                                runningCrn: parseInt(fd.get('runningCrn') as string) || 0,
                                totalProjectValue: parseFloat(fd.get('totalProjectValue') as string) || 0,
                                lowestPercentageCompleted: parseFloat(fd.get('lowestPercentageCompleted') as string) || 0,
                                primaryScope: fd.get('primaryScope') as string,
                                tier: fd.get('tier') as string,
                                bmsPriority: fd.get('bmsPriority') as string,
                                remarks: fd.get('remarks') as string,
                            };
                            try {
                                await updateCp(editingCp.id, input, sessionUser);
                                setEditingCp(null);
                            } finally {
                                setIsSubmitting(false);
                            }
                        }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Contractor Name *</label>
                                <input name="cpName" defaultValue={editingCp.name} required className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Email ID *</label>
                                <input name="email" type="email" defaultValue={editingCp.email} required className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Phone Number *</label>
                                <input name="phone" defaultValue={editingCp.phone} required className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>City *</label>
                                <input name="city" defaultValue={editingCp.city} required className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>User Type</label>
                                <select name="userType" defaultValue={editingCp.userType} className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                    <option value="CONTRACTOR">CONTRACTOR</option>
                                    <option value="REFERRAL_PARTNER">REFERRAL PARTNER</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Tier</label>
                                <select name="tier" defaultValue={editingCp.tier} className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                    <option>Blue</option>
                                    <option>Silver</option>
                                    <option>Gold</option>
                                    <option>Platinum</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>BMS Priority</label>
                                <select name="bmsPriority" defaultValue={editingCp.bmsPriority} className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                    <option>Low</option>
                                    <option>Medium</option>
                                    <option>High</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Total CRN</label>
                                <input name="totalCrn" type="number" defaultValue={editingCp.totalAssignedProjects} className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Running CRN</label>
                                <input name="runningCrn" type="number" defaultValue={editingCp.activeProjects} className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Total Project Value (Cr)</label>
                                <input name="totalProjectValue" type="number" step="0.01" defaultValue={editingCp.totalProjectValueCr} className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Lowest % Completed</label>
                                <input name="lowestPercentageCompleted" type="number" step="0.1" defaultValue={editingCp.lowestPercentageCompleted} className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Remarks</label>
                                <textarea name="remarks" className="input-field" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', minHeight: '60px' }} />
                            </div>
                            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setEditingCp(null)} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={isSubmitting} style={{ flex: 2, background: '#1a3c8f', color: 'white', border: 'none', borderRadius: '10px', padding: '12px', fontWeight: 700, cursor: 'pointer' }}>{isSubmitting ? 'Updating...' : 'Save Changes ✓'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
