import { CronExpressionParser } from 'cron-parser'

const CRON_TIMEZONE = 'UTC'

/** Returns the next scheduled run strictly after `after`. */
export function computeNextRunAt(cronExpression: string, after: Date): Date {
  const interval = CronExpressionParser.parse(cronExpression, {
    currentDate: after,
    tz: CRON_TIMEZONE,
  })

  return interval.next().toDate()
}
