import { createContext, useContext } from 'react'
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
} from '../types/domain'
import type { SessionUser } from '../lib/supabase'

export type AppDataContextValue = {
  dataset: AppDataset
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
  submitLead: (input: LeadSubmissionInput, sessionUser: SessionUser) => Promise<void>
  createVmLead: (input: VmLeadInput, sessionUser: SessionUser) => Promise<void>
  updateIsDisposition: (input: IsDispositionInput, sessionUser: SessionUser) => Promise<void>
  scheduleMeeting: (input: ScheduleMeetingInput, sessionUser: SessionUser) => Promise<void>
  createCp: (input: NewCpInput, sessionUser: SessionUser) => Promise<void>
  updateAgreement: (input: AgreementUpdateInput, sessionUser: SessionUser) => Promise<void>
  updateCommercialStage: (input: CommercialStageInput, sessionUser: SessionUser) => Promise<void>
  updateCommercialValues: (input: CommercialValuesInput, sessionUser: SessionUser) => Promise<void>
  updateIncentivePayment: (input: IncentivePaymentInput, sessionUser: SessionUser) => Promise<void>
  upsertSharedConstructionProject: (input: SharedConstructionInput, sessionUser: SessionUser) => Promise<void>
  upsertBarterMatch: (input: BarterMatchInput, sessionUser: SessionUser) => Promise<void>
}

export const AppDataContext = createContext<AppDataContextValue | null>(null)

export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider')
  }

  return context
}
