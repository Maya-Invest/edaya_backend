import type { AttendanceRecord, Guardian } from '@edaya/core'
import type { WorkflowNotificationContext } from '../delivery/workflow-notification-runner'
import { AttendanceStatus, MessageDeliveryRecipientKind } from '@edaya/core'
import { deliverNotification } from '../delivery/deliver-notification'
import { uniqueNotificationRecipients } from '../delivery/recipient-utils'
import {
  formatNotificationDate,
  formatNotificationTime,
  formatNotificationTimeRange,
  formatPersonName,
  labelAttendanceStatus,
} from '../templates/format-notification-variables'
import { renderNotificationEnqueueContent } from '../templates/render-enqueue-content'
import { resolveClassGroupName } from '../templates/resolve-notification-labels'
import { resolveSchoolContext } from '../templates/resolve-school-context'

export const ATTENDANCE_RECORDED_EVENT_KEY = 'attendance.recorded'

const NOTIFY_STATUSES = new Set<AttendanceStatus>([
  AttendanceStatus.Absent,
  AttendanceStatus.Late,
])

export interface AttendanceRecordedPayload {
  records: AttendanceRecord[]
  schoolId: string
  correction?: boolean
}

export async function handleAttendanceRecorded(
  context: WorkflowNotificationContext,
  payload: AttendanceRecordedPayload,
): Promise<void> {
  if (payload.schoolId !== context.actor.schoolId) {
    return
  }

  const { schoolName, timeZone } = await resolveSchoolContext(context.repositories, payload.schoolId)
  const deps = {
    notificationGateway: context.notificationGateway,
    repositories: context.repositories,
  }

  for (const record of payload.records) {
    if (!payload.correction && !NOTIFY_STATUSES.has(record.status)) {
      continue
    }

    const recipients = await resolveAttendanceGuardianRecipients(
      context,
      record.studentId,
      payload.schoolId,
    )
    if (recipients.length === 0) {
      continue
    }

    const student = await context.repositories.students.findById(record.studentId)
    const occurrence = await resolveAttendanceOccurrence(context, record)
    const classGroupName = await resolveClassGroupName(
      context.repositories,
      occurrence?.classGroupId,
    )

    const content = await renderNotificationEnqueueContent(context.templateService, {
      schoolId: payload.schoolId,
      templateKey: ATTENDANCE_RECORDED_EVENT_KEY,
      variables: {
        schoolName,
        studentName: student
          ? formatPersonName(student.firstName, student.lastName)
          : record.studentId,
        status: record.status,
        statusLabel: labelAttendanceStatus(record.status),
        sessionTitle: occurrence?.title ?? record.anchorKey,
        sessionDate: occurrence
          ? formatNotificationDate(occurrence.startsAt, timeZone)
          : formatNotificationDate(record.date, timeZone),
        sessionTime: occurrence
          ? formatNotificationTime(occurrence.startsAt, timeZone)
          : '',
        sessionTimeRange: occurrence
          ? formatNotificationTimeRange(occurrence.startsAt, occurrence.endsAt, timeZone)
          : '',
        classGroupName,
      },
    })

    const idempotencyKeyPrefix = `${ATTENDANCE_RECORDED_EVENT_KEY}:${record.studentId}:${record.anchorKey}:${record.status}${payload.correction ? `:${record.updatedAt.toISOString()}` : ''}`
    await deliverNotification(deps, {
      schoolId: payload.schoolId,
      kind: 'event',
      eventKey: ATTENDANCE_RECORDED_EVENT_KEY,
      idempotencyKeyPrefix,
      ...content,
      recipients: uniqueNotificationRecipients(recipients),
      metadata: {
        studentId: record.studentId,
        anchorKey: record.anchorKey,
        status: record.status,
      },
    })
  }
}

async function resolveAttendanceOccurrence(
  context: WorkflowNotificationContext,
  record: AttendanceRecord,
): Promise<{ classGroupId?: string, title: string, startsAt: Date, endsAt: Date } | undefined> {
  if (record.attendanceId) {
    const attendance = await context.repositories.attendances.findById(record.attendanceId)
    if (!attendance) {
      return undefined
    }
    return {
      classGroupId: attendance.classGroupId,
      title: attendance.displayLabel,
      startsAt: attendance.startsAt,
      endsAt: attendance.endsAt,
    }
  }
  if (record.lessonSessionId) {
    const lessonSession = await context.repositories.lessonSessions.findById(record.lessonSessionId)
    if (!lessonSession) {
      return undefined
    }
    return {
      classGroupId: lessonSession.classGroupId,
      title: lessonSession.displayLabel,
      startsAt: lessonSession.startsAt,
      endsAt: lessonSession.endsAt,
    }
  }
  return undefined
}

async function resolveAttendanceGuardianRecipients(
  context: WorkflowNotificationContext,
  studentId: string,
  schoolId: string,
) {
  const links = await context.repositories.guardianLinks.list({ studentId })
  const recipients: Array<{ kind: MessageDeliveryRecipientKind, id: string }> = []

  for (const link of links) {
    if (!link.receivesAttendanceAlerts) {
      continue
    }
    const guardian = await context.repositories.guardians.findById(link.guardianId)
    if (!guardian || guardian.schoolId !== schoolId || !guardianAllowsNotifications(guardian)) {
      continue
    }
    recipients.push({
      kind: MessageDeliveryRecipientKind.Guardian,
      id: guardian.id,
    })
  }

  return recipients
}

function guardianAllowsNotifications(guardian: Guardian): boolean {
  return guardian.hasAccess
}
