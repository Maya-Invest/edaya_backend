import type { NotificationDispatchRequest, NotificationRecipientProfile } from '@edaya/core'
import type { BaseSchoolService } from '../../../services/base-school-service'
import { AuthorizationError } from '@edaya/authorization'
import { buildGuardianRecipientProfile, buildStaffRecipientProfile, buildStudentRecipientProfile, buildTeacherRecipientProfile } from './build-recipient-profile'
import { enrichRecipientProfile } from './resolve-notification-contact'

/** Re-evaluate on every channel attempt; revoked access cancels, infrastructure failures retry. */
export async function resolveNotificationDispatchRecipient(base: BaseSchoolService, request: NotificationDispatchRequest): Promise<NotificationRecipientProfile | undefined> {
  let profile: NotificationRecipientProfile | undefined
  try {
    profile = await base.atomicExecution.execute(async () => {
      const recipient = await base.access.notifications.recipient(request)
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
