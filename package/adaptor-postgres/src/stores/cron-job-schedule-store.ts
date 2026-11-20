import type { CronJobKey, CronJobSchedule, CronJobSchedulePort, CronOccurrence } from '@edaya/service'
import { and, eq, lte, sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'
import * as schema from '../postgres-schema'
import { dueSchoolQuery } from './cron-due-schools'

type CronJobScheduleRow = typeof schema.cronJobSchedules.$inferSelect

function mapRow(row: CronJobScheduleRow): CronJobSchedule {
  return {
    id: row.id,
    jobKey: row.jobKey as CronJobKey,
    cronExpression: row.cronExpression,
    enabled: row.enabled,
    nextRunAt: row.nextRunAt,
    lastDispatchedAt: row.lastDispatchedAt ?? null,
  }
}

export class PostgresCronJobScheduleStore implements CronJobSchedulePort {
  constructor(private readonly db: any) {}

  private getClient(): any {
    return transactionContext.getStore() ?? this.db
  }

  async recoverDeliveries(): Promise<void> {
    if (transactionContext.getStore())
      throw new Error('Cron delivery recovery runs outside business transactions')
    await this.getClient().execute(sql`UPDATE command_outbox delivery SET status = 'failed',
      next_attempt_at = clock_timestamp(), failure_code = 'CRON_DELIVERY_UNCONFIRMED', updated_at = clock_timestamp()
      FROM command_outbox execution
      WHERE delivery.kind = 'cron.dispatch' AND execution.kind = 'cron.execute'
        AND delivery.resource_type = 'cron-occurrence' AND execution.resource_type = 'cron-occurrence'
        AND delivery.resource_id = execution.resource_id AND delivery.school_id = execution.school_id
        AND delivery.status = 'completed' AND delivery.updated_at <= clock_timestamp() - INTERVAL '60 seconds'
        AND ((execution.status IN ('pending', 'failed') AND (execution.next_attempt_at IS NULL OR execution.next_attempt_at <= clock_timestamp()))
          OR (execution.status = 'running' AND execution.lease_expires_at <= clock_timestamp()))`)
  }

  async findById(id: string): Promise<CronJobSchedule | null> {
    const rows = await this.getClient().select().from(schema.cronJobSchedules).where(eq(schema.cronJobSchedules.id, id)).limit(1) as CronJobScheduleRow[]
    return rows[0] ? mapRow(rows[0]) : null
  }

  async saveOccurrence(item: CronOccurrence): Promise<void> {
    if (!transactionContext.getStore())
      throw new Error('Cron occurrences require a business transaction')
    await this.getClient().execute(sql`INSERT INTO cron_occurrences
      (id, school_id, schedule_id, job_key, version, scheduled_for, as_of, request_id)
      VALUES (${item.id}, ${item.schoolId}, ${item.scheduleId}, ${item.jobKey}, ${item.version},
        ${item.scheduledFor.toISOString()}, ${item.asOf.toISOString()}, ${item.requestId})`)
  }

  async findOccurrence(id: string): Promise<CronOccurrence | null> {
    const result = await this.getClient().execute(sql`SELECT id, school_id AS "schoolId",
      schedule_id AS "scheduleId", job_key AS "jobKey", version, scheduled_for AS "scheduledFor",
      as_of AS "asOf", request_id AS "requestId" FROM cron_occurrences WHERE id = ${id}`)
    const row = (Array.isArray(result) ? result : result.rows)[0]
    return row ? { ...row, scheduledFor: new Date(row.scheduledFor), asOf: new Date(row.asOf) } : null
  }

  async listDue(asOf: Date): Promise<readonly CronJobSchedule[]> {
    const rows = await this.getClient()
      .select()
      .from(schema.cronJobSchedules)
      .where(and(
        eq(schema.cronJobSchedules.enabled, true),
        lte(schema.cronJobSchedules.nextRunAt, asOf),
      )) as CronJobScheduleRow[]

    return rows.map(mapRow)
  }

  async listDueSchoolIds(jobKey: CronJobKey, asOf: Date): Promise<readonly string[]> {
    const result = await this.getClient().execute(sql`SELECT id FROM schools WHERE id IN (${dueSchoolQuery(jobKey, asOf)}) ORDER BY id`)
    const rows: { id: string }[] = Array.isArray(result) ? result : result.rows
    return rows.map(row => row.id)
  }

  async advanceSchedule(
    id: string,
    input: { nextRunAt: Date, checkedAt: Date, createdOccurrences: boolean },
  ): Promise<void> {
    await this.getClient()
      .update(schema.cronJobSchedules)
      .set({
        nextRunAt: input.nextRunAt,
        lastDispatchedAt: input.createdOccurrences ? input.checkedAt : undefined,
        updatedAt: input.checkedAt,
      })
      .where(eq(schema.cronJobSchedules.id, id))
  }
}
