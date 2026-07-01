import type { AttendanceRecord, Guardian } from '../../../domain'
import type { WorkflowNotificationContext } from '../delivery/workflow-notification-runner'
import { AttendanceStatus, MessageDeliveryRecipientKind } from '../../../domain'
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
    if (!NOTIFY_STATUSES.has(record.status)) {
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

    const [student, session] = await Promise.all([
      context.repositories.students.findById(record.studentId),
      context.repositories.sessions.findById(record.sessionId),
    ])

    const classGroupName = await resolveClassGroupName(
      context.repositories,
      session?.classGroupId,
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
        sessionTitle: session?.title ?? record.sessionId,
        sessionDate: session
          ? formatNotificationDate(session.startsAt, timeZone)
          : formatNotificationDate(record.date, timeZone),
        sessionTime: session
          ? formatNotificationTime(session.startsAt, timeZone)
          : '',
        sessionTimeRange: session
          ? formatNotificationTimeRange(session.startsAt, session.endsAt, timeZone)
          : '',
        classGroupName,
      },
    })

    const idempotencyKeyPrefix = `${ATTENDANCE_RECORDED_EVENT_KEY}:${record.studentId}:${record.sessionId}:${record.status}`
    await deliverNotification(deps, {
      schoolId: payload.schoolId,
      kind: 'event',
      eventKey: ATTENDANCE_RECORDED_EVENT_KEY,
      idempotencyKeyPrefix,
      ...content,
      recipients: uniqueNotificationRecipients(recipients),
      metadata: {
        studentId: record.studentId,
        sessionId: record.sessionId,
        status: record.status,
      },
    })
  }
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
  if (guardian.contactMethods.length === 0) {
    return true
  }
  return guardian.contactMethods.some(method => method.allowsNotifications)
}
