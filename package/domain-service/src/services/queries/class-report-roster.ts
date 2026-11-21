import type { ClassReportRosterInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { classReportRosterPageSize, DomainValidationError } from '@edaya/core'
import { z } from 'zod'
import { scopedIdCursor } from './scoped-id-cursor'

const position = z.object({ name: z.string(), id: z.string().min(1) })
export function readClassReportRoster(base: BaseSchoolService, input: ClassReportRosterInput) {
  return base.atomicExecution.execute(async () => {
    const { actor } = base
    const scopes = await base.access.forOperation().reportCards.classRosterScopes(input.classGroupId, input.periodId)
    const cursor = await scopedIdCursor([actor.kind, 'subjectId' in actor ? actor.subjectId : undefined, actor.kind === 'staff' ? actor.staffMemberId : actor.kind === 'teacher' ? actor.teacherId : undefined, scopes, input.classGroupId, input.periodId, input.view ?? 'roster', input.status ?? '', input.q ?? ''], input.cursor, 'Invalid class report roster cursor')
    let after
    if (cursor.after !== undefined) {
      try {
        after = position.parse(JSON.parse(cursor.after))
      }
      catch {
        throw new DomainValidationError('Invalid class report roster cursor')
      }
    }
    const page = await base.repositories.classReportRoster.read(scopes, input, after)
    const items = page.items.slice(0, classReportRosterPageSize)
    const last = items.at(-1)
    return { ...page, items, nextCursor: last && page.items.length > items.length ? cursor.encode(JSON.stringify({ name: last.studentName, id: last.studentId })) : null }
  }, { readSnapshot: true })
}
