import type {
  AppDataset,
  BarterMatchInput,
  BarterProjectMatch,
  CommercialStageInput,
  CommercialValuesInput,
  IncentivePaymentInput,
  Incentive,
  Lead,
  PartnershipModel,
  SharedConstructionInput,
  SharedConstructionProject,
} from '../types/domain'
import type { SessionUser } from '../lib/supabase'
import { createNotification, generateCode, nowIso, todayIso } from './repository-utils'

function getIncentivePercent(projectValueCr: number) {
  if (projectValueCr < 5) return 2
  if (projectValueCr <= 10) return 2.5
  return 3
}

function shouldCreateIncentive(model: PartnershipModel, stage: CommercialStageInput['stage']) {
  return model === 'Direct Incentive' && stage === 'BA Collected'
}

function deriveBucket(stage: CommercialStageInput['stage']): Lead['bucket'] {
  return stage === 'BA Collected' ? 'Won Leads' : 'Active Leads'
}

export function applyCommercialStageUpdate(
  dataset: AppDataset,
  input: CommercialStageInput,
  sessionUser: SessionUser,
) {
  const lead = dataset.leads.find((item) => item.id === input.leadId)
  if (!lead) return dataset

  const updatedLeads = dataset.leads.map((item) =>
    item.id === input.leadId
      ? {
          ...item,
          currentStage: input.stage,
          baStatus:
            input.stage === 'BA Collected'
              ? 'Collected'
              : input.stage === 'BA Pending'
                ? 'Pending'
                : item.baStatus,
          bucket: deriveBucket(input.stage),
          lastUpdatedAt: nowIso(),
          nextAction:
            input.stage === 'Proposal Shared'
              ? 'Review proposal with customer'
              : input.stage === 'GMV Discussion'
                ? 'Negotiate commercials and final scope'
                : input.stage === 'BA Pending'
                  ? 'Collect BA to close the lead'
                  : 'Release payout or activate next model workflow',
        }
      : item,
  )

  let incentives = dataset.incentives
  if (shouldCreateIncentive(lead.selectedModel, input.stage)) {
    const existing = dataset.incentives.find((item) => item.leadId === lead.id)
    const projectValueCr = lead.finalProjectValueCr ?? lead.proposalValueCr ?? lead.projectValueCr
    const incentivePercent = getIncentivePercent(projectValueCr)
    const incentiveAmountLakh = (projectValueCr * 100 * incentivePercent) / 100

    const record: Incentive = {
      id: existing?.id ?? generateCode('INC'),
      leadId: lead.id,
      cpId: lead.cpId,
      leadName: lead.name,
      cpName: lead.cpName,
      selectedModel: lead.selectedModel,
      projectValueCr,
      incentivePercent,
      incentiveAmountLakh,
      paymentStatus: existing?.paymentStatus ?? 'Pending',
      paymentDate: existing?.paymentDate,
      pendingDays: existing?.pendingDays ?? 0,
    }

    incentives = existing
      ? dataset.incentives.map((item) => (item.leadId === lead.id ? record : item))
      : [record, ...dataset.incentives]
  }

  return {
    ...dataset,
    leads: updatedLeads,
    incentives,
    notifications: [
      createNotification(
        input.stage === 'BA Collected'
          ? 'BA collected notification to CP'
          : 'Lead commercial stage updated',
        `${lead.name} moved to ${input.stage} by ${sessionUser.name}.`,
        input.stage === 'BA Collected' ? 'cp' : 'admin',
        'info',
      ),
      ...dataset.notifications,
    ],
  }
}

export function buildSupabaseIncentivePayload(lead: Lead) {
  const projectValueCr = lead.finalProjectValueCr ?? lead.proposalValueCr ?? lead.projectValueCr
  const incentivePercent = getIncentivePercent(projectValueCr)
  const incentiveAmount = projectValueCr * 100 * (incentivePercent / 100)

  return {
    projectValueCr,
    incentivePercent,
    incentiveAmount,
    paymentDate: todayIso(),
  }
}

export function applyCommercialValuesUpdate(
  dataset: AppDataset,
  input: CommercialValuesInput,
  sessionUser: SessionUser,
) {
  const lead = dataset.leads.find((item) => item.id === input.leadId)
  if (!lead) return dataset

  const proposalValueCr = input.proposalValueCr ?? lead.proposalValueCr
  const finalProjectValueCr = input.finalProjectValueCr ?? lead.finalProjectValueCr

  return {
    ...dataset,
    leads: dataset.leads.map((item) =>
      item.id === input.leadId
        ? {
            ...item,
            proposalValueCr,
            finalProjectValueCr,
            lastUpdatedAt: nowIso(),
          }
        : item,
    ),
    incentives: dataset.incentives.map((item) => {
      if (item.leadId !== input.leadId) return item

      const projectValueCr = finalProjectValueCr ?? proposalValueCr ?? item.projectValueCr
      const incentivePercent =
        item.selectedModel === 'Direct Incentive'
          ? getIncentivePercent(projectValueCr)
          : item.incentivePercent

      return {
        ...item,
        projectValueCr,
        incentivePercent,
        incentiveAmountLakh: (projectValueCr * 100 * incentivePercent) / 100,
      }
    }),
    notifications: [
      createNotification(
        'Commercial values updated',
        `${lead.name} proposal/final values were updated by ${sessionUser.name}.`,
        'admin',
        'info',
      ),
      ...dataset.notifications,
    ],
  }
}

export function applyIncentivePaymentUpdate(
  dataset: AppDataset,
  input: IncentivePaymentInput,
  sessionUser: SessionUser,
) {
  const incentive = dataset.incentives.find((item) => item.id === input.incentiveId)
  if (!incentive) return dataset

  const paymentDate =
    input.paymentStatus === 'Released'
      ? input.paymentDate ?? todayIso()
      : input.paymentDate

  return {
    ...dataset,
    incentives: dataset.incentives.map((item) =>
      item.id === input.incentiveId
        ? {
            ...item,
            paymentStatus: input.paymentStatus,
            paymentDate,
            pendingDays: input.paymentStatus === 'Released' ? 0 : item.pendingDays,
          }
        : item,
    ),
    notifications: [
      createNotification(
        'Incentive payout notification to CP',
        `${incentive.leadName} incentive is now ${input.paymentStatus} by ${sessionUser.name}.`,
        'cp',
        'info',
      ),
      ...dataset.notifications,
    ],
  }
}

export function applySharedConstructionProject(
  dataset: AppDataset,
  input: SharedConstructionInput,
  sessionUser: SessionUser,
) {
  const lead = dataset.leads.find((item) => item.id === input.leadId)
  if (!lead || lead.selectedModel !== 'Shared Construction') return dataset

  const existing = dataset.sharedConstructionProjects.find((item) => item.leadId === input.leadId)
  const record: SharedConstructionProject = {
    id: existing?.id ?? generateCode('SCP'),
    leadId: lead.id,
    cpId: lead.cpId,
    leadName: lead.name,
    cpName: lead.cpName,
    allocationPercent: input.allocationPercent,
    executionStatus: input.executionStatus,
    projectedProfitLakh: input.projectedProfitLakh,
    createdAt: existing?.createdAt ?? nowIso(),
  }

  return {
    ...dataset,
    sharedConstructionProjects: existing
      ? dataset.sharedConstructionProjects.map((item) => (item.leadId === input.leadId ? record : item))
      : [record, ...dataset.sharedConstructionProjects],
    notifications: [
      createNotification(
        'Shared construction project activated',
        `${lead.name} shared-construction flow updated by ${sessionUser.name}.`,
        'admin',
        'info',
      ),
      createNotification(
        'Shared construction scope allocated',
        `${lead.name} now has ${input.allocationPercent}% scope allocated.`,
        'cp',
        'info',
      ),
      ...dataset.notifications,
    ],
  }
}

export function applyBarterMatch(
  dataset: AppDataset,
  input: BarterMatchInput,
  sessionUser: SessionUser,
) {
  const lead = dataset.leads.find((item) => item.id === input.leadId)
  if (!lead || lead.selectedModel !== 'Barter / Exchange') return dataset

  const existing = dataset.barterProjectMatches.find((item) => item.leadId === input.leadId)
  const record: BarterProjectMatch = {
    id: existing?.id ?? generateCode('BTM'),
    leadId: lead.id,
    cpId: lead.cpId,
    leadName: lead.name,
    cpName: lead.cpName,
    matchStatus: input.matchStatus,
    expectedTimelineDays: input.expectedTimelineDays,
    notes: input.notes,
    createdAt: existing?.createdAt ?? nowIso(),
  }

  return {
    ...dataset,
    barterProjectMatches: existing
      ? dataset.barterProjectMatches.map((item) => (item.leadId === input.leadId ? record : item))
      : [record, ...dataset.barterProjectMatches],
    notifications: [
      createNotification(
        'Barter matching flow activated',
        `${lead.name} barter workflow updated by ${sessionUser.name}.`,
        'admin',
        'info',
      ),
      createNotification(
        'Project matching update',
        `${lead.name} matching status is now ${input.matchStatus}.`,
        'cp',
        'info',
      ),
      ...dataset.notifications,
    ],
  }
}
