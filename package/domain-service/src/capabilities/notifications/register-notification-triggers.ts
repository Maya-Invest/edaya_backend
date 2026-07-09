import { notificationTriggerRegistry } from './notification-trigger-registry'
import { activityReminderTrigger } from './triggers/activity-reminder'
import { assessmentDueSoonTrigger } from './triggers/assessment-due-soon'
import { calendarEventReminderTrigger } from './triggers/calendar-event-reminder'

export function registerNotificationTriggers(): void {
  if (!notificationTriggerRegistry.hasTriggers('assessments')) {
    notificationTriggerRegistry.register(assessmentDueSoonTrigger)
  }
  if (!notificationTriggerRegistry.hasTriggers('activities')) {
    notificationTriggerRegistry.register(activityReminderTrigger)
  }
  if (!notificationTriggerRegistry.hasTriggers('calendarEvents')) {
    notificationTriggerRegistry.register(calendarEventReminderTrigger)
  }
}

registerNotificationTriggers()
