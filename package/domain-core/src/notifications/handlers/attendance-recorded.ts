import type { AttendanceRecord, Guardian } from '../../domains'
import type { WorkflowNotificationContext } from '../workflow-notification-runner'
import { AttendanceStatus, MessageDeliveryRecipientKind } from '../../domains'
import { uniqueNotificationRecipients } from '../recipient-utils'

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

    await context.notificationGateway.enqueue({
      idempotencyKey: `${ATTENDANCE_RECORDED_EVENT_KEY}:${record.studentId}:${record.sessionId}:${record.status}`,
      schoolId: payload.schoolId,
      kind: 'event',
      eventKey: ATTENDANCE_RECORDED_EVENT_KEY,
      title: `Attendance update: ${record.status}`,
      body: `Attendance was recorded as ${record.status} for session ${record.sessionId}.`,
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
