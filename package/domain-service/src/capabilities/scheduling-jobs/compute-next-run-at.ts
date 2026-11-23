import { CronExpressionParser } from 'cron-parser'

const CRON_TIMEZONE = 'UTC'

/** Operator schedules use deterministic, five-field UTC cron expressions. */
export function validateJobCron(value: string): string {
  const expression = value.trim().replace(/\s+/g, ' ')
  if (expression.split(' ').length !== 5 || !/^[a-z0-9*,/#? -]+$/i.test(expression) || /(?:^|[ ,])H(?:$|[ ,/(-])/i.test(expression))
    throw new Error('Expected a deterministic five-field UTC cron expression')
  computeNextRunAt(expression, new Date())
  return expression
}

/** Last UTC slot at or before the given instant, including an exact minute boundary. */
export function latestCronSlot(expression: string, at: number): number {
  return CronExpressionParser.parse(expression, { currentDate: new Date(at + 1), tz: CRON_TIMEZONE }).prev().getTime()
}

/** Returns the next scheduled run strictly after `after`. */
export function computeNextRunAt(cronExpression: string, after: Date): Date {
  const interval = CronExpressionParser.parse(cronExpression, {
    currentDate: after,
    tz: CRON_TIMEZONE,
  })

  return interval.next().toDate()
}
