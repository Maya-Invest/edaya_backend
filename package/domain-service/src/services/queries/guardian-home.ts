import type { GuardianHighlightsInput, GuardianHomeScopes } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { AuthorizationError, denyResourceAccess } from '@edaya/authorization'
import { guardianHomeResources } from '@edaya/core'
import { familyPaperTemplates } from '../../capabilities/documents/catalog'
import { requireCurrentGuardianStudentLink } from '../../capabilities/files/profile-photo-access'
import { schoolDayStart } from '../../capabilities/subject-enrollment/dates'

export async function readGuardianHighlights(base: BaseSchoolService, input: GuardianHighlightsInput) {
  const actor = base.actor
  if (actor.kind !== 'guardian' || (actor.academicYearId && input.academicYearId !== actor.academicYearId))
    denyResourceAccess()
  return base.atomicExecution.execute(async () => {
    const access = base.access.forOperation()
    await requireCurrentGuardianStudentLink(base, actor.guardianId, input.studentId, access)
    const scopes = await Promise.all([...guardianHomeResources, 'documentIssuances' as const].map(async (name) => {
      try {
        return [name, await (name === 'documentIssuances' ? access.documents.readScope() : access.entity(name).readScope())] as const
      }
      catch (error) {
        if (!(error instanceof AuthorizationError))
          throw error
        return [name, null] as const
      }
    }))
    const school = await base.repositories.schools.findById(actor.schoolId)
    if (!school)
      denyResourceAccess()
    const day = new Date(input.day)
    return base.repositories.guardianHome.highlights({
      ...input,
      schoolId: actor.schoolId,
      subjectId: actor.subjectId,
      now: new Date(),
      start: schoolDayStart(day, school.timeZone),
      end: schoolDayStart(day, school.timeZone, 1),
      paperTemplates: familyPaperTemplates(),
    }, Object.fromEntries(scopes) as GuardianHomeScopes)
  }, { readSnapshot: true })
}

/** A guardian chooses among their own currently visible children and enrollment years. */
export async function readGuardianChoices(base: BaseSchoolService) {
  const actor = base.actor
  if (actor.kind !== 'guardian')
    denyResourceAccess()
  return base.atomicExecution.execute(async () => {
    const access = base.access.forOperation()
    const guardian = await base.entities.guardians.findById(actor.guardianId, access)
    if (!guardian?.hasAccess || guardian.schoolId !== actor.schoolId)
      denyResourceAccess()
    const [links, years, school] = await Promise.all([
      base.entities.guardianLinks.list({ guardianId: actor.guardianId }, access),
      base.entities.academicYears.list({ schoolId: actor.schoolId }, access),
      base.entities.schools.findById(actor.schoolId, access),
    ])
    if (!school)
      denyResourceAccess()
    const studentIds = [...new Set(links.map(link => link.studentId))]
    const [children, placements] = studentIds.length
      ? await Promise.all([
          base.entities.students.list({ id: { $in: studentIds } }, access),
          base.entities.enrollments.list({ studentId: { $in: studentIds } }, access),
        ])
      : [[], []]
    const visible = new Set(children.map(child => child.id))
    const enrollments = placements.filter(row => visible.has(row.studentId))
    const classes = [...new Set(enrollments.map(row => row.classGroupId))]
    const groups = classes.length ? await base.entities.classGroups.list({ id: { $in: classes } }, access) : []
    const labels = new Map(groups.map(group => [group.id, group.name]))
    return {
      guardianId: actor.guardianId,
      school: { id: school.id, name: school.name, timeZone: school.timeZone },
      children: children.map(child => ({ id: child.id, schoolId: child.schoolId, firstName: child.firstName, lastName: child.lastName, status: child.status, identifier: child.identifier ?? null, photoUrl: child.photoUrl ?? null })),
      years: years.map(year => ({ id: year.id, schoolId: year.schoolId, name: year.name, startDate: year.startDate.toISOString(), endDate: year.endDate.toISOString(), status: year.status })),
      enrollments: enrollments.map(row => ({ studentId: row.studentId, academicYearId: row.academicYearId, classGroupId: row.classGroupId, status: row.status, enrollmentIndex: row.enrollmentIndex, classLabel: labels.get(row.classGroupId) ?? '' })),
    }
  }, { readSnapshot: true })
}
