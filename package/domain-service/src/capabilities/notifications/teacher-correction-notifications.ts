import type { Permission } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { ActorAssuranceLevel, AuthorizationError, createAccessPolicies, createStaffActorMetadata } from '@edaya/authorization'
import { MessageDeliveryRecipientKind } from '@edaya/core'
import { deliverNotification } from './delivery/deliver-notification'

export async function notifyTeacherCorrection(base: BaseSchoolService, row: { id: string, schoolId: string, classGroupId: string, authorSubjectId: string, version: number, reason: string, assessmentId?: string, workflow?: string, periodId?: string, studentIds?: string[] }, action: 'requested' | 'revised' | 'approved' | 'rejected', permission: Permission) {
  const recipients = []
  const group = await base.repositories.classGroups.findById(row.classGroupId)
  if (!group)
    return
  if (action === 'requested' || action === 'revised') {
    for (const staff of await base.repositories.staffMembers.forSchool!(row.schoolId).list()) {
      if (!staff.isActive || staff.accountKind !== 'human' || !staff.subjectId || staff.subjectId === row.authorSubjectId)
        continue
      const access = createAccessPolicies({ actor: createStaffActorMetadata({ schoolId: row.schoolId, staffMemberId: staff.id, subjectId: staff.subjectId, academicYearId: group.academicYearId, requestId: row.id, authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }), repositories: base.repositories })
      try {
        await access.teacherCorrections.assertReviewerNotification(permission, group.id)
        recipients.push({ kind: MessageDeliveryRecipientKind.Staff, id: staff.id, subjectId: staff.subjectId })
      }
      catch (error) {
        if (!(error instanceof AuthorizationError))
          throw error
      }
    }
  }
  else {
    const teacher = await base.repositories.teachers.forSchool!(row.schoolId).findOne({ subjectId: row.authorSubjectId })
    const staff = await base.repositories.staffMembers.forSchool!(row.schoolId).findOne({ subjectId: row.authorSubjectId })
    if (teacher?.isActive)
      recipients.push({ kind: MessageDeliveryRecipientKind.Teacher, id: teacher.id, subjectId: row.authorSubjectId })
    else if (staff?.isActive)
      recipients.push({ kind: MessageDeliveryRecipientKind.Staff, id: staff.id, subjectId: row.authorSubjectId })
  }
  if (!recipients.length)
    return
  const labels = { requested: 'Correction à examiner', revised: 'Demande de correction révisée', approved: 'Correction approuvée', rejected: 'Correction refusée' }
  const source: Record<string, string> = {}
  if (action === 'approved' || action === 'rejected') {
    if (row.assessmentId)
      source.assessmentId = row.assessmentId
    if (row.workflow === 'report_comments' && row.periodId && row.studentIds?.length) {
      source.classGroupId = row.classGroupId
      source.periodId = row.periodId
      source.studentId = row.studentIds[0]!
    }
  }
  await deliverNotification({ repositories: base.repositories, notificationGateway: base.notificationGateway }, { schoolId: row.schoolId, kind: 'event', eventKey: `teacher_correction.${action}`, idempotencyKeyPrefix: `teacher_correction:${row.id}:${row.version}:${action}`, title: labels[action], body: `${group.name} · ${row.reason}`, enablePush: true, enableEmail: false, enableSms: false, recipients, metadata: { ...source, correctionId: row.id, path: `/school/corrections?correction=${encodeURIComponent(row.id)}` } })
}
