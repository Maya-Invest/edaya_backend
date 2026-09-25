import type { Assessment, AssessmentResult } from '@edaya/core'
import type { EntityBusinessHooks } from '../../services/entities/managed-entity-service'
import { markSheetEdited } from './marks-state'

function markChanged(result: AssessmentResult, existing?: AssessmentResult): boolean {
  return !existing || result.score !== existing.score || result.designation !== existing.designation
}

export const markMutationHooks: EntityBusinessHooks<AssessmentResult> = {
  postBatchSave: async (results, repos, actor, existingById) => {
    const sheets = new Map<string, { count: number, changed: { id: string }[] }>()
    for (const result of results) {
      const sheet = sheets.get(result.assessmentId) ?? { count: 0, changed: [] }
      sheet.count += 1
      if (markChanged(result, existingById.get(result.id)))
        sheet.changed.push({ id: result.id })
      sheets.set(result.assessmentId, sheet)
    }
    for (const [assessmentId, sheet] of sheets) await markSheetEdited(assessmentId, repos, actor, sheet.count, sheet.changed)
  },
  postSave: async (result, existing, repos, actor) => markSheetEdited(result.assessmentId, repos, actor, 1, markChanged(result, existing) ? [{ id: result.id }] : []),
  postDelete: async (result, repos, actor) => markSheetEdited(result.assessmentId, repos, actor, 1, [{ id: result.id, removed: true }]),
}
export const assessmentMutationHooks: EntityBusinessHooks<Assessment> = {
  postSave: async (assessment, existing, repos, actor) => {
    if (existing && assessment.marksStatus === 'draft')
      await markSheetEdited(assessment.id, repos, actor)
  },
}
