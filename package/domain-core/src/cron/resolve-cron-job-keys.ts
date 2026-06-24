import type { CronJobKey } from './cron-job-catalog'

/** Map Cloudflare cron expressions to job keys. Undefined runs all registered jobs. */
export function resolveCronJobKeys(cronExpression: string): readonly CronJobKey[] | undefined {
  switch (cronExpression) {
    case '0 6 * * *':
      return ['processDueNotifications']
    case '*/5 * * * *':
      return ['reconcilePendingDeliveries']
    default:
      return undefined
  }
}
