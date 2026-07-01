import { workflowNotificationRunner } from './delivery/workflow-notification-runner'
import {
  ANNOUNCEMENT_PUBLISHED_EVENT_KEY,
  handleAnnouncementPublished,
} from './handlers/announcement-published'
import {
  ASSESSMENT_RESULT_RECORDED_EVENT_KEY,
  handleAssessmentResultRecorded,
} from './handlers/assessment-result-recorded'
import {
  ATTENDANCE_RECORDED_EVENT_KEY,
  handleAttendanceRecorded,
} from './handlers/attendance-recorded'
import {
  handleIncidentRecorded,
  INCIDENT_RECORDED_EVENT_KEY,
} from './handlers/incident-recorded'
import {
  handleReportCardPublished,
  REPORT_CARD_PUBLISHED_EVENT_KEY,
} from './handlers/report-card-published'

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
  if (!workflowNotificationRunner.hasHandlers(ASSESSMENT_RESULT_RECORDED_EVENT_KEY)) {
    workflowNotificationRunner.register(ASSESSMENT_RESULT_RECORDED_EVENT_KEY, handleAssessmentResultRecorded)
  }
  if (!workflowNotificationRunner.hasHandlers(INCIDENT_RECORDED_EVENT_KEY)) {
    workflowNotificationRunner.register(INCIDENT_RECORDED_EVENT_KEY, handleIncidentRecorded)
  }
}

registerWorkflowNotificationHandlers()
