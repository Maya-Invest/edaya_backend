import type { IncidentLessonOptionsInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { incidentLessonOptionsPageSize } from '@edaya/core'
import { scopedIdCursor } from './scoped-id-cursor'

export function readIncidentLessonOptions(base: BaseSchoolService, input: IncidentLessonOptionsInput) {
  return base.atomicExecution.execute(async () => {
    const actor = base.actor
    if (actor.kind !== 'staff')
      denyResourceAccess()
    const scope = await base.access.entity('lessonSessions').readScope()
    const cursor = await scopedIdCursor([actor.subjectId, actor.staffMemberId, actor.schoolId, actor.academicYearId, scope, input.classGroupId, input.q ?? ''], input.cursor, 'Invalid incident lesson cursor')
    const result = await base.repositories.incidentLessonOptions.read(scope, input, cursor.after)
    const items = result.items.slice(0, incidentLessonOptionsPageSize)
    return { items, selected: result.selected, nextCursor: result.items.length > items.length ? cursor.encode(items[items.length - 1]!.id) : null }
  }, { readSnapshot: true })
}
