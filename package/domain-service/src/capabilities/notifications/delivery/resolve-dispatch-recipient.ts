import type { NotificationDispatchRequest, NotificationRecipientProfile } from '@edaya/core'
import type { BaseSchoolService } from '../../../services/base-school-service'
import { ActorAssuranceLevel, AuthorizationError, createAccessPolicies, createGuardianActorMetadata, createStaffActorMetadata, createTeacherActorMetadata, denyResourceAccess } from '@edaya/authorization'
import { assessmentDate } from '../../academics/marks-state'
import { loadParticipation, subjectRoster } from '../../subject-enrollment/participation'
import { buildGuardianRecipientProfile, buildStaffRecipientProfile, buildStudentRecipientProfile, buildTeacherRecipientProfile } from './build-recipient-profile'
import { enrichRecipientProfile } from './resolve-notification-contact'

/** Re-evaluate on every channel attempt; revoked access cancels, infrastructure failures retry. */
export async function resolveNotificationDispatchRecipient(base: BaseSchoolService, request: NotificationDispatchRequest): Promise<NotificationRecipientProfile | undefined> {
  let profile: NotificationRecipientProfile | undefined
  try {
    profile = await base.atomicExecution.execute(async () => {
      const recipient = await base.access.notifications.recipient(request)
      const { assessmentId } = request.metadata
      if (assessmentId && request.eventKey === 'assessment.due_soon' && (recipient.kind === 'student' || recipient.kind === 'guardian')) {
        const assessment = await base.repositories.assessments.findById(assessmentId)
        if (!assessment)
          denyResourceAccess()
        const roster = subjectRoster(await loadParticipation(base.repositories, [assessment.classGroupId]), assessment.classSubjectId, await assessmentDate(assessment, base.repositories))
        if (recipient.kind === 'student' ? !roster.includes(recipient.profile.id) : !recipient.links.some(link => roster.includes(link.studentId)))
          denyResourceAccess()
      }
      if (request.eventKey === 'conversation.message') {
        const { conversationId: id } = request.metadata
        const placement = id ? await base.repositories.conversations.placement(request.schoolId, id) : undefined
        if (!placement || recipient.kind === 'student')
          denyResourceAccess()
        const context = { schoolId: request.schoolId, subjectId: request.subjectId, requestId: request.deliveryId, authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }
        const actor = recipient.kind === 'guardian' ? createGuardianActorMetadata({ ...context, guardianId: recipient.profile.id }) : recipient.kind === 'teacher' ? createTeacherActorMetadata({ ...context, teacherId: recipient.profile.id }) : createStaffActorMetadata({ ...context, staffMemberId: recipient.profile.id })
        await createAccessPolicies({ actor, repositories: base.repositories }).conversations.assertRead(placement)
      }
      switch (recipient.kind) {
        case 'staff': return buildStaffRecipientProfile(recipient.profile)
        case 'guardian': return buildGuardianRecipientProfile(recipient.profile, recipient.links)
        case 'student': return buildStudentRecipientProfile(recipient.profile)
        case 'teacher': return buildTeacherRecipientProfile(recipient.profile)
      }
    })
  }
  catch (error) {
    if (error instanceof AuthorizationError)
      return undefined
    throw error
  }
  if (!profile)
    return undefined
  const contact = await base.authContactResolver?.resolveBySubjectId(request.subjectId)
  return enrichRecipientProfile(profile, contact)
}
