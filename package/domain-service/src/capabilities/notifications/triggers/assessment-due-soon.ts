import type { Assessment } from '@edaya/core'
import type { NotificationTriggerRegistration } from '../notification-trigger-registry'
import { AssessmentKind, MessageDeliveryRecipientKind, StudentClassEnrollmentStatus } from '@edaya/core'
import { cancelNotificationDeliveries } from '../delivery/deliver-notification'
import { formatNotificationDueLabel } from '../templates/format-notification-variables'
import { renderNotificationEnqueueContent } from '../templates/render-enqueue-content'
import {
  resolveClassGroupName,
  resolveSubjectNameFromClassSubject,
} from '../templates/resolve-notification-labels'
import { resolveSchoolContext } from '../templates/resolve-school-context'

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
  const wasHomeworkDue = existing?.kind === AssessmentKind.Homework && Boolean(existing.dueAt)
  const isHomeworkDue = entity.kind === AssessmentKind.Homework && Boolean(entity.dueAt)

  if (!wasHomeworkDue && !isHomeworkDue) {
    return false
  }

  if (entity.completedAt && !existing?.completedAt) {
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
    if (entity.kind !== AssessmentKind.Homework && existing?.kind !== AssessmentKind.Homework) {
      return null
    }
    const idempotencyKey = assessmentDueSoonIdempotencyKey(entity.id)
    const deps = {
      notificationGateway: context.notificationGateway,
      repositories: context.repositories,
    }

    const classGroup = await context.repositories.classGroups.findById(entity.classGroupId)
    if (!classGroup || classGroup.schoolId !== context.actor.schoolId) {
      return null
    }

    if (entity.kind !== AssessmentKind.Homework || entity.completedAt || !entity.dueAt) {
      await cancelNotificationDeliveries(deps, classGroup.schoolId, idempotencyKey)
      return null
    }

    const enrollments = await context.repositories.enrollments.list({
      classGroupId: entity.classGroupId,
      academicYearId: classGroup.academicYearId,
      status: StudentClassEnrollmentStatus.Active,
    })
    const recipients = enrollments.map(enrollment => ({
      kind: MessageDeliveryRecipientKind.Student,
      id: enrollment.studentId,
    }))

    if (existing?.dueAt?.getTime() === entity.dueAt.getTime()) {
      return null
    }

    if (recipients.length === 0) {
      return null
    }

    const { schoolName, timeZone } = await resolveSchoolContext(context.repositories, classGroup.schoolId)
    const [classGroupName, subjectName] = await Promise.all([
      resolveClassGroupName(context.repositories, entity.classGroupId),
      resolveSubjectNameFromClassSubject(context.repositories, entity.classSubjectId),
    ])
    const dueDateLabel = formatNotificationDueLabel(entity.dueAt, timeZone)
    const content = await renderNotificationEnqueueContent(context.templateService, {
      schoolId: classGroup.schoolId,
      templateKey: ASSESSMENT_DUE_SOON_EVENT_KEY,
      variables: {
        schoolName,
        assessmentTitle: entity.title,
        dueDate: dueDateLabel,
        dueDateLabel,
        classGroupName,
        subjectName,
      },
    })

    return {
      idempotencyKey,
      schoolId: classGroup.schoolId,
      kind: 'job',
      eventKey: ASSESSMENT_DUE_SOON_EVENT_KEY,
      ...content,
      recipients,
      deliverAfter: assessmentDueSoonDeliverAfter(entity.dueAt),
      metadata: {
        assessmentId: entity.id,
        classGroupId: entity.classGroupId,
      },
    }
  },
}
