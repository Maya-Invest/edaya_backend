import type { MessageDeliveryStatus } from '@edaya/core'
import type { CronJobKey, CronJobSchedule, SchoolSchedulingPort, SchoolSignal } from '@edaya/service'
import type { SQL } from 'drizzle-orm'
import { computeNextRunAt } from '@edaya/service'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'
import { deliveryMismatches, schoolJobWindows } from './cron-due-schools'

interface Executor {
  execute: (query: SQL) => Promise<unknown>
}
export class SchoolSchedulerSignals implements SchoolSchedulingPort {
  constructor(private readonly db: Executor) {}

  private async rows<T>(query: SQL): Promise<T[]> {
    const result = await ((transactionContext.getStore() as Executor | undefined) ?? this.db).execute(query)
    return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[]
  }

  async rebuild() {
    await this.rows(sql`SELECT rebuild_scheduler_signals()`)
  }

  async pending() {
    return this.rows<{ ref: string }>(
      sql`SELECT ref FROM scheduler_signals WHERE published<revision ORDER BY changed_at,ref LIMIT 100`,
    )
  }

  async read(ref: string, lock = false) {
    return (
      await this.rows<SchoolSignal>(sql`SELECT ref,kind,source_id AS "sourceId",revision::float8 AS revision,
      (extract(epoch FROM last_slot)*1000)::float8 AS "lastSlot",
      floor(extract(epoch FROM changed_at)*1000)::float8 AS "changedAt" FROM scheduler_signals WHERE ref=${ref}
      ${lock ? sql`FOR UPDATE` : sql``}`)
    )[0]
  }

  async published(signal: SchoolSignal) {
    await this.rows(
      sql`UPDATE scheduler_signals SET published=${signal.revision} WHERE ref=${signal.ref} AND revision=${signal.revision} AND published<revision`,
    )
  }

  async advance(signal: SchoolSignal, now: number, ifUnchanged = false) {
    await this.rows(sql`UPDATE scheduler_signals SET revision=revision+1,last_slot=${new Date(now).toISOString()},
      changed_at=clock_timestamp() WHERE ref=${signal.ref} ${ifUnchanged ? sql`AND revision=${signal.revision}` : sql``}`)
  }

  async definitions(): Promise<(CronJobSchedule & { revision: number })[]> {
    const rows = await this.rows<
      CronJobSchedule & { revision: number }
    >(sql`SELECT revision::float8 AS revision,schedule_id AS id,kind AS "jobKey",expression AS "cronExpression",
      enabled,(extract(epoch FROM starts_at)*1000)::float8 AS "nextRunAt",NULL AS "lastDispatchedAt" FROM scheduler_schedule_changes`)
    return rows.map(row => ({ ...row, nextRunAt: new Date(row.nextRunAt) }))
  }

  async mismatches(school: string) {
    return this.rows<{
      id: string
      subjectId: string
      status: MessageDeliveryStatus
    }>(sql`SELECT id,subject_id AS "subjectId",status
      FROM (${deliveryMismatches}) d WHERE school_id=${school} ORDER BY id LIMIT 500`)
  }

  async readySources(at: Date) {
    const now = at.toISOString()
    return this.rows<{ kind: string, sourceId: string }>(sql`
      SELECT 'outbox' AS kind,id AS "sourceId" FROM command_outbox
      WHERE (status IN ('failed','pending') AND (next_attempt_at IS NULL OR next_attempt_at<=${now}))
         OR (status='running' AND lease_expires_at<=${now})
      UNION ALL SELECT 'notification',idempotency_key FROM notify.jobs
      WHERE job_kind IN ('school','invitation') AND status IN ('pending','failed','sending')
        AND (next_attempt_at IS NULL OR next_attempt_at<=${now}) AND (lease_expires_at IS NULL OR lease_expires_at<=${now})`)
  }

  async source(signal: SchoolSignal) {
    const id = signal.sourceId
    if (signal.kind === 'notification') {
      return (
        await this.rows<Source>(sql`SELECT 'notification.'||job_kind AS kind,status,attempts,
        CASE WHEN failure_reason IN ('SMS_DELIVERY_UNCERTAIN','SMS_REJECTED','NOTIFY_VERSION_UNSUPPORTED','NOTIFY_ATTEMPTS_EXHAUSTED')
          THEN failure_reason END AS "failureCode",
        (extract(epoch FROM greatest(next_attempt_at,lease_expires_at,created_at))*1000)::float8 AS due
        FROM notify.jobs WHERE idempotency_key=${id} AND job_kind IN ('school','invitation')`)
      )[0]
    }
    return (
      await this.rows<Source>(sql`SELECT kind,status,attempts,failure_code AS "failureCode",
      (extract(epoch FROM coalesce(CASE WHEN status='running' THEN lease_expires_at ELSE next_attempt_at END,created_at))*1000)::float8 AS due
      FROM command_outbox WHERE id=${id}`)
    )[0]
  }

  async replayDead(signal: SchoolSignal) {
    // Domain handlers keep the receipt, resource, and per-recipient delivery history.
    if (signal.kind === 'notification') {
      await this.rows(sql`UPDATE notify.jobs j SET status='pending', attempts=0, next_attempt_at=clock_timestamp()
        WHERE idempotency_key=${signal.sourceId} AND status='dead' AND payload_version=1
        AND NOT EXISTS (SELECT 1 FROM notify.job_recipients r WHERE r.idempotency_key=j.idempotency_key
          AND r.channel='sms' AND r.status IN ('sending','uncertain','rejected'))`)
    }
    else {
      await this.rows(sql`UPDATE command_outbox SET status='pending',attempts=0,next_attempt_at=clock_timestamp()
        WHERE id=${signal.sourceId} AND status='dead' AND version=1`)
    }
  }

  async eligible(signal: SchoolSignal, at: number) {
    const windows = schoolJobWindows(signal.kind as CronJobKey)
    const instant = new Date(at).toISOString()
    return (
      (
        await this.rows(sql`SELECT 1 FROM (${windows}) w WHERE school_id=${signal.sourceId} AND starts<=${instant}
      AND (ends IS NULL OR ends>=${instant}) LIMIT 1`)
      ).length > 0
    )
  }

  async deadline(
    signal: SchoolSignal,
    schedule: CronJobSchedule | undefined,
    now: number,
    previousDue?: number | null,
  ) {
    if (!schedule?.enabled)
      return null
    const floor = Math.max(
      Math.min(signal.changedAt, previousDue ?? signal.changedAt),
      schedule.nextRunAt.getTime(),
      (signal.lastSlot ?? 0) + 1,
    )
    const windows = await this.rows<{ start: number, end: number | null }>(sql`SELECT DISTINCT
      (extract(epoch FROM greatest(starts,${new Date(floor).toISOString()}::timestamptz))*1000)::float8 AS start,
      (extract(epoch FROM ends)*1000)::float8 AS "end" FROM (${schoolJobWindows(signal.kind as CronJobKey)}) w
      WHERE school_id=${signal.sourceId} AND starts IS NOT NULL AND (ends IS NULL OR ends>=${new Date(now).toISOString()}) ORDER BY start`)
    let earliest: number | null = null
    for (const window of windows) {
      if (earliest !== null && window.start > earliest)
        break
      const slot = computeNextRunAt(schedule.cronExpression, new Date(Math.ceil(window.start) - 1)).getTime()
      if (window.end === null || slot <= window.end)
        earliest = Math.min(earliest ?? slot, slot)
    }
    return earliest
  }
}
interface Source {
  failureCode: string | null
  kind: string
  status: string
  attempts: number
  due: number
}
