import type { TeacherLogbookInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { DomainValidationError, teacherLogbookInput, teacherLogbookPageSize } from '@edaya/core'
import { z } from 'zod'

const id = z.string().min(1)
const cursorFields = z.tuple([id, id, id, id, id, z.enum(['recorded', 'all']), z.string().datetime(), id])

export function getTeacherLogbook(base: BaseSchoolService, input: TeacherLogbookInput) {
  const query = teacherLogbookInput.parse(input)
  return base.atomicExecution.execute(async () => {
    const { teacherId, year } = await base.access.logbooks.teacherOffering(query)
    const selection = [base.actor.schoolId, teacherId, year, query.classGroupId, query.classSubjectId, query.view]
    let after
    if (query.cursor !== undefined) {
      try {
        const cursor = cursorFields.parse(JSON.parse(query.cursor))
        if (!selection.every((field, index) => field === cursor[index]))
          throw new Error('Selection changed')
        after = { startsAt: cursor[6], id: cursor[7] }
      }
      catch {
        throw new DomainValidationError('Invalid teacher logbook cursor')
      }
    }
    const rows = await base.repositories.teacherLogbook.list(base.actor.schoolId, query, after)
    const items = rows.slice(0, teacherLogbookPageSize)
    const boundary = items.at(-1)
    return { items, nextCursor: rows.length > teacherLogbookPageSize && boundary ? JSON.stringify([...selection, boundary.startsAt, boundary.id]) : null }
  }, { readSnapshot: true })
}
