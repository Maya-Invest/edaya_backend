import type { CronJobKey, CronJobSchedule, CronJobSchedulePort } from '@edaya/school-service'
import { and, eq, lte } from 'drizzle-orm'
import * as schema from '../postgres-schema'

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
    return this.db
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

  async markDispatched(
    id: string,
    input: { nextRunAt: Date, dispatchedAt: Date },
  ): Promise<void> {
    await this.getClient()
      .update(schema.cronJobSchedules)
      .set({
        nextRunAt: input.nextRunAt,
        lastDispatchedAt: input.dispatchedAt,
        updatedAt: input.dispatchedAt,
      })
      .where(eq(schema.cronJobSchedules.id, id))
  }
}
