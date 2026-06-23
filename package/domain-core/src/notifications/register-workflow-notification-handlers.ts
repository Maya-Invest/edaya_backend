import {
  ANNOUNCEMENT_PUBLISHED_EVENT_KEY,
  handleAnnouncementPublished,
} from './handlers/announcement-published'
import {
  ATTENDANCE_RECORDED_EVENT_KEY,
  handleAttendanceRecorded,
} from './handlers/attendance-recorded'
import {
  handleReportCardPublished,
  REPORT_CARD_PUBLISHED_EVENT_KEY,
} from './handlers/report-card-published'
import { workflowNotificationRunner } from './workflow-notification-runner'

export function registerWorkflowNotificationHandlers(): void {
  if (!workflowNotificationRunner.hasHandlers(ANNOUNCEMENT_PUBLISHED_EVENT_KEY)) {
    workflowNotificationRunner.register(ANNOUNCEMENT_PUBLISHED_EVENT_KEY, handleAnnouncementPublished)
  }
  if (!workflowNotificationRunner.hasHandlers(REPORT_CARD_PUBLISHED_EVENT_KEY)) {
    workflowNotificationRunner.register(REPORT_CARD_PUBLISHED_EVENT_KEY, handleReportCardPublished)
  }
  if (!workflowNotificationRunner.hasHandlers(ATTENDANCE_RECORDED_EVENT_KEY)) {
    workflowNotificationRunner.register(ATTENDANCE_RECORDED_EVENT_KEY, handleAttendanceRecorded)
  }
}

registerWorkflowNotificationHandlers()
