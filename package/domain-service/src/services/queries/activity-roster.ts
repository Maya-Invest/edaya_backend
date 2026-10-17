import type { BaseSchoolService } from '../base-school-service'
import { StudentClassEnrollmentStatus } from '@edaya/core'

/** Minimal identity projection for one activity; no dossier, guardian or health fields. */
export async function getActivityRoster(base: BaseSchoolService, input: { activityId: string }) {
  const context = await base.access.activityRoster.context(input.activityId)
  const [participants, placements] = await Promise.all([
    context.participants.list({ activityId: input.activityId }),
    context.placements.list({ activityId: input.activityId }),
  ])
  const classes = context.classes ? await context.classes.findByIds([...new Set(placements.map(row => row.classGroupId))]) : []
  const enrollments = classes.length ? await context.enrollments.list({ classGroupId: { $in: classes.map(row => row.id) }, status: StudentClassEnrollmentStatus.Active }) : []
  const eligibleStudentIds = [...new Set(enrollments.map(row => row.studentId))]
  const students = await context.students.findByIds([...new Set([...participants.map(row => row.studentId), ...eligibleStudentIds])])
  return {
    students: students.map(row => ({ id: row.id, firstName: row.firstName, lastName: row.lastName, matricule: row.matricule, classGroupId: enrollments.find(enrollment => enrollment.studentId === row.id)?.classGroupId })),
    eligibleStudentIds,
    classes: classes.map(row => ({ id: row.id, name: row.name })),
  }
}
