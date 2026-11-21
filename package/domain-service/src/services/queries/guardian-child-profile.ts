import type { GuardianChildInput, GuardianPapersInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { guardianPapersPageSize } from '@edaya/core'
import { familyPaperTemplates } from '../../capabilities/documents/catalog'
import { scopedIdCursor } from './scoped-id-cursor'

async function guardianChildContext(base: BaseSchoolService, input: GuardianChildInput) {
  const actor = base.actor
  if (actor.kind !== 'guardian' || (actor.academicYearId && actor.academicYearId !== input.academicYearId))
    denyResourceAccess()
  const access = base.access.forOperation()
  // The guardian's scoped student reader validates the actor and current family links.
  const student = await base.entities.students.findById(input.studentId, access)
  if (!student || student.schoolId !== actor.schoolId)
    denyResourceAccess()
  return { actor, access, student }
}

export function readGuardianChildPhoto(base: BaseSchoolService, input: GuardianChildInput) {
  return base.atomicExecution.execute(async () => {
    const { actor, access, student } = await guardianChildContext(base, input)
    const scope = await access.entity('studentPhotoSubmissions').readScope()
    const decision = await base.repositories.guardianChildProfile.photoDecision(scope, student.id, actor.guardianId)
    return {
      academicYearId: input.academicYearId,
      student: { id: student.id, schoolId: student.schoolId, firstName: student.firstName, lastName: student.lastName, status: student.status, identifier: student.identifier ?? null, photoUrl: student.photoUrl ?? null },
      decision,
    }
  }, { readSnapshot: true })
}

export function readGuardianPapers(base: BaseSchoolService, input: GuardianPapersInput) {
  return base.atomicExecution.execute(async () => {
    const { actor, access } = await guardianChildContext(base, input)
    const scope = await access.documents.readScope()
    const cursor = await scopedIdCursor([actor.subjectId, actor.guardianId, actor.schoolId, input.academicYearId, input.studentId, scope], input.cursor, 'Invalid family paper cursor')
    const rows = await base.repositories.guardianChildProfile.papers(scope, input, familyPaperTemplates(), cursor.after)
    const items = rows.slice(0, guardianPapersPageSize)
    return { studentId: input.studentId, academicYearId: input.academicYearId, items, nextCursor: rows.length > items.length ? cursor.encode(items[items.length - 1]!.id) : null }
  }, { readSnapshot: true })
}
