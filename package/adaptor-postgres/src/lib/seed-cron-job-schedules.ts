import { sql } from 'drizzle-orm'

const CRON_SCHEDULE_SEEDS = [
  { id: 'cron-schedule-private-file-cleanup', jobKey: 'preparePrivateFileCleanup', cronExpression: '*/15 * * * *' },
  {
    id: 'cron-schedule-expire-account-invitations',
    jobKey: 'expireAccountInvitations',
    cronExpression: '0 2 * * *',
  },
  {
    id: 'cron-schedule-process-due-notifications',
    jobKey: 'processDueNotifications',
    cronExpression: '0 6 * * *',
  },
  {
    id: 'cron-schedule-reconcile-pending-deliveries',
    jobKey: 'reconcilePendingDeliveries',
    cronExpression: '*/5 * * * *',
  },
] as const

export async function seedCronJobSchedules(
  db: { execute: (query: unknown) => Promise<unknown> },
): Promise<void> {
  for (const row of CRON_SCHEDULE_SEEDS) {
    await db.execute(sql`
      INSERT INTO cron_job_schedules (
        id,
        job_key,
        cron_expression,
        enabled,
        next_run_at,
        created_at,
        updated_at
      )
      VALUES (
        ${row.id},
        ${row.jobKey},
        ${row.cronExpression},
        true,
        TIMESTAMP '1970-01-01 00:00:00',
        NOW(),
        NOW()
      )
      ON CONFLICT (job_key) DO NOTHING
    `)
  }
}
