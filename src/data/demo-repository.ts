import { appDataset } from './mockData'
import type { AppRepository } from './repository'
import {
  applyAgreementUpdate,
  applyCreateCp,
  applyIsDisposition,
  applyLeadSubmission,
  applyMeetingSchedule,
  applyVmLeadCreation,
} from './repository-utils'
import {
  applyBarterMatch,
  applyCommercialStageUpdate,
  applyCommercialValuesUpdate,
  applyIncentivePaymentUpdate,
  applySharedConstructionProject,
} from './commercial-utils'

const STORAGE_KEY = 'cp-as-partner-demo-data'

function loadStoredDataset() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return appDataset

  try {
    return JSON.parse(stored)
  } catch {
    return appDataset
  }
}

function persist(dataset: ReturnType<typeof loadStoredDataset>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset))
  return dataset
}

export const demoRepository: AppRepository = {
  async loadDataset() {
    return loadStoredDataset()
  },
  async submitLead(input, sessionUser) {
    return persist(applyLeadSubmission(loadStoredDataset(), input, sessionUser))
  },
  async createVmLead(input, sessionUser) {
    return persist(applyVmLeadCreation(loadStoredDataset(), input, sessionUser))
  },
  async updateIsDisposition(input, sessionUser) {
    return persist(applyIsDisposition(loadStoredDataset(), input, sessionUser))
  },
  async scheduleMeeting(input, sessionUser) {
    return persist(applyMeetingSchedule(loadStoredDataset(), input, sessionUser))
  },
  async createCp(input, sessionUser) {
    return persist(applyCreateCp(loadStoredDataset(), input, sessionUser))
  },
  async updateAgreement(input, sessionUser) {
    return persist(applyAgreementUpdate(loadStoredDataset(), input, sessionUser))
  },
  async updateCommercialStage(input, sessionUser) {
    return persist(applyCommercialStageUpdate(loadStoredDataset(), input, sessionUser))
  },
  async updateCommercialValues(input, sessionUser) {
    return persist(applyCommercialValuesUpdate(loadStoredDataset(), input, sessionUser))
  },
  async updateIncentivePayment(input, sessionUser) {
    return persist(applyIncentivePaymentUpdate(loadStoredDataset(), input, sessionUser))
  },
  async upsertSharedConstructionProject(input, sessionUser) {
    return persist(applySharedConstructionProject(loadStoredDataset(), input, sessionUser))
  },
  async upsertBarterMatch(input, sessionUser) {
    return persist(applyBarterMatch(loadStoredDataset(), input, sessionUser))
  },
}
