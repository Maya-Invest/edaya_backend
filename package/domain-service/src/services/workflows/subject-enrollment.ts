import type { ManageStudentSubjectEnrollmentsInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess, resolveAuditActorId } from '@edaya/authorization'
import { BusinessRuleViolationError, manageStudentSubjectEnrollmentsSchema, StudentSubjectEnrollment } from '@edaya/core'
import { academicStateLock } from '../../capabilities/academics/marks-state'
import { schoolDayStart } from '../../capabilities/subject-enrollment/dates'
import { enrollmentBounds, persistSubjectEnrollment, withdrawSubjectEnrollment } from '../../capabilities/subject-enrollment/persistence'
import { loadSubjectWork } from '../../capabilities/subject-enrollment/work'
import { schoolCommandScope } from '../commands/school-command-scope'

export async function manageSubjectEnrollments(base: BaseSchoolService, raw: ManageStudentSubjectEnrollmentsInput) {
  const input = manageStudentSubjectEnrollmentsSchema.parse(raw)
  const repositories = base.repositories
  const actor = base.actor
  if (actor.kind !== 'staff')
    denyResourceAccess()
  const command = 'manageStudentSubjectEnrollments'
  return base.commandExecution.execute({
    scope: await schoolCommandScope(actor, command, input.requestId),
    input,
    resultMode: 'ordinary',
    lockKeys: [academicStateLock(actor.schoolId)],
    authorize: async () => {
      // Stable parent references allow authorization even after a hard-deleted enrollment is replayed.
      for (const op of input.operations) {
        const placement = await repositories.enrollments.findById(op.studentClassEnrollmentId)
        const offering = await repositories.classSubjects.findById(op.classSubjectId)
        if (!placement || !offering || offering.classGroupId !== placement.classGroupId)
          denyResourceAccess()
        await base.access.enrollments.assertUpdate(placement)
      }
    },
    execute: async () => {
      const keys = input.operations.map(op => JSON.stringify([op.studentClassEnrollmentId, op.classSubjectId]))
      if (new Set(keys).size !== keys.length)
        throw new BusinessRuleViolationError('DUPLICATE_SUBJECT_ENROLLMENT_OPERATION', 'Only one selection per placement and subject is allowed in a batch')
      const at = new Date()
      const contexts = await Promise.all(input.operations.map(op => enrollmentBounds(repositories, op.studentClassEnrollmentId, op.classSubjectId)))
      for (const { offering } of contexts) {
        if (input.expectedRevisions[offering.id] !== offering.participationRevision)
          throw new BusinessRuleViolationError('SUBJECT_PARTICIPATION_REVISION_CONFLICT', 'The subject roster changed. Reload before retrying', { classSubjectId: offering.id, expectedRevision: input.expectedRevisions[offering.id], actualRevision: offering.participationRevision })
      }
      const offeringIds = [...new Set(contexts.map(context => context.offering.id))]
      const work = new Map(await Promise.all(offeringIds.map(async id => [id, await loadSubjectWork(repositories, id)] as const)))
      const calendar = new Map((await repositories.academicPeriods.list({ academicYearId: { $in: [...new Set(contexts.map(context => context.year.id))] } })).map(period => [period.id, period]))
      const allRows = await repositories.subjectEnrollments.list({ studentClassEnrollmentId: { $in: [...new Set(input.operations.map(op => op.studentClassEnrollmentId))] } })
      const ids: string[] = []
      for (const [index, op] of input.operations.entries()) {
        const { placement, offering, subject, start, end, year, timeZone } = contexts[index]!
        if (!subject.isOptional)
          throw new BusinessRuleViolationError('COMPULSORY_SUBJECT_MANAGED', 'Compulsory subject participation is managed automatically')
        const previous = allRows.find(row => row.studentClassEnrollmentId === placement.id && row.classSubjectId === offering.id && !row.deletedAt)
        if (op.selection.scope === 'none') {
          if (previous) {
            await withdrawSubjectEnrollment(repositories, previous, resolveAuditActorId(actor), at, work.get(offering.id))
            ids.push(previous.id)
          }
          continue
        }
        if (!offering.isOffered)
          throw new BusinessRuleViolationError('SUBJECT_NOT_OFFERED', 'This class does not offer the subject')
        if (at >= end)
          throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_PLACEMENT_CLOSED', 'This class placement or academic year has ended')
        const selection = op.selection
        const periodIds = selection.scope === 'periods' ? [...selection.periodIds].sort() : []
        if (new Set(periodIds).size !== periodIds.length)
          throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_PERIOD_INVALID', 'Select each period only once')
        const periods = periodIds.map((periodId) => {
          const period = calendar.get(periodId)
          if (!period || period.schoolId !== actor.schoolId || period.academicYearId !== year.id)
            throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_PERIOD_INVALID', 'Periods must belong to the placement academic year')
          const existing = previous?.periods.find(row => row.periodId === periodId)
          const startsAt = schoolDayStart(period.startDate, timeZone)
          const endsAt = schoolDayStart(period.endDate, timeZone, 1)
          if (!existing && Math.max(at.getTime(), start.getTime(), startsAt.getTime()) >= Math.min(end.getTime(), endsAt.getTime()))
            throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_PERIOD_ENDED', 'Select a current or upcoming period within the class placement')
          return { periodId, startsAt, endsAt, activatedAt: existing?.activatedAt ?? at }
        })
        if (previous?.scope === selection.scope && JSON.stringify(previous.periods.map(period => period.periodId).sort()) === JSON.stringify(periodIds)) {
          ids.push(previous.id)
          continue
        }
        const enrolledAt = new Date(Math.max(start.getTime(), previous?.scope === selection.scope ? previous.enrolledAt.getTime() : at.getTime()))
        const row = new StudentSubjectEnrollment({
          ...previous?.data,
          id: previous?.id ?? crypto.randomUUID(),
          studentClassEnrollmentId: placement.id,
          classSubjectId: offering.id,
          enrolledAt,
          endedAt: end,
          source: 'explicit',
          scope: selection.scope,
          periods,
          revision: (previous?.revision ?? -1) + 1,
        })
        await persistSubjectEnrollment(repositories, row, previous, work.get(offering.id))
        ids.push(row.id)
      }
      return { enrollmentIds: ids, revisions: Object.fromEntries((await repositories.classSubjects.findByIds(offeringIds)).map(row => [row.id, row.participationRevision])) }
    },
    persistResult: result => result,
    replay: async stored => stored,
    audit: result => result.enrollmentIds.map(id => ({ event: command, resourceType: 'subjectEnrollments', resourceId: id })),
  })
}
