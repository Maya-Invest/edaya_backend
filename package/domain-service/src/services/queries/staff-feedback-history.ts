import type { StaffFeedbackHistoryFilter, StaffFeedbackHistoryInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { DomainValidationError } from '@edaya/core'
import { z } from 'zod'
import { actorSubjectId, assertFamilyFeedbackRead } from '../../capabilities/family-feedback/access'
import { feedbackLabelScopes } from './family-feedback-lists'

const fields = z.tuple([z.string(), z.string().datetime(), z.string().min(1)])

async function historyScopes(base: BaseSchoolService, filter: StaffFeedbackHistoryFilter) {
  await assertFamilyFeedbackRead(base)
  return feedbackLabelScopes(base, filter.academicYearId ? ['teacherAssignments', 'teachers', 'classSubjects', 'subjects', 'classGroups'] : [])
}

export function readStaffFeedbackHistory(base: BaseSchoolService, input: StaffFeedbackHistoryInput) {
  return base.atomicExecution.execute(async () => {
    const scopes = await historyScopes(base, input)
    const actor = base.actor
    const signature = [actor.schoolId, actor.kind, actorSubjectId(base), actor.kind === 'staff' ? actor.staffMemberId : null, 'academicYearId' in actor ? actor.academicYearId : undefined, input.academicYearId, input.lang, input.status, input.q ?? '', scopes]
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(signature))))
    const selection = Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('')
    let after
    if (input.cursor !== undefined) {
      try {
        const [scope, createdAt, id] = fields.parse(JSON.parse(input.cursor))
        if (scope !== selection)
          throw new Error('Selection changed')
        after = { createdAt, id }
      }
      catch {
        throw new DomainValidationError('Invalid campaign history cursor')
      }
    }
    const { items, total, next } = await base.repositories.staffFeedbackHistory.read(actor.schoolId, input, scopes, { after })
    return { items, total, nextCursor: next ? JSON.stringify([selection, next.createdAt, next.id]) : null }
  }, { readSnapshot: true })
}

export function exportStaffFeedbackHistory(base: BaseSchoolService, filter: StaffFeedbackHistoryFilter) {
  return base.atomicExecution.execute(async () => {
    const scopes = await historyScopes(base, filter)
    const { items } = await base.repositories.staffFeedbackHistory.read(base.actor.schoolId, filter, scopes)
    return { items }
  }, { readSnapshot: true })
}
