import { supabase } from '../lib/supabase'
import type {
    AppDataset,
    ContractorPartner,
    Lead,
    Role,
    UserProfile,
} from '../types/domain'
import type { AppRepository } from './repository'
import { generateCode, todayIso } from './repository-utils'
import type { SessionUser as _SessionUser } from '../lib/supabase'

function requireSupabase() {
    if (!supabase) {
        throw new Error('Supabase is not configured.')
    }
    return supabase
}

function inferBucket(stage: Lead['currentStage'], baStatus: Lead['baStatus']): Lead['bucket'] {
    if (baStatus === 'Collected') return 'Won Leads'
    if (stage === 'Rejected' || (stage as string) === 'Non-Interested') return 'Rejected Leads'
    if (stage === 'Inactive') return 'Inactive Leads'
    return 'Active Leads'
}

function inferTemperature(value?: string): Lead['temperature'] {
    if (value === 'Hot' || value === 'Warm' || value === 'Pre-Cold' || value === 'Cold') {
        return value
    }
    return 'Warm'
}

async function loadDataset(): Promise<AppDataset> {
    const client = requireSupabase()
    const [
        usersResponse,
        cpsResponse,
        leadsResponse,
        isUpdatesResponse,
        meetingsResponse,
        incentivesResponse,
        projectsResponse,
        agreementsResponse,
        vmUpdatesResponse,
        notificationsResponse,
    ] = await Promise.all([
        client.from('user_master').select('*').order('created_at', { ascending: false }),
        client.from('cp_master').select('*').order('created_at', { ascending: false }),
        client.from('lead_master').select('*').order('submitted_at', { ascending: false }),
        client.from('is_updates').select('*').order('created_at', { ascending: false }),
        client.from('meeting_master').select('*').order('created_at', { ascending: false }),
        client.from('incentive_master').select('*').order('created_at', { ascending: false }),
        client.from('project_master').select('*').order('created_at', { ascending: false }),
        client.from('agreement_master').select('*').order('created_at', { ascending: false }),
        client.from('vm_updates').select('*').order('created_at', { ascending: false }),
        client.from('notification_master').select('*').order('created_at', { ascending: false }),
    ])

    const responses = [
        usersResponse,
        cpsResponse,
        leadsResponse,
        isUpdatesResponse,
        meetingsResponse,
        incentivesResponse,
        projectsResponse,
        agreementsResponse,
        vmUpdatesResponse,
        notificationsResponse,
    ]
    // Log individual query errors without aborting — a single RLS block shouldn't wipe all data
    const tableNames = ['user_master', 'cp_master', 'lead_master', 'is_updates', 'meeting_master', 'incentive_master', 'project_master', 'agreement_master', 'vm_updates', 'notification_master']
    responses.forEach((r, i) => { if (r.error) console.error(`[loadDataset] ${tableNames[i]} query failed:`, r.error.message) })

    const userRows = usersResponse.data ?? []
    const cpRows = cpsResponse.data ?? []
    const leadRows = leadsResponse.data ?? []
    const isRows = isUpdatesResponse.data ?? []
    const meetingRows = meetingsResponse.data ?? []
    const incentiveRows = incentivesResponse.data ?? []
    const projectRows = projectsResponse.data ?? []
    const agreementRows = agreementsResponse.data ?? []
    const vmUpdateRows = vmUpdatesResponse.data ?? []
    const notificationRows = notificationsResponse.data ?? []

    // Keyed by user_master.id (PK) for FK lookups (is_owner_id, vm_owner_id, etc.)
    const usersByMasterId = new Map<string, string>(
        userRows.map((row) => [row.id as string, row.full_name as string])
    )

    const users: UserProfile[] = userRows.map((row) => ({
        id: row.auth_user_id ?? row.id,
        fullName: row.full_name,
        email: row.email,
        role: row.role.toLowerCase() as Role,
        city: row.city ?? '',
        phone: row.phone ?? '',
    }))

    const cps: ContractorPartner[] = cpRows.map((c) => {
        const vmOwnerName = usersByMasterId.get(c.vm_owner_id) ?? 'Assigned Soon'
        return {
            id: c.id,
            code: c.cp_code,
            name: c.cp_name,
            companyName: c.company_name,
            city: c.city,
            phone: c.phone,
            activeSince: c.created_at,
            primaryScope: c.primary_scope,
            spoc: c.spoc_name,
            vmOwner: vmOwnerName,
            vmOwnerId: c.vm_owner_id ?? undefined,   // FK so VM dashboard can filter its own portfolio
            tier: c.tier,
            activeProjects: c.active_projects || 0,
            completedProjects: c.completed_projects || 0,
            heldProjects: c.held_projects || 0,
            totalProjectValueCr: c.total_portfolio_value_cr || 0,
            totalAssignedProjects: c.total_assigned_projects || 0,
            averageCsat: c.average_csat || 0,
            averageDelayDays: c.average_delay_days || 0,
            bmsPriority: (c.bms_priority || 'Medium') as any,
            eligibleForProject: c.eligible_for_project,
            initProjectCount: c.init_project_count || 0,
            leadsReceived: 0,
            email: c.email,
            userType: c.user_type || 'CONTRACTOR',
            lowestPercentageCompleted: c.lowest_percentage_completed || 0,
            linkedUserId: c.linked_user_id,
            onboardingVmName: c.onboarding_vm_name,
            onboardingCallStatus: c.onboarding_call_status,
            onboardingMeetingStatus: c.onboarding_meeting_status,
            onboardingMeetingScheduledDate: c.onboarding_meeting_scheduled_date,
            onboardingAlignedForActivation: c.onboarding_aligned_for_activation,
            onboardingModeOfMeeting: c.onboarding_mode_of_meeting,
            onboardingCpReadyForSigning: c.onboarding_cp_ready_for_signing,
            onboardingAgreementSentStatus: c.onboarding_agreement_sent_status,
            onboardingCpSignedStatus: c.onboarding_cp_signed_status,
            onboardingSignedAgreementUrl: c.onboarding_signed_agreement_url,
        }
    })

    const leads: Lead[] = leadRows.map((l) => {
        const cp = cps.find((c) => c.id === l.cp_id)
        return {
            id: l.id,
            name: l.lead_name,
            phone: l.lead_number,
            city: l.lead_city,
            projectType: l.project_type,
            selectedModel: l.selected_model,
            projectValueCr: l.approximate_project_value_cr,
            proposalValueCr: l.proposal_value_cr,
            finalProjectValueCr: l.final_project_value_cr,
            currentStage: l.current_stage,
            temperature: inferTemperature(l.lead_temperature),
            bucket: inferBucket(l.current_stage, l.ba_status),
            cpId: l.cp_id,
            cpName: cp?.name ?? 'Unknown',
            // Populate CP contact fields from the joined cp_master row
            cpEmail: cp?.email,
            cpPhone: cp?.phone,
            isOwner: usersByMasterId.get(l.is_owner_id) ?? 'Unassigned',
            // Resolve scheduling_owner_id FK to a name
            schedulingOwner: usersByMasterId.get(l.scheduling_owner_id),
            submittedAt: l.submitted_at,
            lastUpdatedAt: l.last_updated_at,
            crnNumber: l.crn_number,
            baStatus: (l.ba_status ?? 'Pending') as Lead['baStatus'],
            requirementSummary: l.requirement_summary,
            reasonForNotProceeding: l.reason_for_not_proceeding,
            nextAction: 'None',
        }
    })

    return {
        users,
        cps,
        leads,
        isUpdates: isRows.map(r => ({
            leadId: r.lead_id,
            status: r.call_status,
            interestStatus: r.interest_status,
            reason: r.reason,
            detailedComment: r.detailed_comment,
            expectedConcern: r.expected_concern,
            nextPossibleAction: r.next_possible_action,
            nextFollowUpDate: r.next_follow_up_date,
            comment: r.comment
        })),
        meetings: meetingRows.map(m => ({
            id: m.id,
            leadId: m.lead_id,
            assignedOs: m.assigned_os,
            date: m.meeting_date,
            time: m.meeting_time,
            status: m.status,
            mode: m.meeting_mode,
            notes: m.meeting_notes,
            rescheduleReason: m.reschedule_reason
        })),
        incentives: incentiveRows.map(i => {
            const lead = leads.find(l => l.id === i.lead_id)
            // incentive_master has no cp_name column — join from cps
            const incentiveCp = cps.find(c => c.id === i.cp_id)
            return {
                id: i.id,
                leadId: i.lead_id,
                cpId: i.cp_id,
                leadName: lead?.name ?? 'Unknown',
                cpName: incentiveCp?.name ?? 'Unknown',
                selectedModel: i.selected_model,
                projectValueCr: i.project_value_cr,
                incentivePercent: i.incentive_percent,
                incentiveAmountLakh: i.incentive_amount,
                paymentStatus: i.payment_status,
                paymentDate: i.payment_date,
                pendingDays: i.pending_days
            }
        }),
        sharedConstructionProjects: projectRows.filter(p => p.partnership_model === 'Shared Construction').map(p => {
            const cp = cps.find(c => c.id === p.cp_id)
            const lead = leads.find(l => l.id === p.lead_id)
            return {
                id: p.id,
                cpId: p.cp_id || '',
                leadId: p.lead_id || '',
                leadName: lead?.name || p.project_name,
                cpName: cp?.name || 'CP',
                allocationPercent: 100,
                // project_value_cr stores projectedProfitLakh directly (set by upsertSharedConstructionProject)
                executionStatus: p.status as import('../types/domain').SharedConstructionProject['executionStatus'],
                projectedProfitLakh: p.project_value_cr || 0,
                createdAt: p.created_at
            }
        }),
        barterProjectMatches: projectRows.filter(p => p.partnership_model === 'Barter').map(p => {
            const cp = cps.find(c => c.id === p.cp_id)
            const lead = leads.find(l => l.id === p.lead_id)
            return {
                id: p.id,
                cpId: p.cp_id || '',
                leadId: p.lead_id || '',
                leadName: lead?.name || p.project_name,
                cpName: cp?.name || 'CP',
                // Read actual status from DB instead of hardcoding 'Matched'
                matchStatus: p.status as import('../types/domain').BarterProjectMatch['matchStatus'],
                expectedTimelineDays: 14,
                notes: '',
                createdAt: p.created_at
            }
        }),
        agreements: agreementRows.map(ag => {
            const agCp = cps.find(c => c.id === ag.cp_id)
            const vmOwnerName = usersByMasterId.get(ag.vm_owner_id) ?? 'VM'
            return {
                id: ag.id,
                contractorId: ag.cp_id,
                cpName: agCp?.name ?? 'CP',
                cpEmail: agCp?.email,
                sentDate: ag.agreement_sent_date,
                status: ag.agreement_status,
                signedDate: ag.signed_date,
                spotdraftStatus: (ag.spotdraft_link_status ?? 'Ready') as import('../types/domain').Agreement['spotdraftStatus'],
                vmOwner: vmOwnerName,
            }
        }),
        vmUpdates: vmUpdateRows.map(v => ({
            id: v.id,
            cpId: v.cp_id,
            // Resolve FK to name; domain type is vmOwner (string), not vmOwnerId (uuid)
            vmOwner: usersByMasterId.get(v.vm_owner_id),
            callStatus: v.call_status,
            meetingStatus: v.meeting_status,
            meetingScheduledDate: v.meeting_scheduled_date,
            // DB stores boolean; domain type expects 'Yes' | 'No'
            alignedForActivation: v.aligned_for_activation ? 'Yes' : 'No',
            // DB column is meeting_mode; domain field is modeOfMeeting
            modeOfMeeting: v.meeting_mode,
            agreementSigningStatus: v.agreement_signing_status ?? 'Pending',
            leadsReceived: v.leads_received ?? 0,
            remarks: v.remarks,
            createdAt: v.created_at
        })),
        notifications: notificationRows.map(n => ({
            id: n.id,
            title: n.title,
            detail: n.detail,
            audience: n.audience,
            severity: n.severity,
            createdAt: n.created_at
        }))
    }
}


async function insertNotification(title: string, detail: string, audience: Role | 'all', severity: 'info' | 'warn' | 'critical' = 'info') {
    const client = requireSupabase()
    await client.from('notification_master').insert({
        title,
        detail,
        audience: audience === 'all' ? null : audience,
        severity
    })
}

export const supabaseRepository: AppRepository = {
    loadDataset,
    async submitLead(input, sessionUser) {
        const client = requireSupabase()
        // Use sessionUser.userMasterId (user_master.id) directly — no extra DB round-trip
        const { data: cp } = await client
            .from('cp_master')
            .select('id, cp_name')
            .eq('linked_user_id', sessionUser.userMasterId)
            .single()

        const leadCode = generateCode('LD')
        const { error } = await client.from('lead_master').insert({
            lead_code: leadCode,
            cp_id: cp?.id,
            lead_name: input.name,
            lead_number: input.phone,
            lead_city: input.city,
            project_type: input.projectType,
            approximate_project_value_cr: input.projectValueCr,
            selected_model: input.selectedModel,
        })
        if (error) throw error

        await insertNotification(
            'New Lead Received',
            `New lead ${input.name} has been submitted by ${cp?.cp_name}.`,
            'is'
        )

        return loadDataset()
    },
    async createVmLead(input, _sessionUser) {
        const client = requireSupabase()
        const leadCode = generateCode('LD')
        const { error } = await client.from('lead_master').insert({
            lead_code: leadCode,
            cp_id: input.cpId,
            lead_name: input.name,
            lead_number: input.phone,
            lead_city: input.city,
            project_type: input.projectType,
            approximate_project_value_cr: input.projectValueCr,
            selected_model: input.selectedModel,
            current_stage: 'Lead Shared',
            requirement_summary: input.notes ?? null,          // VmLeadInput uses 'notes'
            reason_for_not_proceeding: input.reasonForNotProceeding ?? null,
        })
        if (error) throw error

        return loadDataset()
    },
    async updateIsDisposition(input, sessionUser) {
        const client = requireSupabase()

        // Update lead stage — use userMasterId directly (user_master.id FK)
        const { error: leadError } = await client
            .from('lead_master')
            .update({
                current_stage: input.qualifyLead ? 'Qualified' : input.callStatus,
                is_owner_id: sessionUser.userMasterId,
                last_updated_at: new Date().toISOString()
            })
            .eq('id', input.leadId)
        if (leadError) throw leadError

        // Insert update history
        await client.from('is_updates').insert({
            lead_id: input.leadId,
            is_owner_id: sessionUser.userMasterId,
            call_status: input.callStatus,
            interest_status: input.interestStatus,
            reason: input.reason,
            detailed_comment: input.detailedComment,
            expected_concern: input.expectedConcern,
            next_possible_action: input.nextPossibleAction,
            expected_timeline: input.expectedTimeline,
            budget_range: input.budgetRange,
            expected_project_value_cr: input.expectedProjectValueCr,
            next_follow_up_date: input.nextFollowUpDate,
            comment: input.comment
        })

        return loadDataset()
    },
    async scheduleMeeting(input, sessionUser) {
        const client = requireSupabase()

        const { error } = await client.from('meeting_master').insert({
            lead_id: input.leadId,
            assigned_os: input.assignedOs,
            meeting_date: input.date,
            meeting_time: input.time,
            meeting_mode: input.mode,
            status: 'Meeting Scheduled',
            meeting_notes: input.notes
        })
        if (error) throw error

        // Use userMasterId directly — no extra DB round-trip needed
        await client.from('lead_master').update({
            current_stage: 'Meeting Scheduled',
            scheduling_owner_id: sessionUser.userMasterId
        }).eq('id', input.leadId)

        return loadDataset()
    },
    async createCp(input, sessionUser) {
        const client = requireSupabase()
        const cpCode = input.contractorId || generateCode('CP')
        const { data: cpInsert, error: cpError } = await client
            .from('cp_master')
            .insert({
                id: crypto.randomUUID(),
                cp_code: cpCode,
                cp_name: input.cpName,
                company_name: input.companyName,
                city: input.city,
                pincode: input.pincode,
                phone: input.phone,
                email: input.email,
                user_type: input.userType || 'CONTRACTOR',
                total_assigned_projects: input.totalCrn || 0,
                active_projects: input.runningCrn || 0,
                total_portfolio_value_cr: input.totalProjectValue || 0,
                lowest_percentage_completed: input.lowestPercentageCompleted || 0,
                primary_scope: input.primaryScope,
                tier: input.tier || 'Platinum',
                bms_priority: input.bmsPriority || 'Medium',
                vm_owner_id: sessionUser.userMasterId,
                spoc_name: sessionUser.name,
                remarks: input.remarks || ('New CP Created ' + todayIso())
            })
            .select('id')
            .single()
        if (cpError) throw cpError

        await client.from('agreement_master').insert({
            cp_id: cpInsert.id,
            agreement_sent_date: todayIso(),
            agreement_status: 'Pending',
            spotdraft_link_status: 'Ready',
            vm_owner_id: sessionUser.userMasterId,
        })

        return loadDataset()
    },
    async updateCp(id, input, _sessionUser) {
        const client = requireSupabase()
        const { error } = await client
            .from('cp_master')
            .update({
                cp_name: input.cpName,
                company_name: input.companyName,
                city: input.city,
                pincode: input.pincode,
                phone: input.phone,
                email: input.email,
                user_type: input.userType || 'CONTRACTOR',
                total_assigned_projects: input.totalCrn || 0,
                active_projects: input.runningCrn || 0,
                total_portfolio_value_cr: input.totalProjectValue || 0,
                lowest_percentage_completed: input.lowestPercentageCompleted || 0,
                primary_scope: input.primaryScope,
                tier: input.tier || 'Platinum',
                bms_priority: input.bmsPriority || 'Medium',
                remarks: input.remarks || ('CP Updated ' + todayIso())
            })
            .eq('id', id)
        if (error) throw error
        return loadDataset()
    },
    async updateAgreement(input, _sessionUser) {
        const client = requireSupabase()

        // 1. Update agreement_master for status / signed date
        const agUpdate: Record<string, any> = {}
        if (input.status) agUpdate.agreement_status = input.status
        if (input.status === 'Signed' || input.status === 'Done') {
            agUpdate.signed_date = todayIso()
        }
        if (Object.keys(agUpdate).length > 0) {
            const { error } = await client
                .from('agreement_master')
                .update(agUpdate)
                .eq('cp_id', input.contractorId)
            if (error) throw error
        }

        // 2. Update cp_master onboarding fields that arrive with this call
        const cpUpdate: Record<string, any> = {}
        if (input.vmOwner !== undefined) cpUpdate.onboarding_vm_name = input.vmOwner
        if (input.callStatus !== undefined) cpUpdate.onboarding_call_status = input.callStatus
        if (input.meetingStatus !== undefined) cpUpdate.onboarding_meeting_status = input.meetingStatus
        if (input.meetingScheduledDate !== undefined) cpUpdate.onboarding_meeting_scheduled_date = input.meetingScheduledDate
        if (input.alignedForActivation !== undefined) cpUpdate.onboarding_aligned_for_activation = input.alignedForActivation
        if (input.modeOfMeeting !== undefined) cpUpdate.onboarding_mode_of_meeting = input.modeOfMeeting
        if (input.readyForSigning !== undefined) cpUpdate.onboarding_cp_ready_for_signing = input.readyForSigning
        // When CP signs, mark signed status on their cp_master row
        if (input.status === 'Signed' || input.status === 'Done') {
            cpUpdate.onboarding_cp_signed_status = 'Done'
        }
        if (Object.keys(cpUpdate).length > 0) {
            await client.from('cp_master').update(cpUpdate).eq('id', input.contractorId)
        }

        return loadDataset()
    },
    async updateCommercialStage(input, _sessionUser) {
        const client = requireSupabase()
        const { error } = await client
            .from('lead_master')
            .update({ current_stage: input.stage, last_updated_at: new Date().toISOString() })
            .eq('id', input.leadId)
        if (error) throw error
        return loadDataset()
    },
    async updateCommercialValues(input, _sessionUser) {
        const client = requireSupabase()
        const { error } = await client
            .from('lead_master')
            .update({
                proposal_value_cr: input.proposalValueCr,
                final_project_value_cr: input.finalProjectValueCr,
                last_updated_at: new Date().toISOString()
            })
            .eq('id', input.leadId)
        if (error) throw error
        return loadDataset()
    },
    async updateIncentivePayment(input, _sessionUser) {
        const client = requireSupabase()
        const { error } = await client
            .from('incentive_master')
            .update({
                payment_status: input.paymentStatus,
                payment_date: input.paymentStatus === 'Released' ? todayIso() : null
            })
            .eq('id', input.incentiveId)
        if (error) throw error
        return loadDataset()
    },
    async updateCpOnboarding(input, _sessionUser) {
        const client = requireSupabase()
        const dbField = input.field.replace(/[A-Z]/g, (m: string) => `_${m.toLowerCase()}`)
        const { error } = await client
            .from('cp_master')
            .update({ [dbField]: input.value })
            .eq('id', input.cpId)
        if (error) throw error

        // When VM marks agreement as Sent, also update agreement_master so the CP
        // portal can gate visibility on the agreement_status column.
        if (input.field === 'onboardingAgreementSentStatus' && input.value === 'Sent') {
            await client
                .from('agreement_master')
                .update({ agreement_status: 'Sent' })
                .eq('cp_id', input.cpId)
        }

        return loadDataset()
    },
    async upsertSharedConstructionProject(input, _sessionUser) {
        const client = requireSupabase()

        // Find the lead to get cp_id and name for the project record
        const { data: lead } = await client
            .from('lead_master')
            .select('cp_id, lead_name')
            .eq('id', input.leadId)
            .single()

        const { data: existing } = await client
            .from('project_master')
            .select('id')
            .eq('lead_id', input.leadId)
            .eq('partnership_model', 'Shared Construction')
            .maybeSingle()

        if (existing) {
            const { error } = await client
                .from('project_master')
                .update({ status: input.executionStatus, project_value_cr: input.projectedProfitLakh })
                .eq('id', existing.id)
            if (error) throw error
        } else {
            const { error } = await client.from('project_master').insert({
                cp_id: lead?.cp_id,
                lead_id: input.leadId,
                project_name: lead?.lead_name ?? 'Shared Construction Project',
                project_value_cr: input.projectedProfitLakh,
                status: input.executionStatus,
                partnership_model: 'Shared Construction',
            })
            if (error) throw error
        }

        return loadDataset()
    },
    async upsertBarterMatch(input, _sessionUser) {
        const client = requireSupabase()

        const { data: lead } = await client
            .from('lead_master')
            .select('cp_id, lead_name')
            .eq('id', input.leadId)
            .single()

        const { data: existing } = await client
            .from('project_master')
            .select('id')
            .eq('lead_id', input.leadId)
            .eq('partnership_model', 'Barter')
            .maybeSingle()

        if (existing) {
            const { error } = await client
                .from('project_master')
                .update({ status: input.matchStatus })
                .eq('id', existing.id)
            if (error) throw error
        } else {
            const { error } = await client.from('project_master').insert({
                cp_id: lead?.cp_id,
                lead_id: input.leadId,
                project_name: lead?.lead_name ?? 'Barter Project',
                project_value_cr: 0,
                status: input.matchStatus,
                partnership_model: 'Barter',
            })
            if (error) throw error
        }

        return loadDataset()
    },
    async bulkCreateCp(rows: any[], sessionUser) {
        const client = requireSupabase()

        // 1. Fetch existing CP codes for upsert deduplication
        const { data: existingRecords } = await client.from('cp_master').select('id, cp_code')

        const idMap = new Map((existingRecords || []).map(c => [c.cp_code, c.id]))
        // Use sessionUser.userMasterId directly — no extra user_master fetch needed
        const currentUserId = sessionUser.userMasterId || null

        const report = {
            inserted: 0,
            updated: 0,
            skipped: 0,
            errors: [] as string[]
        }

        const cpInserts = []
        const localCodeTracker = new Set()

        for (const [index, r] of rows.entries()) {
            const rowNum = index + 2 // 1-based + 1 for header
            const rawId = String(r.contractor_id || '').trim()
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)
            const cpCode = r.cp_code || (isUuid ? generateCode('CP') : (rawId || generateCode('CP')))
            const cpName = r.assigned_contractor_name || r.cp_name || r.name

            // Validation Layer
            if (!cpName) { report.skipped++; report.errors.push(`Row ${rowNum}: Missing cp_name`); continue }
            if (!r.phone) { report.skipped++; report.errors.push(`Row ${rowNum}: Missing phone`); continue }
            if (!r.cities && !r.city) { report.skipped++; report.errors.push(`Row ${rowNum}: Missing city`); continue }
            if (localCodeTracker.has(cpCode)) { report.skipped++; report.errors.push(`Row ${rowNum}: Duplicate CP Code in file (${cpCode})`); continue }

            localCodeTracker.add(cpCode)

            const existingId = idMap.get(String(cpCode))

            if (existingId) {
                report.updated++
            } else {
                report.inserted++
            }

            const rowPayload: any = {
                id: existingId || crypto.randomUUID(),
                cp_code: String(cpCode),
                cp_name: cpName,
                phone: String(r.phone || ''),
                email: r.email || null,
                user_type: r.user_type || 'CONTRACTOR',
                city: r.cities || r.city || '',
                total_assigned_projects: parseInt(String(r.total_crn || 0)) || 0,
                active_projects: parseInt(String(r.running_crn || 0)) || 0,
                total_portfolio_value_cr: parseFloat(String(r.total_project_value || 0)) || 0,
                lowest_percentage_completed: parseFloat(String(r.lowest_percentage_completed || 0)) || 0,
                tier: r.Tier || r.tier || 'Platinum',
                bms_priority: r.BMS || r.bms_priority || r.bms_colms || 'Medium',
                vm_owner_id: currentUserId,
                spoc_name: sessionUser.name,
                remarks: 'Bulk Upload ' + todayIso()
            }

            cpInserts.push(rowPayload)
        }

        if (cpInserts.length > 0) {
            const { error } = await client
                .from('cp_master')
                .upsert(cpInserts, { onConflict: 'cp_code', count: 'exact' })

            if (error) {
                console.error('Bulk Upsert Backend Error:', error)
                throw new Error(`Database Error: ${error.message}`)
            }
        }

        return { ...await loadDataset(), importReport: report } as any
    },
}
