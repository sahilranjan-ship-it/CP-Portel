import type { SessionUser } from '../lib/supabase'
import type {
  AgreementUpdateInput,
  AppDataset,
  CommercialStageInput,
  CommercialValuesInput,
  IncentivePaymentInput,
  IsDispositionInput,
  LeadSubmissionInput,
  NewCpInput,
  ScheduleMeetingInput,
  BarterMatchInput,
  SharedConstructionInput,
  VmLeadInput,
  CPOnboardingUpdateInput,
} from '../types/domain'

export interface AppRepository {
  loadDataset(): Promise<AppDataset>
  submitLead(input: LeadSubmissionInput, sessionUser: SessionUser): Promise<AppDataset>
  updateIsDisposition(input: IsDispositionInput, sessionUser: SessionUser): Promise<AppDataset>
  scheduleMeeting(input: ScheduleMeetingInput, sessionUser: SessionUser): Promise<AppDataset>
  createCp(input: NewCpInput, sessionUser: SessionUser): Promise<AppDataset>
  updateCp(id: string, input: NewCpInput, sessionUser: SessionUser): Promise<AppDataset>
  createVmLead(input: VmLeadInput, sessionUser: SessionUser): Promise<AppDataset>
  updateAgreement(input: AgreementUpdateInput, sessionUser: SessionUser): Promise<AppDataset>
  updateCommercialStage(input: CommercialStageInput, sessionUser: SessionUser): Promise<AppDataset>
  updateCommercialValues(input: CommercialValuesInput, sessionUser: SessionUser): Promise<AppDataset>
  updateIncentivePayment(input: IncentivePaymentInput, sessionUser: SessionUser): Promise<AppDataset>
  updateCpOnboarding(input: CPOnboardingUpdateInput, sessionUser: SessionUser): Promise<AppDataset>
  upsertSharedConstructionProject(input: SharedConstructionInput, sessionUser: SessionUser): Promise<AppDataset>
  upsertBarterMatch(input: BarterMatchInput, sessionUser: SessionUser): Promise<AppDataset>
  bulkCreateCp(rows: any[], sessionUser: SessionUser): Promise<AppDataset & { importReport: any }>
}
