export type Role = 'cp' | 'is' | 'scheduling' | 'vm' | 'admin'

export const NOT_PROCEEDING_REASONS = [
  'Area is outside my operating zone',
  'I do not work in this city / pincode',
  'Project value is too low',
  'Margin is too low',
  'Commission % is not attractive',
  'This project is outside my expertise / scope'
] as const;

export type NotProceedingReason = typeof NOT_PROCEEDING_REASONS[number];

export type PartnershipModel =
  | 'Direct Incentive'
  | 'Shared Construction'
  | 'Barter / Exchange'
  | 'Financial Assistance Model'

export type LeadTemperature = 'Hot' | 'Warm' | 'Pre-Cold' | 'Cold'

export type LeadStage =
  | 'Lead Shared'
  | 'Qualified'
  | 'Meeting Scheduled'
  | 'Meeting Done'
  | 'Proposal Shared'
  | 'GMV Discussion'
  | 'BA Pending'
  | 'BA Collected'
  | 'Rejected'
  | 'Inactive'
  | 'RNR'
  | 'Callback Later'

export type LeadBucket = 'Active Leads' | 'Inactive Leads' | 'Won Leads' | 'Rejected Leads'

export type CallStatus =
  | 'Connected'
  | 'Callback Later'
  | 'No Incoming'
  | 'No Response'
  | 'RNR1'
  | 'RNR2'
  | 'RNR3'
  | 'RNR4'
  | 'RNR5'

export type InterestStatus = 'Interested' | 'Non-Interested'

export type SchedulingStatus =
  | 'Pending Scheduling'
  | 'Meeting Date Selection Pending'
  | 'OS Selection Pending'
  | 'Meeting Scheduled'
  | 'Reschedule Requested'
  | 'Rescheduled'
  | 'Meeting Completed'
  | 'Cancelled'
  | 'No Show'

export type MeetingMode = 'Site Visit' | 'Office Visit' | 'Video Call' | 'Phone Call'

export type VmMeetingStatus =
  | 'Meeting Pending'
  | 'Meeting Scheduled'
  | 'Meeting Done'
  | 'Not Interested'

export type AgreementStatus = 'Pending' | 'Done'

export type PaymentStatus = 'Pending' | 'Released'

export type Kpi = {
  label: string
  value: string
  trend?: string
  tone?: 'default' | 'good' | 'warn'
}

export type UserProfile = {
  id: string
  fullName: string
  email: string
  role: Role
  city: string
  phone: string
  spoc?: string
}

export type ContractorPartner = {
  id: string
  code: string
  name: string
  companyName: string
  city: string
  activeSince: string
  primaryScope: string
  phone: string
  spoc: string
  vmOwner: string
  vmOwnerId?: string          // user_master.id of the assigned VM (for per-VM portfolio filtering)
  tier: string
  activeProjects: number
  completedProjects: number
  heldProjects: number
  totalProjectValueCr: number
  totalAssignedProjects: number
  averageCsat: number
  averageDelayDays: number
  bmsPriority: 'High' | 'Medium' | 'Low'
  eligibleForProject: boolean
  initProjectCount: number
  leadsReceived: number
  email?: string
  userType?: string
  lowestPercentageCompleted?: number
  linkedUserId?: string
  // Persisted Onboarding Data (Dedicated Table/Fields)
  onboardingVmName?: string
  onboardingCallStatus?: string
  onboardingMeetingStatus?: string
  onboardingMeetingScheduledDate?: string
  onboardingAlignedForActivation?: 'Yes' | 'No'
  onboardingModeOfMeeting?: 'Online' | 'Offline'
  onboardingCpReadyForSigning?: 'Yes' | 'No'
  onboardingAgreementSentStatus?: 'Pending' | 'Sent' | 'Signed' | 'Done'
  onboardingCpSignedStatus?: 'Pending' | 'Sent' | 'Signed' | 'Done'
  onboardingSignedAgreementUrl?: string
}

export type Lead = {
  id: string
  name: string
  phone: string
  city: string
  projectType: string
  selectedModel: PartnershipModel
  projectValueCr: number
  proposalValueCr?: number
  finalProjectValueCr?: number
  currentStage: LeadStage
  temperature: LeadTemperature
  bucket: LeadBucket
  cpId: string
  cpName: string
  cpEmail?: string
  cpPhone?: string
  isOwner: string
  schedulingOwner?: string
  assignedOs?: string
  submittedAt: string
  lastUpdatedAt: string
  meetingAt?: string
  nextAction: string
  crnNumber?: string
  baStatus: 'Pending' | 'Collected' | 'Rejected'
  requirementSummary: string
  customerPreferredSlot?: string
  preferredLanguage?: string
  expectedTimeline?: string
  budgetRange?: string
  comment?: string
  reasonForNotProceeding?: string
}

export type IsUpdate = {
  leadId: string
  status: CallStatus
  interestStatus?: InterestStatus
  reason?: string
  detailedComment?: string
  expectedConcern?: string
  nextPossibleAction?: string
  nextFollowUpDate?: string
  comment?: string
}

export type Meeting = {
  id: string
  leadId: string
  assignedOs: string
  date: string
  time: string
  mode: MeetingMode
  status: SchedulingStatus
  notes: string
  rescheduleReason?: string
}

export type Incentive = {
  id: string
  leadId: string
  cpId: string
  leadName: string
  cpName: string
  selectedModel: PartnershipModel
  projectValueCr: number
  incentivePercent: number
  incentiveAmountLakh: number
  paymentStatus: PaymentStatus
  paymentDate?: string
  pendingDays: number
}

export type Agreement = {
  id: string
  contractorId: string
  cpName: string
  cpEmail?: string
  sentDate: string
  status: 'Pending' | 'Sent' | 'Signed' | 'Done'
  signedDate?: string
  signerName?: string
  signerEmail?: string
  signedContent?: string
  spotdraftStatus: 'Ready' | 'Sent' | 'Viewed' | 'Completed'
  vmOwner: string
  // New onboarding fields
  callStatus?: string
  meetingStatus?: string
  meetingScheduledDate?: string
  alignedForActivation?: 'Yes' | 'No'
  modeOfMeeting?: 'Online' | 'Offline'
  readyForSigning?: 'Yes' | 'No'
}

export type Notification = {
  id: string
  title: string
  detail: string
  audience: Role | 'all'
  severity: 'info' | 'warn' | 'critical'
  createdAt: string
}

export type SharedConstructionProject = {
  id: string
  leadId: string
  cpId: string
  leadName: string
  cpName: string
  allocationPercent: number
  executionStatus: 'Planning' | 'Mobilization' | 'Execution' | 'Completed'
  projectedProfitLakh: number
  createdAt: string
}

export type BarterProjectMatch = {
  id: string
  leadId: string
  cpId: string
  leadName: string
  cpName: string
  matchStatus: 'Match Pending' | 'Matching' | 'Matched'
  expectedTimelineDays: number
  notes: string
  createdAt: string
}

export type VmUpdate = {
  id: string
  cpId: string
  vmOwner?: string
  callStatus?: string
  meetingStatus?: string
  meetingScheduledDate?: string
  alignedForActivation?: 'Yes' | 'No'
  modeOfMeeting?: 'Online' | 'Offline'
  readyForSigning?: 'Yes' | 'No'
  agreementSigningStatus: 'Pending' | 'Signed' | 'Done'
  leadsReceived: number
  remarks?: string
  createdAt: string
}

export type CPOnboardingUpdateInput = {
  cpId: string
  field: string
  value: any
}

export type AppDataset = {
  users: UserProfile[]
  cps: ContractorPartner[]
  leads: Lead[]
  isUpdates: IsUpdate[]
  meetings: Meeting[]
  incentives: Incentive[]
  sharedConstructionProjects: SharedConstructionProject[]
  barterProjectMatches: BarterProjectMatch[]
  agreements: Agreement[]
  vmUpdates: VmUpdate[]
  notifications: Notification[]
}

export type LeadSubmissionInput = {
  name: string
  phone: string
  city: string
  projectType: string
  projectValueCr: number
  selectedModel: PartnershipModel
  notes: string
  requirementSummary?: string
  reasonForNotProceeding?: string
}

export type IsDispositionInput = {
  leadId: string
  callStatus: CallStatus
  interestStatus?: InterestStatus
  temperature?: LeadTemperature
  reason?: string
  detailedComment?: string
  expectedConcern?: string
  nextPossibleAction?: string
  expectedTimeline?: string
  budgetRange?: string
  expectedProjectValueCr?: number
  requirementSummary?: string
  comment?: string
  nextFollowUpDate?: string
  qualifyLead: boolean
}

export type ScheduleMeetingInput = {
  leadId: string
  assignedOs: string
  date: string
  time: string
  mode: MeetingMode
  notes: string
  rescheduleReason?: string
}

export type NewCpInput = {
  contractorId?: string
  cpName: string
  companyName?: string
  email: string
  phone: string
  city: string
  pincode?: string
  userType?: string
  totalCrn?: number
  runningCrn?: number
  totalProjectValue?: number
  lowestPercentageCompleted?: number
  primaryScope?: string
  tier?: string
  bmsPriority?: string
  remarks?: string
}

export type AgreementUpdateInput = {
  id?: string // The agreement ID
  contractorId: string
  status?: 'Pending' | 'Sent' | 'Signed' | 'Done'
  signedDate?: string
  signerName?: string
  signerEmail?: string
  signedContent?: string
  // Onboarding workflow update
  vmOwner?: string
  callStatus?: string
  meetingStatus?: string
  meetingScheduledDate?: string
  alignedForActivation?: 'Yes' | 'No'
  modeOfMeeting?: 'Online' | 'Offline'
  readyForSigning?: 'Yes' | 'No'
}

export type CommercialStageInput = {
  leadId: string
  stage: Extract<
    LeadStage,
    'Proposal Shared' | 'GMV Discussion' | 'BA Pending' | 'BA Collected'
  >
}

export type CommercialValuesInput = {
  leadId: string
  proposalValueCr?: number
  finalProjectValueCr?: number
}

export type IncentivePaymentInput = {
  incentiveId: string
  paymentStatus: PaymentStatus
  paymentDate?: string
}

export type VmLeadInput = LeadSubmissionInput & {
  cpId: string
}

export type SharedConstructionInput = {
  leadId: string
  allocationPercent: number
  executionStatus: SharedConstructionProject['executionStatus']
  projectedProfitLakh: number
}

export type BarterMatchInput = {
  leadId: string
  matchStatus: BarterProjectMatch['matchStatus']
  expectedTimelineDays: number
  notes: string
}
