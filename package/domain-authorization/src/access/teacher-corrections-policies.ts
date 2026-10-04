import type { CorrectionWorkflow, Permission as PermissionType } from '@edaya/core'
import type { AccessPolicies } from './access-policies'
import { Permission, StudentClassEnrollmentStatus } from '@edaya/core'
import { AccessFacts, denied } from './facts'

const reviewPermissions = { attendance: Permission.ATTENDANCE_VALIDATE, report_comments: Permission.REPORT_CARD_PUBLISH, logbook: Permission.CLASS_LOGBOOK_VALIDATE, discipline: Permission.DISCIPLINE_VALIDATE } as const

/** Keeps each correction action and its complete resource placement together. */
export class TeacherCorrectionsAccessPolicy {
  constructor(private readonly access: AccessPolicies) {}

  queueScope(workflow: CorrectionWorkflow) {
    return this.access.scope(reviewPermissions[workflow], 'classGroups')
  }

  assertReview(workflow: CorrectionWorkflow, classGroupId: string, intent: 'read' | 'write' = 'write') {
    if (this.access.actor.kind !== 'staff')
      denied()
    return this.access.assertResources(reviewPermissions[workflow], 'classGroups', [classGroupId], intent)
  }

  assertReviewerNotification(permission: PermissionType, classGroupId: string) {
    const allowed: readonly PermissionType[] = [Permission.GRADE_VALIDATE, ...Object.values(reviewPermissions)]
    if (!allowed.includes(permission))
      denied()
    return this.access.assertResources(permission, 'classGroups', [classGroupId], 'read')
  }

  assertAttendanceRecord(recordId: string) {
    return this.access.assertResources(Permission.ATTENDANCE_RECORD, 'attendance', [recordId])
  }

  assertLessonAttendance(lessonSessionId: string) {
    return this.access.assertResources(Permission.ATTENDANCE_RECORD, 'lessonSessions', [lessonSessionId])
  }

  async assertLogbookProposal(lessonSessionId: string, matterIds: readonly string[]) {
    await this.access.assertResources([Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE], 'lessonSessions', [lessonSessionId])
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    const lesson = await facts.one('lessonSessions', lessonSessionId)
    for (const id of matterIds) {
      await this.access.assertResources(Permission.CLASS_LOGBOOK_CREATE, 'classSubjectMatters', [id])
      const matter = await facts.one('classSubjectMatters', id)
      if (matter.classSubjectId !== lesson.classSubjectId)
        denied()
    }
  }

  async assertIncidentProposal(incidentId: string, studentIds: readonly string[]) {
    await this.access.assertResources(Permission.DISCIPLINE_CREATE, 'incidents', [incidentId])
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    const incident = await facts.one('incidents', incidentId)
    if (this.access.actor.kind === 'teacher' && incident.reporterId !== this.access.actor.teacherId)
      denied()
    const existing = await facts.list('studentIncidentInvolvements', { incidentId })
    const added = studentIds.filter(id => !existing.some(p => p.studentId === id))
    if (added.length)
      await this.access.assertResources(Permission.DISCIPLINE_CREATE, 'students', added)
    const enrollments = await facts.list('enrollments', { classGroupId: incident.classGroupId })
    if (added.some(id => !enrollments.some(e => e.studentId === id && e.status === StudentClassEnrollmentStatus.Active)))
      denied()
  }

  assertValidateLogbook(lessonSessionIds: readonly string[]) {
    if (this.access.actor.kind !== 'staff')
      denied()
    return this.access.assertResources(Permission.CLASS_LOGBOOK_VALIDATE, 'lessonSessions', lessonSessionIds)
  }

  assertTakeOverIncident(incidentId: string) {
    if (this.access.actor.kind !== 'staff')
      denied()
    return this.access.assertResources(Permission.DISCIPLINE_VALIDATE, 'incidents', [incidentId])
  }

  assertFollowUp(incidentId: string) {
    return this.access.assertResources(Permission.DISCIPLINE_CREATE, 'incidents', [incidentId])
  }
}
