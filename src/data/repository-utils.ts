import type { SessionUser } from '../lib/supabase'
import type {
  Agreement,
  AgreementUpdateInput,
  AppDataset,
  ContractorPartner,
  IsDispositionInput,
  Lead,
  LeadStage,
  LeadSubmissionInput,
  NewCpInput,
  Notification,
  ScheduleMeetingInput,
  VmLeadInput,
} from '../types/domain'

export function generateCode(prefix: string) {
  return `${prefix}-${Math.floor(Math.random() * 9000 + 1000)}`
}

export function nowIso() {
  return new Date().toISOString()
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function createNotification(
  title: string,
  detail: string,
  audience: Notification['audience'],
  severity: Notification['severity'],
): Notification {
  return {
    id: crypto.randomUUID(),
    title,
    detail,
    audience,
    severity,
    createdAt: nowIso(),
  }
}

export function applyLeadSubmission(
  dataset: AppDataset,
  input: LeadSubmissionInput,
  sessionUser: SessionUser,
) {
  const cp =
    dataset.cps.find((item) => item.name === sessionUser.name) ??
    dataset.cps[0]
  const defaultIsOwner =
    dataset.users.find((item) => item.role === 'is')?.fullName ?? 'Unassigned'

  const newLead: Lead = {
    id: generateCode('LD'),
    name: input.name,
    phone: input.phone,
    city: input.city,
    projectType: input.projectType,
    selectedModel: input.selectedModel,
    projectValueCr: input.projectValueCr,
    currentStage: 'Lead Shared',
    temperature: 'Warm',
    bucket: 'Active Leads',
    cpId: cp.id,
    cpName: cp.name,
    isOwner: defaultIsOwner,
    submittedAt: nowIso(),
    lastUpdatedAt: nowIso(),
    nextAction: 'Assign to IS within 30 minutes',
    baStatus: 'Pending',
    requirementSummary: input.notes || 'Submitted by CP',
    comment: input.notes,
  }

  return {
    ...dataset,
    leads: [newLead, ...dataset.leads],
    notifications: [
      createNotification(
        'New lead assigned to IS',
        `${input.name} from ${input.city} was submitted by ${cp.name}.`,
        'is',
        'info',
      ),
      ...dataset.notifications,
    ],
  }
}

export function applyVmLeadCreation(
  dataset: AppDataset,
  input: VmLeadInput,
  sessionUser: SessionUser,
) {
  const cp = dataset.cps.find((item) => item.id === input.cpId) ?? dataset.cps[0]
  const defaultIsOwner =
    dataset.users.find((item) => item.role === 'is')?.fullName ?? 'Unassigned'

  const newLead: Lead = {
    id: generateCode('LD'),
    name: input.name,
    phone: input.phone,
    city: input.city,
    projectType: input.projectType,
    selectedModel: input.selectedModel,
    projectValueCr: input.projectValueCr,
    currentStage: 'Lead Shared',
    temperature: 'Warm',
    bucket: 'Active Leads',
    cpId: cp.id,
    cpName: cp.name,
    isOwner: defaultIsOwner,
    submittedAt: nowIso(),
    lastUpdatedAt: nowIso(),
    nextAction: 'Assign to IS within 30 minutes',
    baStatus: 'Pending',
    requirementSummary: input.notes || 'Created by VM team',
    comment: input.notes,
  }

  return {
    ...dataset,
    leads: [newLead, ...dataset.leads],
    notifications: [
      createNotification(
        'Referral captured by VM',
        `${input.name} was created for ${cp.name} by ${sessionUser.name}.`,
        'vm',
        'info',
      ),
      createNotification(
        'New lead assigned to IS',
        `${input.name} from ${input.city} is ready for qualification.`,
        'is',
        'info',
      ),
      ...dataset.notifications,
    ],
  }
}

export function applyIsDisposition(
  dataset: AppDataset,
  input: IsDispositionInput,
  sessionUser: SessionUser,
) {
  const lead = dataset.leads.find((item) => item.id === input.leadId)
  if (!lead) return dataset

  const qualified = input.qualifyLead && input.interestStatus === 'Interested'
  const stage: LeadStage = qualified
    ? 'Qualified'
    : input.interestStatus === 'Non-Interested'
      ? 'Non-Interested'
      : 'Calling Attempt'

  const crnNumber = qualified ? lead.crnNumber ?? generateCode('CRN') : lead.crnNumber
  const nextAction = qualified
    ? 'Send to Scheduling Team'
    : input.interestStatus === 'Non-Interested'
      ? 'Nurture or close lead'
      : 'Follow-up as per customer request'

  const updatedLeads = dataset.leads.map((item) =>
    item.id === input.leadId
      ? {
          ...item,
          isOwner: sessionUser.name,
          currentStage: stage,
          temperature: input.temperature,
          crnNumber,
          lastUpdatedAt: nowIso(),
          nextAction,
          bucket: input.interestStatus === 'Non-Interested' ? 'Rejected Leads' : item.bucket,
        }
      : item,
  )

  const existing = dataset.isUpdates.find((item) => item.leadId === input.leadId)
  const updatedIsUpdates = existing
    ? dataset.isUpdates.map((item) =>
        item.leadId === input.leadId
          ? {
              ...item,
              status: input.callStatus,
              interestStatus: input.interestStatus,
              comment: input.comment,
              nextFollowUpDate: input.nextFollowUpDate,
            }
          : item,
      )
    : [
        {
          leadId: input.leadId,
          status: input.callStatus,
          interestStatus: input.interestStatus,
          comment: input.comment,
          nextFollowUpDate: input.nextFollowUpDate,
        },
        ...dataset.isUpdates,
      ]

  const notifications = [...dataset.notifications]
  if (qualified) {
    notifications.unshift(
      createNotification(
        'Qualified lead assigned to Scheduling Team',
        `${lead.name} is qualified by ${sessionUser.name} and ready for scheduling.`,
        'scheduling',
        'info',
      ),
    )
  }

  return {
    ...dataset,
    leads: updatedLeads,
    isUpdates: updatedIsUpdates,
    notifications,
  }
}

export function applyMeetingSchedule(
  dataset: AppDataset,
  input: ScheduleMeetingInput,
  sessionUser: SessionUser,
) {
  const lead = dataset.leads.find((item) => item.id === input.leadId)
  if (!lead) return dataset
  const meetingStage: LeadStage = 'Meeting Scheduled'

  const updatedLeads = dataset.leads.map((item) =>
    item.id === input.leadId
      ? {
          ...item,
          schedulingOwner: sessionUser.name,
          assignedOs: input.assignedOs,
          meetingAt: `${input.date}T${input.time}:00+05:30`,
          currentStage: meetingStage,
          lastUpdatedAt: nowIso(),
          nextAction: 'Conduct meeting and update outcome',
        }
      : item,
  )

  const existingMeeting = dataset.meetings.find((item) => item.leadId === input.leadId)
  const meetingRecord = {
    id: existingMeeting?.id ?? generateCode('MT'),
    leadId: input.leadId,
    assignedOs: input.assignedOs,
    date: input.date,
    time: input.time,
    mode: input.mode,
    status: 'Meeting Scheduled' as const,
    notes: input.notes,
  }

  const meetings = existingMeeting
    ? dataset.meetings.map((item) => (item.leadId === input.leadId ? meetingRecord : item))
    : [meetingRecord, ...dataset.meetings]

  return {
    ...dataset,
    leads: updatedLeads,
    meetings,
    notifications: [
      createNotification(
        'Meeting assigned to OS',
        `${lead.name} is scheduled with ${input.assignedOs} on ${input.date} at ${input.time}.`,
        'all',
        'info',
      ),
      ...dataset.notifications,
    ],
  }
}

export function applyCreateCp(
  dataset: AppDataset,
  input: NewCpInput,
  sessionUser: SessionUser,
) {
  const newCp: ContractorPartner = {
    id: generateCode('CP'),
    name: input.cpName,
    companyName: input.companyName,
    city: input.city,
    activeSince: todayIso(),
    primaryScope: input.primaryScope,
    phone: input.phone,
    spoc: sessionUser.name,
    vmOwner: sessionUser.name,
    tier: input.tier,
    activeProjects: 0,
    completedProjects: 0,
    heldProjects: 0,
    totalProjectValueCr: input.portfolioValueCr,
    totalAssignedProjects: 0,
    averageCsat: 0,
    averageDelayDays: 0,
    bmsPriority: 'Medium',
    eligibleForProject: true,
    initProjectCount: 0,
    leadsReceived: 0,
  }

  const newAgreement: Agreement = {
    id: generateCode('AGR'),
    contractorId: newCp.id,
    cpName: input.cpName,
    sentDate: todayIso(),
    status: 'Pending',
    spotdraftStatus: 'Sent',
    vmOwner: sessionUser.name,
  }

  return {
    ...dataset,
    cps: [newCp, ...dataset.cps],
    agreements: [newAgreement, ...dataset.agreements],
    notifications: [
      createNotification(
        'Agreement sent notification to contractor',
        `${input.cpName} has been added by ${sessionUser.name} and agreement has been initiated.`,
        'vm',
        'info',
      ),
      ...dataset.notifications,
    ],
  }
}

export function applyAgreementUpdate(
  dataset: AppDataset,
  input: AgreementUpdateInput,
  sessionUser: SessionUser,
) {
  return {
    ...dataset,
    agreements: dataset.agreements.map((item) =>
      item.contractorId === input.contractorId
        ? {
            ...item,
            status: input.status,
            signedDate: input.status === 'Done' ? todayIso() : item.signedDate,
            spotdraftStatus: input.status === 'Done' ? 'Completed' : item.spotdraftStatus,
          }
        : item,
    ),
    notifications: [
      createNotification(
        'Agreement status updated',
        `${input.contractorId} agreement is now ${input.status} by ${sessionUser.name}.`,
        'admin',
        input.status === 'Done' ? 'info' : 'warn',
      ),
      ...dataset.notifications,
    ],
  }
}
