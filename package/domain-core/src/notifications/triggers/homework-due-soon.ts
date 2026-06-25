import type { HomeworkAssignment } from '../../domains'
import type { NotificationTriggerRegistration } from '../notification-trigger-registry'
import { resolveClassGroupStudentAndGuardianRecipients } from '../recipient-resolvers'
import { renderNotificationEnqueueContent } from '../templates/render-enqueue-content'
import { resolveSchoolName } from '../templates/resolve-school-name'

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

    const schoolName = await resolveSchoolName(context.repositories, entity.schoolId)
    const content = await renderNotificationEnqueueContent(context.templateService, {
      schoolId: entity.schoolId,
      templateKey: HOMEWORK_DUE_SOON_EVENT_KEY,
      variables: {
        schoolName,
        homeworkTitle: entity.title,
        dueDate: entity.dueDate.toISOString().slice(0, 10),
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
