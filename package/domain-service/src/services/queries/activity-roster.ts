import type { ResourceAccessScope } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { AuthorizationError } from '@edaya/authorization'
import { StudentClassEnrollmentStatus } from '@edaya/core'

/** Minimal identity projection for one activity; no dossier, guardian or health fields. */
export async function getActivityRoster(base: BaseSchoolService, input: { activityId: string, includeMemberships?: boolean }) {
  const access = base.access.forOperation()
  const context = await access.activityRoster.context(input.activityId)
  // The staff membership table may also be visible through timetable grants. Identity labels
  // continue to come exclusively from the activity roster policy.
  const include = base.actor.kind === 'staff' && input.includeMemberships
  const query = { activityId: input.activityId }
  const participantRows = context.participants.list(query)
  const placementRows = context.placements.list(query)
  const [participants, placements, members, links] = await Promise.all([
    participantRows,
    placementRows,
    include
      ? visibleRows(access.entity('activityEnrollments').readScope(), context.participantScope, participantRows, scope => base.repositories.activityEnrollments.forAccess(scope).list(query))
      : undefined,
    include
      ? visibleRows(access.entity('classActivityEnrollments').readScope(), context.placementScope, placementRows, scope => base.repositories.classActivityEnrollments.forAccess(scope).list(query))
      : undefined,
  ])
  const classes = context.classes ? await context.classes.findByIds([...new Set(placements.map(row => row.classGroupId))]) : []
  const enrollments = classes.length ? await context.enrollments.list({ classGroupId: { $in: classes.map(row => row.id) }, status: StudentClassEnrollmentStatus.Active }) : []
  const firstClassByStudent = new Map<string, string>()
  for (const enrollment of enrollments) {
    if (!firstClassByStudent.has(enrollment.studentId))
      firstClassByStudent.set(enrollment.studentId, enrollment.classGroupId)
  }
  const eligibleStudentIds = [...firstClassByStudent.keys()]
  const students = await context.students.findByIds([...new Set([...participants.map(row => row.studentId), ...eligibleStudentIds])])
  return {
    ...(members && links && {
      membership: {
        enrollments: members.map(({ id, studentId, status }) => ({ id, studentId, status })),
        linkedClassIds: [...new Set(links.map(row => row.classGroupId))],
      },
    }),
    students: students.map(row => ({ id: row.id, firstName: row.firstName, lastName: row.lastName, identifier: row.identifier, classGroupId: firstClassByStudent.get(row.id) })),
    eligibleStudentIds,
    classes: classes.map(row => ({ id: row.id, name: row.name })),
  }
}

async function visibleRows<T>(requestedScope: Promise<ResourceAccessScope>, originalScope: ResourceAccessScope, original: Promise<T[]>, read: (scope: ResourceAccessScope) => Promise<T[]>) {
  try {
    const scope = await requestedScope
    return JSON.stringify(scope) === JSON.stringify(originalScope) ? await original : await read(scope)
  }
  catch (error) {
    if (error instanceof AuthorizationError)
      return []
    throw error
  }
}
