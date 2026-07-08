import type { CronJobResult, SchoolCronJobContext } from '../cron-job-context'
import { scanActivityReminders } from './scan-activity-reminders'
import { scanAssessmentDueNotifications } from './scan-assessment-due-notifications'
import { scanCalendarEventReminders } from './scan-calendar-event-reminders'

function sumCronJobResults(results: CronJobResult[]): CronJobResult {
  return results.reduce(
    (total, result) => ({
      processed: total.processed + result.processed,
      skipped: total.skipped + result.skipped,
    }),
    { processed: 0, skipped: 0 },
  )
}

export async function processDueNotifications(context: SchoolCronJobContext): Promise<CronJobResult> {
  const results = await Promise.all([
    scanAssessmentDueNotifications(context),
    scanActivityReminders(context),
    scanCalendarEventReminders(context),
  ])
  return sumCronJobResults(results)
}
