import { supabase } from '../lib/supabase'
import type {
  Agreement,
  AppDataset,
  BarterMatchInput,
  BarterProjectMatch,
  CommercialStageInput,
  CommercialValuesInput,
  ContractorPartner,
  IncentivePaymentInput,
  Incentive,
  IsUpdate,
  Lead,
  Meeting,
  Notification,
  SharedConstructionInput,
  SharedConstructionProject,
  UserProfile,
} from '../types/domain'
import type { AppRepository } from './repository'
import { generateCode, todayIso } from './repository-utils'
import { buildSupabaseIncentivePayload } from './commercial-utils'

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }
  return supabase
}

function inferBucket(stage: Lead['currentStage'], baStatus: Lead['baStatus']): Lead['bucket'] {
  if (baStatus === 'Collected') return 'Won Leads'
  if (stage === 'Rejected' || stage === 'Non-Interested') return 'Rejected Leads'
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
    notificationsResponse,
  ]
  const error = responses.find((response) => response.error)?.error
  if (error) throw error

  const userRows = usersResponse.data ?? []
  const cpRows = cpsResponse.data ?? []
  const leadRows = leadsResponse.data ?? []
  const isRows = isUpdatesResponse.data ?? []
  const meetingRows = meetingsResponse.data ?? []
  const incentiveRows = incentivesResponse.data ?? []
  const projectRows = projectsResponse.data ?? []
  const agreementRows = agreementsResponse.data ?? []
  const notificationRows = notificationsResponse.data ?? []

  const users: UserProfile[] = userRows.map((row) => ({
    id: row.auth_user_id ?? row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    city: row.city ?? '',
    phone: row.phone ?? '',
  }))

  const cpIdToCode = new Map<string, string>()
  const cpCodeToName = new Map<string, string>()
  const cps: ContractorPartner[] = cpRows.map((row) => {
    cpIdToCode.set(row.id, row.cp_code)
    cpCodeToName.set(row.cp_code, row.cp_name)

    return {
      id: row.cp_code,
      name: row.cp_name,
      companyName: row.company_name ?? '',
      city: row.city,
      activeSince: row.active_since ?? todayIso(),
      primaryScope: row.primary_scope ?? '',
      phone: row.phone,
      spoc: row.spoc_name ?? '',
      vmOwner: row.vm_owner_id ?? '',
      tier: row.tier ?? '',
      activeProjects: row.active_projects ?? 0,
      completedProjects: row.completed_projects ?? 0,
      heldProjects: row.held_projects ?? 0,
      totalProjectValueCr: Number(row.total_portfolio_value_cr ?? 0),
      totalAssignedProjects: row.total_assigned_projects ?? 0,
      averageCsat: Number(row.average_csat ?? 0),
      averageDelayDays: row.average_delay_days ?? 0,
      bmsPriority: row.bms_priority ?? 'Medium',
      eligibleForProject: Boolean(row.eligible_for_project),
      initProjectCount: row.init_project_count ?? 0,
      leadsReceived: 0,
      linkedUserId: row.linked_user_id ?? undefined,
    }
  })

  const leads: Lead[] = leadRows.map((row) => ({
    id: row.lead_code,
    name: row.lead_name,
    phone: row.lead_number,
    city: row.lead_city,
    projectType: row.project_type,
    selectedModel: row.selected_model,
    projectValueCr: Number(row.approximate_project_value_cr ?? 0),
    proposalValueCr: row.proposal_value_cr ? Number(row.proposal_value_cr) : undefined,
    finalProjectValueCr: row.final_project_value_cr ? Number(row.final_project_value_cr) : undefined,
    currentStage: row.current_stage,
    temperature: inferTemperature(row.lead_temperature),
    bucket: inferBucket(row.current_stage, row.ba_status ?? 'Pending'),
    cpId: cpIdToCode.get(row.cp_id) ?? row.cp_id,
    cpName: cpCodeToName.get(cpIdToCode.get(row.cp_id) ?? '') ?? '',
    isOwner: userRows.find((userRow) => userRow.id === row.is_owner_id)?.full_name ?? '',
    schedulingOwner: userRows.find((userRow) => userRow.id === row.scheduling_owner_id)?.full_name ?? undefined,
    assignedOs: undefined,
    submittedAt: row.submitted_at,
    lastUpdatedAt: row.last_updated_at,
    nextAction: row.current_stage === 'Qualified' ? 'Send to Scheduling Team' : 'Continue workflow',
    crnNumber: row.crn_number ?? undefined,
    baStatus: row.ba_status ?? 'Pending',
    requirementSummary: row.requirement_summary ?? '',
    comment: row.additional_notes ?? undefined,
  }))

  const isUpdates: IsUpdate[] = isRows.map((row) => {
    const matchingLead = leadRows.find((leadRow) => leadRow.id === row.lead_id)
    return {
      leadId: matchingLead?.lead_code ?? row.lead_id,
      status: row.call_status,
      interestStatus: row.interest_status ?? undefined,
      reason: row.reason ?? undefined,
      detailedComment: row.detailed_comment ?? undefined,
      expectedConcern: row.expected_concern ?? undefined,
      nextPossibleAction: row.next_possible_action ?? undefined,
      nextFollowUpDate: row.next_follow_up_date ?? undefined,
      comment: row.comment ?? undefined,
    }
  })

  const meetings: Meeting[] = meetingRows.map((row) => {
    const matchingLead = leadRows.find((leadRow) => leadRow.id === row.lead_id)
    return {
      id: row.id,
      leadId: matchingLead?.lead_code ?? row.lead_id,
      assignedOs: row.assigned_os,
      date: row.meeting_date,
      time: row.meeting_time,
      mode: row.meeting_mode,
      status: row.status,
      notes: row.meeting_notes ?? '',
      rescheduleReason: row.reschedule_reason ?? undefined,
    }
  })

  const incentives: Incentive[] = incentiveRows.map((row) => {
    const matchingLead = leadRows.find((leadRow) => leadRow.id === row.lead_id)
    const cpCode = cpIdToCode.get(row.cp_id) ?? row.cp_id
    return {
      id: row.id,
      leadId: matchingLead?.lead_code ?? row.lead_id,
      cpId: cpCode,
      leadName: matchingLead?.lead_name ?? 'Lead',
      cpName: cpCodeToName.get(cpCode) ?? 'CP',
      selectedModel: row.selected_model,
      projectValueCr: Number(row.project_value_cr ?? 0),
      incentivePercent: Number(row.incentive_percent ?? 0),
      incentiveAmountLakh: Number(row.incentive_amount ?? 0),
      paymentStatus: row.payment_status,
      paymentDate: row.payment_date ?? undefined,
      pendingDays: row.pending_days ?? 0,
    }
  })

  const sharedConstructionProjects: SharedConstructionProject[] = projectRows
    .filter((row) => row.partnership_model === 'Shared Construction')
    .map((row) => {
      const cpCode = cpIdToCode.get(row.cp_id) ?? row.cp_id
      const matchingLead = leadRows.find((leadRow) => leadRow.id === row.lead_id)
      const allocationPercent = Number(String(row.status).match(/(\d+)%/)?.[1] ?? 15)
      const projectedProfitLakh = Number(row.project_value_cr ?? 0) * 100 * (allocationPercent / 100) * 0.3
      return {
        id: row.id,
        leadId: matchingLead?.lead_code ?? row.lead_id,
        cpId: cpCode,
        leadName: matchingLead?.lead_name ?? row.project_name,
        cpName: cpCodeToName.get(cpCode) ?? 'CP',
        allocationPercent,
        executionStatus: String(row.status).includes('Completed')
          ? 'Completed'
          : String(row.status).includes('Execution')
            ? 'Execution'
            : String(row.status).includes('Mobilization')
              ? 'Mobilization'
              : 'Planning',
        projectedProfitLakh,
        createdAt: row.created_at,
      }
    })

  const barterProjectMatches: BarterProjectMatch[] = projectRows
    .filter((row) => row.partnership_model === 'Barter / Exchange')
    .map((row) => {
      const cpCode = cpIdToCode.get(row.cp_id) ?? row.cp_id
      const matchingLead = leadRows.find((leadRow) => leadRow.id === row.lead_id)
      const notes = String(row.status)
      const expectedTimelineDays = Number(notes.match(/(\d+)\s*days/i)?.[1] ?? 10)
      const matchStatus = notes.includes('Matched')
        ? 'Matched'
        : notes.includes('Matching')
          ? 'Matching'
          : 'Match Pending'
      return {
        id: row.id,
        leadId: matchingLead?.lead_code ?? row.lead_id,
        cpId: cpCode,
        leadName: matchingLead?.lead_name ?? row.project_name,
        cpName: cpCodeToName.get(cpCode) ?? 'CP',
        matchStatus,
        expectedTimelineDays,
        notes,
        createdAt: row.created_at,
      }
    })

  const agreements: Agreement[] = agreementRows.map((row) => {
    const cpCode = cpIdToCode.get(row.cp_id) ?? row.cp_id
    return {
      id: row.id,
      contractorId: cpCode,
      cpName: cpCodeToName.get(cpCode) ?? 'CP',
      sentDate: row.agreement_sent_date,
      status: row.agreement_status,
      signedDate: row.signed_date ?? undefined,
      spotdraftStatus: row.spotdraft_link_status ?? 'Ready',
      vmOwner: row.vm_owner_id ?? '',
    }
  })

  const notifications: Notification[] = notificationRows.map((row) => ({
    id: row.id,
    title: row.title,
    detail: row.detail,
    audience: row.audience ?? 'all',
    severity: row.severity,
    createdAt: row.created_at,
  }))

  return { users, cps, leads, isUpdates, meetings, incentives, sharedConstructionProjects, barterProjectMatches, agreements, notifications }
}

async function findCpRowIdByCode(cpCode: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('cp_master')
    .select('id')
    .eq('cp_code', cpCode)
    .single()
  if (error) throw error
  return data.id as string
}

async function findLeadRowByCode(leadCode: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_master')
    .select('id, lead_name')
    .eq('lead_code', leadCode)
    .single()
  if (error) throw error
  return data as { id: string; lead_name: string }
}

async function findUserRowIdByFullName(fullName: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_master')
    .select('id')
    .eq('full_name', fullName)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.id as string | undefined
}

async function findDefaultUserRowIdByRole(role: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_master')
    .select('id')
    .eq('role', role)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.id as string | undefined
}

async function insertNotification(
  title: string,
  detail: string,
  audience: Notification['audience'],
  severity: Notification['severity'],
) {
  const client = requireSupabase()
  const { error } = await client.from('notification_master').insert({
    title,
    detail,
    audience: audience === 'all' ? null : audience,
    severity,
  })
  if (error) throw error
}

export const supabaseRepository: AppRepository = {
  async loadDataset() {
    return loadDataset()
  },
  async submitLead(input, sessionUser) {
    const client = requireSupabase()
    const cp = await client
      .from('cp_master')
      .select('id, cp_code, cp_name')
      .eq('cp_name', sessionUser.name)
      .limit(1)
      .maybeSingle()
    if (cp.error) throw cp.error
    const cpRow = cp.data
    if (!cpRow) {
      throw new Error(`No CP master row found for ${sessionUser.name}.`)
    }

    const { error } = await client.from('lead_master').insert({
      lead_code: generateCode('LD'),
      cp_id: cpRow.id,
      is_owner_id: await findDefaultUserRowIdByRole('is'),
      lead_name: input.name,
      lead_number: input.phone,
      lead_city: input.city,
      project_type: input.projectType,
      approximate_project_value_cr: input.projectValueCr,
      selected_model: input.selectedModel,
      current_stage: 'Lead Shared',
      lead_temperature: 'Warm',
      additional_notes: input.notes,
      requirement_summary: input.notes,
    })
    if (error) throw error

    await insertNotification(
      'New lead assigned to IS',
      `${input.name} from ${input.city} was submitted by ${cpRow.cp_name}.`,
      'is',
      'info',
    )

    return loadDataset()
  },
  async createVmLead(input, sessionUser) {
    const client = requireSupabase()
    const cpRowId = await findCpRowIdByCode(input.cpId)

    const { error } = await client.from('lead_master').insert({
      lead_code: generateCode('LD'),
      cp_id: cpRowId,
      is_owner_id: await findDefaultUserRowIdByRole('is'),
      lead_name: input.name,
      lead_number: input.phone,
      lead_city: input.city,
      project_type: input.projectType,
      approximate_project_value_cr: input.projectValueCr,
      selected_model: input.selectedModel,
      current_stage: 'Lead Shared',
      lead_temperature: 'Warm',
      additional_notes: input.notes,
      requirement_summary: input.notes,
    })
    if (error) throw error

    await insertNotification(
      'Referral captured by VM',
      `${input.name} was created for ${input.cpId} by ${sessionUser.name}.`,
      'vm',
      'info',
    )

    await insertNotification(
      'New lead assigned to IS',
      `${input.name} from ${input.city} is ready for qualification.`,
      'is',
      'info',
    )

    return loadDataset()
  },
  async updateIsDisposition(input, sessionUser) {
    const client = requireSupabase()
    const leadRow = await findLeadRowByCode(input.leadId)
    const qualified = input.qualifyLead && input.interestStatus === 'Interested'
    const stage = qualified
      ? 'Qualified'
      : input.interestStatus === 'Non-Interested'
        ? 'Non-Interested'
        : 'Calling Attempt'
    const crnNumber = qualified ? generateCode('CRN') : null

    const isOwner = await client
      .from('user_master')
      .select('id')
      .eq('full_name', sessionUser.name)
      .limit(1)
      .maybeSingle()
    if (isOwner.error) throw isOwner.error

    const { error: leadError } = await client
      .from('lead_master')
      .update({
        current_stage: stage,
        lead_temperature: input.temperature,
        crn_number: crnNumber,
        is_owner_id: isOwner.data?.id ?? null,
        last_updated_at: new Date().toISOString(),
      })
      .eq('id', leadRow.id)
    if (leadError) throw leadError

    const payload = {
      lead_id: leadRow.id,
      is_owner_id: isOwner.data?.id ?? null,
      call_status: input.callStatus,
      interest_status: input.interestStatus,
      comment: input.comment,
      next_follow_up_date: input.nextFollowUpDate || null,
    }

    const { data: existing, error: existingError } = await client
      .from('is_updates')
      .select('id')
      .eq('lead_id', leadRow.id)
      .limit(1)
      .maybeSingle()
    if (existingError) throw existingError

    if (existing?.id) {
      const { error } = await client.from('is_updates').update(payload).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await client.from('is_updates').insert(payload)
      if (error) throw error
    }

    if (qualified) {
      await insertNotification(
        'Qualified lead assigned to Scheduling Team',
        `${leadRow.lead_name} is qualified by ${sessionUser.name} and ready for scheduling.`,
        'scheduling',
        'info',
      )
    }

    return loadDataset()
  },
  async scheduleMeeting(input) {
    const client = requireSupabase()
    const leadRow = await findLeadRowByCode(input.leadId)
    const schedulingOwnerId = await findDefaultUserRowIdByRole('scheduling')

    const { error: leadError } = await client
      .from('lead_master')
      .update({
        current_stage: 'Meeting Scheduled',
        scheduling_owner_id: schedulingOwnerId ?? null,
        last_updated_at: new Date().toISOString(),
      })
      .eq('id', leadRow.id)
    if (leadError) throw leadError

    const payload = {
      lead_id: leadRow.id,
      assigned_os: input.assignedOs,
      meeting_date: input.date,
      meeting_time: input.time,
      meeting_mode: input.mode,
      status: 'Meeting Scheduled',
      meeting_notes: input.notes,
    }

    const { data: existing, error: existingError } = await client
      .from('meeting_master')
      .select('id')
      .eq('lead_id', leadRow.id)
      .limit(1)
      .maybeSingle()
    if (existingError) throw existingError

    if (existing?.id) {
      const { error } = await client.from('meeting_master').update(payload).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await client.from('meeting_master').insert(payload)
      if (error) throw error
    }

    await insertNotification(
      'Meeting assigned to OS',
      `${leadRow.lead_name} is scheduled with ${input.assignedOs} on ${input.date} at ${input.time}.`,
      'all',
      'info',
    )

    return loadDataset()
  },
  async createCp(input, sessionUser) {
    const client = requireSupabase()
    const owner = await client
      .from('user_master')
      .select('id')
      .eq('full_name', sessionUser.name)
      .limit(1)
      .maybeSingle()
    if (owner.error) throw owner.error

    const cpCode = generateCode('CP')
    const linkedUserId = await findUserRowIdByFullName(input.cpName)
    const { data: cpInsert, error: cpError } = await client
      .from('cp_master')
      .insert({
        cp_code: cpCode,
        cp_name: input.cpName,
        linked_user_id: linkedUserId ?? null,
        company_name: input.companyName,
        city: input.city,
        pincode: input.pincode,
        phone: input.phone,
        primary_scope: input.primaryScope,
        tier: input.tier,
        spoc_name: sessionUser.name,
        vm_owner_id: owner.data?.id ?? null,
        total_portfolio_value_cr: input.portfolioValueCr,
        remarks: input.remarks,
      })
      .select('id')
      .single()
    if (cpError) throw cpError

    const { error: agreementError } = await client.from('agreement_master').insert({
      cp_id: cpInsert.id,
      agreement_sent_date: todayIso(),
      agreement_status: 'Pending',
      spotdraft_link_status: 'Sent',
      vm_owner_id: owner.data?.id ?? null,
    })
    if (agreementError) throw agreementError

    await insertNotification(
      'Agreement sent notification to contractor',
      `${input.cpName} has been added by ${sessionUser.name} and agreement has been initiated.`,
      'vm',
      'info',
    )

    return loadDataset()
  },
  async updateAgreement(input, sessionUser) {
    const client = requireSupabase()
    const cpRowId = await findCpRowIdByCode(input.contractorId)
    const { error } = await client
      .from('agreement_master')
      .update({
        agreement_status: input.status,
        signed_date: input.status === 'Done' ? todayIso() : null,
        spotdraft_link_status: input.status === 'Done' ? 'Completed' : 'Viewed',
      })
      .eq('cp_id', cpRowId)
    if (error) throw error

    await insertNotification(
      'Agreement status updated',
      `${input.contractorId} agreement is now ${input.status} by ${sessionUser.name}.`,
      'admin',
      input.status === 'Done' ? 'info' : 'warn',
    )

    return loadDataset()
  },
  async updateCommercialStage(input: CommercialStageInput, sessionUser) {
    const client = requireSupabase()
    const leadRow = await findLeadRowByCode(input.leadId)

    const nextBaStatus =
      input.stage === 'BA Collected'
        ? 'Collected'
        : input.stage === 'BA Pending'
          ? 'Pending'
          : null

    const { error: leadError } = await client
      .from('lead_master')
      .update({
        current_stage: input.stage,
        ba_status: nextBaStatus,
        last_updated_at: new Date().toISOString(),
      })
      .eq('id', leadRow.id)
    if (leadError) throw leadError

    if (input.stage === 'BA Collected') {
      const { data: leadData, error: leadDataError } = await client
        .from('lead_master')
        .select('cp_id, selected_model, approximate_project_value_cr, proposal_value_cr, final_project_value_cr')
        .eq('id', leadRow.id)
        .single()
      if (leadDataError) throw leadDataError

      if (leadData.selected_model === 'Direct Incentive') {
        const syntheticLead: Lead = {
          id: input.leadId,
          name: leadRow.lead_name,
          phone: '',
          city: '',
          projectType: '',
          selectedModel: leadData.selected_model,
          projectValueCr: Number(leadData.approximate_project_value_cr ?? 0),
          proposalValueCr: leadData.proposal_value_cr ? Number(leadData.proposal_value_cr) : undefined,
          finalProjectValueCr: leadData.final_project_value_cr ? Number(leadData.final_project_value_cr) : undefined,
          currentStage: input.stage,
          temperature: 'Warm',
          bucket: 'Won Leads',
          cpId: leadData.cp_id,
          cpName: '',
          isOwner: '',
          submittedAt: '',
          lastUpdatedAt: '',
          nextAction: '',
          baStatus: 'Collected',
          requirementSummary: '',
        }

        const incentive = buildSupabaseIncentivePayload(syntheticLead)

        const { data: existing, error: existingError } = await client
          .from('incentive_master')
          .select('id')
          .eq('lead_id', leadRow.id)
          .limit(1)
          .maybeSingle()
        if (existingError) throw existingError

        const payload = {
          lead_id: leadRow.id,
          cp_id: leadData.cp_id,
          selected_model: leadData.selected_model,
          project_value_cr: incentive.projectValueCr,
          incentive_percent: incentive.incentivePercent,
          incentive_amount: incentive.incentiveAmount,
          payment_status: 'Pending',
          payment_date: incentive.paymentDate,
        }

        if (existing?.id) {
          const { error } = await client.from('incentive_master').update(payload).eq('id', existing.id)
          if (error) throw error
        } else {
          const { error } = await client.from('incentive_master').insert(payload)
          if (error) throw error
        }
      }
    }

    await insertNotification(
      input.stage === 'BA Collected'
        ? 'BA collected notification to CP'
        : 'Lead commercial stage updated',
      `${leadRow.lead_name} moved to ${input.stage} by ${sessionUser.name}.`,
      input.stage === 'BA Collected' ? 'cp' : 'admin',
      'info',
    )

    return loadDataset()
  },
  async updateCommercialValues(input: CommercialValuesInput, sessionUser) {
    const client = requireSupabase()
    const leadRow = await findLeadRowByCode(input.leadId)

    const { error } = await client
      .from('lead_master')
      .update({
        proposal_value_cr: input.proposalValueCr ?? null,
        final_project_value_cr: input.finalProjectValueCr ?? null,
        last_updated_at: new Date().toISOString(),
      })
      .eq('id', leadRow.id)
    if (error) throw error

    await insertNotification(
      'Commercial values updated',
      `${leadRow.lead_name} proposal/final values were updated by ${sessionUser.name}.`,
      'admin',
      'info',
    )

    return loadDataset()
  },
  async updateIncentivePayment(input: IncentivePaymentInput, sessionUser) {
    const client = requireSupabase()
    const paymentDate =
      input.paymentStatus === 'Released'
        ? input.paymentDate ?? todayIso()
        : input.paymentDate ?? null

    const { error } = await client
      .from('incentive_master')
      .update({
        payment_status: input.paymentStatus,
        payment_date: paymentDate,
      })
      .eq('id', input.incentiveId)
    if (error) throw error

    await insertNotification(
      'Incentive payout notification to CP',
      `Incentive ${input.incentiveId} is now ${input.paymentStatus} by ${sessionUser.name}.`,
      'cp',
      'info',
    )

    return loadDataset()
  },
  async upsertSharedConstructionProject(input: SharedConstructionInput, sessionUser) {
    const client = requireSupabase()
    const leadRow = await findLeadRowByCode(input.leadId)
    const { data: leadData, error: leadDataError } = await client
      .from('lead_master')
      .select('cp_id, lead_name, final_project_value_cr, proposal_value_cr, approximate_project_value_cr, selected_model')
      .eq('id', leadRow.id)
      .single()
    if (leadDataError) throw leadDataError
    if (leadData.selected_model !== 'Shared Construction') {
      throw new Error('This flow only applies to Shared Construction leads.')
    }

    const projectValueCr =
      Number(leadData.final_project_value_cr ?? leadData.proposal_value_cr ?? leadData.approximate_project_value_cr ?? 0)
    const status = `${input.executionStatus} • ${input.allocationPercent}% allocation`

    const { data: existing, error: existingError } = await client
      .from('project_master')
      .select('id')
      .eq('lead_id', leadRow.id)
      .eq('partnership_model', 'Shared Construction')
      .limit(1)
      .maybeSingle()
    if (existingError) throw existingError

    const payload = {
      cp_id: leadData.cp_id,
      lead_id: leadRow.id,
      project_name: leadData.lead_name,
      project_value_cr: projectValueCr,
      status,
      partnership_model: 'Shared Construction',
    }

    if (existing?.id) {
      const { error } = await client.from('project_master').update(payload).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await client.from('project_master').insert(payload)
      if (error) throw error
    }

    await insertNotification(
      'Shared construction project activated',
      `${leadData.lead_name} shared-construction flow updated by ${sessionUser.name}.`,
      'admin',
      'info',
    )

    await insertNotification(
      'Shared construction scope allocated',
      `${leadData.lead_name} now has ${input.allocationPercent}% scope allocated.`,
      'cp',
      'info',
    )

    return loadDataset()
  },
  async upsertBarterMatch(input: BarterMatchInput, sessionUser) {
    const client = requireSupabase()
    const leadRow = await findLeadRowByCode(input.leadId)
    const { data: leadData, error: leadDataError } = await client
      .from('lead_master')
      .select('cp_id, lead_name, final_project_value_cr, proposal_value_cr, approximate_project_value_cr, selected_model')
      .eq('id', leadRow.id)
      .single()
    if (leadDataError) throw leadDataError
    if (leadData.selected_model !== 'Barter / Exchange') {
      throw new Error('This flow only applies to Barter / Exchange leads.')
    }

    const projectValueCr =
      Number(leadData.final_project_value_cr ?? leadData.proposal_value_cr ?? leadData.approximate_project_value_cr ?? 0)
    const status = `${input.matchStatus} • expected ${input.expectedTimelineDays} days • ${input.notes}`

    const { data: existing, error: existingError } = await client
      .from('project_master')
      .select('id')
      .eq('lead_id', leadRow.id)
      .eq('partnership_model', 'Barter / Exchange')
      .limit(1)
      .maybeSingle()
    if (existingError) throw existingError

    const payload = {
      cp_id: leadData.cp_id,
      lead_id: leadRow.id,
      project_name: leadData.lead_name,
      project_value_cr: projectValueCr,
      status,
      partnership_model: 'Barter / Exchange',
    }

    if (existing?.id) {
      const { error } = await client.from('project_master').update(payload).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await client.from('project_master').insert(payload)
      if (error) throw error
    }

    await insertNotification(
      'Barter matching flow activated',
      `${leadData.lead_name} barter workflow updated by ${sessionUser.name}.`,
      'admin',
      'info',
    )

    await insertNotification(
      'Project matching update',
      `${leadData.lead_name} matching status is now ${input.matchStatus}.`,
      'cp',
      'info',
    )

    return loadDataset()
  },
}
