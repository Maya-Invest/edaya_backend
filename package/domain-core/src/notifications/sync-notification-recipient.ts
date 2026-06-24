import type { NotificationRecipient, NotificationRecipientProfile } from '../ports/notification-gateway'
import type { BaseSchoolService } from '../services/base-school-service'

export function scheduleNotificationRecipientUpsert(
  baseService: BaseSchoolService,
  profile: NotificationRecipientProfile | undefined,
): void {
  if (!profile?.recipient.subjectId) {
    return
  }
  void baseService.notificationGateway.upsertRecipient(profile)
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
