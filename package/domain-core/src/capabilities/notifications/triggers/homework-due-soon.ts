import type { HomeworkAssignment } from '../../../domain'
import type { NotificationTriggerRegistration } from '../notification-trigger-registry'
import { resolveClassGroupStudentAndGuardianRecipients } from '../delivery/recipient-resolvers'
import { formatNotificationDueLabel } from '../templates/format-notification-variables'
import { renderNotificationEnqueueContent } from '../templates/render-enqueue-content'
import {
  resolveClassGroupName,
  resolveSubjectNameFromClassSubject,
} from '../templates/resolve-notification-labels'
import { resolveSchoolContext } from '../templates/resolve-school-context'

export const HOMEWORK_DUE_SOON_EVENT_KEY = 'homework.due_soon'
export const HOMEWORK_DUE_SOON_LEAD_DAYS = 3

export function homeworkDueSoonIdempotencyKey(homeworkId: string): string {
  return `${HOMEWORK_DUE_SOON_EVENT_KEY}:${homeworkId}`
}

export function homeworkDueSoonDeliverAfter(dueDate: Date): Date {
  const deliverAfter = new Date(dueDate)
  deliverAfter.setUTCDate(deliverAfter.getUTCDate() - HOMEWORK_DUE_SOON_LEAD_DAYS)
  return deliverAfter
}

export function homeworkDueSoonPredicate(
  entity: HomeworkAssignment,
  existing: HomeworkAssignment | undefined,
): boolean {
  if (!existing) {
    return true
  }
  return entity.dueDate.getTime() !== existing.dueDate.getTime()
}

export const homeworkDueSoonTrigger: NotificationTriggerRegistration<HomeworkAssignment> = {
  entityKey: 'homeworkAssignments',
  predicate: homeworkDueSoonPredicate,
  resolver: async (entity, existing, context) => {
    const idempotencyKey = homeworkDueSoonIdempotencyKey(entity.id)

    if (existing?.dueDate.getTime() === entity.dueDate.getTime()) {
      return null
    }

    if (entity.schoolId !== context.actor.schoolId) {
      return null
    }

    const recipients = await resolveClassGroupStudentAndGuardianRecipients(
      context.repositories,
      entity.schoolId,
      entity.classGroupId,
      link => link.receivesAcademicReports,
    )
    if (recipients.length === 0) {
      return null
    }

    const { schoolName, timeZone } = await resolveSchoolContext(context.repositories, entity.schoolId)
    const [classGroupName, subjectName] = await Promise.all([
      resolveClassGroupName(context.repositories, entity.classGroupId),
      resolveSubjectNameFromClassSubject(context.repositories, entity.classSubjectId),
    ])
    const dueDateLabel = formatNotificationDueLabel(entity.dueDate, timeZone)
    const content = await renderNotificationEnqueueContent(context.templateService, {
      schoolId: entity.schoolId,
      templateKey: HOMEWORK_DUE_SOON_EVENT_KEY,
      variables: {
        schoolName,
        homeworkTitle: entity.title,
        dueDate: dueDateLabel,
        dueDateLabel,
        classGroupName,
        subjectName,
      },
    })

    return {
      idempotencyKey,
      schoolId: entity.schoolId,
      kind: 'job',
      eventKey: HOMEWORK_DUE_SOON_EVENT_KEY,
      ...content,
      recipients,
      deliverAfter: homeworkDueSoonDeliverAfter(entity.dueDate),
      metadata: {
        homeworkAssignmentId: entity.id,
        classGroupId: entity.classGroupId,
      },
    }
  },
}
