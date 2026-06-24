import type { NotificationRecipientProfile } from "@edaya/core";
import type {
  BulkUpdateSubscriberPreferencesDto,
  PatchPreferenceChannelsDto,
  PatchSubscriberPreferencesDto,
} from "@novu/api/models/components";

/** Novu workflow trigger ids aligned with core `eventKey` values. */
export const NOVU_NOTIFICATION_WORKFLOW_IDS = [
  "announcement.published",
  "report_card.published",
  "attendance.recorded",
  "assessment.result_recorded",
  "incident.recorded",
  "assessment.due_soon",
  "homework.due_soon",
  "activity.reminder",
  "calendar.event_reminder",
] as const;

function mapPreferenceChannels(
  profile: NotificationRecipientProfile,
): PatchPreferenceChannelsDto {
  const allowsNotifications = profile.preferences.allowsNotifications !== false;
  const channels = profile.preferences.channels ?? {};

  return {
    email: allowsNotifications && (channels.email ?? true),
    sms: allowsNotifications && (channels.sms ?? false),
    inApp: allowsNotifications && (channels.in_app ?? true),
    push: allowsNotifications && (channels.push ?? false),
  };
}

export function mapRecipientProfileToNovuGlobalPreferences(
  schoolId: string,
  profile: NotificationRecipientProfile,
): PatchSubscriberPreferencesDto {
  return {
    channels: mapPreferenceChannels(profile),
    context: { tenant: schoolId },
  };
}

export function mapRecipientProfileToNovuWorkflowPreferencesBulk(
  schoolId: string,
  profile: NotificationRecipientProfile,
): BulkUpdateSubscriberPreferencesDto {
  const channels = mapPreferenceChannels(profile);

  return {
    preferences: NOVU_NOTIFICATION_WORKFLOW_IDS.map(workflowId => ({
      workflowId,
      channels,
    })),
    context: { tenant: schoolId },
  };
}
