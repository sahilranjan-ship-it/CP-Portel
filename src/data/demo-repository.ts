import { appDataset } from './mockData'
import type { AppRepository } from './repository'
import {
  applyAgreementUpdate,
  applyCpOnboardingUpdate,
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
import type { NewCpInput } from '../types/domain'

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
  async updateCpOnboarding(input, sessionUser) {
    return persist(applyCpOnboardingUpdate(loadStoredDataset(), input, sessionUser))
  },
  async upsertSharedConstructionProject(input, sessionUser) {
    return persist(applySharedConstructionProject(loadStoredDataset(), input, sessionUser))
  },
  async upsertBarterMatch(input, sessionUser) {
    return persist(applyBarterMatch(loadStoredDataset(), input, sessionUser))
  },
  async bulkCreateCp(rows, sessionUser) {
    const dataset = loadStoredDataset();
    // In a real app, this would be a backend call. For demo, we simulate it using our utils.
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    let currentDataset = dataset;
    for (const row of rows) {
      try {
        // Simple heuristic: if row has a contractorId that exists, it's an update
        const exists = currentDataset.cps.find(c => c.code === (row.contractor_id || row.contractorId));
        const input: NewCpInput = {
          contractorId: row.contractor_id || row.contractorId || `CP-${Math.floor(Math.random() * 10000)}`,
          cpName: row.assigned_contractor_name || row.cpName || row.cp_name || 'Unknown',
          companyName: row.company_name || row.cpName || '',
          email: row.email || '',
          phone: row.phone || '',
          city: row.cities || row.city || '',
          pincode: row.pincode || '',
          userType: row.user_type || 'CONTRACTOR',
          totalCrn: parseInt(row.total_crn) || 0,
          runningCrn: parseInt(row.running_crn) || 0,
          totalProjectValue: parseFloat(row.total_project_value) || 0,
          lowestPercentageCompleted: parseFloat(row.lowest_percentage_completed) || 0,
          primaryScope: row.primary_scope || '',
          tier: row.tier || 'Blue',
          bmsPriority: row.bms_priority || 'Low',
          remarks: row.remarks || '',
        };

        currentDataset = applyCreateCp(currentDataset, input, sessionUser);
        if (exists) updated++; else inserted++;
      } catch (err) {
        errors.push((err as Error).message);
      }
    }

    const finalDataset = {
      ...currentDataset,
      importReport: { inserted, updated, skipped: 0, errors }
    };

    return persist(finalDataset);
  },
}
