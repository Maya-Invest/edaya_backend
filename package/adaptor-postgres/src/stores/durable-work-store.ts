import type { ClaimedDurableWork, DurableWorkPort, DurableWorkState } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'

interface WorkSqlExecutor { execute: (query: SQL) => Promise<unknown> }
export const DURABLE_WORK_MAX_ATTEMPTS = 8

function assertLease(leaseMs: number): void {
  if (!Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300000)
    throw new Error('Work lease must be between 1000 and 300000 milliseconds')
}

export class PostgresDurableWork implements DurableWorkPort {
  constructor(private readonly db: WorkSqlExecutor) {}

  private async query<T>(statement: SQL): Promise<T[]> {
    const executor = transactionContext.getStore() as WorkSqlExecutor | undefined ?? this.db
    const result = await executor.execute(statement)
    return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[]
  }

  async getState(id: string): Promise<DurableWorkState | null> {
    const rows = await this.query<{ status: DurableWorkState['status'], retryAt: string | null }>(sql`
      SELECT status, CASE WHEN status = 'running' THEN lease_expires_at ELSE next_attempt_at END AS "retryAt"
      FROM command_outbox WHERE id = ${id}`)
    return rows[0] ? { status: rows[0].status, retryAt: rows[0].retryAt ? new Date(rows[0].retryAt) : null } : null
  }

  async claim(input: { kinds: readonly string[], jobId?: string, limit: number, leaseMs: number }): Promise<ClaimedDurableWork[]> {
    if (transactionContext.getStore())
      throw new Error('Durable work must be dispatched outside business transactions')
    assertLease(input.leaseMs)
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100 || input.kinds.length > 100)
      throw new Error('Work claim batches must be bounded by 100')
    if (!input.kinds.length)
      return []
    if (input.kinds.some(kind => !kind || kind.length > 200))
      throw new Error('Work kinds must be non-empty and bounded')
    if (input.jobId !== undefined && (!input.jobId.trim() || input.jobId.length > 200))
      throw new Error('Work identifiers must be non-empty and bounded')
    const specificJob = input.jobId === undefined ? sql`TRUE` : sql`id = ${input.jobId}`
    const kinds = sql.join([...new Set(input.kinds)].map(kind => sql`${kind}`), sql`, `)
    // Also terminalize the last crashed attempt; no later caller may reset its budget.
    await this.query(sql`UPDATE command_outbox SET status = 'dead', lease_id = NULL,
      lease_expires_at = NULL, failure_code = 'WORK_ATTEMPTS_EXHAUSTED', updated_at = clock_timestamp()
      WHERE ${specificJob} AND kind IN (${kinds}) AND attempts >= ${DURABLE_WORK_MAX_ATTEMPTS}
        AND (status IN ('pending', 'failed') OR (status = 'running' AND lease_expires_at <= clock_timestamp()))`)
    const leaseId = crypto.randomUUID()
    return this.query<ClaimedDurableWork>(sql`
      WITH candidates AS (
        SELECT id FROM command_outbox WHERE ${specificJob} AND kind IN (${kinds}) AND attempts < ${DURABLE_WORK_MAX_ATTEMPTS}
          AND ((status IN ('pending', 'failed') AND (next_attempt_at IS NULL OR next_attempt_at <= clock_timestamp()))
            OR (status = 'running' AND lease_expires_at <= clock_timestamp()))
        ORDER BY created_at, id LIMIT ${input.limit} FOR UPDATE SKIP LOCKED
      )
      UPDATE command_outbox work SET status = 'running', lease_id = ${leaseId},
        lease_expires_at = clock_timestamp() + ${input.leaseMs} * INTERVAL '1 millisecond',
        attempts = work.attempts + 1, updated_at = clock_timestamp()
      FROM candidates WHERE work.id = candidates.id
      RETURNING work.id, work.receipt_id AS "receiptId", work.school_id AS "schoolId", work.kind,
        work.version, work.resource_type AS "resourceType", work.resource_id AS "resourceId",
        work.lease_id AS "leaseId", work.attempts`)
  }

  private currentLease(work: ClaimedDurableWork): SQL {
    return sql`id = ${work.id} AND school_id = ${work.schoolId} AND lease_id = ${work.leaseId}
      AND status = 'running' AND lease_expires_at > clock_timestamp()`
  }

  async complete(work: ClaimedDurableWork): Promise<boolean> {
    const rows = await this.query(sql`UPDATE command_outbox SET status = 'completed', lease_id = NULL,
      lease_expires_at = NULL, next_attempt_at = NULL, failure_code = NULL, updated_at = clock_timestamp()
      WHERE ${this.currentLease(work)} RETURNING id`)
    return rows.length === 1
  }

  async renew(work: ClaimedDurableWork, leaseMs: number): Promise<boolean> {
    assertLease(leaseMs)
    const rows = await this.query(sql`UPDATE command_outbox SET
      lease_expires_at = clock_timestamp() + ${leaseMs} * INTERVAL '1 millisecond', updated_at = clock_timestamp()
      WHERE ${this.currentLease(work)} RETURNING id`)
    return rows.length === 1
  }

  async fail(work: ClaimedDurableWork, failure: { code: string, permanent: boolean }): Promise<boolean> {
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(failure.code))
      throw new Error('Work failures require a stable code, not provider messages')
    const rows = await this.query(sql`UPDATE command_outbox SET
      status = CASE WHEN ${failure.permanent} OR attempts >= ${DURABLE_WORK_MAX_ATTEMPTS} THEN 'dead' ELSE 'failed' END,
      failure_code = ${failure.code}, lease_id = NULL, lease_expires_at = NULL,
      next_attempt_at = clock_timestamp() + LEAST(900, 5 * POWER(2, attempts - 1)) * INTERVAL '1 second',
      updated_at = clock_timestamp() WHERE ${this.currentLease(work)} RETURNING id`)
    return rows.length === 1
  }
}
