import type { Assessment } from '../../domains'
import type { NotificationTriggerRegistration } from '../notification-trigger-registry'
import { MessageDeliveryRecipientKind, StudentClassEnrollmentStatus } from '../../domains'

export const ASSESSMENT_DUE_SOON_EVENT_KEY = 'assessment.due_soon'
export const ASSESSMENT_DUE_SOON_LEAD_DAYS = 3

export function assessmentDueSoonIdempotencyKey(assessmentId: string): string {
  return `${ASSESSMENT_DUE_SOON_EVENT_KEY}:${assessmentId}`
}

export function assessmentDueSoonDeliverAfter(dueAt: Date): Date {
  const deliverAfter = new Date(dueAt)
  deliverAfter.setUTCDate(deliverAfter.getUTCDate() - ASSESSMENT_DUE_SOON_LEAD_DAYS)
  return deliverAfter
}

export function assessmentDueSoonPredicate(
  entity: Assessment,
  existing: Assessment | undefined,
): boolean {
  if (entity.metAt && !existing?.metAt) {
    return true
  }
  if (!entity.dueAt && existing?.dueAt) {
    return true
  }
  if (entity.dueAt && entity.dueAt.getTime() !== existing?.dueAt?.getTime()) {
    return true
  }
  if (!existing && entity.dueAt) {
    return true
  }
  return false
}

export const assessmentDueSoonTrigger: NotificationTriggerRegistration<Assessment> = {
  entityKey: 'assessments',
  predicate: assessmentDueSoonPredicate,
  resolver: async (entity, existing, context) => {
    const idempotencyKey = assessmentDueSoonIdempotencyKey(entity.id)

    if (entity.metAt || !entity.dueAt) {
      await context.notificationGateway.cancel(idempotencyKey)
      return null
    }

    if (existing?.dueAt?.getTime() === entity.dueAt.getTime()) {
      return null
    }

    const classGroup = await context.repositories.classGroups.findById(entity.classGroupId)
    if (!classGroup || classGroup.schoolId !== context.actor.schoolId) {
      return null
    }

    const enrollments = await context.repositories.enrollments.list({
      classGroupId: entity.classGroupId,
      status: StudentClassEnrollmentStatus.Active,
    })

    const recipients = enrollments.map(enrollment => ({
      kind: MessageDeliveryRecipientKind.Student,
      id: enrollment.studentId,
    }))

    if (recipients.length === 0) {
      return null
    }

    return {
      idempotencyKey,
      schoolId: classGroup.schoolId,
      kind: 'job',
      eventKey: ASSESSMENT_DUE_SOON_EVENT_KEY,
      title: `Assessment due soon: ${entity.title}`,
      body: `${entity.title} is due on ${entity.dueAt.toISOString().slice(0, 10)}.`,
      recipients,
      deliverAfter: assessmentDueSoonDeliverAfter(entity.dueAt),
      metadata: {
        assessmentId: entity.id,
        classGroupId: entity.classGroupId,
      },
    }
  },
}
