import type { BaseRepositoryInterface, FamilyFeedbackAnswer, FamilyFeedbackCampaign, FamilyFeedbackResponse, FamilyFeedbackScoredRow, FamilyFeedbackSlot, Guardian } from '@edaya/core'
import { aggregateFamilyFeedback, FAMILY_FEEDBACK_CANNOT_ASSESS, FAMILY_FEEDBACK_QUESTION_IDS, FAMILY_FEEDBACK_SCORED_VALUES } from '@edaya/core'
import { loadInBatches } from '../shared/bounded-reads'

/** Callers supply already school-scoped repositories after campaign authorization. */
export async function computeCampaignAggregates(repositories: {
  slots: Pick<BaseRepositoryInterface<FamilyFeedbackSlot>, 'list'>
  responses: Pick<BaseRepositoryInterface<FamilyFeedbackResponse>, 'list'>
  guardians: Pick<BaseRepositoryInterface<Guardian>, 'findByIds'>
}, campaign: FamilyFeedbackCampaign) {
  const slots = await repositories.slots.list({ campaignId: campaign.id })
  const responses = await repositories.responses.list({ campaignId: campaign.id })
  const bySlot = new Map(slots.map(row => [row.id, row]))
  const guardians = await loadInBatches(slots.flatMap(row => row.completingGuardianId ? [row.completingGuardianId] : []), ids => repositories.guardians.findByIds(ids))
  const subjects = new Map(guardians.map(row => [row.id, row.subjectId]))
  const rows: FamilyFeedbackScoredRow[] = []
  for (const response of responses) {
    const guardianId = bySlot.get(response.slotId)?.completingGuardianId
    const subjectId = guardianId ? subjects.get(guardianId) : undefined
    if (!subjectId)
      continue
    for (const questionId of FAMILY_FEEDBACK_QUESTION_IDS) {
      const value = response.answers[questionId]
      if (value === FAMILY_FEEDBACK_CANNOT_ASSESS || (FAMILY_FEEDBACK_SCORED_VALUES as readonly number[]).includes(value))
        rows.push({ questionId, value: value as FamilyFeedbackAnswer, guardianSubjectId: subjectId })
    }
  }
  return aggregateFamilyFeedback(rows, slots.length, slots.filter(row => row.isCompleted).length, campaign.themeDraft)
}
