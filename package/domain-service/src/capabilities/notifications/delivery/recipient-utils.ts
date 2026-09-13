import type { NotificationRecipient } from '@edaya/core'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import { MessageDeliveryRecipientKind } from '@edaya/core'

export async function resolveRecipientSubjectId(
  repositories: SchoolRepositories,
  recipient: Pick<NotificationRecipient, 'kind' | 'id'>,
): Promise<string | undefined> {
  switch (recipient.kind) {
    case MessageDeliveryRecipientKind.Staff: {
      const staff = await repositories.staffMembers.findById(recipient.id)
      return staff?.isActive && staff.accountKind === 'human' ? staff.subjectId : undefined
    }
    case MessageDeliveryRecipientKind.Guardian: {
      const guardian = await repositories.guardians.findById(recipient.id)
      return guardian?.hasAccess ? guardian.subjectId : undefined
    }
    case MessageDeliveryRecipientKind.Student: {
      const student = await repositories.students.findById(recipient.id)
      return student?.status === 'active' ? student.subjectId : undefined
    }
    case MessageDeliveryRecipientKind.Teacher: {
      const teacher = await repositories.teachers.findById(recipient.id)
      return teacher?.isActive ? teacher.subjectId : undefined
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
