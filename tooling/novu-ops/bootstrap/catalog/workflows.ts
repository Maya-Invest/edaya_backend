import {
  ACCOUNT_INVITATION_EVENT_KEY,
  ACTIVITY_REMINDER_EVENT_KEY,
  ANNOUNCEMENT_PUBLISHED_EVENT_KEY,
  ASSESSMENT_DUE_SOON_EVENT_KEY,
  ASSESSMENT_RESULT_RECORDED_EVENT_KEY,
  ATTENDANCE_RECORDED_EVENT_KEY,
  AUTH_EMAIL_VERIFICATION_EVENT_KEY,
  AUTH_OTP_EVENT_KEY,
  CALENDAR_EVENT_REMINDER_EVENT_KEY,
  INCIDENT_RECORDED_EVENT_KEY,
  REPORT_CARD_PUBLISHED_EVENT_KEY,
} from "@edaya/core";
import type { BootstrapEmailTemplates } from "../lib/load-templates";
import type { BootstrapWorkflowDefinition } from "../lib/types";
import { edayaAuthEmailStep, edayaEmailStep, edayaInAppStep, edayaInvitationEmailStep, edayaPushStep } from "../lib/templates";

const EDAYA_TAG = "edaya";

function standardNotificationWorkflow(
  templates: BootstrapEmailTemplates,
  workflowId: string,
  name: string,
  description: string,
): BootstrapWorkflowDefinition {
  return {
    workflowId,
    name,
    description,
    tags: [EDAYA_TAG, "notification"],
    steps: [edayaInAppStep(), edayaEmailStep(templates), edayaPushStep()],
  };
}

/** Declarative Novu workflows aligned with core `eventKey` trigger ids. */
export function buildBootstrapWorkflows(
  templates: BootstrapEmailTemplates,
): BootstrapWorkflowDefinition[] {
  return [
    standardNotificationWorkflow(
      templates,
      ANNOUNCEMENT_PUBLISHED_EVENT_KEY,
      "Announcement published",
      "School announcement delivered to guardians/staff in-app and email.",
    ),
    standardNotificationWorkflow(
      templates,
      REPORT_CARD_PUBLISHED_EVENT_KEY,
      "Report card published",
      "Guardian notification when a report card is published.",
    ),
    standardNotificationWorkflow(
      templates,
      ATTENDANCE_RECORDED_EVENT_KEY,
      "Attendance recorded",
      "Guardian notification for attendance events.",
    ),
    standardNotificationWorkflow(
      templates,
      ASSESSMENT_RESULT_RECORDED_EVENT_KEY,
      "Assessment result recorded",
      "Guardian notification when an assessment result is recorded.",
    ),
    standardNotificationWorkflow(
      templates,
      INCIDENT_RECORDED_EVENT_KEY,
      "Incident recorded",
      "Guardian notification when a student is involved in an incident.",
    ),
    standardNotificationWorkflow(
      templates,
      ASSESSMENT_DUE_SOON_EVENT_KEY,
      "Assessment due soon",
      "Reminder before an assessment due date.",
    ),
    standardNotificationWorkflow(
      templates,
      ACTIVITY_REMINDER_EVENT_KEY,
      "Activity reminder",
      "Reminder for extracurricular activities.",
    ),
    standardNotificationWorkflow(
      templates,
      CALENDAR_EVENT_REMINDER_EVENT_KEY,
      "Calendar event reminder",
      "Reminder for upcoming calendar events.",
    ),
    {
      workflowId: ACCOUNT_INVITATION_EVENT_KEY,
      name: "Account invitation",
      description: "Pre-account invite email for staff, guardians, and students.",
      tags: [EDAYA_TAG, "invitation"],
      steps: [edayaInvitationEmailStep(templates)],
    },
    {
      workflowId: AUTH_OTP_EVENT_KEY,
      name: "Auth OTP",
      description: "One-time codes for Better Auth sign-in and account verification.",
      tags: [EDAYA_TAG, "auth"],
      steps: [edayaAuthEmailStep(templates)],
    },
    {
      workflowId: AUTH_EMAIL_VERIFICATION_EVENT_KEY,
      name: "Auth email verification",
      description: "Email verification link for new EDAYA accounts.",
      tags: [EDAYA_TAG, "auth"],
      steps: [edayaAuthEmailStep(templates)],
    },
  ];
}
