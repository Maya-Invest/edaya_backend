import type { NotificationRecipient } from '@edaya/core'
import type { SchoolRepositories } from '@edaya/service'
import { MessageDeliveryRecipientKind } from '@edaya/core'

export async function resolveRecipientSubjectId(
  repositories: SchoolRepositories,
  recipient: Pick<NotificationRecipient, 'kind' | 'id'>,
): Promise<string | undefined> {
  switch (recipient.kind) {
    case MessageDeliveryRecipientKind.Staff: {
      const staff = await repositories.staffMembers.findById(recipient.id)
      return staff?.subjectId
    }
    case MessageDeliveryRecipientKind.Guardian: {
      const guardian = await repositories.guardians.findById(recipient.id)
      return guardian?.subjectId
    }
    case MessageDeliveryRecipientKind.Student: {
      const student = await repositories.students.findById(recipient.id)
      return student?.subjectId
    }
    case MessageDeliveryRecipientKind.Teacher: {
      const teacher = await repositories.teachers.findById(recipient.id)
      return teacher?.subjectId
    }
  }
}

export function uniqueNotificationRecipients(
  recipients: readonly NotificationRecipient[],
): NotificationRecipient[] {
  const seen = new Map<string, NotificationRecipient>()
  for (const recipient of recipients) {
    seen.set(`${recipient.kind}:${recipient.id}`, recipient)
  }
  return [...seen.values()]
}
