import type { NotificationRecipient, NotificationRecipientProfile } from '../ports/notification-gateway'
import type { BaseSchoolService } from '../services/base-school-service'
import { enrichRecipientProfile } from './resolve-notification-contact'

export function scheduleNotificationRecipientUpsert(
  baseService: BaseSchoolService,
  profile: NotificationRecipientProfile | undefined,
): void {
  if (!profile?.recipient.subjectId) {
    return
  }

  void (async () => {
    try {
      const subjectId = profile.recipient.subjectId!
      const authContact = await baseService.authContactResolver?.resolveBySubjectId(subjectId)
      const enriched = enrichRecipientProfile(profile, authContact)
      await baseService.notificationGateway.upsertRecipient(enriched)
    }
    catch {
      // Provider sync must not break business commands.
    }
  })()
}

export function scheduleNotificationRecipientRemove(
  baseService: BaseSchoolService,
  schoolId: string,
  recipient: NotificationRecipient,
): void {
  if (!recipient.subjectId) {
    return
  }
  void baseService.notificationGateway.removeRecipient(schoolId, recipient)
}
