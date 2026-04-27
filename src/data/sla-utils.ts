import type { AppDataset } from '../types/domain'

export type Escalation = {
    id: string
    type: 'IS' | 'Scheduling' | 'Agreement' | 'BA' | 'Incentive'
    label: string
    detail: string
    severity: 'critical' | 'warn'
}

export function getEscalations(dataset: AppDataset): Escalation[] {
    const escalations: Escalation[] = []
    const now = new Date()

    // 1. IS lead not called within 30 mins
    dataset.leads.forEach(lead => {
        if (lead.currentStage === 'Lead Shared') {
            const submitted = new Date(lead.submittedAt)
            const diffMins = (now.getTime() - submitted.getTime()) / (1000 * 60)
            if (diffMins > 30) {
                escalations.push({
                    id: `is-sla-${lead.id}`,
                    type: 'IS',
                    label: 'IS TAT Breach',
                    detail: `Lead ${lead.name} not called for ${Math.floor(diffMins)} mins.`,
                    severity: 'critical'
                })
            }
        }
    })

    // 2. Scheduling not completed within 1 day
    dataset.leads.forEach(lead => {
        if (lead.currentStage === 'Qualified') {
            const updated = new Date(lead.lastUpdatedAt)
            const diffDays = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
            if (diffDays > 1) {
                escalations.push({
                    id: `sch-sla-${lead.id}`,
                    type: 'Scheduling',
                    label: 'Scheduling TAT Breach',
                    detail: `Lead ${lead.name} qualified for ${Math.floor(diffDays)} days but not scheduled.`,
                    severity: 'critical'
                })
            }
        }
    })

    // 3. Agreement pending for more than 7 days
    dataset.agreements.forEach(agreement => {
        if (agreement.status === 'Pending') {
            const sent = new Date(agreement.sentDate)
            const diffDays = (now.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24)
            if (diffDays > 7) {
                escalations.push({
                    id: `agr-sla-${agreement.id}`,
                    type: 'Agreement',
                    label: 'Agreement Delayed',
                    detail: `CP ${agreement.cpName} agreement pending for ${Math.floor(diffDays)} days.`,
                    severity: 'warn'
                })
            }
        }
    })

    // 4. BA pending for more than 14 days
    dataset.leads.forEach(lead => {
        if (lead.baStatus === 'Pending' && (lead.currentStage === 'Proposal Shared' || lead.currentStage === 'GMV Discussion')) {
            const updated = new Date(lead.lastUpdatedAt)
            const diffDays = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
            if (diffDays > 14) {
                escalations.push({
                    id: `ba-sla-${lead.id}`,
                    type: 'BA',
                    label: 'BA Collection Delayed',
                    detail: `BA for ${lead.name} pending for ${Math.floor(diffDays)} days since proposal.`,
                    severity: 'warn'
                })
            }
        }
    })

    // 5. Incentive not released within 7 days after BA collection
    dataset.incentives.forEach(inc => {
        if (inc.paymentStatus === 'Pending') {
            const lead = dataset.leads.find(l => l.id === inc.leadId)
            if (lead?.baStatus === 'Collected') {
                const updated = new Date(lead.lastUpdatedAt)
                const diffDays = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
                if (diffDays > 7) {
                    escalations.push({
                        id: `inc-sla-${inc.id}`,
                        type: 'Incentive',
                        label: 'Incentive Payout Delay',
                        detail: `Incentive for ${lead.name} not paid after 7 days of BA collection.`,
                        severity: 'critical'
                    })
                }
            }
        }
    })

    return escalations
}
